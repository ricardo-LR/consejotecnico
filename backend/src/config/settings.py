import os
from dotenv import load_dotenv

load_dotenv()

# AWS
AWS_REGION = os.getenv("AWS_REGION", "us-east-1")
DYNAMODB_TABLE_USERS = "consejotecnico-users"
DYNAMODB_TABLE_PLANEACIONES = "consejotecnico-planeaciones"
DYNAMODB_TABLE_PURCHASES = "consejotecnico-purchases"

# Maestro Workspace tables
DYNAMODB_TABLE_GRUPOS = "consejotecnico-grupos"
DYNAMODB_TABLE_ALUMNOS = "consejotecnico-alumnos"
DYNAMODB_TABLE_EVALUACIONES = "consejotecnico-evaluaciones"
DYNAMODB_TABLE_CALIFICACIONES = "consejotecnico-calificaciones"
DYNAMODB_TABLE_DIARIO = "consejotecnico-diario"

# Security
JWT_SECRET = os.getenv("JWT_SECRET", "dev-secret-key")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_HOURS = 1

# Environment
DEBUG = os.getenv("DEBUG", "False") == "True"
ENVIRONMENT = os.getenv("ENVIRONMENT", "dev")

# MercadoPago
MP_ACCESS_TOKEN = os.getenv("MERCADOPAGO_SANDBOX_ACCESS_TOKEN") or os.getenv("MERCADOPAGO_ACCESS_TOKEN") or ""
MP_PUBLIC_KEY = os.getenv("MERCADOPAGO_SANDBOX_PUBLIC_KEY", "")
MP_WEBHOOK_SECRET = os.getenv("MERCADOPAGO_WEBHOOK_SECRET", "")
MP_SANDBOX_MODE = os.getenv("MERCADOPAGO_SANDBOX_MODE", "True") == "True"
MP_SUCCESS_URL = os.getenv("MERCADOPAGO_SUCCESS_URL", "https://consejotecnico.mx/pago/exito")
MP_FAILURE_URL = os.getenv("MERCADOPAGO_FAILURE_URL", "https://consejotecnico.mx/pago/error")
MP_PENDING_URL = os.getenv("MERCADOPAGO_PENDING_URL", "https://consejotecnico.mx/pago/pendiente")
MP_WEBHOOK_URL = os.getenv("MERCADOPAGO_WEBHOOK_URL", "")
