"""
Admin change-plan handler — update a user's plan from the admin panel.

Lambda entry point: handler(event, context)

Expected headers:
  Authorization: Bearer <admin_jwt>

Expected event body (JSON):
  {
    "email":     "user@example.com",
    "plan_type": "gratuito" | "grado" | "pro",
    "grado":     "3"     // required when plan_type == "grado"
  }
"""

import json
import sys
import boto3
from datetime import datetime, timezone, timedelta
from botocore.exceptions import ClientError
from jose import JWTError, jwt

from src.config.settings import (
    AWS_REGION,
    DYNAMODB_TABLE_USERS,
    DYNAMODB_TABLE_PURCHASES,
    JWT_SECRET,
    JWT_ALGORITHM,
)

# ── Helpers ───────────────────────────────────────────────────────────────────

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
}

VALID_PLANS = {"gratuito", "grado", "pro"}

_dynamodb = None


def _get_db():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return _dynamodb


def _get_table():
    return _get_db().Table(DYNAMODB_TABLE_USERS)


def _list_purchases() -> list:
    table = _get_db().Table(DYNAMODB_TABLE_PURCHASES)
    items = []
    kwargs: dict = {}
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last
    return items


def _ok(body: dict, status: int = 200) -> dict:
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, ensure_ascii=False, default=str),
    }


def _err(message: str, status: int = 400) -> dict:
    print(f"[ADMIN_CHANGE_PLAN] ERROR {status}: {message}", file=sys.stderr)
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


def _verify_admin_token(event: dict) -> bool:
    """Return True if request carries a valid admin JWT."""
    auth = event.get("headers", {}).get("Authorization", "")
    if not auth.startswith("Bearer "):
        return False
    token = auth[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get("role") == "admin"
    except JWTError:
        return False


# ── Handler ───────────────────────────────────────────────────────────────────


def handler(event: dict, context) -> dict:
    """AWS Lambda handler."""
    http_method = event.get("httpMethod", "POST")

    # OPTIONS preflight
    if http_method == "OPTIONS":
        return {"statusCode": 204, "headers": CORS_HEADERS, "body": ""}

    if not _verify_admin_token(event):
        return _err("No autorizado.", 401)

    # GET /admin/purchases — list all purchases
    if http_method == "GET":
        try:
            items = _list_purchases()
            return _ok({"items": items, "count": len(items)})
        except ClientError as exc:
            return _err(f"Error al consultar compras: {exc}", 500)

    try:
        body = _parse_body(event)
    except (json.JSONDecodeError, TypeError):
        return _err("El cuerpo de la solicitud no es JSON válido.", 400)

    email = body.get("email", "").strip().lower()
    plan_type = body.get("plan_type", "").strip().lower()
    grado = body.get("grado", "").strip()

    if not email or not plan_type:
        return _err("Se requieren email y plan_type.", 400)

    if plan_type not in VALID_PLANS:
        return _err(f"plan_type debe ser uno de: {', '.join(VALID_PLANS)}.", 400)

    if plan_type == "grado" and not grado:
        return _err("Se requiere 'grado' cuando plan_type es 'grado'.", 400)

    table = _get_table()

    # Verify user exists
    try:
        resp = table.get_item(Key={"email": email})
    except ClientError as exc:
        return _err(f"Error al consultar usuario: {exc}", 500)

    if not resp.get("Item"):
        return _err(f"Usuario '{email}' no encontrado.", 404)

    now = datetime.now(timezone.utc).isoformat()

    # Build update expression
    update_expr = "SET plan_type = :pt, updatedAt = :ua"
    expr_values: dict = {":pt": plan_type, ":ua": now}

    if plan_type in ("grado", "pro"):
        expiration = (datetime.now(timezone.utc) + timedelta(days=365)).isoformat()
        update_expr += ", plan_expiration = :pe"
        expr_values[":pe"] = expiration
    else:
        # gratuito — remove expiration
        update_expr += " REMOVE plan_expiration"

    if plan_type == "grado":
        update_expr += ", grado = :gr"
        expr_values[":gr"] = grado
    else:
        update_expr += " REMOVE grado" if "REMOVE" not in update_expr else ", grado"

    # Simple approach: explicit conditional update
    update_kwargs = {
        "Key": {"email": email},
        "UpdateExpression": update_expr,
        "ExpressionAttributeValues": expr_values,
        "ReturnValues": "ALL_NEW",
    }

    try:
        result = table.update_item(**update_kwargs)
    except ClientError as exc:
        return _err(f"Error al actualizar usuario: {exc}", 500)

    updated = result.get("Attributes", {})
    print(f"[ADMIN_CHANGE_PLAN] Updated {email}: plan={plan_type} grado={grado}", file=sys.stderr)

    return _ok(
        {
            "message": f"Plan actualizado correctamente para {email}.",
            "email": email,
            "plan_type": plan_type,
            "grado": grado or None,
            "updatedAt": now,
        }
    )
