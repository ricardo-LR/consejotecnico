"""
admin_cte_handler.py — Lambda handler for CTE (Consejo Técnico Escolar) management.

Routes (all require admin Bearer token):
  GET  /admin/cte/list          → list all CTEs
  GET  /admin/cte/{id}          → get single CTE
  POST /admin/cte               → create CTE
  PUT  /admin/cte/{id}          → update CTE fields
  PUT  /admin/cte/{id}/state    → change estado (borrador→revision→produccion)
  POST /admin/cte/{id}/upload   → get presigned S3 upload URL
"""

import json
import uuid
import boto3
import sys
from datetime import datetime

sys.path.insert(0, '/opt/python')

dynamodb = boto3.resource('dynamodb', region_name='us-east-1')
s3       = boto3.client('s3', region_name='us-east-1')

CTE_TABLE = dynamodb.Table('consejotecnico-admin-cte')
BUCKET    = 'consejotecnico-files-dev'

CORS = {
    'Content-Type':                     'application/json',
    'Access-Control-Allow-Origin':      '*',
    'Access-Control-Allow-Headers':     'Content-Type,Authorization',
    'Access-Control-Allow-Methods':     'GET,POST,PUT,DELETE,OPTIONS',
}

# ── Helpers ──────────────────────────────────────────────────────────────────

def ok(body: dict, status: int = 200) -> dict:
    return {'statusCode': status, 'headers': CORS, 'body': json.dumps(body, ensure_ascii=False, default=str)}

def err(msg: str, status: int = 400) -> dict:
    print(f'[ADMIN-CTE] ERROR {status}: {msg}', file=sys.stderr)
    return {'statusCode': status, 'headers': CORS, 'body': json.dumps({'error': msg}, ensure_ascii=False)}

def parse_body(event: dict) -> dict:
    b = event.get('body', '{}')
    return json.loads(b) if isinstance(b, str) else (b or {})

def now_iso() -> str:
    return datetime.utcnow().isoformat()

def _historial_entry(accion: str, desc: str) -> dict:
    return {
        'fecha': now_iso(),
        'accion': accion,
        'usuario': 'admin@consejotecnico.com',
        'descripcion': desc,
    }

# ── Auth check ────────────────────────────────────────────────────────────────

