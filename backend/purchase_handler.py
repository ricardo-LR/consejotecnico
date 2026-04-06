"""
Checkout handler para Mercado Pago (Checkout Bricks + Checkout API).
Soporta tarjeta (token), cuenta MP, OXXO, transferencia bancaria, etc.
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

PRECIOS = {
    "grado":         499,
    "pro_maestro":   999,
    "pro_directivo": 999,
    "pro":           999,   # alias legacy
}
NOMBRES = {
    "grado":         "Plan Por Grado - ConsejotecnicoCMS",
    "pro_maestro":   "Plan Pro Maestro - ConsejotecnicoCMS",
    "pro_directivo": "Plan Pro Directivo - ConsejotecnicoCMS",
    "pro":           "Plan Pro Maestro - ConsejotecnicoCMS",
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


def _upgrade_plan(email: str, plan_type: str, grado: str = "") -> None:
    try:
        now = datetime.now(timezone.utc).isoformat()
        update_expr = "SET plan_type = :p, updatedAt = :u"
        expr_values: dict = {":p": plan_type, ":u": now}
        if grado:
            update_expr += ", grado = :g"
            expr_values[":g"] = grado
        _get_db().Table(DYNAMODB_TABLE_USERS).update_item(
            Key={"email": email},
            UpdateExpression=update_expr,
            ExpressionAttributeValues=expr_values,
        )
        print(f"[PURCHASE] Plan actualizado: {email} -> {plan_type} (grado: {grado or 'N/A'})")
    except Exception as e:
        print(f"[PURCHASE] WARNING: DynamoDB plan update failed: {e}")


def _save_purchase(email: str, plan_type: str, payment_id: str, status: str, method: str = "", grado: str = "") -> None:
    try:
        now = datetime.now(timezone.utc).isoformat()
        item: dict = {
            "purchaseId":    str(uuid.uuid4()),
            "email":         email,
            "planType":      plan_type,
            "mpPaymentId":   str(payment_id),
            "status":        status.upper(),
            "paymentMethod": method,
            "createdAt":     now,
            "updatedAt":     now,
        }
        if grado:
            item["grado"] = grado
        _get_db().Table(DYNAMODB_TABLE_PURCHASES).put_item(Item=item)
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

    # ── Extraer campos comunes ────────────────────────────────────────────────
    token             = (body.get("token") or "").strip()
    payment_method_id = (body.get("payment_method_id") or "").strip()
    payment_method    = (body.get("payment_method") or "").strip()   # Bricks: 'creditCard', 'ticket', etc.
    issuer_id         = body.get("issuer_id")
    installments      = int(body.get("installments") or 1)
    description       = body.get("description") or ""
    payer             = body.get("payer") or {}
    plan_type         = (body.get("plan_type") or "grado").strip()

    grado = (body.get("grado") or "").strip()

    # email del usuario logueado (quién compra el plan) — nunca del payer
    email = (body.get("email") or "").strip()
    if not email:
        email = (payer.get("email") or "").strip()

    print(f"[PURCHASE] method={payment_method} token={'YES' if token else 'NO'} email={email} plan={plan_type}")

    if not email:
        return _err("Se requiere email del usuario", 400)
    if plan_type not in PRECIOS:
        return _err(f"Plan desconocido: {plan_type}", 400)

    # Precio siempre del servidor
    amount = float(PRECIOS[plan_type])
    if not description:
        description = NOMBRES[plan_type]

    access_token = (
        os.environ.get("MERCADOPAGO_SANDBOX_ACCESS_TOKEN") or
        os.environ.get("MERCADOPAGO_ACCESS_TOKEN")
    )
    if not access_token:
        return _err("Token de Mercado Pago no configurado", 500)

    print(f"[PURCHASE] MP token prefix: {access_token[:15]}... amount={amount}")

    # ── Construir payment_data ────────────────────────────────────────────────
    payment_data: dict = {
        "transaction_amount": amount,
        "description":        description,
        "payer":              payer,
        "external_reference": f"{email}|{plan_type}|{uuid.uuid4().hex[:8]}",
        "metadata":           {"email": email, "plan_type": plan_type},
        "notification_url":   WEBHOOK_URL,
    }

    if token:
        # Pago con tarjeta (Checkout API / Bricks tarjeta)
        payment_data["token"]             = token
        payment_data["payment_method_id"] = payment_method_id or "master"
        payment_data["installments"]      = installments
        if issuer_id:
            payment_data["issuer_id"] = int(issuer_id)

    elif payment_method_id:
        # Pago sin token: OXXO, transferencia, cuenta MP, etc.
        payment_data["payment_method_id"] = payment_method_id

        # Fecha de vencimiento para tickets (OXXO): 3 días
        if payment_method_id in ("oxxo", "paycash", "bancomer"):
            from datetime import timedelta
            expiry = datetime.now(timezone.utc) + timedelta(days=3)
            payment_data["date_of_expiration"] = expiry.strftime("%Y-%m-%dT%H:%M:%S.000-04:00")

    else:
        return _err("Se requiere token de tarjeta o método de pago", 400)

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

    mp_status  = result.get("status", "")
    detail     = result.get("status_detail", "")
    payment_id = result.get("id", "")

    print(f"[PURCHASE] Resultado: status={mp_status} detail={detail} id={payment_id}")

    _save_purchase(email, plan_type, payment_id, mp_status, payment_method or payment_method_id, grado)

    if mp_status == "approved":
        _upgrade_plan(email, plan_type, grado)

    message_text = (
        "¡Pago aprobado!" if mp_status == "approved"
        else f"Pago {mp_status}: {detail}"
    )

    # Para OXXO/ticket: incluir URL de pago al usuario
    extra = {}
    if mp_status in ("pending", "in_process"):
        ticket_url = result.get("transaction_details", {}).get("external_resource_url")
        if ticket_url:
            extra["ticket_url"] = ticket_url

    return _ok({
        "status":        mp_status,
        "status_detail": detail,
        "id":            payment_id,
        "message":       message_text,
        **extra,
    })
