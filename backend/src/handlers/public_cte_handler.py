import json, os, boto3
from datetime import datetime

dynamodb = boto3.resource("dynamodb", region_name="us-east-1")

CORS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
}


def handler(event, context):
    try:
        method = event["httpMethod"]
        path = event["path"]

        if method == "OPTIONS":
            return {"statusCode": 204, "headers": CORS, "body": ""}

        auth = (event.get("headers") or {}).get("Authorization", "").replace("Bearer ", "")
        if not auth:
            return error_response(401, "No autorizado")

        if method == "GET" and path.endswith("/cte/list"):
            estado = (event.get("queryStringParameters") or {}).get("estado", "produccion")
            return list_ctes_by_estado(estado)
        else:
            return error_response(404, "Endpoint no encontrado")

    except Exception as e:
        print(f"[ERROR] {str(e)}")
        return error_response(500, str(e))


def list_ctes_by_estado(estado):
    """Listar CTEs por estado (solo PRODUCCIÓN para usuarios)"""
    try:
        cte_table = dynamodb.Table("consejotecnico-admin-cte")

        response = cte_table.scan(
            FilterExpression="#estado = :estado",
            ExpressionAttributeNames={"#estado": "estado"},
            ExpressionAttributeValues={":estado": estado},
        )

        ctes = response.get("Items", [])
        ctes_sorted = sorted(ctes, key=lambda x: x.get("mes", ""))

        print(f"[LIST-PUBLIC-CTE] Estado={estado}, Total={len(ctes_sorted)}")
        return success_response(200, {"ctes": ctes_sorted})

    except Exception as e:
        print(f"[ERROR-LIST] {str(e)}")
        return error_response(500, str(e))


def success_response(code, data):
    return {
        "statusCode": code,
        "body": json.dumps(data, ensure_ascii=False, default=str),
        "headers": CORS,
    }


def error_response(code, msg):
    return {
        "statusCode": code,
        "body": json.dumps({"error": msg}, ensure_ascii=False),
        "headers": CORS,
    }
