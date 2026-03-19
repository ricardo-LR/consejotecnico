"""
Planeaciones handler — list and get lesson plans.

Lambda entry point: handler(event, context)

Routes (via event.routeKey or event.action):
  GET /planeaciones            → list_planeaciones(tema, grado, page)
  GET /planeaciones/{id}       → get_planeacion(id)
"""

import json
import boto3
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

from src.config.settings import AWS_REGION, DYNAMODB_TABLE_PLANEACIONES

PAGE_SIZE = 20

_dynamodb = None


def _get_table():
    global _dynamodb
    if _dynamodb is None:
        _dynamodb = boto3.resource("dynamodb", region_name=AWS_REGION)
    return _dynamodb.Table(DYNAMODB_TABLE_PLANEACIONES)


CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
}


def _ok(body: dict, status: int = 200) -> dict:
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, ensure_ascii=False, default=str),
    }


def _err(message: str, status: int = 400) -> dict:
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps({"error": message}, ensure_ascii=False),
    }


# ──────────────────────────────────────────────
# Actions
# ──────────────────────────────────────────────

def list_planeaciones(tema: str | None = None, grado: str | None = None, page: int = 1) -> dict:
    """
    Return a paginated list of planeaciones.

    Uses the GSI 'tema-createdAt' when filtering by tema.
    Falls back to a full scan when no tema is specified (dev / admin use).

    page is 1-based.
    """
    table = _get_table()
    page = max(1, page)

    try:
        if tema:
            # Query by GSI: tema-createdAt
            key_cond = Key("tema").eq(tema)
            query_kwargs: dict = {
                "IndexName": "tema-createdAt",
                "KeyConditionExpression": key_cond,
                "ScanIndexForward": False,  # newest first
                "Limit": PAGE_SIZE * page,  # over-fetch for simple offset paging
            }
            if grado:
                query_kwargs["FilterExpression"] = (
                    boto3.dynamodb.conditions.Attr("grado").eq(grado)
                )
            resp = table.query(**query_kwargs)
        else:
            # No tema filter — full scan (should only be used by admin queries)
            scan_kwargs: dict = {"Limit": PAGE_SIZE * page}
            if grado:
                scan_kwargs["FilterExpression"] = (
                    boto3.dynamodb.conditions.Attr("grado").eq(grado)
                )
            resp = table.scan(**scan_kwargs)

    except ClientError as exc:
        return _err("Error al consultar planeaciones.", 500)

    items = resp.get("Items", [])
    # Simple offset paging (cost-acceptable for moderate dataset sizes)
    start = (page - 1) * PAGE_SIZE
    page_items = items[start : start + PAGE_SIZE]

    # Strip internal fields before returning
    for item in page_items:
        item.pop("gsi1pk", None)
        item.pop("gsi1sk", None)

    return _ok(
        {
            "planeaciones": page_items,
            "page": page,
            "page_size": PAGE_SIZE,
            "total_returned": len(page_items),
            "has_more": len(items) > start + PAGE_SIZE,
        }
    )


def get_planeacion(planeacion_id: str) -> dict:
    """Return full detail for a single planeación by primary key."""
    if not planeacion_id:
        return _err("Se requiere el ID de la planeación.", 400)

    table = _get_table()
    try:
        resp = table.get_item(Key={"planeacionId": planeacion_id})
    except ClientError:
        return _err("Error al obtener la planeación.", 500)

    item = resp.get("Item")
    if not item:
        return _err(f"Planeación '{planeacion_id}' no encontrada.", 404)

    # Strip internal GSI keys
    item.pop("gsi1pk", None)
    item.pop("gsi1sk", None)

    return _ok({"planeacion": item})


# ──────────────────────────────────────────────
# Lambda entry point
# ──────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """AWS Lambda handler — supports both API Gateway HTTP API and direct invocation."""
    http_method = event.get("requestContext", {}).get("http", {}).get("method", "").upper()
    path_params = event.get("pathParameters") or {}
    query_params = event.get("queryStringParameters") or {}

    # GET /planeaciones/{id}
    if path_params.get("id"):
        return get_planeacion(path_params["id"])

    # Direct invocation fallback (action field)
    action = (event.get("action") or "").lower()
    if action == "get_planeacion":
        return get_planeacion(event.get("id", ""))

    # GET /planeaciones  (list)
    if http_method in ("GET", "") or action == "list_planeaciones":
        try:
            page = int(query_params.get("page", event.get("page", 1)))
        except (ValueError, TypeError):
            page = 1

        return list_planeaciones(
            tema=query_params.get("tema") or event.get("tema"),
            grado=query_params.get("grado") or event.get("grado"),
            page=page,
        )

    return _err(f"Método o acción no soportada.", 405)
