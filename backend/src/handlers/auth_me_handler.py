"""
auth_me_handler.py — GET /auth/me  →  return current user profile from JWT + DynamoDB.
"""

import json
import boto3
from botocore.exceptions import ClientError
from src.config.settings import AWS_REGION, DYNAMODB_TABLE_USERS
from src.utils.jwt_utils import verify_token

CORS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
}

_dynamodb = None


def _get_table():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return _dynamodb.Table(DYNAMODB_TABLE_USERS)


def _ok(body: dict, status: int = 200) -> dict:
    return {"statusCode": status, "headers": CORS, "body": json.dumps(body, ensure_ascii=False, default=str)}


def _err(msg: str, status: int = 400) -> dict:
    return {"statusCode": status, "headers": CORS, "body": json.dumps({"error": msg}, ensure_ascii=False)}


def handler(event: dict, context) -> dict:
    method = event.get("httpMethod", "GET")

    if method == "OPTIONS":
        return {"statusCode": 204, "headers": CORS, "body": ""}

    auth = (event.get("headers") or {}).get("Authorization", "")
    if not auth.startswith("Bearer "):
        return _err("No autorizado.", 401)

    payload = verify_token(auth[7:])
    if not payload:
        return _err("Token inválido o expirado.", 401)

    email = payload.get("email", "").strip().lower()
    if not email:
        return _err("Token sin email.", 401)

    try:
        resp = _get_table().get_item(Key={"email": email})
    except ClientError as exc:
        return _err(f"Error al consultar usuario: {exc}", 500)

    item = resp.get("Item")
    if not item:
        # Fallback: return data from JWT claims
        return _ok(
            {
                "email": email,
                "nombre": payload.get("nombre", ""),
                "plan_type": payload.get("plan_type", "gratuito"),
            }
        )

    item.pop("password_hash", None)
    return _ok(item)
