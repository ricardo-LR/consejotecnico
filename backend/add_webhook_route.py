"""Add POST /webhook route to the existing API Gateway and redeploy."""
import boto3

REGION = 'us-east-1'
ACCOUNT_ID = '036040252313'
API_ID = 'ceatmeuuhb'
PROFILE = 'consejotecnico'
STAGE = 'dev'

session = boto3.Session(profile_name=PROFILE, region_name=REGION)
apigw = session.client('apigateway')
lmb = session.client('lambda')


def lambda_uri(name):
    arn = f'arn:aws:lambda:{REGION}:{ACCOUNT_ID}:function:consejotecnico-{name}'
    return f'arn:aws:apigateway:{REGION}:lambda:path/2015-03-31/functions/{arn}/invocations'


# Get root resource id
resources = apigw.get_resources(restApiId=API_ID)['items']
root_id = next(r['id'] for r in resources if r['path'] == '/')
print(f'Root resource id: {root_id}')

# Get or create /webhook resource
webhook_id = None
for r in resources:
    if r.get('pathPart') == 'webhook' and r.get('parentId') == root_id:
        webhook_id = r['id']
        break

if not webhook_id:
    resp = apigw.create_resource(restApiId=API_ID, parentId=root_id, pathPart='webhook')
    webhook_id = resp['id']
    print(f'/webhook resource created: {webhook_id}')
else:
    print(f'/webhook resource already exists: {webhook_id}')

# Add POST method
try:
    apigw.put_method(
        restApiId=API_ID, resourceId=webhook_id,
        httpMethod='POST', authorizationType='NONE',
    )
except apigw.exceptions.ConflictException:
    pass

try:
    apigw.put_method_response(
        restApiId=API_ID, resourceId=webhook_id,
        httpMethod='POST', statusCode='200',
        responseParameters={'method.response.header.Access-Control-Allow-Origin': False},
        responseModels={'application/json': 'Empty'},
    )
except apigw.exceptions.ConflictException:
    pass

try:
    apigw.put_integration(
        restApiId=API_ID, resourceId=webhook_id,
        httpMethod='POST', type='AWS_PROXY',
        integrationHttpMethod='POST',
        uri=lambda_uri('webhook'),
    )
except apigw.exceptions.ConflictException:
    pass

# Add OPTIONS for CORS
try:
    apigw.put_method(
        restApiId=API_ID, resourceId=webhook_id,
        httpMethod='OPTIONS', authorizationType='NONE',
    )
except apigw.exceptions.ConflictException:
    pass

try:
    apigw.put_method_response(
        restApiId=API_ID, resourceId=webhook_id,
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
        restApiId=API_ID, resourceId=webhook_id,
        httpMethod='OPTIONS', type='MOCK',
        requestTemplates={'application/json': '{"statusCode": 200}'},
    )
except apigw.exceptions.ConflictException:
    pass

try:
    apigw.put_integration_response(
        restApiId=API_ID, resourceId=webhook_id,
        httpMethod='OPTIONS', statusCode='200',
        responseParameters={
            'method.response.header.Access-Control-Allow-Origin': "'*'",
            'method.response.header.Access-Control-Allow-Headers': "'Content-Type,Authorization,x-signature,x-request-id'",
            'method.response.header.Access-Control-Allow-Methods': "'POST,OPTIONS'",
        },
        responseTemplates={'application/json': ''},
    )
except apigw.exceptions.ConflictException:
    pass

print('  POST /webhook OK')
print('  OPTIONS /webhook OK')

# Grant API Gateway permission to invoke webhook Lambda
try:
    lmb.add_permission(
        FunctionName='consejotecnico-webhook',
        StatementId=f'apigw-post-{webhook_id}',
        Action='lambda:InvokeFunction',
        Principal='apigateway.amazonaws.com',
        SourceArn=f'arn:aws:execute-api:{REGION}:{ACCOUNT_ID}:{API_ID}/*/POST/webhook',
    )
    print('  Lambda permission added OK')
except lmb.exceptions.ResourceConflictException:
    print('  Lambda permission already exists')

# Redeploy
deployment = apigw.create_deployment(
    restApiId=API_ID,
    stageName=STAGE,
    description='Add POST /webhook route + MP sandbox integration',
)
print(f'\nRedeployed. Deployment id: {deployment["id"]}')
print(f'Webhook URL: https://{API_ID}.execute-api.{REGION}.amazonaws.com/{STAGE}/webhook')
