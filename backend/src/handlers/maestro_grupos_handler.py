"""
Maestro Grupos handler - manage teacher's class groups.

Routes handled:
  GET    /maestro/grupos              - list all groups for current teacher
  POST   /maestro/grupos              - create a new group (plan limit enforced)
  PUT    /maestro/grupos/{grupoId}    - update group name/details
  DELETE /maestro/grupos/{grupoId}    - delete group and all its data
"""

import json
import sys
import uuid
import boto3
from datetime import datetime, timezone
from decimal import Decimal
from botocore.exceptions import ClientError

from src.config.settings import AWS_REGION, DYNAMODB_TABLE_GRUPOS, DYNAMODB_TABLE_ALUMNOS, DYNAMODB_TABLE_EVALUACIONES
from src.models.plan_validator import can_create_grupo
from src.utils.maestro_auth import verify_maestro_token, unauthorized, forbidden

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,POST,PUT,DELETE,OPTIONS",
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
    print(f"[GRUPOS] ERROR {status}: {msg}", file=sys.stderr)
    return {"statusCode": status, "headers": CORS_HEADERS, "body": json.dumps({"error": msg}, ensure_ascii=False)}


def _parse_body(event):
    body = event.get("body") or "{}"
    return json.loads(body) if isinstance(body, str) else (body or {})


def _count_grupos(email_maestro: str) -> int:
    table = _db().Table(DYNAMODB_TABLE_GRUPOS)
    resp = table.scan(
        FilterExpression="email_maestro = :e AND activo = :a",
        ExpressionAttributeValues={":e": email_maestro, ":a": True},
        Select="COUNT",
    )
    return resp.get("Count", 0)


def list_grupos(email_maestro: str):
    table = _db().Table(DYNAMODB_TABLE_GRUPOS)
    items = []
    kwargs = {
        "FilterExpression": "email_maestro = :e AND activo = :a",
        "ExpressionAttributeValues": {":e": email_maestro, ":a": True},
    }
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last
    items.sort(key=lambda x: x.get("createdAt", ""))
    return _ok({"items": items, "count": len(items)})


def create_grupo(email_maestro: str, plan_type: str, body: dict):
    nombre = (body.get("nombre") or "").strip()
    grado = (body.get("grado") or "").strip()
    ciclo = (body.get("ciclo_escolar") or "").strip()

    if not nombre:
        return _err("El nombre del grupo es obligatorio.", 400)

    # Plan check
    current_count = _count_grupos(email_maestro)
    ok, msg = can_create_grupo(plan_type, current_count)
    if not ok:
        return forbidden(msg)

    grupo_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "grupoId": grupo_id,
        "email_maestro": email_maestro,
        "nombre": nombre,
        "grado": grado,
        "ciclo_escolar": ciclo,
        "activo": True,
        "createdAt": now,
        "updatedAt": now,
    }
    _db().Table(DYNAMODB_TABLE_GRUPOS).put_item(Item=item)
    print(f"[GRUPOS] Created grupo {grupo_id} for {email_maestro}", file=sys.stderr)
    return _ok(item, 201)


def update_grupo(email_maestro: str, grupo_id: str, body: dict):
    nombre = (body.get("nombre") or "").strip()
    grado = (body.get("grado") or "").strip()
    ciclo = (body.get("ciclo_escolar") or "").strip()

    if not nombre:
        return _err("El nombre del grupo es obligatorio.", 400)

    now = datetime.now(timezone.utc).isoformat()
    try:
        resp = (
            _db()
            .Table(DYNAMODB_TABLE_GRUPOS)
            .update_item(
                Key={"grupoId": grupo_id},
                UpdateExpression="SET nombre = :n, grado = :g, ciclo_escolar = :c, updatedAt = :u",
                ConditionExpression="email_maestro = :e AND activo = :a",
                ExpressionAttributeValues={
                    ":n": nombre,
                    ":g": grado,
                    ":c": ciclo,
                    ":u": now,
                    ":e": email_maestro,
                    ":a": True,
                },
                ReturnValues="ALL_NEW",
            )
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return _err("Grupo no encontrado.", 404)
        raise
    return _ok(resp.get("Attributes", {}))


def delete_grupo(email_maestro: str, grupo_id: str):
    now = datetime.now(timezone.utc).isoformat()
    try:
        _db().Table(DYNAMODB_TABLE_GRUPOS).update_item(
            Key={"grupoId": grupo_id},
            UpdateExpression="SET activo = :f, updatedAt = :u",
            ConditionExpression="email_maestro = :e",
            ExpressionAttributeValues={":f": False, ":u": now, ":e": email_maestro},
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return _err("Grupo no encontrado.", 404)
        raise
    return _ok({"message": "Grupo eliminado correctamente.", "grupoId": grupo_id})


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
    grupo_id = path_params.get("grupoId")

    try:
        if method == "GET" and not grupo_id:
            return list_grupos(email)

        body = _parse_body(event)

        if method == "POST":
            return create_grupo(email, plan_type, body)

        if not grupo_id:
            return _err("grupoId requerido en la URL.", 400)

        if method == "PUT":
            return update_grupo(email, grupo_id, body)

        if method == "DELETE":
            return delete_grupo(email, grupo_id)

        return _err(f"Método {method} no soportado.", 405)

    except Exception as exc:
        print(f"[GRUPOS] Unhandled: {exc}", file=sys.stderr)
        return _err(f"Error interno: {exc}", 500)
