import os
from dotenv import load_dotenv

load_dotenv()

# AWS
AWS_REGION = os.getenv('AWS_REGION', 'us-east-1')
DYNAMODB_TABLE_USERS = 'consejotecnico-users'
DYNAMODB_TABLE_PLANEACIONES = 'consejotecnico-planeaciones'
DYNAMODB_TABLE_PURCHASES = 'consejotecnico-purchases'

# Security
JWT_SECRET = os.getenv('JWT_SECRET', 'dev-secret-key')
JWT_ALGORITHM = 'HS256'
JWT_EXPIRATION_HOURS = 1

# Environment
DEBUG = os.getenv('DEBUG', 'False') == 'True'
ENVIRONMENT = os.getenv('ENVIRONMENT', 'dev')
