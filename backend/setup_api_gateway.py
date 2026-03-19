"""
Creates API Gateway resources, methods, and Lambda integrations for CONSEJOTECNICO.
Run: python backend/setup_api_gateway.py
"""
import boto3
import json

REGION = 'us-east-1'
ACCOUNT_ID = '036040252313'
API_ID = 'ceatmeuuhb'
PROFILE = 'consejotecnico'
STAGE = 'dev'

session = boto3.Session(profile_name=PROFILE, region_name=REGION)
apigw = session.client('apigateway')
lmb = session.client('lambda')

def lambda_arn(name):
    return f'arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:consejotecnico-{name}'

def lambda_uri(name):
    arn = lambda_arn(name)
    return f'arn:aws:apigateway:{REGION}:lambda:path/2015-03-31/functions/{arn}/invocations'

def cors_headers():
    return {
        'method.response.header.Access-Control-Allow-Origin': "'*'",
        'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization,X-Amz-Date,X-Api-Key'",
        'method.response.header.Access-Control-Allow-Methods': "'GET,POST,PUT,DELETE,OPTIONS'",
    }

def add_cors_options(resource_id):
    """Add OPTIONS method with CORS mock integration to a resource."""
    try:
        apigw.put_method(
            restApiId=API_ID,
            resourceId=resource_id,
            httpMethod='OPTIONS',
            authorizationType='NONE',
        )
    except apigw.exceptions.ConflictException:
        pass

    try:
        apigw.put_method_response(
            restApiId=API_ID,
            resourceId=resource_id,
            httpMethod='OPTIONS',
            statusCode='200',
            responseParameters={
                'method.response.header.Access-Control-Allow-Headers': False,
                'method.response.header.Access-Control-Allow-Methods': False,
                'method.response.header.Access-Control-Allow-Origin': False,
            },
            responseModels={'application/json': 'Empty'},
        )
    except apigw.exceptions.ConflictException:
        pass
    try:
        apigw.put_integration(
            restApiId=API_ID,
            resourceId=resource_id,
            httpMethod='OPTIONS',
            type='MOCK',
            requestTemplates={'application/json': '{"statusCode": 200}'},
        )
    except apigw.exceptions.ConflictException:
        pass
    try:
        apigw.put_integration_response(
            restApiId=API_ID,
            resourceId=resource_id,
            httpMethod='OPTIONS',
            statusCode='200',
            responseParameters=cors_headers(),
            responseTemplates={'application/json': ''},
        )
    except apigw.exceptions.ConflictException:
        pass

def add_lambda_method(resource_id, http_method, lambda_name):
    """Add a method with Lambda proxy integration."""
    try:
        apigw.put_method(
            restApiId=API_ID,
            resourceId=resource_id,
            httpMethod=http_method,
            authorizationType='NONE',
        )
    except apigw.exceptions.ConflictException:
        pass

    try:
        apigw.put_method_response(
            restApiId=API_ID,
            resourceId=resource_id,
            httpMethod=http_method,
            statusCode='200',
            responseParameters={
                'method.response.header.Access-Control-Allow-Origin': False,
            },
            responseModels={'application/json': 'Empty'},
        )
    except apigw.exceptions.ConflictException:
        pass
    try:
        apigw.put_integration(
            restApiId=API_ID,
            resourceId=resource_id,
            httpMethod=http_method,
            type='AWS_PROXY',
            integrationHttpMethod='POST',
            uri=lambda_uri(lambda_name),
        )
    except apigw.exceptions.ConflictException:
        pass

    # Add Lambda permission for API Gateway to invoke
    try:
        lmb.add_permission(
            FunctionName=f'consejotecnico-{lambda_name}',
            StatementId=f'apigw-{http_method.lower()}-{resource_id}',
            Action='lambda:InvokeFunction',
            Principal='apigateway.amazonaws.com',
            SourceArn=f'arn:aws:execute-api:{REGION}:{ACCOUNT_ID}:{API_ID}/*/{http_method}/*',
        )
    except lmb.exceptions.ResourceConflictException:
        pass

def get_or_create_resource(parent_id, path_part):
    """Get existing resource or create new one."""
    resources = apigw.get_resources(restApiId=API_ID)['items']
    for r in resources:
        if r.get('pathPart') == path_part and r.get('parentId') == parent_id:
            return r['id']
    resp = apigw.create_resource(
        restApiId=API_ID,
        parentId=parent_id,
        pathPart=path_part,
    )
    return resp['id']

# Get root resource id
resources = apigw.get_resources(restApiId=API_ID)['items']
root_id = next(r['id'] for r in resources if r['path'] == '/')
print(f'Root resource id: {root_id}')

# ─── /auth ──────────────────────────────────────
auth_id = get_or_create_resource(root_id, 'auth')
print(f'/auth id: {auth_id}')

auth_login_id = get_or_create_resource(auth_id, 'login')
add_lambda_method(auth_login_id, 'POST', 'auth')
add_cors_options(auth_login_id)
print('  POST /auth/login OK')

auth_register_id = get_or_create_resource(auth_id, 'register')
add_lambda_method(auth_register_id, 'POST', 'auth')
add_cors_options(auth_register_id)
print('  POST /auth/register OK')

# ─── /planeaciones ───────────────────────────────
plan_id = get_or_create_resource(root_id, 'planeaciones')
print(f'/planeaciones id: {plan_id}')

add_lambda_method(plan_id, 'GET', 'planeaciones')
add_cors_options(plan_id)
print('  GET /planeaciones OK')

plan_detail_id = get_or_create_resource(plan_id, '{id}')
add_lambda_method(plan_detail_id, 'GET', 'planeaciones')
add_cors_options(plan_detail_id)
print('  GET /planeaciones/{id} OK')

# ─── /pricing ────────────────────────────────────
pricing_id = get_or_create_resource(root_id, 'pricing')
print(f'/pricing id: {pricing_id}')

add_lambda_method(pricing_id, 'GET', 'pricing')
add_cors_options(pricing_id)
print('  GET /pricing OK')

# ─── /purchase ───────────────────────────────────
purchase_id = get_or_create_resource(root_id, 'purchase')
print(f'/purchase id: {purchase_id}')

add_lambda_method(purchase_id, 'POST', 'purchase')
add_cors_options(purchase_id)
print('  POST /purchase OK')

# ─── Deploy to stage ─────────────────────────────
print(f'\nDeploying to stage: {STAGE}...')
deployment = apigw.create_deployment(
    restApiId=API_ID,
    stageName=STAGE,
    stageDescription='Dev stage',
    description='Initial deployment',
)
print(f'Deployment id: {deployment["id"]}')

api_url = f'https://{API_ID}.execute-api.{REGION}.amazonaws.com/{STAGE}'
print(f'\nDONE API Gateway deployed!')
print(f'Base URL: {api_url}')
print(f'  POST {api_url}/auth/login')
print(f'  POST {api_url}/auth/register')
print(f'  GET  {api_url}/planeaciones')
print(f'  GET  {api_url}/planeaciones/{{id}}')
print(f'  GET  {api_url}/pricing')
print(f'  POST {api_url}/purchase')
