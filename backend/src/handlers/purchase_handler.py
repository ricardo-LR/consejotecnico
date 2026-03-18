"""
Purchase handler — initiate a MercadoPago payment for a planeación.

Lambda entry point: handler(event, context)

Expected event body (JSON):
  {
    "email":         "user@example.com",
    "planeacion_id": "abc123",
    "plan_type":     "individual" | "pack_5" | "anual_grado" | "anual_total",
    "grado":         "3ro"   // required only for anual_grado
  }

The JWT bearer token must be present in the Authorization header (validated
upstream by API Gateway / a Lambda authorizer). The email in the body is
used for DynamoDB lookups; cross-check against the JWT claim if needed.
"""

import json
import os
import uuid
import boto3
from datetime import datetime, timezone
from botocore.exceptions import ClientError

import mercadopago  # pip install mercadopago

from src.config.settings import AWS_REGION, DYNAMODB_TABLE_USERS, DYNAMODB_TABLE_PURCHASES
from src.models.pricing import calculate_price, get_tier, validate_access

# ──────────────────────────────────────────────
# MercadoPago SDK init
# ──────────────────────────────────────────────

MP_ACCESS_TOKEN = os.getenv("MP_ACCESS_TOKEN", "")
_mp_sdk: mercadopago.SDK | None = None


def _get_mp() -> mercadopago.SDK:
    global _mp_sdk
    if _mp_sdk is None:
        if not MP_ACCESS_TOKEN:
            raise RuntimeError("MP_ACCESS_TOKEN no está configurado.")
        _mp_sdk = mercadopago.SDK(MP_ACCESS_TOKEN)
    return _mp_sdk


# ──────────────────────────────────────────────
# DynamoDB helpers
# ──────────────────────────────────────────────

_dynamodb = None


def _get_resource():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return _dynamodb


def _get_user(email: str) -> dict | None:
    table = _get_resource().Table(DYNAMODB_TABLE_USERS)
    resp = table.get_item(Key={"email": email})
    return resp.get("Item")


def _save_purchase(item: dict) -> None:
    table = _get_resource().Table(DYNAMODB_TABLE_PURCHASES)
    table.put_item(Item=item)


# ──────────────────────────────────────────────
# Response helpers
# ──────────────────────────────────────────────

def _ok(body: dict, status: int = 200) -> dict:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False, default=str),
    }


def _err(message: str, status: int = 400) -> dict:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps({"error": message}, ensure_ascii=False),
    }


def _parse_body(event: dict) -> dict:
    body = event.get("body", "{}")
    if isinstance(body, str):
        return json.loads(body)
    return body or {}


# ──────────────────────────────────────────────
# Main action
# ──────────────────────────────────────────────

def create_purchase(
    email: str,
    planeacion_id: str,
    plan_type: str,
    grado: str | None = None,
    completeness_score: float = 1.0,
) -> dict:
    """
    Validate access, calculate price, create a MercadoPago preference,
    persist a pending purchase record, and return the checkout URL.
    """
    # ── 1. Input validation ──────────────────
    if not email or not planeacion_id or not plan_type:
        return _err("Se requieren: email, planeacion_id y plan_type.", 400)

    tier = get_tier(plan_type)
    if tier is None:
        return _err(f"Plan desconocido: '{plan_type}'.", 400)

    # ── 2. Load user ─────────────────────────
    try:
        user = _get_user(email)
    except ClientError:
        return _err("Error al consultar el usuario.", 500)

    if not user:
        return _err("Usuario no encontrado.", 404)

    # ── 3. Access check ──────────────────────
    user_plan = {
        "plan_type": user.get("plan_type", "gratis"),
        "downloads": user.get("downloads", 0),
        "grado": user.get("grado"),
        "active": user.get("active", True),
    }
    allowed, reason = validate_access(user_plan, planeacion_grado=grado or "")
    # For purchases we allow even if the user has exhausted downloads — they are buying more
    # Only block if they are on a paid active plan that already grants unlimited access
    if allowed and tier.get("planeaciones") == -1:
        # They already have unlimited access — no need to purchase again
        return _err(
            "Ya tienes acceso ilimitado con tu plan actual. No es necesario comprar.",
            409,
        )

    # ── 4. Calculate price ───────────────────
    price = calculate_price(plan_type, completeness_score)
    if price == 0:
        return _err("El plan gratuito no requiere pago.", 400)

    # ── 5. Build MercadoPago preference ──────
    purchase_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    preference_data = {
        "items": [
            {
                "id": planeacion_id,
                "title": tier["label"],
                "description": tier["description"],
                "quantity": 1,
                "currency_id": "MXN",
                "unit_price": float(price),
            }
        ],
        "payer": {"email": email},
        "external_reference": purchase_id,
        "back_urls": {
            "success": os.getenv("MP_SUCCESS_URL", "https://consejotecnico.mx/pago/exito"),
            "failure": os.getenv("MP_FAILURE_URL", "https://consejotecnico.mx/pago/error"),
            "pending": os.getenv("MP_PENDING_URL", "https://consejotecnico.mx/pago/pendiente"),
        },
        "auto_return": "approved",
        "notification_url": os.getenv("MP_WEBHOOK_URL", ""),
        "statement_descriptor": "Consejo Tecnico",
    }

    try:
        mp = _get_mp()
        pref_response = mp.preference().create(preference_data)
    except RuntimeError as exc:
        return _err(str(exc), 500)
    except Exception:
        return _err("Error al crear la preferencia de pago.", 502)

    if pref_response["status"] not in (200, 201):
        return _err(
            f"MercadoPago rechazó la solicitud: {pref_response.get('response', {})}",
            502,
        )

    preference = pref_response["response"]
    checkout_url = preference.get("init_point", "")
    sandbox_url = preference.get("sandbox_init_point", "")

    # ── 6. Persist pending purchase ──────────
    purchase_item = {
        "purchaseId": purchase_id,
        "email": email,
        "planeacionId": planeacion_id,
        "planType": plan_type,
        "grado": grado,
        "price": str(price),        # DynamoDB-safe (Decimal alternative)
        "currency": "MXN",
        "status": "PENDING",
        "mpPreferenceId": preference.get("id", ""),
        "createdAt": now,
        "updatedAt": now,
    }

    try:
        _save_purchase(purchase_item)
    except ClientError:
        # Non-fatal: the MP preference was created; user can still pay
        pass

    return _ok(
        {
            "purchase_id": purchase_id,
            "checkout_url": checkout_url,
            "sandbox_url": sandbox_url,
            "price": price,
            "currency": "MXN",
            "plan_type": plan_type,
            "status": "PENDING",
        },
        status=201,
    )


# ──────────────────────────────────────────────
# Lambda entry point
# ──────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """AWS Lambda handler."""
    try:
        body = _parse_body(event)
    except (json.JSONDecodeError, TypeError):
        return _err("El cuerpo de la solicitud no es JSON válido.", 400)

    try:
        score = float(body.get("completeness_score", 1.0))
    except (ValueError, TypeError):
        score = 1.0

    return create_purchase(
        email=body.get("email", ""),
        planeacion_id=body.get("planeacion_id", ""),
        plan_type=body.get("plan_type", ""),
        grado=body.get("grado"),
        completeness_score=score,
    )
