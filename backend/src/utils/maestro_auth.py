"""
JWT verification for Maestro Workspace endpoints.
Extracts email and plan_type from the standard user JWT.
"""

from jose import JWTError, jwt
from src.config.settings import JWT_SECRET, JWT_ALGORITHM


def verify_maestro_token(event: dict) -> dict | None:
    """
    Verify user JWT from Authorization header.
    Returns payload dict with email, plan_type, nombre or None if invalid.
    """
    headers = event.get("headers") or {}
    # API Gateway may lowercase header names
    auth = headers.get("Authorization") or headers.get("authorization") or ""
    if not auth.startswith("Bearer "):
        return None
    token = auth[7:]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        if "email" not in payload:
            return None
        return payload
    except JWTError:
        return None


def unauthorized() -> dict:
    return {
        "statusCode": 401,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": '{"error": "No autorizado. Inicia sesión para continuar."}',
    }


def forbidden(message: str = "Acceso denegado.") -> dict:
    return {
        "statusCode": 403,
        "headers": {
            "Content-Type": "application/json",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Headers": "Content-Type,Authorization",
        },
        "body": f'{{"error": "{message}", "upgrade_required": true}}',
    }
