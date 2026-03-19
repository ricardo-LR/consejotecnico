"""Add POST /webhook/mercadopago route to API Gateway (alias for /webhook)."""
import boto3

REGION = 'us-east-1'
ACCOUNT_ID = '036040252313'
API_ID = 'ceatmeuuhb'
PROFILE = 'consejotecnico'
STAGE = 'dev'

session = boto3.Session(profile_name=PROFILE, region_name=REGION)
apigw = session.client('apigateway')
lmb = session.client('lambda')


def lambda_uri():
    arn = f'arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:consejotecnico-webhook'
    return f'arn:aws:apigateway:{REGION}:lambda:path/2015-03-31/functions/{arn}/invocations'


# Get existing resources
resources = apigw.get_resources(restApiId=API_ID)['items']
root_id = next(r['id'] for r in resources if r['path'] == '/')
webhook_id = next(r['id'] for r in resources if r.get('path') == '/webhook')
print(f'Root id: {root_id}')
print(f'/webhook id: {webhook_id}')

# Get or create /webhook/mercadopago
mp_webhook_id = None
for r in resources:
    if r.get('pathPart') == 'mercadopago' and r.get('parentId') == webhook_id:
        mp_webhook_id = r['id']
        break

if not mp_webhook_id:
    resp = apigw.create_resource(
        restApiId=API_ID, parentId=webhook_id, pathPart='mercadopago'
    )
    mp_webhook_id = resp['id']
    print(f'/webhook/mercadopago created: {mp_webhook_id}')
else:
    print(f'/webhook/mercadopago already exists: {mp_webhook_id}')

# POST method
try:
    apigw.put_method(
        restApiId=API_ID, resourceId=mp_webhook_id,
        httpMethod='POST', authorizationType='NONE',
    )
except apigw.exceptions.ConflictException:
    pass

try:
    apigw.put_method_response(
        restApiId=API_ID, resourceId=mp_webhook_id,
        httpMethod='POST', statusCode='200',
        responseParameters={'method.response.header.Access-Control-Allow-Origin': False},
        responseModels={'application/json': 'Empty'},
    )
except apigw.exceptions.ConflictException:
    pass

try:
    apigw.put_integration(
        restApiId=API_ID, resourceId=mp_webhook_id,
        httpMethod='POST', type='AWS_PROXY',
        integrationHttpMethod='POST',
        uri=lambda_uri(),
    )
except apigw.exceptions.ConflictException:
    pass

print('  POST /webhook/mercadopago -> consejotecnico-webhook OK')

# OPTIONS for CORS
try:
    apigw.put_method(
        restApiId=API_ID, resourceId=mp_webhook_id,
        httpMethod='OPTIONS', authorizationType='NONE',
    )
except apigw.exceptions.ConflictException:
    pass

try:
    apigw.put_method_response(
        restApiId=API_ID, resourceId=mp_webhook_id,
        httpMethod='OPTIONS', statusCode='200',
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
        restApiId=API_ID, resourceId=mp_webhook_id,
        httpMethod='OPTIONS', type='MOCK',
        requestTemplates={'application/json': '{"statusCode": 200}'},
    )
except apigw.exceptions.ConflictException:
    pass

try:
    apigw.put_integration_response(
        restApiId=API_ID, resourceId=mp_webhook_id,
        httpMethod='OPTIONS', statusCode='200',
        responseParameters={
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Headers':
                "'Content-Type,Authorization,x-signature,x-request-id'",
            'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
        },
        responseTemplates={'application/json': ''},
    )
except apigw.exceptions.ConflictException:
    pass

print('  OPTIONS /webhook/mercadopago OK')

# Lambda invoke permission
try:
    lmb.add_permission(
        FunctionName='consejotecnico-webhook',
        StatementId=f'apigw-mp-webhook-{mp_webhook_id}',
        Action='lambda:InvokeFunction',
        Principal='apigateway.amazonaws.com',
        SourceArn=f'arn:aws:execute-api:{REGION}:{ACCOUNT_ID}:{API_ID}/*/POST/webhook/mercadopago',
    )
    print('  Lambda permission added OK')
except lmb.exceptions.ResourceConflictException:
    print('  Lambda permission already exists')

# Redeploy
deployment = apigw.create_deployment(
    restApiId=API_ID,
    stageName=STAGE,
    description='Add POST /webhook/mercadopago alias route',
)
print(f'\nRedeployed. id: {deployment["id"]}')
url_base = f'https://{API_ID}.execute-api.{REGION}.amazonaws.com/{STAGE}'
print(f'\nWebhook endpoints:')
print(f'  POST {url_base}/webhook')
print(f'  POST {url_base}/webhook/mercadopago')
