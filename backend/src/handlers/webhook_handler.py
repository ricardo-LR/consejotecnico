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
import os
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

DYNAMODB_TABLE_USERS = os.environ.get("DYNAMODB_TABLE_USERS", "consejotecnico-users")

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
    resp = table.scan(FilterExpression=boto3.dynamodb.conditions.Attr("mpPreferenceId").eq(mp_preference_id))
    items = resp.get("Items", [])
    return items[0] if items else None


def _find_purchase_by_mp_payment_id(mp_payment_id: str) -> dict | None:
    """Scan purchases table for a record matching mpPaymentId."""
    table = _get_db().Table(DYNAMODB_TABLE_PURCHASES)
    resp = table.scan(FilterExpression=boto3.dynamodb.conditions.Attr("mpPaymentId").eq(mp_payment_id))
    items = resp.get("Items", [])
    return items[0] if items else None


def _upgrade_user_plan(email: str, plan_type: str) -> None:
    """Update plan_type in the users table when a payment is approved."""
    if not email or not plan_type:
        logger.warning("_upgrade_user_plan called with empty email=%s plan_type=%s", email, plan_type)
        return
    table = _get_db().Table(DYNAMODB_TABLE_USERS)
    now = datetime.now(timezone.utc).isoformat()
    try:
        table.update_item(
            Key={"email": email},
            UpdateExpression="SET plan_type = :p, updatedAt = :u",
            ExpressionAttributeValues={":p": plan_type, ":u": now},
        )
        logger.info("User %s upgraded to plan=%s", email, plan_type)
    except Exception as exc:
        logger.error("Failed to upgrade user %s plan: %s", email, exc)


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
    "pending": "PENDING",
    "in_process": "PENDING",
    "rejected": "FAILED",
    "cancelled": "CANCELLED",
    "refunded": "REFUNDED",
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

    logger.info("MP payment %s: status=%s, preference=%s", mp_payment_id, mp_status, mp_preference_id)

    our_status = STATUS_MAP.get(mp_status, "PENDING")

    # Find the matching purchase record
    purchase = _find_purchase_by_preference(mp_preference_id)
    if not purchase:
        # Fallback: try by mpPaymentId (for retried webhooks)
        purchase = _find_purchase_by_mp_payment_id(mp_payment_id)

    if not purchase:
        # Last resort: try to extract email/planType from external_reference (email|plan_type)
        ext_ref = payment.get("external_reference", "")
        if "|" in ext_ref and our_status == "COMPLETED":
            email_ref, plan_ref = ext_ref.split("|", 1)
            logger.info("No purchase record found — using external_reference email=%s plan=%s", email_ref, plan_ref)
            _upgrade_user_plan(email_ref.strip(), plan_ref.strip())
        else:
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

    # When approved, upgrade the user's plan
    if our_status == "COMPLETED":
        email = purchase.get("email", "")
        plan_type = purchase.get("planType", "")
        _upgrade_user_plan(email, plan_type)


# ──────────────────────────────────────────────
# Merchant order processing (IPN merchant_order topic)
# ──────────────────────────────────────────────


def _process_merchant_order(merchant_order_id: str) -> None:
    """Fetch merchant order from MP and process each associated payment."""
    mp = _get_mp()
    import urllib.request as _ureq

    access_token = MP_ACCESS_TOKEN
    url = f"https://api.mercadopago.com/merchant_orders/{merchant_order_id}"
    req = _ureq.Request(
        url,
        headers={"Authorization": f"Bearer {access_token}"},
        method="GET",
    )
    try:
        with _ureq.urlopen(req, timeout=10) as resp:
            order = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:
        logger.error("Failed to fetch merchant_order %s: %s", merchant_order_id, exc)
        return

    payments = order.get("payments", [])
    logger.info("Merchant order %s has %d payment(s)", merchant_order_id, len(payments))

    for pay in payments:
        pay_id = str(pay.get("id", ""))
        if pay_id:
            logger.info("Processing payment %s from merchant_order %s", pay_id, merchant_order_id)
            _process_payment_event(pay_id)


# ──────────────────────────────────────────────
# Lambda entry point
# ──────────────────────────────────────────────


def handler(event: dict, context) -> dict:
    """AWS Lambda handler for MercadoPago notifications.

    Handles two notification formats:
    1. Webhooks API (JSON body): {"action": "payment.updated", "data": {"id": "123"}}
    2. IPN via notification_url (query params): ?id=123&topic=payment|merchant_order
       IPN notifications skip signature validation (no x-signature header).
    """
    logger.info("Webhook raw event keys: %s", list(event.keys()))

    is_ipn = False  # track whether this is IPN (skips signature check)

    # ── Parse body (Webhooks API format) ──────────────
    try:
        raw_body = event.get("body") or "{}"
        body: dict = json.loads(raw_body) if isinstance(raw_body, str) else raw_body
    except (json.JSONDecodeError, TypeError):
        body = {}

    action = body.get("action", "")
    data = body.get("data", {})
    mp_payment_id = str(data.get("id", ""))
    ipn_topic = ""

    # ── IPN format (query params from notification_url) ──
    # MP sends: POST ?id=<id>&topic=payment|merchant_order
    if not mp_payment_id:
        qs = event.get("queryStringParameters") or {}
        ipn_id = str(qs.get("id", "") or qs.get("data.id", ""))
        ipn_topic = qs.get("topic", "") or qs.get("type", "")
        if ipn_id and ipn_topic in ("payment", "merchant_order"):
            mp_payment_id = ipn_id
            action = "payment.updated"
            is_ipn = True
            logger.info("IPN notification: id=%s topic=%s", ipn_id, ipn_topic)

    logger.info("Webhook received: action=%s, payment_id=%s is_ipn=%s", action, mp_payment_id, is_ipn)

    # Only process payment events
    if action not in ("payment.created", "payment.updated"):
        logger.info("Ignoring action: %s", action)
        return _ok("ignored")

    if not mp_payment_id:
        return _err("Missing data.id in webhook payload.", 400)

    # Signature validation — skip for IPN (no x-signature header in IPN)
    if not is_ipn and not _validate_signature(event, mp_payment_id):
        return _err("Invalid webhook signature.", 401)

    # For merchant_order IPN: fetch the order and process its payments
    if ipn_topic == "merchant_order":
        try:
            _process_merchant_order(mp_payment_id)
        except Exception as exc:
            logger.error("Error processing merchant_order %s: %s", mp_payment_id, exc)
            return _err("Internal server error.", 500)
        return _ok("processed")

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
