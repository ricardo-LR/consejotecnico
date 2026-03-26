"""
Standalone MercadoPago purchase handler.
Uses stdlib + boto3 (built into Lambda runtime) — no layer required.
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

SUCCESS_URL = "https://db0i745ypndsx.cloudfront.net/checkout/success"
FAILURE_URL = "https://db0i745ypndsx.cloudfront.net/checkout/failure"
PENDING_URL = "https://db0i745ypndsx.cloudfront.net/checkout/pending"

DYNAMODB_TABLE_PURCHASES = os.environ.get("DYNAMODB_TABLE_PURCHASES", "consejotecnico-purchases")
AWS_REGION               = os.environ.get("AWS_REGION", "us-east-1")

_db = None

def _get_db():
    global _db
    if _db is None:
        _db = boto3.resource("dynamodb", region_name=AWS_REGION)
    return _db

PRECIOS = {"grado": 499, "pro": 999}
NOMBRES = {
    "grado": "Plan Por Grado - ConsejotecnicoCMS",
    "pro":   "Plan Pro - ConsejotecnicoCMS",
}


def _ok(body: dict, status: int = 200) -> dict:
    return {"statusCode": status, "headers": CORS_HEADERS, "body": json.dumps(body)}


def _err(message: str, status: int = 400) -> dict:
    print(f"[PURCHASE] ERROR {status}: {message}")
    return {"statusCode": status, "headers": CORS_HEADERS, "body": json.dumps({"error": message})}


def handler(event, context):
    print(f"[PURCHASE] {event.get('httpMethod')} {event.get('path')}")

    # OPTIONS preflight
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 200, "headers": CORS_HEADERS, "body": ""}

    try:
        body = json.loads(event.get("body") or "{}")
    except (json.JSONDecodeError, TypeError):
        return _err("Body JSON inválido", 400)

    email     = body.get("email", "").strip()
    plan_type = body.get("plan_type", "grado").strip()

    print(f"[PURCHASE] email={email} plan={plan_type}")

    if not email:
        return _err("Se requiere email", 400)
    if plan_type not in PRECIOS:
        return _err(f"Plan desconocido: {plan_type}", 400)

    access_token = (
        os.environ.get("MERCADOPAGO_SANDBOX_ACCESS_TOKEN") or
        os.environ.get("MERCADOPAGO_ACCESS_TOKEN")
    )
    if not access_token:
        return _err("Token de Mercado Pago no configurado", 500)

    # Detect sandbox by token prefix — TEST- = sandbox, APP_USR- = production
    is_sandbox = access_token.startswith("TEST-")
    print(f"[PURCHASE] token prefix: {access_token[:15]}... sandbox={is_sandbox}")

    preference_data = {
        "items": [{
            "title":      NOMBRES[plan_type],
            "quantity":   1,
            "unit_price": PRECIOS[plan_type],
            "currency_id": "MXN",
        }],
        "payer": {"email": email},
        "back_urls": {
            "success": SUCCESS_URL,
            "failure": FAILURE_URL,
            "pending": PENDING_URL,
        },
        "external_reference": f"{email}|{plan_type}",
        "metadata": {"email": email, "plan_type": plan_type},
    }

    print(f"[PURCHASE] Creating MP preference...")
    req_data = json.dumps(preference_data).encode("utf-8")
    req = urllib.request.Request(
        "https://api.mercadopago.com/checkout/preferences",
        data=req_data,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as resp:
            result = json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body_err = e.read().decode("utf-8", errors="replace")
        print(f"[PURCHASE] MP HTTP error {e.code}: {body_err}")
        return _err(f"Mercado Pago error {e.code}: {body_err}", 502)
    except Exception as e:
        print(f"[PURCHASE] MP request exception: {e}")
        return _err(str(e), 502)

    pref_id     = result.get("id", "")
    sandbox_url = result.get("sandbox_init_point", "")
    live_url    = result.get("init_point", "")

    # REGLA DE ORO: TEST- token → sandbox_init_point, APP_USR- token → init_point
    # Nunca mezclar. Mezclar causa ERR_TOO_MANY_REDIRECTS.
    init_point = sandbox_url if is_sandbox else live_url

    print(f"[PURCHASE] pref_id={pref_id} is_sandbox={is_sandbox}")
    print(f"[PURCHASE] init_point={init_point[:70]}...")

    # Guardar registro en DynamoDB para que el webhook lo encuentre
    try:
        purchase_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        _get_db().Table(DYNAMODB_TABLE_PURCHASES).put_item(Item={
            "purchaseId":      purchase_id,
            "email":           email,
            "planType":        plan_type,
            "mpPreferenceId":  pref_id,
            "status":          "PENDING",
            "createdAt":       now,
            "updatedAt":       now,
        })
        print(f"[PURCHASE] Purchase record saved: {purchase_id}")
    except Exception as e:
        print(f"[PURCHASE] WARNING: DynamoDB save failed: {e}")
        # No es fatal — continuamos con la respuesta

    return _ok({
        "purchase_id":        pref_id,
        "init_point":         init_point,       # correcto según modo sandbox/prod
        "checkout_url":       init_point,       # alias para compatibilidad frontend
        "sandbox_init_point": sandbox_url,
        "is_sandbox":         is_sandbox,
        "plan_type":          plan_type,
        "status":             "PENDING",
    })
