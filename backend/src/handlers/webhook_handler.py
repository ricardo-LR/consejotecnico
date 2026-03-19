"""
Webhook handler — receive and process MercadoPago payment notifications.

Lambda entry point: handler(event, context)

MercadoPago sends a POST request with:
  - Header x-signature: ts=<timestamp>,v1=<hmac_sha256_hex>
  - Header x-request-id: <uuid>
  - Body: { "action": "payment.created"|"payment.updated", "data": { "id": "<mp_payment_id>" } }

Signature validation (MP v2):
  signed_template = "id:<data.id>;request-id:<x-request-id>;ts:<ts>;"
  expected_hmac   = HMAC-SHA256(key=WEBHOOK_SECRET, msg=signed_template)
"""

import hashlib
import hmac
import json
import logging
import boto3
from datetime import datetime, timezone

import mercadopago
from botocore.exceptions import ClientError

from src.config.settings import (
    AWS_REGION,
    DYNAMODB_TABLE_PURCHASES,
    MP_ACCESS_TOKEN,
    MP_WEBHOOK_SECRET,
)

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

# ──────────────────────────────────────────────
# Lazy singletons
# ──────────────────────────────────────────────

_mp_sdk: mercadopago.SDK | None = None
_dynamodb = None


def _get_mp() -> mercadopago.SDK:
    global _mp_sdk
    if _mp_sdk is None:
        _mp_sdk = mercadopago.SDK(MP_ACCESS_TOKEN)
    return _mp_sdk


def _get_db():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return _dynamodb


# ──────────────────────────────────────────────
# Response helpers
# ──────────────────────────────────────────────

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
}


def _ok(msg: str = "OK") -> dict:
    return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps({"status": msg})}


def _err(msg: str, status: int = 400) -> dict:
    return {"statusCode": status, "headers": CORS_HEADERS, "body": json.dumps({"error": msg})}


# ──────────────────────────────────────────────
# Signature validation
# ──────────────────────────────────────────────

