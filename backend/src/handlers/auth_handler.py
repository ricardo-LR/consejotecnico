"""
Auth handler — login and register.

Lambda entry point: handler(event, context)

Expected event body (JSON):
  login:    { "action": "login",    "email": "...", "password": "..." }
  register: { "action": "register", "email": "...", "password": "...", "nombre": "..." }
"""

import json
import boto3
from datetime import datetime, timezone
from botocore.exceptions import ClientError
from passlib.hash import bcrypt

from src.config.settings import AWS_REGION, DYNAMODB_TABLE_USERS
from src.utils.jwt_utils import create_access_token
from src.utils.validators import validate_email, validate_password, validate_registration_input

# ──────────────────────────────────────────────
# DynamoDB client (lazy init for Lambda reuse)
# ──────────────────────────────────────────────

_dynamodb = None


def _get_table():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return _dynamodb.Table(DYNAMODB_TABLE_USERS)


# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def _ok(body: dict, status: int = 200) -> dict:
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def _err(message: str, status: int = 400, errors: list | None = None) -> dict:
    body = {"error": message}
    if errors:
        body["errors"] = errors
    return {
        "statusCode": status,
        "headers": {"Content-Type": "application/json"},
        "body": json.dumps(body, ensure_ascii=False),
    }


def _parse_body(event: dict) -> dict:
    body = event.get("body", "{}")
    if isinstance(body, str):
        return json.loads(body)
    return body or {}


# ──────────────────────────────────────────────
# Actions
# ──────────────────────────────────────────────

def login(email: str, password: str) -> dict:
    """
    Validate credentials and return a JWT token.
    Returns API Gateway response dict.
    """
    ok_email, msg = validate_email(email)
    if not ok_email:
        return _err(msg, 400)

    ok_pwd, msg = validate_password(password)
    if not ok_pwd:
        return _err(msg, 400)

    table = _get_table()
    try:
        resp = table.get_item(Key={"email": email.strip().lower()})
    except ClientError as exc:
        return _err("Error al consultar la base de datos.", 500)

    item = resp.get("Item")
    if not item:
        return _err("Credenciales incorrectas.", 401)

    if not bcrypt.verify(password, item.get("password_hash", "")):
        return _err("Credenciales incorrectas.", 401)

    token = create_access_token(
        email=item["email"],
        user_data={
            "nombre": item.get("nombre", ""),
            "plan_type": item.get("plan_type", "gratis"),
        },
    )
    return _ok(
        {
            "token": token,
            "email": item["email"],
            "nombre": item.get("nombre", ""),
            "plan_type": item.get("plan_type", "gratis"),
        }
    )


def register(email: str, password: str, nombre: str) -> dict:
    """
    Create a new user account and return a JWT token.
    Returns API Gateway response dict.
    """
    valid, errors = validate_registration_input(email, password, nombre)
    if not valid:
        return _err("Datos de registro inválidos.", 400, errors)

    email = email.strip().lower()
    nombre = nombre.strip()

    table = _get_table()

    # Check if user already exists
    try:
        resp = table.get_item(Key={"email": email})
    except ClientError:
        return _err("Error al consultar la base de datos.", 500)

    if resp.get("Item"):
        return _err("Ya existe una cuenta con ese correo electrónico.", 409)

    password_hash = bcrypt.hash(password)
    now = datetime.now(timezone.utc).isoformat()

    item = {
        "email": email,
        "nombre": nombre,
        "password_hash": password_hash,
        "plan_type": "gratis",
        "downloads": 0,
        "active": True,
        "createdAt": now,
        "updatedAt": now,
    }

    try:
        table.put_item(
            Item=item,
            ConditionExpression="attribute_not_exists(email)",
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return _err("Ya existe una cuenta con ese correo electrónico.", 409)
        return _err("Error al crear el usuario.", 500)

    token = create_access_token(
        email=email,
        user_data={"nombre": nombre, "plan_type": "gratis"},
    )
    return _ok(
        {"token": token, "email": email, "nombre": nombre, "plan_type": "gratis"},
        status=201,
    )


# ──────────────────────────────────────────────
# Lambda entry point
# ──────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """AWS Lambda handler."""
    try:
        body = _parse_body(event)
    except (json.JSONDecodeError, TypeError):
        return _err("El cuerpo de la solicitud no es JSON válido.", 400)

    action = body.get("action", "").lower()

    if action == "login":
        return login(
            email=body.get("email", ""),
            password=body.get("password", ""),
        )

    if action == "register":
        return register(
            email=body.get("email", ""),
            password=body.get("password", ""),
            nombre=body.get("nombre", ""),
        )

    return _err(f"Acción desconocida: '{action}'. Use 'login' o 'register'.", 400)
