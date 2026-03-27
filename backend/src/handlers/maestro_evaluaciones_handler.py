"""
Maestro Evaluaciones handler.

Routes:
  GET    /maestro/grupo/{grupoId}/evaluaciones  - list evaluations for group
  POST   /maestro/evaluaciones                  - create evaluation (plan limit enforced)
  DELETE /maestro/evaluaciones/{evalId}         - delete evaluation
"""

import json
import sys
import uuid
import boto3
from datetime import datetime, timezone
from botocore.exceptions import ClientError

from src.config.settings import AWS_REGION, DYNAMODB_TABLE_EVALUACIONES, DYNAMODB_TABLE_GRUPOS
from src.models.plan_validator import can_create_evaluacion
from src.utils.maestro_auth import verify_maestro_token, unauthorized, forbidden

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,DELETE,OPTIONS",
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
    print(f"[EVALUACIONES] ERROR {status}: {msg}", file=sys.stderr)
    return {"statusCode": status, "headers": CORS_HEADERS, "body": json.dumps({"error": msg}, ensure_ascii=False)}


def _parse_body(event):
    body = event.get("body") or "{}"
    return json.loads(body) if isinstance(body, str) else (body or {})


def _verify_grupo(email_maestro, grupo_id):
    resp = _db().Table(DYNAMODB_TABLE_GRUPOS).get_item(Key={"grupoId": grupo_id})
    item = resp.get("Item")
    return item is not None and item.get("email_maestro") == email_maestro


def _count_evaluaciones(grupo_id):
    resp = (
        _db()
        .Table(DYNAMODB_TABLE_EVALUACIONES)
        .scan(
            FilterExpression="grupoId = :g AND activo = :a",
            ExpressionAttributeValues={":g": grupo_id, ":a": True},
            Select="COUNT",
        )
    )
    return resp.get("Count", 0)


def list_evaluaciones(email_maestro, grupo_id):
    if not _verify_grupo(email_maestro, grupo_id):
        return _err("Grupo no encontrado.", 404)
    table = _db().Table(DYNAMODB_TABLE_EVALUACIONES)
    items = []
    kwargs = {
        "FilterExpression": "grupoId = :g AND activo = :a",
        "ExpressionAttributeValues": {":g": grupo_id, ":a": True},
    }
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        if not resp.get("LastEvaluatedKey"):
            break
        kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]
    items.sort(key=lambda x: x.get("fecha", ""))
    return _ok({"items": items, "count": len(items)})


def create_evaluacion(email_maestro, plan_type, body):
    grupo_id = (body.get("grupoId") or "").strip()
    nombre = (body.get("nombre") or "").strip()
    fecha = (body.get("fecha") or "").strip()
    tipo = (body.get("tipo") or "examen").strip()

    if not grupo_id or not nombre:
        return _err("grupoId y nombre son obligatorios.", 400)
    if not _verify_grupo(email_maestro, grupo_id):
        return _err("Grupo no encontrado.", 404)

    current = _count_evaluaciones(grupo_id)
    ok, msg = can_create_evaluacion(plan_type, current)
    if not ok:
        return forbidden(msg)

    eval_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "evaluacionId": eval_id,
        "grupoId": grupo_id,
        "email_maestro": email_maestro,
        "nombre": nombre,
        "fecha": fecha or now[:10],
        "tipo": tipo,
        "activo": True,
        "createdAt": now,
    }
    _db().Table(DYNAMODB_TABLE_EVALUACIONES).put_item(Item=item)
    return _ok(item, 201)


def delete_evaluacion(email_maestro, eval_id):
    now = datetime.now(timezone.utc).isoformat()
    try:
        _db().Table(DYNAMODB_TABLE_EVALUACIONES).update_item(
            Key={"evaluacionId": eval_id},
            UpdateExpression="SET activo = :f, updatedAt = :u",
            ConditionExpression="email_maestro = :e",
            ExpressionAttributeValues={":f": False, ":u": now, ":e": email_maestro},
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return _err("Evaluación no encontrada.", 404)
        raise
    return _ok({"message": "Evaluación eliminada.", "evaluacionId": eval_id})


def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode": 204, "headers": CORS_HEADERS, "body": ""}

    payload = verify_maestro_token(event)
    if not payload:
        return unauthorized()

    email = payload["email"]
    plan_type = payload.get("plan_type", "gratuito")
    method = event.get("httpMethod", "GET")
    path = event.get("path", "")
    path_params = event.get("pathParameters") or {}

    try:
        if method == "GET":
            grupo_id = path_params.get("grupoId") or path_params.get("id")
            if not grupo_id:
                return _err("grupoId requerido.", 400)
            return list_evaluaciones(email, grupo_id)

        body = _parse_body(event)

        if method == "POST":
            return create_evaluacion(email, plan_type, body)

        eval_id = path_params.get("evalId") or path_params.get("id")
        if method == "DELETE" and eval_id:
            return delete_evaluacion(email, eval_id)

        return _err(f"Método {method} no soportado.", 405)

    except Exception as exc:
        print(f"[EVALUACIONES] Unhandled: {exc}", file=sys.stderr)
        return _err(f"Error interno: {exc}", 500)
