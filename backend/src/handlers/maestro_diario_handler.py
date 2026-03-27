"""
Maestro Diario handler — daily class diary (grado/pro plans only).

Routes:
  GET  /maestro/diario?grupoId=xxx  - list diary entries for group
  POST /maestro/diario              - create diary entry
  PUT  /maestro/diario/{diarioId}   - update diary entry
"""

import json
import sys
import uuid
import boto3
from datetime import datetime, timezone
from botocore.exceptions import ClientError

from src.config.settings import AWS_REGION, DYNAMODB_TABLE_DIARIO, DYNAMODB_TABLE_GRUPOS
from src.models.plan_validator import can_use_feature
from src.utils.maestro_auth import verify_maestro_token, unauthorized, forbidden

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,OPTIONS",
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
    print(f"[DIARIO] ERROR {status}: {msg}", file=sys.stderr)
    return {"statusCode": status, "headers": CORS_HEADERS, "body": json.dumps({"error": msg}, ensure_ascii=False)}


def _parse_body(event):
    body = event.get("body") or "{}"
    return json.loads(body) if isinstance(body, str) else (body or {})


def _verify_grupo(email_maestro, grupo_id):
    resp = _db().Table(DYNAMODB_TABLE_GRUPOS).get_item(Key={"grupoId": grupo_id})
    item = resp.get("Item")
    return item is not None and item.get("email_maestro") == email_maestro


def list_diario(email_maestro, grupo_id):
    if not _verify_grupo(email_maestro, grupo_id):
        return _err("Grupo no encontrado.", 404)
    table = _db().Table(DYNAMODB_TABLE_DIARIO)
    items = []
    kwargs = {
        "FilterExpression": "grupoId = :g AND email_maestro = :e",
        "ExpressionAttributeValues": {":g": grupo_id, ":e": email_maestro},
    }
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        if not resp.get("LastEvaluatedKey"):
            break
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
    items.sort(key=lambda x: x.get("fecha", ""), reverse=True)
    return _ok({"items": items, "count": len(items)})


def create_entry(email_maestro, body):
    grupo_id = (body.get("grupoId") or "").strip()
    fecha = (body.get("fecha") or "").strip()
    tema = (body.get("tema") or "").strip()
    actividad = (body.get("actividad") or "").strip()
    asistencia = int(body.get("asistencia", 0))
    observaciones = (body.get("observaciones") or "").strip()

    if not grupo_id or not fecha or not tema:
        return _err("grupoId, fecha y tema son obligatorios.", 400)
    if not _verify_grupo(email_maestro, grupo_id):
        return _err("Grupo no encontrado.", 404)

    diario_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "diarioId": diario_id,
        "grupoId": grupo_id,
        "email_maestro": email_maestro,
        "fecha": fecha,
        "tema": tema,
        "actividad": actividad,
        "asistencia": asistencia,
        "observaciones": observaciones,
        "createdAt": now,
        "updatedAt": now,
    }
    _db().Table(DYNAMODB_TABLE_DIARIO).put_item(Item=item)
    return _ok(item, 201)


def update_entry(email_maestro, diario_id, body):
    tema = (body.get("tema") or "").strip()
    actividad = (body.get("actividad") or "").strip()
    observaciones = (body.get("observaciones") or "").strip()
    asistencia = int(body.get("asistencia", 0))
    now = datetime.now(timezone.utc).isoformat()
    try:
        resp = (
            _db()
            .Table(DYNAMODB_TABLE_DIARIO)
            .update_item(
                Key={"diarioId": diario_id},
                UpdateExpression="SET tema = :t, actividad = :ac, observaciones = :o, asistencia = :as, updatedAt = :u",
                ConditionExpression="email_maestro = :e",
                ExpressionAttributeValues={
                    ":t": tema,
                    ":ac": actividad,
                    ":o": observaciones,
                    ":as": asistencia,
                    ":u": now,
                    ":e": email_maestro,
                },
                ReturnValues="ALL_NEW",
            )
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return _err("Entrada no encontrada.", 404)
        raise
    return _ok(resp.get("Attributes", {}))


def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 204, "headers": CORS_HEADERS, "body": ""}

    payload = verify_maestro_token(event)
    if not payload:
        return unauthorized()

    email = payload["email"]
    plan_type = payload.get("plan_type", "gratuito")
    method = event.get("httpMethod", "GET")
    path_params = event.get("pathParameters") or {}
    qs = event.get("queryStringParameters") or {}

    # Feature gate
    ok, msg = can_use_feature(plan_type, "diario")
    if not ok:
        return forbidden(msg)

    try:
        if method == "GET":
            grupo_id = qs.get("grupoId", "")
            if not grupo_id:
                return _err("grupoId requerido como query param.", 400)
            return list_diario(email, grupo_id)

        body = _parse_body(event)

        if method == "POST":
            return create_entry(email, body)

        diario_id = path_params.get("diarioId") or path_params.get("id")
        if method == "PUT" and diario_id:
            return update_entry(email, diario_id, body)

        return _err(f"Método {method} no soportado.", 405)

    except Exception as exc:
        print(f"[DIARIO] Unhandled: {exc}", file=sys.stderr)
        return _err(f"Error interno: {exc}", 500)
