"""
Checkout API handler para Mercado Pago.
Recibe card token del frontend, crea pago directo via POST /v1/payments.
Lambda handler: purchase_handler.handler
"""
import json
import os
import uuid
import urllib.request
import urllib.error
from datetime import datetime, timezone
import boto3

CORS_HEADERS = {
    "Access-Control-Allow-Origin": "https://db0i745ypndsx.cloudfront.net",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Content-Type": "application/json",
}

DYNAMODB_TABLE_USERS     = "consejotecnico-users"
DYNAMODB_TABLE_PURCHASES = os.environ.get("DYNAMODB_TABLE_PURCHASES", "consejotecnico-purchases")
AWS_REGION               = os.environ.get("AWS_REGION", "us-east-1")
WEBHOOK_URL              = "https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev/webhook/mercadopago"

PRECIOS = {"grado": 499, "pro": 999}
NOMBRES = {
    "grado": "Plan Por Grado - ConsejotecnicoCMS",
    "pro":   "Plan Pro - ConsejotecnicoCMS",
}

_db = None


def _get_db():
    global _db
    if _db is None:
        _db = boto3.resource("dynamodb", region_name=AWS_REGION)
    return _db


def _ok(body: dict, status: int = 200) -> dict:
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, ensure_ascii=False),
    }


def _err(message: str, status: int = 400) -> dict:
    print(f"[PURCHASE] ERROR {status}: {message}")
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps({"error": message}),
    }


def _upgrade_plan(email: str, plan_type: str) -> None:
    try:
        _get_db().Table(DYNAMODB_TABLE_USERS).update_item(
            Key={"email": email},
            UpdateExpression="SET plan_type = :p, updatedAt = :u",
            ExpressionAttributeValues={
                ":p": plan_type,
                ":u": datetime.now(timezone.utc).isoformat(),
            },
        )
        print(f"[PURCHASE] Plan actualizado: {email} -> {plan_type}")
    except Exception as e:
        print(f"[PURCHASE] WARNING: DynamoDB plan update failed: {e}")


def _save_purchase(email: str, plan_type: str, payment_id: str, status: str) -> None:
    try:
        now = datetime.now(timezone.utc).isoformat()
        _get_db().Table(DYNAMODB_TABLE_PURCHASES).put_item(Item={
            "purchaseId":  str(uuid.uuid4()),
            "email":       email,
            "planType":    plan_type,
            "mpPaymentId": str(payment_id),
            "status":      status.upper(),
            "createdAt":   now,
            "updatedAt":   now,
        })
    except Exception as e:
        print(f"[PURCHASE] WARNING: DynamoDB save failed: {e}")


def handler(event, context):
    print(f"[PURCHASE] {event.get('httpMethod')} {event.get('path')}")

    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
    except (json.JSONDecodeError, TypeError):
        return _err("Body JSON inválido", 400)

    token             = (body.get("token") or "").strip()
    payment_method_id = (body.get("payment_method_id") or "master").strip()
    issuer_id         = body.get("issuer_id")
    installments      = int(body.get("installments") or 1)
    description       = body.get("description") or "ConsejotecnicoCMS"
    payer             = body.get("payer") or {}
    plan_type         = (body.get("plan_type") or "grado").strip()
    email             = (body.get("email") or payer.get("email") or "").strip()

    print(f"[PURCHASE] token={token[:10]}... email={email} plan={plan_type}")

    if not token:
        return _err("Se requiere token de tarjeta", 400)
    if not email:
        return _err("Se requiere email", 400)
    if plan_type not in PRECIOS:
        return _err(f"Plan desconocido: {plan_type}", 400)

    # Precio siempre del servidor — nunca confiar en el cliente
    amount = float(PRECIOS[plan_type])
    if not description or description == "ConsejotecnicoCMS":
        description = NOMBRES[plan_type]

    access_token = (
        os.environ.get("MERCADOPAGO_SANDBOX_ACCESS_TOKEN") or
        os.environ.get("MERCADOPAGO_ACCESS_TOKEN")
    )
    if not access_token:
        return _err("Token de Mercado Pago no configurado", 500)

    print(f"[PURCHASE] MP token prefix: {access_token[:15]}... amount={amount}")

    payment_data = {
        "token":              token,
        "payment_method_id":  payment_method_id,
        "transaction_amount": amount,
        "installments":       installments,
        "description":        description,
        "payer":              payer,
        "external_reference": f"{email}|{plan_type}|{uuid.uuid4().hex[:8]}",
        "metadata":           {"email": email, "plan_type": plan_type},
        "notification_url":   WEBHOOK_URL,
    }
    if issuer_id:
        payment_data["issuer_id"] = int(issuer_id)

    print(f"[PURCHASE] Creando pago MP: {json.dumps(payment_data)}")

    req = urllib.request.Request(
        "https://api.mercadopago.com/v1/payments",
        data=json.dumps(payment_data).encode("utf-8"),
        headers={
            "Authorization":     f"Bearer {access_token}",
            "Content-Type":      "application/json",
            "X-Idempotency-Key": uuid.uuid4().hex,
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=15) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body_err = e.read().decode("utf-8", errors="replace")
        print(f"[PURCHASE] MP HTTP error {e.code}: {body_err}")
        return _err(f"Error Mercado Pago {e.code}: {body_err}", 502)
    except Exception as e:
        print(f"[PURCHASE] MP request exception: {e}")
        return _err(str(e), 502)

    mp_status = result.get("status", "")
    detail    = result.get("status_detail", "")
    payment_id = result.get("id", "")

    print(f"[PURCHASE] Resultado: status={mp_status} detail={detail} id={payment_id}")

    _save_purchase(email, plan_type, payment_id, mp_status)

    if mp_status == "approved":
        _upgrade_plan(email, plan_type)

    message = (
        "¡Pago aprobado!" if mp_status == "approved"
        else f"Pago {mp_status}: {detail}"
    )

    return _ok({
        "status":        mp_status,
        "status_detail": detail,
        "id":            payment_id,
        "message":       message,
    })
