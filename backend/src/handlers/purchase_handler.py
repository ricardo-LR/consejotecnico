"""
Purchase handler — initiate a MercadoPago payment for a planeacion.

Lambda entry point: handler(event, context)

Expected event body (JSON):
  {
    "email":              "user@example.com",
    "planeacion_id":      "abc123",
    "plan_type":          "individual" | "pack_5" | "anual_grado" | "anual_total",
    "grado":              "3ro",          // required only for anual_grado
    "completeness_score": 0.8             // optional, default 1.0 (for individual pricing)
  }
"""

import json
import os
import uuid
import boto3
from datetime import datetime, timezone
from botocore.exceptions import ClientError

import mercadopago

from src.config.settings import (
    AWS_REGION,
    DYNAMODB_TABLE_USERS,
    DYNAMODB_TABLE_PURCHASES,
    MP_ACCESS_TOKEN,
    MP_SUCCESS_URL,
    MP_FAILURE_URL,
    MP_PENDING_URL,
    MP_WEBHOOK_URL,
    MP_SANDBOX_MODE,
)
from src.models.pricing import calculate_price, get_tier, validate_access

# ──────────────────────────────────────────────
# MercadoPago SDK init (lazy)
# ──────────────────────────────────────────────

_mp_sdk: mercadopago.SDK | None = None


def _get_mp() -> mercadopago.SDK:
    global _mp_sdk
    if _mp_sdk is None:
        if not MP_ACCESS_TOKEN:
            raise RuntimeError("MERCADOPAGO_SANDBOX_ACCESS_TOKEN no esta configurado.")
        _mp_sdk = mercadopago.SDK(MP_ACCESS_TOKEN)
    return _mp_sdk


# ──────────────────────────────────────────────
# DynamoDB helpers (lazy)
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

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
}


def _ok(body: dict, status: int = 200) -> dict:
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, ensure_ascii=False, default=str),
    }


def _err(message: str, status: int = 400) -> dict:
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
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
    # 1. Input validation
    if not email or not planeacion_id or not plan_type:
        return _err("Se requieren: email, planeacion_id y plan_type.", 400)

    tier = get_tier(plan_type)
    if tier is None:
        return _err(f"Plan desconocido: '{plan_type}'.", 400)

    # 2. Load user
    try:
        user = _get_user(email)
    except ClientError:
        return _err("Error al consultar el usuario.", 500)

    if not user:
        return _err("Usuario no encontrado.", 404)

    # 3. Access check (block repurchase of unlimited plans)
    user_plan = {
        "plan_type": user.get("plan_type", "gratis"),
        "downloads": user.get("downloads", 0),
        "grado": user.get("grado"),
        "active": user.get("active", True),
    }
    allowed, _ = validate_access(user_plan, planeacion_grado=grado or "")
    if allowed and tier.get("planeaciones") == -1:
        return _err(
            "Ya tienes acceso ilimitado con tu plan actual. No es necesario comprar.",
            409,
        )

    # 4. Calculate price
    price = calculate_price(plan_type, completeness_score)
    if price == 0:
        return _err("El plan gratuito no requiere pago.", 400)

    # 5. Build MercadoPago preference
    purchase_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    preference_data = {
        "items": [
            {
                "id": planeacion_id,
                "title": f"CONSEJOTECNICO - {tier['label']}",
                "description": tier["description"],
                "quantity": 1,
                "currency_id": "MXN",
                "unit_price": float(price),
            }
        ],
        "payer": {"email": email},
        "external_reference": purchase_id,
        "back_urls": {
            "success": MP_SUCCESS_URL,
            "failure": MP_FAILURE_URL,
            "pending": MP_PENDING_URL,
        },
        "auto_return": "approved",
        "statement_descriptor": "CONSEJOTECNICO",
        "binary_mode": False,  # allow pending payments
    }

    # Add webhook URL if configured
    if MP_WEBHOOK_URL:
        preference_data["notification_url"] = MP_WEBHOOK_URL

    try:
        mp = _get_mp()
        pref_response = mp.preference().create(preference_data)
    except RuntimeError as exc:
        return _err(str(exc), 500)
    except Exception as exc:
        return _err(f"Error al crear la preferencia de pago: {exc}", 502)

    if pref_response["status"] not in (200, 201):
        return _err(
            f"MercadoPago rechazo la solicitud: {pref_response.get('response', {})}",
            502,
        )

    preference = pref_response["response"]
    # In sandbox mode, prefer the sandbox URL
    checkout_url = (
        preference.get("sandbox_init_point", "")
        if MP_SANDBOX_MODE
        else preference.get("init_point", "")
    )

    # 6. Persist pending purchase record
    purchase_item = {
        "purchaseId": purchase_id,
        "email": email,
        "planeacionId": planeacion_id,
        "planType": plan_type,
        "grado": grado,
        "price": str(price),
        "currency": "MXN",
        "status": "PENDING",
        "mpPreferenceId": preference.get("id", ""),
        "sandboxMode": MP_SANDBOX_MODE,
        "createdAt": now,
        "updatedAt": now,
    }

    try:
        _save_purchase(purchase_item)
    except ClientError:
        # Non-fatal: MP preference created; user can still pay
        pass

    return _ok(
        {
            "purchase_id": purchase_id,
            "status": "PENDING",
            "checkout_url": checkout_url,
            "price": price,
            "currency": "MXN",
            "plan_type": plan_type,
            "mp_preference_id": preference.get("id", ""),
            "sandbox_mode": MP_SANDBOX_MODE,
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
        return _err("El cuerpo de la solicitud no es JSON valido.", 400)

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
