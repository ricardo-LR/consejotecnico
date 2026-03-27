"""
Maestro Alumnos handler - manage students per group.

Routes:
  GET    /maestro/grupo/{grupoId}/alumnos   - list students in group
  POST   /maestro/alumnos                   - add student to group
  PUT    /maestro/alumnos/{alumnoId}        - update student
  DELETE /maestro/alumnos/{alumnoId}        - delete student
  POST   /maestro/alumnos/import-csv        - bulk import from CSV text
"""

import json
import sys
import uuid
import csv
import io
import boto3
from datetime import datetime, timezone
from botocore.exceptions import ClientError

from src.config.settings import AWS_REGION, DYNAMODB_TABLE_ALUMNOS, DYNAMODB_TABLE_GRUPOS
from src.models.plan_validator import can_add_alumno
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
    print(f"[ALUMNOS] ERROR {status}: {msg}", file=sys.stderr)
    return {"statusCode": status, "headers": CORS_HEADERS, "body": json.dumps({"error": msg}, ensure_ascii=False)}


def _parse_body(event):
    body = event.get("body") or "{}"
    return json.loads(body) if isinstance(body, str) else (body or {})


def _verify_grupo_ownership(email_maestro: str, grupo_id: str) -> bool:
    resp = _db().Table(DYNAMODB_TABLE_GRUPOS).get_item(Key={"grupoId": grupo_id})
    item = resp.get("Item")
    return item is not None and item.get("email_maestro") == email_maestro and item.get("activo", True)


def _count_alumnos_in_grupo(grupo_id: str) -> int:
    resp = (
        _db()
        .Table(DYNAMODB_TABLE_ALUMNOS)
        .scan(
            FilterExpression="grupoId = :g AND activo = :a",
            ExpressionAttributeValues={":g": grupo_id, ":a": True},
            Select="COUNT",
        )
    )
    return resp.get("Count", 0)


def list_alumnos(email_maestro: str, grupo_id: str):
    if not _verify_grupo_ownership(email_maestro, grupo_id):
        return _err("Grupo no encontrado.", 404)
    table = _db().Table(DYNAMODB_TABLE_ALUMNOS)
    items = []
    kwargs = {
        "FilterExpression": "grupoId = :g AND activo = :a",
        "ExpressionAttributeValues": {":g": grupo_id, ":a": True},
    }
    while True:
        resp = table.scan(**kwargs)
        items.extend(resp.get("Items", []))
        last = resp.get("LastEvaluatedKey")
        if not last:
            break
        kwargs["ExclusiveStartKey"] = last
    items.sort(key=lambda x: (x.get("apellido", ""), x.get("nombre", "")))
    return _ok({"items": items, "count": len(items), "grupoId": grupo_id})


def create_alumno(email_maestro: str, plan_type: str, body: dict):
    grupo_id = (body.get("grupoId") or "").strip()
    nombre = (body.get("nombre") or "").strip()
    apellido = (body.get("apellido") or "").strip()

    if not grupo_id or not nombre:
        return _err("grupoId y nombre son obligatorios.", 400)
    if not _verify_grupo_ownership(email_maestro, grupo_id):
        return _err("Grupo no encontrado.", 404)

    current = _count_alumnos_in_grupo(grupo_id)
    ok, msg = can_add_alumno(plan_type, current)
    if not ok:
        return forbidden(msg)

    alumno_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    item = {
        "alumnoId": alumno_id,
        "grupoId": grupo_id,
        "email_maestro": email_maestro,
        "nombre": nombre,
        "apellido": apellido,
        "activo": True,
        "createdAt": now,
        "updatedAt": now,
    }
    _db().Table(DYNAMODB_TABLE_ALUMNOS).put_item(Item=item)
    return _ok(item, 201)


