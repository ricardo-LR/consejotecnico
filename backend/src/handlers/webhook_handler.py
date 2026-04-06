"""
Webhook handler — receive and process MercadoPago payment notifications.

Lambda entry point: handler(event, context)

IMPORTANT: Always returns HTTP 200 immediately.
MP marks any non-200 or slow response as an error and retries.

Handles two notification formats:
1. Webhooks API (JSON body): {"action": "payment.updated", "data": {"id": "123"}}
2. IPN via notification_url (query params): ?id=123&topic=payment|merchant_order
"""

import hmac
import hashlib
import json
import logging
import os
import urllib.request
import urllib.error
from datetime import datetime, timezone

import boto3
from botocore.exceptions import ClientError

from src.config.settings import (
    AWS_REGION,
    DYNAMODB_TABLE_PURCHASES,
    MP_ACCESS_TOKEN,
)

DYNAMODB_TABLE_USERS = os.environ.get("DYNAMODB_TABLE_USERS", "consejotecnico-users")

logger = logging.getLogger(__name__)
logger.setLevel(logging.INFO)

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
}

# ──────────────────────────────────────────────
# Lazy singletons
# ──────────────────────────────────────────────

_dynamodb = None


def _get_db():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return _dynamodb


# ──────────────────────────────────────────────
# DynamoDB helpers
# ──────────────────────────────────────────────


def _upgrade_user_plan(email: str, plan_type: str) -> None:
    if not email or not plan_type:
        logger.warning("_upgrade_user_plan: empty email=%s plan_type=%s", email, plan_type)
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
        logger.error("Failed to upgrade user %s: %s", email, exc)


def _find_purchase_by_mp_payment_id(mp_payment_id: str) -> dict | None:
    table = _get_db().Table(DYNAMODB_TABLE_PURCHASES)
    try:
        resp = table.scan(
            FilterExpression=boto3.dynamodb.conditions.Attr("mpPaymentId").eq(mp_payment_id)
        )
        items = resp.get("Items", [])
        return items[0] if items else None
    except Exception as exc:
        logger.error("DynamoDB scan error: %s", exc)
        return None


def _update_purchase_status(purchase_id: str, status: str, mp_payment_id: str = "") -> None:
    table = _get_db().Table(DYNAMODB_TABLE_PURCHASES)
    now = datetime.now(timezone.utc).isoformat()
    update_expr = "SET #st = :s, updatedAt = :u"
    expr_names = {"#st": "status"}
    expr_values: dict = {":s": status, ":u": now}
    if mp_payment_id:
        update_expr += ", mpPaymentId = :pid"
        expr_values[":pid"] = mp_payment_id
    try:
        table.update_item(
            Key={"purchaseId": purchase_id},
            UpdateExpression=update_expr,
            ExpressionAttributeNames=expr_names,
            ExpressionAttributeValues=expr_values,
        )
        logger.info("Purchase %s status -> %s", purchase_id, status)
    except Exception as exc:
        logger.error("Failed to update purchase %s: %s", purchase_id, exc)


# ──────────────────────────────────────────────
# MP API (urllib, no SDK dependency)
# ──────────────────────────────────────────────

STATUS_MAP = {
    "approved": "COMPLETED",
    "pending": "PENDING",
    "in_process": "PENDING",
    "rejected": "FAILED",
    "cancelled": "CANCELLED",
    "refunded": "REFUNDED",
    "charged_back": "REFUNDED",
}


def _fetch_payment(mp_payment_id: str) -> dict | None:
    access_token = (
        os.environ.get("MERCADOPAGO_SANDBOX_ACCESS_TOKEN")
        or os.environ.get("MERCADOPAGO_ACCESS_TOKEN")
        or MP_ACCESS_TOKEN
    )
    if not access_token:
        logger.error("No MP access token configured")
        return None

    url = f"https://api.mercadopago.com/v1/payments/{mp_payment_id}"
    req = urllib.request.Request(
        url,
        headers={"Authorization": f"Bearer {access_token}"},
        method="GET",
    )
    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            return json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        logger.error("MP API HTTP error %s for payment %s: %s", exc.code, mp_payment_id, exc.read())
        return None
    except Exception as exc:
        logger.error("MP API error for payment %s: %s", mp_payment_id, exc)
        return None


def _process_payment(mp_payment_id: str) -> None:
    """Fetch payment from MP and update DynamoDB."""
    payment = _fetch_payment(mp_payment_id)
    if not payment:
        logger.warning("Could not fetch payment %s from MP", mp_payment_id)
        return

    mp_status = payment.get("status", "")
    our_status = STATUS_MAP.get(mp_status, "PENDING")
    ext_ref = payment.get("external_reference", "")

    logger.info("Payment %s: status=%s ext_ref=%s", mp_payment_id, mp_status, ext_ref)

    # Try to find purchase record and update it
    purchase = _find_purchase_by_mp_payment_id(str(mp_payment_id))
    if purchase:
        _update_purchase_status(
            purchase_id=purchase["purchaseId"],
            status=our_status,
            mp_payment_id=str(mp_payment_id),
        )
        if our_status == "COMPLETED":
            email = purchase.get("email", "")
            plan_type = purchase.get("planType", "")
            _upgrade_user_plan(email, plan_type)
    elif our_status == "COMPLETED" and "|" in ext_ref:
        # Fallback: use external_reference = "email|plan_type|..."
        parts = ext_ref.split("|")
        if len(parts) >= 2:
            email_ref = parts[0].strip()
            plan_ref = parts[1].strip()
            logger.info("Fallback upgrade from ext_ref: email=%s plan=%s", email_ref, plan_ref)
            _upgrade_user_plan(email_ref, plan_ref)
    else:
        logger.warning("No purchase record for mp_payment_id=%s", mp_payment_id)