def _verify_admin(event: dict) -> bool:
    from src.config.settings import JWT_SECRET, JWT_ALGORITHM
    from jose import jwt, JWTError
    auth = (event.get('headers') or {}).get('Authorization', '')
    if not auth.startswith('Bearer '):
        return False
    try:
        payload = jwt.decode(auth[7:], JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload.get('role') == 'admin'
    except JWTError:
        return False

# ── Handler ───────────────────────────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    method = event.get('httpMethod', 'GET')
    path   = event.get('path', '')

    if method == 'OPTIONS':
        return {'statusCode': 204, 'headers': CORS, 'body': ''}

    if not _verify_admin(event):
        return err('No autorizado.', 401)

    try:
        body = parse_body(event)
    except (json.JSONDecodeError, TypeError):
        body = {}

    print(f'[ADMIN-CTE] {method} {path}')

    try:
        # GET /admin/cte/list
        if method == 'GET' and path.endswith('/cte/list'):
            return _list_ctes()

        # GET /admin/cte/{id}
        if method == 'GET' and '/admin/cte/' in path:
            cte_id = path.rstrip('/').split('/')[-1]
            return _get_cte(cte_id)

        # POST /admin/cte  (create)
        if method == 'POST' and (path.endswith('/admin/cte') or path.endswith('/cte')):
            return _create_cte(body)

        # POST /admin/cte/{id}/upload
        if method == 'POST' and '/upload' in path:
            cte_id = path.split('/admin/cte/')[-1].split('/')[0]
            return _presigned_upload(cte_id, body)

        # PUT /admin/cte/{id}/state
        if method == 'PUT' and '/state' in path:
            cte_id = path.split('/admin/cte/')[-1].split('/')[0]
            return _change_state(cte_id, body)

        # PUT /admin/cte/{id}  (update fields)
        if method == 'PUT' and '/admin/cte/' in path:
            cte_id = path.rstrip('/').split('/')[-1]
            return _update_cte(cte_id, body)

        return err('Endpoint no encontrado.', 404)

    except Exception as exc:
        print(f'[ADMIN-CTE] EXCEPTION: {exc}', file=sys.stderr)
        return err(str(exc), 500)


# ── Operations ────────────────────────────────────────────────────────────────

def _list_ctes() -> dict:
    resp  = CTE_TABLE.scan()
    items = resp.get('Items', [])
    order = {'borrador': 0, 'revision': 1, 'produccion': 2}
    items.sort(key=lambda x: (order.get(x.get('estado', 'borrador'), 9), x.get('mes', '')))
    return ok({'ctes': items, 'total': len(items)})


def _get_cte(cte_id: str) -> dict:
    resp = CTE_TABLE.get_item(Key={'cte_id': cte_id})
    if 'Item' not in resp:
        return err('CTE no encontrado.', 404)
    return ok(resp['Item'])


def _create_cte(body: dict) -> dict:
    mes = body.get('mes', '').strip()
    año = int(body.get('año', 2025))
    if not mes:
        return err('Mes requerido.', 400)

    cte_id = f"cte_{mes.lower()}_{año}"

    existing = CTE_TABLE.get_item(Key={'cte_id': cte_id})
    if 'Item' in existing:
        return err(f'CTE {cte_id} ya existe.', 409)

    item = {
        'cte_id':    cte_id,
        'mes':       mes,
        'año':       año,
        'titulo':    body.get('titulo', f'CTE {mes} {año}'),
        'descripcion': body.get('descripcion', ''),
        'estado':    'borrador',
        'archivos': {
            'presentacion':       None,
            'orden_dia':          None,
            'guia_facilitador':   None,
            'minuta_template':    None,
            'material_referencia': None,
        },
        'metadata': {
            'grados_afectados':  body.get('grados_afectados', []),
            'temas_clave':       body.get('temas_clave', []),
            'duracion_minutos':  body.get('duracion_minutos', 75),
            'creado_por':        'admin@consejotecnico.com',
        },
        'cambios_historial': [_historial_entry('crear', 'CTE creado')],
        'notas_revision':    '',
        'revisado_por':      None,
        'fecha_revision':    None,
        'fecha_produccion':  None,
        'created_at':        now_iso(),
        'updated_at':        now_iso(),
    }
    CTE_TABLE.put_item(Item=item)
    print(f'[ADMIN-CTE] Created {cte_id}')
    return ok(item, 201)


def _update_cte(cte_id: str, body: dict) -> dict:
    resp = CTE_TABLE.get_item(Key={'cte_id': cte_id})
    if 'Item' not in resp:
        return err('CTE no encontrado.', 404)

    entry = _historial_entry('actualizar', 'CTE actualizado')
    CTE_TABLE.update_item(
        Key={'cte_id': cte_id},
        UpdateExpression=(
            'SET updated_at = :now, titulo = :titulo, descripcion = :desc, '
            'notas_revision = :notes, '
            'cambios_historial = list_append(if_not_exists(cambios_historial, :empty), :cambio)'
        ),
        ExpressionAttributeValues={
            ':now':    now_iso(),
            ':titulo': body.get('titulo', resp['Item'].get('titulo', '')),
            ':desc':   body.get('descripcion', resp['Item'].get('descripcion', '')),
            ':notes':  body.get('notas_revision', resp['Item'].get('notas_revision', '')),
            ':cambio': [entry],
            ':empty':  [],
        },
    )
    return ok({'message': 'CTE actualizado', 'cte_id': cte_id})


def _change_state(cte_id: str, body: dict) -> dict:
    resp = CTE_TABLE.get_item(Key={'cte_id': cte_id})
    if 'Item' not in resp:
        return err('CTE no encontrado.', 404)

    cte     = resp['Item']
    current = cte.get('estado', 'borrador')
    new     = body.get('estado', '')

    valid_transitions = {
        'borrador':  ['revision'],
        'revision':  ['borrador', 'produccion'],
        'produccion': ['revision'],
    }
    if new not in valid_transitions.get(current, []):
        return err(f'Transición inválida: {current} → {new}', 400)

    entry = _historial_entry('cambiar_estado', f'Estado: {current} → {new}')
    extra = {}
    if new == 'produccion':
        extra = {':fprod': now_iso()}
        extra_expr = ', fecha_produccion = :fprod'
    else:
        extra_expr = ''

    CTE_TABLE.update_item(
        Key={'cte_id': cte_id},
        UpdateExpression=(
            f'SET estado = :state, updated_at = :now, revisado_por = :rev, fecha_revision = :frev'
            f'{extra_expr}, '
            f'cambios_historial = list_append(if_not_exists(cambios_historial, :empty), :cambio)'
        ),
        ExpressionAttributeValues={
            ':state': new,
            ':now':   now_iso(),
            ':rev':   'admin@consejotecnico.com',
            ':frev':  now_iso(),
            ':cambio': [entry],
            ':empty':  [],
            **extra,
        },
    )
    print(f'[ADMIN-CTE] State {cte_id}: {current} → {new}')
    return ok({'message': f'Estado cambiado a {new}', 'cte_id': cte_id, 'estado': new})


def _presigned_upload(cte_id: str, body: dict) -> dict:
    tipo    = body.get('tipo_archivo', 'presentacion')
    ext_map = {
        'presentacion':       'pptx',
        'orden_dia':          'pdf',
        'guia_facilitador':   'pdf',
        'minuta_template':    'docx',
        'material_referencia': 'pdf',
    }
    ext     = ext_map.get(tipo, 'pdf')
    s3_key  = f'cte/{cte_id}/{tipo}.{ext}'

    presigned = s3.generate_presigned_post(
        Bucket=BUCKET,
        Key=s3_key,
        ExpiresIn=3600,
    )

    # Record the file reference in DynamoDB
    file_entry = {
        'nombre':             f'{tipo}.{ext}',
        's3_key':             s3_key,
        'version':            1,
        'ultima_actualizacion': now_iso(),
    }
    entry = _historial_entry('subir_archivo', f'Archivo subido: {tipo}')
    CTE_TABLE.update_item(
        Key={'cte_id': cte_id},
        UpdateExpression=(
            f'SET archivos.{tipo} = :file, updated_at = :now, '
            f'cambios_historial = list_append(if_not_exists(cambios_historial, :empty), :cambio)'
        ),
        ExpressionAttributeValues={
            ':file':  file_entry,
            ':now':   now_iso(),
            ':cambio': [entry],
            ':empty':  [],
        },
    )

    print(f'[ADMIN-CTE] Presigned upload for {s3_key}')
    return ok({'upload_url': presigned['url'], 'fields': presigned['fields'], 's3_key': s3_key})
