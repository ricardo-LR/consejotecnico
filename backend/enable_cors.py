"""
enable_cors.py — Configure CORS for all API Gateway resources.

Sets up OPTIONS MOCK integration with proper CORS headers for every
resource that has at least one configured HTTP method.

Run: python backend/enable_cors.py
"""
import boto3

REGION       = 'us-east-1'
API_ID       = 'ceatmeuuhb'
PROFILE      = 'consejotecnico'
STAGE        = 'dev'

CORS_ALLOW_HEADERS = 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,x-signature,x-request-id'
CORS_ALLOW_METHODS = 'GET,POST,PUT,DELETE,OPTIONS'
CORS_ALLOW_ORIGIN  = '*'

session = boto3.Session(profile_name=PROFILE, region_name=REGION)
apigw   = session.client('apigateway')

# ──────────────────────────────────────────────────────────────────────────────

def _try(fn, *args, **kwargs):
    """Call fn; ignore ConflictException (resource already exists)."""
    try:
        return fn(*args, **kwargs)
    except apigw.exceptions.ConflictException:
        return None


def add_cors_options(resource_id: str, path: str) -> None:
    """Add OPTIONS MOCK integration + CORS method response to a resource."""

    # 1. OPTIONS method
    _try(apigw.put_method,
         restApiId=API_ID,
         resourceId=resource_id,
         httpMethod='OPTIONS',
         authorizationType='NONE')

    # 2. Method response (declares which headers the response will contain)
    _try(apigw.put_method_response,
         restApiId=API_ID,
         resourceId=resource_id,
         httpMethod='OPTIONS',
         statusCode='200',
         responseParameters={
             'method.response.header.Access-Control-Allow-Headers': False,
             'method.response.header.Access-Control-Allow-Methods': False,
             'method.response.header.Access-Control-Allow-Origin':  False,
         },
         responseModels={'application/json': 'Empty'})

    # 3. MOCK integration (returns statusCode 200 without calling any backend)
    _try(apigw.put_integration,
         restApiId=API_ID,
         resourceId=resource_id,
         httpMethod='OPTIONS',
         type='MOCK',
         requestTemplates={'application/json': '{"statusCode": 200}'})

    # 4. Integration response (maps the MOCK response to the CORS headers)
    _try(apigw.put_integration_response,
         restApiId=API_ID,
         resourceId=resource_id,
         httpMethod='OPTIONS',
         statusCode='200',
         responseParameters={
             'method.response.header.Access-Control-Allow-Headers': f"'{CORS_ALLOW_HEADERS}'",
             'method.response.header.Access-Control-Allow-Methods': f"'{CORS_ALLOW_METHODS}'",
             'method.response.header.Access-Control-Allow-Origin':  f"'{CORS_ALLOW_ORIGIN}'",
         },
         responseTemplates={'application/json': ''})

    print(f'  OPTIONS {path}  OK')


def patch_method_response_cors(resource_id: str, http_method: str, path: str) -> None:
    """
    Ensure GET/POST method responses declare the Allow-Origin header so
    API Gateway lets the Lambda-supplied header through (required in some
    API GW v1 passthrough configurations).
    """
    try:
        apigw.update_method_response(
            restApiId=API_ID,
            resourceId=resource_id,
            httpMethod=http_method,
            statusCode='200',
            patchOperations=[{
                'op': 'add',
                'path': '/responseParameters/method.response.header.Access-Control-Allow-Origin',
                'value': 'false',
            }],
        )
        print(f'  {http_method} {path}  -> CORS header declared  OK')
    except apigw.exceptions.ConflictException:
        pass   # already present
    except Exception as exc:
        print(f'  {http_method} {path}  -> warning: {exc}')


# ──────────────────────────────────────────────────────────────────────────────

resources = apigw.get_resources(restApiId=API_ID, limit=500)['items']

# Sort by path for clean output
resources.sort(key=lambda r: r.get('path', '/'))

print(f'Found {len(resources)} resources\n')
print('-- Configuring OPTIONS CORS ------------------------------------------')

for resource in resources:
    resource_id = resource['id']
    path        = resource.get('path', '/')
    methods     = set(resource.get('resourceMethods', {}).keys())

    # Skip resources with no methods at all (root, intermediate nodes)
    if not methods:
        print(f'  (no methods) {path}  skipped')
        continue

    # Skip if OPTIONS is already fully configured (has integration)
    if 'OPTIONS' in methods:
        # Check if integration exists; if not, still set it up
        try:
            integ = apigw.get_integration(
                restApiId=API_ID, resourceId=resource_id, httpMethod='OPTIONS'
            )
            if integ.get('type') == 'MOCK':
                print(f'  OPTIONS {path}  already configured, skipping')
                continue
        except apigw.exceptions.NotFoundException:
            pass  # method exists but no integration — fall through to add it

    add_cors_options(resource_id, path)

print()
print('-- Declaring CORS header on GET/POST method responses ----------------')

for resource in resources:
    resource_id = resource['id']
    path        = resource.get('path', '/')
    methods     = set(resource.get('resourceMethods', {}).keys())

    for method in methods - {'OPTIONS'}:
        patch_method_response_cors(resource_id, method, path)

# ── Redeploy ──────────────────────────────────────────────────────────────────
print()
print('-- Redeploying to stage:', STAGE, '-----------------------------------------')
deployment = apigw.create_deployment(
    restApiId=API_ID,
    stageName=STAGE,
    description='Enable CORS on all resources',
)
print(f'Deployment id: {deployment["id"]}')

base = f'https://{API_ID}.execute-api.{REGION}.amazonaws.com/{STAGE}'
print(f'\nDONE — API available at: {base}')
print()
print('Quick CORS check:')
print(f'  curl -i -X OPTIONS {base}/auth/login \\')
print(f'    -H "Origin: http://localhost:3000" \\')
print(f'    -H "Access-Control-Request-Method: POST"')
