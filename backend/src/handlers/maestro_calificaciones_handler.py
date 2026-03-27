"""
Maestro Calificaciones handler.

Routes:
  GET  /maestro/grupo/{grupoId}/calificaciones  - all grades for group
  POST /maestro/calificaciones                  - save/update a grade
"""

import json
import sys
import uuid
import boto3
from datetime import datetime, timezone
from decimal import Decimal

from src.config.settings import (
    AWS_REGION,
    DYNAMODB_TABLE_CALIFICACIONES,
    DYNAMODB_TABLE_GRUPOS,
    DYNAMODB_TABLE_EVALUACIONES,
)
from src.utils.maestro_auth import verify_maestro_token, unauthorized

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
}

_dynamodb = None


def _db():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return _dynamodb


def _ok(body, status=200):
    return {"statusCode": status, "headers": CORS_HEADERS, "body": json.dumps(body, ensure_ascii=False, default=str)}


def _err(msg, status=400):
    print(f"[CALIFICACIONES] ERROR {status}: {msg}", file=sys.stderr)
    return {"statusCode": status, "headers": CORS_HEADERS, "body": json.dumps({"error": msg}, ensure_ascii=False)}


def _parse_body(event):
    body = event.get("body") or "{}"
    return json.loads(body) if isinstance(body, str) else (body or {})


def _verify_grupo(email_maestro, grupo_id):
    resp = _db().Table(DYNAMODB_TABLE_GRUPOS).get_item(Key={"grupoId": grupo_id})
    item = resp.get("Item")
    return item is not None and item.get("email_maestro") == email_maestro


def list_calificaciones(email_maestro, grupo_id):
    if not _verify_grupo(email_maestro, grupo_id):
        return _err("Grupo no encontrado.", 404)
    table = _db().Table(DYNAMODB_TABLE_CALIFICACIONES)
    items = []
    kwargs = {
        "FilterExpression": "grupoId = :g",
        "ExpressionAttributeValues": {":g": grupo_id},
    }
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        if not resp.get("LastEvaluatedKey"):
            break
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
    return _ok({"items": items, "count": len(items)})


def save_calificacion(email_maestro, body):
    """Upsert a single grade: evaluacionId + alumnoId = composite key."""
    eval_id = (body.get("evaluacionId") or "").strip()
    alumno_id = (body.get("alumnoId") or "").strip()
    grupo_id = (body.get("grupoId") or "").strip()
    calificacion = body.get("calificacion")

    if not eval_id or not alumno_id or not grupo_id:
        return _err("evaluacionId, alumnoId y grupoId son obligatorios.", 400)

    if not _verify_grupo(email_maestro, grupo_id):
        return _err("Grupo no encontrado.", 404)

    # Use composite PK for upsert
    cal_id = f"{eval_id}#{alumno_id}"
    now = datetime.now(timezone.utc).isoformat()

    item = {
        "calificacionId": cal_id,
        "evaluacionId": eval_id,
        "alumnoId": alumno_id,
        "grupoId": grupo_id,
        "email_maestro": email_maestro,
        "calificacion": Decimal(str(calificacion)) if calificacion is not None else None,
        "observaciones": body.get("observaciones", ""),
        "updatedAt": now,
    }
    _db().Table(DYNAMODB_TABLE_CALIFICACIONES).put_item(Item=item)
    return _ok(item)


def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 204, "headers": CORS_HEADERS, "body": ""}

    payload = verify_maestro_token(event)
    if not payload:
        return unauthorized()

    email = payload["email"]
    method = event.get("httpMethod", "GET")
    path_params = event.get("pathParameters") or {}

    try:
        if method == "GET":
            grupo_id = path_params.get("grupoId") or path_params.get("id")
            if not grupo_id:
                return _err("grupoId requerido.", 400)
            return list_calificaciones(email, grupo_id)

        if method == "POST":
            body = _parse_body(event)
            return save_calificacion(email, body)

        return _err(f"Método {method} no soportado.", 405)

    except Exception as exc:
        print(f"[CALIFICACIONES] Unhandled: {exc}", file=sys.stderr)
        return _err(f"Error interno: {exc}", 500)
