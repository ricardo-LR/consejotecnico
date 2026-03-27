"""
Purchase handler — initiate a MercadoPago payment for a planeacion.

Lambda entry point: handler(event, context)

Expected event body (JSON):
  {
    "email":              "user@example.com",
    "planeacion_id":      "abc123",
    "plan_type":          "individual" | "grado" | "pro",
    "grado":              "3ro",          // required only for grado plan
    "completeness_score": 0.8             // optional, default 1.0 (for individual pricing)
  }
"""

import json
import os
import sys
import traceback
import uuid
import boto3
from datetime import datetime, timezone
from botocore.exceptions import ClientError

import mercadopago

from src.config.settings import (
    AWS_REGION,
    DYNAMODB_TABLE_USERS,
    DYNAMODB_TABLE_PURCHASES,
    DYNAMODB_TABLE_PLANEACIONES,
    MP_ACCESS_TOKEN,
    MP_SUCCESS_URL,
    MP_FAILURE_URL,
    MP_PENDING_URL,
    MP_WEBHOOK_URL,
    MP_SANDBOX_MODE,
)
from src.models.pricing import calculate_price, get_tier, validate_access

# ──────────────────────────────────────────────
# Logging helper
# ──────────────────────────────────────────────


def _log(msg: str) -> None:
    """Print to stderr so CloudWatch captures it regardless of stdout buffering."""
    print(f"[PURCHASE] {msg}", file=sys.stderr)


# ──────────────────────────────────────────────
# MercadoPago SDK init (lazy)
# ──────────────────────────────────────────────

_mp_sdk: mercadopago.SDK | None = None


def _get_mp() -> mercadopago.SDK:
    global _mp_sdk
    if _mp_sdk is None:
        if not MP_ACCESS_TOKEN:
            raise RuntimeError("MERCADOPAGO_SANDBOX_ACCESS_TOKEN no esta configurado.")
        _log(f"Initializing MP SDK (token prefix: {MP_ACCESS_TOKEN[:12]}...)")
        _mp_sdk = mercadopago.SDK(MP_ACCESS_TOKEN)
        _log("MP SDK initialized OK")
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