# ──────────────────────────────────────────────
# Signature validation
# ──────────────────────────────────────────────


def _validate_signature(event: dict) -> bool:
    """
    Validates the x-signature header from MercadoPago.
    Returns True if valid, or if no secret is configured (dev mode).
    MP signature format: x-signature: ts=<ts>,v1=<hmac>
    Message template: id:<data.id>;request-id:<x-request-id>;ts:<ts>;
    """
    secret = os.environ.get("MERCADOPAGO_WEBHOOK_SECRET", "")
    if not secret or secret == "tu_webhook_secret_aqui":
        logger.info("MP_WEBHOOK_SECRET not configured — skipping validation")
        return True

    try:
        headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
        x_signature  = headers.get("x-signature", "")
        x_request_id = headers.get("x-request-id", "")

        if not x_signature:
            logger.info("No x-signature header — accepting (may be manual test)")
            return True

        # Extract data.id from query params or body
        qs = event.get("queryStringParameters") or {}
        data_id = qs.get("data.id") or qs.get("id", "")
        if not data_id:
            try:
                body = json.loads(event.get("body") or "{}")
                data_id = str(body.get("data", {}).get("id", ""))
            except Exception:
                data_id = ""

        # Parse x-signature: "ts=1234,v1=abcd"
        parts = dict(p.split("=", 1) for p in x_signature.split(",") if "=" in p)
        ts = parts.get("ts", "")
        v1 = parts.get("v1", "")

        if not v1:
            logger.info("No v1 in x-signature — accepting")
            return True

        # Build message: "id:<data_id>;request-id:<x_request_id>;ts:<ts>;"
        manifest = f"id:{data_id};request-id:{x_request_id};ts:{ts};"
        expected = hmac.new(
            secret.encode("utf-8"),
            manifest.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        valid = hmac.compare_digest(expected, v1)
        logger.info("Signature validation: valid=%s manifest=%s", valid, manifest)
        return valid

    except Exception as exc:
        logger.error("Signature validation error: %s — accepting", exc)
        return True  # Never block on validation errors


# ──────────────────────────────────────────────
# Lambda entry point
# ──────────────────────────────────────────────


def handler(event: dict, context) -> dict:
    """
    Always returns 200 immediately.
    MP requires a 200 response within 5 seconds or it marks as error.
    """
    logger.info("Webhook received: %s", list(event.keys()))

    # Handle OPTIONS preflight
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    # Validate MP signature (always return 200 even if invalid — MP must not retry)
    if not _validate_signature(event):
        logger.warning("Invalid MP signature — ignoring notification")
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps({"status": "invalid_signature"})}

    try:
        # ── Parse body ─────────────────────────────────
        raw_body = event.get("body") or "{}"
        body: dict = json.loads(raw_body) if isinstance(raw_body, str) else (raw_body or {})
    except (json.JSONDecodeError, TypeError):
        body = {}

    qs = event.get("queryStringParameters") or {}

    # ── Extract payment ID and action ──────────────
    # Format 1: Webhooks API — {"action": "payment.updated", "data": {"id": "..."}}
    action = body.get("action", "")
    data = body.get("data", {})
    mp_payment_id = str(data.get("id", "")).strip()

    # Format 2: IPN via notification_url — ?id=...&topic=payment
    if not mp_payment_id:
        ipn_id = str(qs.get("id", "") or qs.get("data.id", "")).strip()
        ipn_topic = (qs.get("topic", "") or qs.get("type", "")).strip()
        if ipn_id and ipn_topic in ("payment", "merchant_order"):
            mp_payment_id = ipn_id
            action = "payment.updated"
            logger.info("IPN notification: id=%s topic=%s", ipn_id, ipn_topic)

    # Format 3: body with "type" instead of "action" (some MP sandbox notifications)
    if not action and body.get("type") in ("payment",):
        action = "payment.updated"

    logger.info("action=%s mp_payment_id=%s", action, mp_payment_id)

    # Always return 200 first, then process
    result_body = json.dumps({"status": "ok"})

    if not mp_payment_id:
        logger.info("No payment ID in notification — ignoring")
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps({"status": "ignored"})}

    if action not in ("payment.created", "payment.updated"):
        logger.info("Ignoring action: %s", action)
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": json.dumps({"status": "ignored"})}

    # Process payment (errors are logged but never propagate to HTTP response)
    try:
        _process_payment(mp_payment_id)
    except ClientError as exc:
        logger.error("DynamoDB error: %s", exc)
    except Exception as exc:
        logger.error("Unexpected error processing payment %s: %s", mp_payment_id, exc)

    return {"statusCode": 200, "headers": CORS_HEADERS, "body": result_body}