def _validate_signature(event: dict, payment_id: str) -> bool:
    """
    Validate MP webhook signature.
    If WEBHOOK_SECRET is not set, skip validation (useful during local dev).
    """
    if not MP_WEBHOOK_SECRET:
        logger.warning("MERCADOPAGO_WEBHOOK_SECRET not set — skipping signature check.")
        return True

    headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    x_signature = headers.get("x-signature", "")
    x_request_id = headers.get("x-request-id", "")

    # Parse ts and v1 from x-signature header
    ts = ""
    v1 = ""
    for part in x_signature.split(","):
        part = part.strip()
        if part.startswith("ts="):
            ts = part[3:]
        elif part.startswith("v1="):
            v1 = part[3:]

    if not ts or not v1:
        logger.error("x-signature header missing ts or v1: %s", x_signature)
        return False

    signed_template = f"id:{payment_id};request-id:{x_request_id};ts:{ts};"
    expected = hmac.new(
        MP_WEBHOOK_SECRET.encode("utf-8"),
        signed_template.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    if not hmac.compare_digest(expected, v1):
        logger.error("Signature mismatch. expected=%s got=%s", expected, v1)
        return False

    return True


# ──────────────────────────────────────────────
# DynamoDB helpers
# ──────────────────────────────────────────────

def _find_purchase_by_preference(mp_preference_id: str) -> dict | None:
    """Scan purchases table for a record matching mpPreferenceId."""
    table = _get_db().Table(DYNAMODB_TABLE_PURCHASES)
    resp = table.scan(
        FilterExpression=boto3.dynamodb.conditions.Attr("mpPreferenceId").eq(mp_preference_id)
    )
    items = resp.get("Items", [])
    return items[0] if items else None


def _find_purchase_by_mp_payment_id(mp_payment_id: str) -> dict | None:
    """Scan purchases table for a record matching mpPaymentId."""
    table = _get_db().Table(DYNAMODB_TABLE_PURCHASES)
    resp = table.scan(
        FilterExpression=boto3.dynamodb.conditions.Attr("mpPaymentId").eq(mp_payment_id)
    )
    items = resp.get("Items", [])
    return items[0] if items else None


def _update_purchase_status(
    purchase_id: str,
    status: str,
    mp_payment_id: str = "",
    reason: str = "",
) -> None:
    table = _get_db().Table(DYNAMODB_TABLE_PURCHASES)
    now = datetime.now(timezone.utc).isoformat()
    update_expr = "SET #st = :s, updatedAt = :u"
    expr_names = {"#st": "status"}
    expr_values: dict = {":s": status, ":u": now}

    if mp_payment_id:
        update_expr += ", mpPaymentId = :pid"
        expr_values[":pid"] = mp_payment_id

    if reason:
        update_expr += ", statusReason = :r"
        expr_values[":r"] = reason

    table.update_item(
        Key={"purchaseId": purchase_id},
        UpdateExpression=update_expr,
        ExpressionAttributeNames=expr_names,
        ExpressionAttributeValues=expr_values,
    )
    logger.info("Purchase %s updated to status=%s", purchase_id, status)


# ──────────────────────────────────────────────
# Payment event processing
# ──────────────────────────────────────────────

# Map MP payment status → our internal status
STATUS_MAP = {
    "approved": "COMPLETED",
    "pending":  "PENDING",
    "in_process": "PENDING",
    "rejected":  "FAILED",
    "cancelled": "CANCELLED",
    "refunded":  "REFUNDED",
    "charged_back": "REFUNDED",
}


def _process_payment_event(mp_payment_id: str) -> None:
    """Fetch payment details from MP and update the purchase record."""
    mp = _get_mp()
    payment_resp = mp.payment().get(mp_payment_id)

    if payment_resp["status"] != 200:
        logger.error("Failed to fetch MP payment %s: %s", mp_payment_id, payment_resp)
        return

    payment = payment_resp["response"]
    mp_status = payment.get("status", "")
    mp_preference_id = payment.get("preference_id", "")
    status_detail = payment.get("status_detail", "")

    logger.info(
        "MP payment %s: status=%s, preference=%s", mp_payment_id, mp_status, mp_preference_id
    )

    our_status = STATUS_MAP.get(mp_status, "PENDING")

    # Find the matching purchase record
    purchase = _find_purchase_by_preference(mp_preference_id)
    if not purchase:
        # Fallback: try by mpPaymentId (for retried webhooks)
        purchase = _find_purchase_by_mp_payment_id(mp_payment_id)

    if not purchase:
        logger.warning(
            "No purchase found for mp_preference_id=%s, mp_payment_id=%s",
            mp_preference_id,
            mp_payment_id,
        )
        return

    _update_purchase_status(
        purchase_id=purchase["purchaseId"],
        status=our_status,
        mp_payment_id=str(mp_payment_id),
        reason=status_detail,
    )


# ──────────────────────────────────────────────
# Lambda entry point
# ──────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """AWS Lambda handler for MercadoPago webhooks."""
    # Parse body
    try:
        raw_body = event.get("body") or "{}"
        body: dict = json.loads(raw_body) if isinstance(raw_body, str) else raw_body
    except (json.JSONDecodeError, TypeError):
        return _err("Invalid JSON body.", 400)

    action = body.get("action", "")
    data = body.get("data", {})
    mp_payment_id = str(data.get("id", ""))

    logger.info("Webhook received: action=%s, payment_id=%s", action, mp_payment_id)

    # Only process payment events
    if action not in ("payment.created", "payment.updated"):
        logger.info("Ignoring action: %s", action)
        return _ok("ignored")

    if not mp_payment_id:
        return _err("Missing data.id in webhook payload.", 400)

    # Validate signature
    if not _validate_signature(event, mp_payment_id):
        return _err("Invalid webhook signature.", 401)

    # Process the payment event
    try:
        _process_payment_event(mp_payment_id)
    except ClientError as exc:
        logger.error("DynamoDB error processing webhook: %s", exc)
        return _err("Database error.", 500)
    except Exception as exc:
        logger.error("Unexpected error processing webhook: %s", exc)
        return _err("Internal server error.", 500)

    return _ok("processed")