def update_alumno(email_maestro: str, alumno_id: str, body: dict):
    nombre = (body.get("nombre") or "").strip()
    apellido = (body.get("apellido") or "").strip()
    if not nombre:
        return _err("El nombre es obligatorio.", 400)
    now = datetime.now(timezone.utc).isoformat()
    try:
        resp = (
            _db()
            .Table(DYNAMODB_TABLE_ALUMNOS)
            .update_item(
                Key={"alumnoId": alumno_id},
                UpdateExpression="SET nombre = :n, apellido = :a, updatedAt = :u",
                ConditionExpression="email_maestro = :e AND activo = :ac",
                ExpressionAttributeValues={":n": nombre, ":a": apellido, ":u": now, ":e": email_maestro, ":ac": True},
                ReturnValues="ALL_NEW",
            )
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return _err("Alumno no encontrado.", 404)
        raise
    return _ok(resp.get("Attributes", {}))


def delete_alumno(email_maestro: str, alumno_id: str):
    now = datetime.now(timezone.utc).isoformat()
    try:
        _db().Table(DYNAMODB_TABLE_ALUMNOS).update_item(
            Key={"alumnoId": alumno_id},
            UpdateExpression="SET activo = :f, updatedAt = :u",
            ConditionExpression="email_maestro = :e",
            ExpressionAttributeValues={":f": False, ":u": now, ":e": email_maestro},
        )
    except ClientError as exc:
        if exc.response["Error"]["Code"] == "ConditionalCheckFailedException":
            return _err("Alumno no encontrado.", 404)
        raise
    return _ok({"message": "Alumno eliminado.", "alumnoId": alumno_id})


def import_csv(email_maestro: str, plan_type: str, body: dict):
    grupo_id = (body.get("grupoId") or "").strip()
    csv_text = body.get("csv_text", "")
    if not grupo_id or not csv_text:
        return _err("grupoId y csv_text son obligatorios.", 400)
    if not _verify_grupo_ownership(email_maestro, grupo_id):
        return _err("Grupo no encontrado.", 404)

    reader = csv.DictReader(io.StringIO(csv_text))
    rows = list(reader)

    # Check plan limit for total
    current = _count_alumnos_in_grupo(grupo_id)
    ok, msg = can_add_alumno(plan_type, current + len(rows) - 1)
    if not ok:
        return forbidden(f"El CSV tiene {len(rows)} alumnos pero excedería el límite de tu plan.")

    now = datetime.now(timezone.utc).isoformat()
    table = _db().Table(DYNAMODB_TABLE_ALUMNOS)
    created = []
    for row in rows:
        nombre = (row.get("nombre") or row.get("Nombre") or "").strip()
        apellido = (row.get("apellido") or row.get("Apellido") or "").strip()
        if not nombre:
            continue
        alumno_id = str(uuid.uuid4())
        item = {
            "alumnoId": alumno_id,
            "grupoId": grupo_id,
            "email_maestro": email_maestro,
            "nombre": nombre,
            "apellido": apellido,
            "activo": True,
            "createdAt": now,
            "updatedAt": now,
        }
        table.put_item(Item=item)
        created.append(item)

    return _ok({"message": f"{len(created)} alumnos importados.", "items": created}, 201)


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
        body = _parse_body(event) if method in ("POST", "PUT") else {}

        # GET /maestro/grupo/{grupoId}/alumnos
        if method == "GET" and "grupo" in path:
            grupo_id = path_params.get("grupoId") or path_params.get("id")
            if not grupo_id:
                return _err("grupoId requerido.", 400)
            return list_alumnos(email, grupo_id)

        # POST /maestro/alumnos/import-csv
        if method == "POST" and "import-csv" in path:
            return import_csv(email, plan_type, body)

        # POST /maestro/alumnos
        if method == "POST":
            return create_alumno(email, plan_type, body)

        alumno_id = path_params.get("alumnoId") or path_params.get("id")
        if not alumno_id:
            return _err("alumnoId requerido.", 400)

        if method == "PUT":
            return update_alumno(email, alumno_id, body)

        if method == "DELETE":
            return delete_alumno(email, alumno_id)

        return _err(f"Método {method} no soportado.", 405)

    except Exception as exc:
        print(f"[ALUMNOS] Unhandled: {exc}", file=sys.stderr)
        return _err(f"Error interno: {exc}", 500)
