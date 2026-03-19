# MercadoPago Integration Guide — CONSEJOTECNICO

## Indice

1. [Arquitectura del flujo de pago](#1-arquitectura-del-flujo-de-pago)
2. [Credenciales y configuracion](#2-credenciales-y-configuracion)
3. [Flujo Sandbox vs Produccion](#3-flujo-sandbox-vs-produccion)
4. [Tarjetas de prueba](#4-tarjetas-de-prueba)
5. [Probar webhooks localmente](#5-probar-webhooks-localmente)
6. [Validacion de firma webhook](#6-validacion-de-firma-webhook)
7. [Estados de pago (status flow)](#7-estados-de-pago-status-flow)
8. [Migracion a Produccion](#8-migracion-a-produccion)
9. [Referencia de endpoints](#9-referencia-de-endpoints)
10. [Troubleshooting](#10-troubleshooting)

---

## 1. Arquitectura del flujo de pago

```
Usuario                Frontend              API Gateway          Lambda                MercadoPago
  |                       |                      |                   |                      |
  |-- Click "Comprar" --> |                      |                   |                      |
  |                       |-- POST /purchase --> |                   |                      |
  |                       |                      |-- Invoke -------> |                      |
  |                       |                      |                   |-- create_preference->|
  |                       |                      |                   |<-- checkout_url ----- |
  |                       |                      |<-- {checkout_url}-|                      |
  |                       |<-- {checkout_url} ---|                   |                      |
  |<-- redirect --------- |                      |                   |                      |
  |                                                                  |                      |
  |---------------------- Formulario de pago MP (Sandbox/Prod) ----> |                      |
  |                                                                  |                      |
  |<-- redirect back_url (success/failure/pending) ----------------- |                      |
  |                                                                  |                      |
  |              MercadoPago -- POST /webhook ---------------------->|                      |
  |                                             |-- Invoke --------> |                      |
  |                                             |                    |-- GET /payments/{id}->|
  |                                             |                    |<-- payment details ---|
  |                                             |                    |-- UPDATE DynamoDB     |
  |                                             |                    |-- return 200 OK       |
```

### Componentes clave

| Componente | Descripcion |
|---|---|
| `purchase_handler.py` | Crea preferencia MP, guarda compra en DynamoDB (status=PENDING) |
| `webhook_handler.py` | Recibe notificaciones MP, valida firma, actualiza DynamoDB |
| DynamoDB `consejotecnico-purchases` | Tabla de compras con status PENDING/COMPLETED/FAILED/CANCELLED |

---

## 2. Credenciales y configuracion

### Variables de entorno (backend/.env)

```bash
# MercadoPago Sandbox
MERCADOPAGO_SANDBOX_ACCESS_TOKEN=TEST-xxxx-xxxx-xxxx-xxxx
MERCADOPAGO_SANDBOX_PUBLIC_KEY=TEST-xxxx-xxxx-xxxx-xxxx
MERCADOPAGO_WEBHOOK_SECRET=tu_webhook_secret_aqui
MERCADOPAGO_SANDBOX_MODE=True

# URLs de retorno (apuntan a CloudFront en dev)
MERCADOPAGO_SUCCESS_URL=https://db0i745ypndsx.cloudfront.net/dashboard?payment=success
MERCADOPAGO_FAILURE_URL=https://db0i745ypndsx.cloudfront.net/dashboard?payment=failure
MERCADOPAGO_PENDING_URL=https://db0i745ypndsx.cloudfront.net/dashboard?payment=pending

# URL del webhook Lambda
MERCADOPAGO_WEBHOOK_URL=https://ceatmeuuhb.execute-api.us-east-1.amazonaws.com/dev/webhook
```

### Como obtener las credenciales

**Sandbox (desarrollo):**
1. Ir a https://www.mercadopago.com.mx/developers/panel
2. Menu lateral: "Tus aplicaciones" → seleccionar o crear una app
3. Seccion "Credenciales de prueba":
   - Copiar **Public Key** (empieza con `TEST-`)
   - Copiar **Access Token** (empieza con `TEST-`)

**Produccion:**
1. Mismo panel → "Credenciales de produccion"
2. Completar el proceso de verificacion de cuenta
3. Copiar **Public Key** (empieza con `APP_USR-`)
4. Copiar **Access Token** (empieza con `APP_USR-`)

### Lambda environment variables (AWS)

Las variables de entorno estan configuradas en todas las funciones Lambda.
Para actualizarlas en AWS:

```bash
aws lambda update-function-configuration \
  --function-name consejotecnico-purchase \
  --environment "Variables={MERCADOPAGO_SANDBOX_ACCESS_TOKEN=TEST-...,MERCADOPAGO_SANDBOX_MODE=True,...}" \
  --region us-east-1 \
  --profile consejotecnico
```

---

## 3. Flujo Sandbox vs Produccion

| Aspecto | Sandbox | Produccion |
|---|---|---|
| Access Token | `TEST-xxxx` | `APP_USR-xxxx` |
| Public Key | `TEST-xxxx` | `APP_USR-xxxx` |
| Checkout URL | `sandbox_init_point` | `init_point` |
| Pagos reales | No (dinero ficticio) | Si |
| Tarjetas | Usar tarjetas de prueba | Tarjetas reales |
| Env var | `MERCADOPAGO_SANDBOX_MODE=True` | `MERCADOPAGO_SANDBOX_MODE=False` |

En el `purchase_handler.py`, cuando `MP_SANDBOX_MODE=True`, se retorna el `sandbox_init_point`
en lugar del `init_point`. Cambiar esta variable es todo lo que se necesita.

---

## 4. Tarjetas de prueba

Ver archivo: `backend/MERCADOPAGO_TEST_CARDS.txt`

### Resumen rapido

| Numero | Tipo | Resultado |
|---|---|---|
| `4009 1753 3280 6176` | Visa Credito | Aprobado |
| `5031 7557 3453 0604` | Mastercard Credito | Aprobado |
| `3711 8030 3257 522` | Amex | Aprobado |
| `4009 1753 3280 6176` | Visa Credito | Rechazado (usar nombre FUND) |

**Datos adicionales:** cualquier fecha futura, cualquier CVV de 3 digitos.

Para forzar el resultado, usa estos valores en el campo **Nombre del titular**:
- `APRO` → Aprobado
- `FUND` → Fondos insuficientes (rechazado)
- `CONT` → Pendiente por contingencia
- `CALL` → Requiere llamar al banco

---

## 5. Probar webhooks localmente

### Opcion A: Usar ngrok (recomendado)

```bash
# 1. Instalar ngrok: https://ngrok.com
# 2. Iniciar tu servidor local (o usar SAM local)
sam local start-api --port 3001

# 3. Exponer con ngrok
ngrok http 3001

# 4. Copiar la URL publica de ngrok (ej: https://abc123.ngrok.io)
# 5. Actualizar MERCADOPAGO_WEBHOOK_URL en .env:
MERCADOPAGO_WEBHOOK_URL=https://abc123.ngrok.io/webhook

# 6. Configurar la URL en el panel de MP:
#    Panel MP → Tu App → Notificaciones → URL de notificacion
```

### Opcion B: Simular webhook directamente al Lambda (sin ngrok)

```bash
# Invocar el Lambda webhook directamente con un evento de prueba
aws lambda invoke \
  --function-name consejotecnico-webhook \
  --payload '{"httpMethod":"POST","headers":{"x-signature":"ts=12345,v1=abc"},"body":"{\"action\":\"payment.updated\",\"data\":{\"id\":\"123\"}}"}' \
  --region us-east-1 \
  --profile consejotecnico \
  --cli-binary-format raw-in-base64-out \
  /tmp/response.json && cat /tmp/response.json
```

### Opcion C: Script de tests

```bash
cd C:\Users\Usuario\Documents\consejotecnico
pip install mercadopago boto3 requests python-dotenv
python backend/test_mercadopago.py --sandbox
```

### Opcion D: Usando el simulador de MP

En el Panel de MercadoPago → Tu App → "Simular notificacion":
1. Seleccionar "Pagos"
2. Ingresar el ID de la preferencia creada
3. Seleccionar el evento (approved/rejected/pending)
4. Click "Simular"

---

## 6. Validacion de firma webhook

MercadoPago firma cada webhook con HMAC-SHA256. El handler valida esta firma antes de procesar.

### Cabeceras que envia MercadoPago

```
x-signature: ts=1698765432,v1=a1b2c3d4e5f6...
x-request-id: 550e8400-e29b-41d4-a716-446655440000
```

### Como se calcula la firma

```python
import hashlib, hmac

webhook_secret = "tu_webhook_secret_aqui"
payment_id = "123456789"          # data.id del body
request_id = "550e8400-..."       # x-request-id header
ts = "1698765432"                 # timestamp de x-signature

signed_template = f"id:{payment_id};request-id:{request_id};ts:{ts};"
signature = hmac.new(
    webhook_secret.encode("utf-8"),
    signed_template.encode("utf-8"),
    hashlib.sha256
).hexdigest()
# Comparar con v1 de x-signature header
```

### Configurar el Webhook Secret en MercadoPago

1. Panel MP → Tu App → Notificaciones
2. Activar "Firma de notificaciones"
3. Copiar el secret generado
4. Actualizar `MERCADOPAGO_WEBHOOK_SECRET` en `.env` y en Lambda

### Si no hay Webhook Secret configurado

El handler omite la validacion de firma y registra un warning.
**No recomendado en produccion.**

---

## 7. Estados de pago (status flow)

```
                    ┌─────────────┐
                    │   PENDING   │  ← compra creada, esperando pago
                    └──────┬──────┘
                           │ MP webhook payment.updated
              ┌────────────┼────────────┐
              ▼            ▼            ▼
        ┌──────────┐ ┌──────────┐ ┌──────────┐
        │COMPLETED │ │  FAILED  │ │CANCELLED │
        │(approved)│ │(rejected)│ │(cancelled│
        └──────────┘ └──────────┘ │ /expired)│
                                  └──────────┘
```

### Mapeo MP status → DynamoDB status

| MercadoPago status | DynamoDB status |
|---|---|
| `approved` | `COMPLETED` |
| `pending` | `PENDING` |
| `in_process` | `PENDING` |
| `rejected` | `FAILED` |
| `cancelled` | `CANCELLED` |
| `refunded` | `REFUNDED` |
| `charged_back` | `REFUNDED` |

### Campos guardados en DynamoDB al completarse

```json
{
  "purchaseId": "uuid",
  "email": "user@example.com",
  "planeacionId": "abc123",
  "planType": "individual",
  "price": "79",
  "currency": "MXN",
  "status": "COMPLETED",
  "statusReason": "accredited",
  "mpPreferenceId": "123456789-...",
  "mpPaymentId": "987654321",
  "sandboxMode": true,
  "createdAt": "2026-03-19T...",
  "updatedAt": "2026-03-19T..."
}
```

---

## 8. Migracion a Produccion

### Checklist

- [ ] Cuenta MP verificada (subir documentos de identidad)
- [ ] Ingresos de la cuenta en MXN configurados
- [ ] Credenciales de produccion obtenidas (`APP_USR-...`)
- [ ] `MERCADOPAGO_SANDBOX_MODE=False` en variables de entorno Lambda
- [ ] `MERCADOPAGO_SANDBOX_ACCESS_TOKEN` reemplazado por token de produccion
- [ ] `MERCADOPAGO_SUCCESS_URL` apuntando a dominio de produccion
- [ ] `MERCADOPAGO_WEBHOOK_URL` apuntando a endpoint de produccion
- [ ] Webhook Secret de produccion configurado
- [ ] Prueba con pago real de $1 MXN antes de lanzar

### Actualizar Lambda en produccion

```bash
aws lambda update-function-configuration \
  --function-name consejotecnico-purchase \
  --environment "Variables={
    MERCADOPAGO_SANDBOX_ACCESS_TOKEN=APP_USR-tu-token-produccion,
    MERCADOPAGO_SANDBOX_MODE=False,
    MERCADOPAGO_SUCCESS_URL=https://tudominio.com/dashboard?payment=success,
    MERCADOPAGO_FAILURE_URL=https://tudominio.com/dashboard?payment=failure,
    MERCADOPAGO_PENDING_URL=https://tudominio.com/dashboard?payment=pending,
    MERCADOPAGO_WEBHOOK_URL=https://tudominio.com/webhook,
    MERCADOPAGO_WEBHOOK_SECRET=secret-de-produccion
  }" \
  --region us-east-1 \
  --profile consejotecnico
```

---

## 9. Referencia de endpoints

### POST /purchase

Crea una preferencia de pago en MercadoPago y devuelve el checkout URL.

**Request:**
```json
{
  "email": "usuario@example.com",
  "planeacion_id": "abc123",
  "plan_type": "individual",
  "grado": "3ro",
  "completeness_score": 0.8
}
```

**Response (201):**
```json
{
  "purchase_id": "uuid-v4",
  "status": "PENDING",
  "checkout_url": "https://www.mercadopago.com.mx/checkout/v1/redirect?pref_id=...",
  "price": 79,
  "currency": "MXN",
  "plan_type": "individual",
  "mp_preference_id": "123456789-abc-...",
  "sandbox_mode": true
}
```

### POST /webhook

Recibe notificaciones de MercadoPago. No requiere autenticacion JWT (MP no puede enviarlo).
La validacion se hace via firma HMAC-SHA256 en el header `x-signature`.

**Request (enviado por MercadoPago):**
```http
POST /webhook
x-signature: ts=1698765432,v1=abc123...
x-request-id: 550e8400-...
Content-Type: application/json

{
  "action": "payment.updated",
  "data": { "id": "987654321" }
}
```

**Response (200):**
```json
{ "status": "processed" }
```

---

## 10. Troubleshooting

### Error: `mp preference rejected: 400`
- Verificar que `unit_price` sea un float mayor a 0
- Verificar que `currency_id` sea `MXN`
- Verificar que el Access Token sea correcto

### Error: `No module named 'mercadopago'`
- El Lambda Layer no tiene la estructura correcta
- Verificar que sea `python/lib/python3.11/site-packages/` (no `lambda_layer/python/...`)
- Re-ejecutar el build del layer y republicar

### Webhook devuelve `401 Invalid webhook signature`
- El `MERCADOPAGO_WEBHOOK_SECRET` no coincide con el configurado en MP
- Si estas probando localmente, dejar la variable en blanco para omitir validacion

### Webhook devuelve `500` al buscar el pago
- El `data.id` del webhook no existe en MercadoPago (payment_id falso)
- Normal en pruebas locales con IDs ficticios

### Compra guardada como PENDING pero no se actualiza
- Verificar que el `notification_url` de la preferencia sea el correcto
- Verificar que el Lambda de webhook tenga permisos de DynamoDB
- Revisar CloudWatch Logs: `/aws/lambda/consejotecnico-webhook`

### Ver logs del webhook Lambda

```bash
aws logs tail /aws/lambda/consejotecnico-webhook \
  --follow \
  --region us-east-1 \
  --profile consejotecnico
```