def _get_planeacion(planeacion_id: str) -> dict | None:
    table = _get_resource().Table(DYNAMODB_TABLE_PLANEACIONES)
    resp = table.get_item(Key={"planeacionId": planeacion_id})
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
    _log(f"ERROR {status}: {message}")
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
    Validate access, resolve price, create a MercadoPago preference (or grant
    a free download), persist a purchase record, and return the result.
    """
    _log(
        f"create_purchase called: email={email} plan={plan_type} planeacion={planeacion_id} grado={grado} score={completeness_score}"
    )

    # 1. Input validation
    is_subscription = plan_type in ("grado", "pro")
    if not email or not plan_type:
        return _err("Se requieren: email y plan_type.", 400)
    if not is_subscription and not planeacion_id:
        return _err("Se requiere planeacion_id para compras individuales.", 400)

    tier = get_tier(plan_type)
    if tier is None:
        return _err(f"Plan desconocido: '{plan_type}'.", 400)
    _log(f"Tier resolved: {tier}")

    # 2. Load user
    _log(f"Looking up user: {email}")
    try:
        user = _get_user(email)
    except ClientError as exc:
        _log(f"DynamoDB error fetching user: {exc}")
        return _err("Error al consultar el usuario.", 500)

    if not user:
        _log(f"User not found: {email}")
        return _err("Usuario no encontrado.", 404)
    _log(f"User found: plan_type={user.get('plan_type')} downloads={user.get('downloads')}")

    # 3. Access check (block repurchase of unlimited subscription plans)
    if is_subscription:
        current_plan = user.get("plan_type", "gratuito")
        _log(f"Subscription check: current={current_plan} requested={plan_type}")
        if current_plan == plan_type:
            return _err(
                "Ya tienes este plan activo. No es necesario comprarlo de nuevo.",
                409,
            )

    # 4. Resolve price
    planeacion = None
    if plan_type == "individual":
        _log(f"Fetching planeacion: {planeacion_id}")
        try:
            planeacion = _get_planeacion(planeacion_id)
        except ClientError as exc:
            _log(f"DynamoDB error fetching planeacion: {exc}")
            return _err("Error al consultar la planeacion.", 500)

        if not planeacion:
            _log(f"Planeacion not found: {planeacion_id}")
            return _err(f"Planeacion '{planeacion_id}' no encontrada.", 404)

        price = float(planeacion.get("price", 0))
        _log(f"Planeacion price from DB: {price} (titulo={planeacion.get('titulo')})")
    else:
        price = calculate_price(plan_type, completeness_score)
        _log(f"Fixed plan price: {price}")

    # 5. Free document — grant access directly without MercadoPago
    if price == 0 and plan_type == "individual":
        _log("Free document — granting access without MercadoPago")
        purchase_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        purchase_item = {
            "purchaseId": purchase_id,
            "email": email,
            "planeacionId": planeacion_id,
            "planType": plan_type,
            "price": "0",
            "currency": "MXN",
            "status": "COMPLETED",
            "statusReason": "free_document",
            "createdAt": now,
            "updatedAt": now,
        }
        try:
            _save_purchase(purchase_item)
            _log(f"Free purchase saved: {purchase_id}")
        except ClientError as exc:
            _log(f"Warning: could not save free purchase record: {exc}")

        return _ok(
            {
                "purchase_id": purchase_id,
                "status": "COMPLETED",
                "price": 0,
                "currency": "MXN",
                "plan_type": plan_type,
                "download_ready": True,
                "planeacion_id": planeacion_id,
            },
            status=200,
        )

    if price == 0:
        return _err("El plan gratuito no requiere pago.", 400)

    # 6. Build MercadoPago preference
    _log(f"Building MP preference: price={price} plan={plan_type} sandbox={MP_SANDBOX_MODE}")
    purchase_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()

    item_title = planeacion.get("titulo", tier["label"]) if planeacion else tier["label"]
    preference_data = {
        "items": [
            {
                "id": planeacion_id or plan_type,
                "title": f"CONSEJOTECNICO - {item_title}"[:255],
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
        "binary_mode": False,
    }

    if MP_WEBHOOK_URL:
        preference_data["notification_url"] = MP_WEBHOOK_URL
        _log(f"Webhook URL set: {MP_WEBHOOK_URL}")

    _log(f"Preference payload: {json.dumps(preference_data, default=str)}")

    try:
        mp = _get_mp()
        pref_response = mp.preference().create(preference_data)
        _log(
            f"MP response status: {pref_response.get('status')} response keys: {list(pref_response.get('response', {}).keys())}"
        )
    except RuntimeError as exc:
        _log(f"RuntimeError from MP: {exc}")
        return _err(str(exc), 500)
    except Exception as exc:
        _log(f"Exception creating MP preference: {exc}")
        traceback.print_exc(file=sys.stderr)
        return _err(f"Error al crear la preferencia de pago: {exc}", 502)

    if pref_response["status"] not in (200, 201):
        mp_error = pref_response.get("response", {})
        _log(f"MP rejected preference: status={pref_response['status']} body={mp_error}")
        return _err(
            f"MercadoPago rechazo la solicitud: {mp_error}",
            502,
        )

    preference = pref_response["response"]
    checkout_url = preference.get("sandbox_init_point", "") if MP_SANDBOX_MODE else preference.get("init_point", "")
    _log(f"MP preference created: id={preference.get('id')} url={checkout_url[:60]}...")

    # 7. Persist pending purchase record
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
        _log(f"Purchase record saved: {purchase_id}")
    except ClientError as exc:
        _log(f"Warning: could not save purchase record (non-fatal): {exc}")

    _log(f"Returning PENDING checkout: purchase_id={purchase_id}")
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
    _log(f"Handler invoked. RequestId={getattr(context, 'aws_request_id', 'local')}")
    _log(f"Event: {json.dumps(event, default=str)}")

    try:
        body = _parse_body(event)
    except (json.JSONDecodeError, TypeError) as exc:
        _log(f"Body parse error: {exc}")
        return _err("El cuerpo de la solicitud no es JSON valido.", 400)

    _log(f"Parsed body: {json.dumps(body, default=str)}")

    try:
        score = float(body.get("completeness_score", 1.0))
    except (ValueError, TypeError):
        score = 1.0

    try:
        result = create_purchase(
            email=body.get("email", ""),
            planeacion_id=body.get("planeacion_id", ""),
            plan_type=body.get("plan_type", ""),
            grado=body.get("grado"),
            completeness_score=score,
        )
        _log(f"Handler returning status={result.get('statusCode')}")
        return result
    except Exception as exc:
        _log(f"Unhandled exception in create_purchase: {exc}")
        traceback.print_exc(file=sys.stderr)
        return _err(f"Error interno: {exc}", 500)
