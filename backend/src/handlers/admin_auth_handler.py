"""
Admin auth handler — login for the admin panel.

Lambda entry point: handler(event, context)

Expected event body (JSON):
  { "email": "admin@consejotecnico.com", "password": "Admin123!" }
"""

import json
import sys
import boto3
from datetime import datetime, timedelta
from botocore.exceptions import ClientError
from jose import jwt, JWTError

from src.config.settings import JWT_SECRET, JWT_ALGORITHM, AWS_REGION, DYNAMODB_TABLE_USERS

# ── Hardcoded admin credentials ───────────────────────────────────────────────
ADMIN_EMAIL = "admin@consejotecnico.com"
ADMIN_PASSWORD = "Admin123!"
ADMIN_TOKEN_HOURS = 24

# ── Helpers ───────────────────────────────────────────────────────────────────

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
}


def _ok(body: dict, status: int = 200) -> dict:
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, ensure_ascii=False, default=str),
    }


def _err(message: str, status: int = 400) -> dict:
    print(f"[ADMIN_AUTH] ERROR {status}: {message}", file=sys.stderr)
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


_dynamodb = None


def _get_users_table():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return _dynamodb.Table(DYNAMODB_TABLE_USERS)


def _verify_admin_token(event: dict) -> bool:
    auth = event.get("headers", {}).get("Authorization", "")
    if not auth.startswith("Bearer "):
        return False
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("role") == "admin"
    except JWTError:
        return False


def _create_admin_token(email: str) -> str:
    payload = {
        "email": email,
        "role": "admin",
        "admin_id": "consejotecnico-admin",
        "exp": datetime.utcnow() + timedelta(hours=ADMIN_TOKEN_HOURS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def _list_users() -> list:
    table = _get_users_table()
    items = []
    kwargs: dict = {}
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last
    # Strip password hashes before returning
    for item in items:
        item.pop("password_hash", None)
    return items


# ── Handler ───────────────────────────────────────────────────────────────────


def handler(event: dict, context) -> dict:
    """AWS Lambda handler."""
    http_method = event.get("httpMethod", "POST")

    # Handle OPTIONS preflight
    if http_method == "OPTIONS":
        return {"statusCode": 204, "headers": CORS_HEADERS, "body": ""}

    # GET /admin/users — return user list
    if http_method == "GET":
        if not _verify_admin_token(event):
            return _err("No autorizado.", 401)
        try:
            email_filter = (event.get("queryStringParameters") or {}).get("email")
            if email_filter:
                table = _get_users_table()
                resp = table.get_item(Key={"email": email_filter.strip().lower()})
                item = resp.get("Item")
                if item:
                    item.pop("password_hash", None)
                return _ok({"item": item})
            users = _list_users()
            return _ok({"items": users, "count": len(users)})
        except ClientError as exc:
            return _err(f"Error al consultar usuarios: {exc}", 500)

    # POST /admin/auth — login
    try:
        body = _parse_body(event)
    except (json.JSONDecodeError, TypeError):
        return _err("El cuerpo de la solicitud no es JSON válido.", 400)

    email = body.get("email", "").strip().lower()
    password = body.get("password", "")

    if not email or not password:
        return _err("Se requieren email y password.", 400)

    if email != ADMIN_EMAIL or password != ADMIN_PASSWORD:
        return _err("Credenciales de administrador incorrectas.", 401)

    token = _create_admin_token(email)
    return _ok({"token": token, "email": email, "role": "admin"})
