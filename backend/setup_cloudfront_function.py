"""
setup_cloudfront_function.py — Create a CloudFront Function that rewrites
clean URL paths to their .html file equivalents in S3.

Problem: Next.js static export generates auth/register.html, catalog.html, etc.
         CloudFront+S3 serves index.html (via 403->index.html) for every path
         that doesn't have an exact S3 key match.  This means /auth/register
         always gets the landing page HTML instead of auth/register.html, so
         React renders the landing page regardless of the URL.

Fix:    A CloudFront Function intercepts viewer requests and appends .html to
        any path that (a) has no file extension and (b) has no trailing slash.
        /auth/register  ->  /auth/register.html
        /catalog        ->  /catalog.html
        /               ->  /index.html     (unchanged, S3 already serves it)
        /_next/...      ->  unchanged        (has extension)

Usage:
    cd C:/Users/Usuario/Documents/consejotecnico
    python backend/setup_cloudfront_function.py
"""

import boto3
import time

PROFILE         = 'consejotecnico'
DISTRIBUTION_ID = 'E1HBW81B60RV92'
FUNCTION_NAME   = 'consejotecnico-spa-rewrite'

# CloudFront Functions run in JavaScript (not Python)
FUNCTION_CODE = """
function handler(event) {
    var request = event.request;
    var uri = request.uri;

    // Pass through anything that already has a file extension
    // (JS chunks, CSS, images, fonts, etc.)
    var dotIndex = uri.lastIndexOf('.');
    var slashAfterDot = uri.indexOf('/', dotIndex);
    if (dotIndex !== -1 && slashAfterDot === -1) {
        // URI has a file extension (e.g. /_next/static/chunk/abc.js)
        return request;
    }

    // Strip trailing slash (except root)
    if (uri !== '/' && uri.endsWith('/')) {
        uri = uri.slice(0, -1);
    }

    // Map root to index.html, everything else to <path>.html
    if (uri === '' || uri === '/') {
        request.uri = '/index.html';
    } else {
        request.uri = uri + '.html';
    }

    return request;
}
"""

session  = boto3.Session(profile_name=PROFILE, region_name='us-east-1')
cf       = session.client('cloudfront')

# ── 1. Create (or update) the function ─────────────────────────────────────

print(f"Creating/updating CloudFront Function '{FUNCTION_NAME}' ...")

existing_etag = None
try:
    existing = cf.describe_function(Name=FUNCTION_NAME)
    existing_etag = existing['ETag']
    print(f"  Function already exists (ETag={existing_etag}) — will update.")
except cf.exceptions.NoSuchFunctionExists:
    print("  Function does not exist — will create.")

if existing_etag:
    resp = cf.update_function(
        Name=FUNCTION_NAME,
        IfMatch=existing_etag,
        FunctionConfig={
            'Comment': 'Rewrite clean URLs to .html files for Next.js static export',
            'Runtime': 'cloudfront-js-2.0',
        },
        FunctionCode=FUNCTION_CODE.encode(),
    )
else:
    resp = cf.create_function(
        Name=FUNCTION_NAME,
        FunctionConfig={
            'Comment': 'Rewrite clean URLs to .html files for Next.js static export',
            'Runtime': 'cloudfront-js-2.0',
        },
        FunctionCode=FUNCTION_CODE.encode(),
    )

fn_arn  = resp['FunctionSummary']['FunctionMetadata']['FunctionARN']
fn_etag = resp['ETag']
print(f"  Function ARN : {fn_arn}")
print(f"  ETag         : {fn_etag}")

# ── 2. Publish the function ─────────────────────────────────────────────────

print("\nPublishing function ...")
pub = cf.publish_function(Name=FUNCTION_NAME, IfMatch=fn_etag)
pub_arn = pub['FunctionSummary']['FunctionMetadata']['FunctionARN']
stage   = pub['FunctionSummary']['FunctionMetadata']['Stage']
print(f"  Published — Stage: {stage}  ARN: {pub_arn}")

# ── 3. Associate with the distribution's default cache behavior ─────────────

print(f"\nAssociating function with distribution {DISTRIBUTION_ID} ...")
dist_resp = cf.get_distribution_config(Id=DISTRIBUTION_ID)
cfg       = dist_resp['DistributionConfig']
dist_etag = dist_resp['ETag']

# Find the default cache behavior
dcb = cfg['DefaultCacheBehavior']

# Build updated FunctionAssociations
existing_assocs = dcb.get('FunctionAssociations', {}).get('Items', [])
# Remove any existing viewer-request function association
existing_assocs = [
    a for a in existing_assocs
    if a['EventType'] != 'viewer-request'
]
existing_assocs.append({
    'FunctionARN': fn_arn,
    'EventType': 'viewer-request',
})

dcb['FunctionAssociations'] = {
    'Quantity': len(existing_assocs),
    'Items': existing_assocs,
}
cfg['DefaultCacheBehavior'] = dcb

update = cf.update_distribution(
    Id=DISTRIBUTION_ID,
    DistributionConfig=cfg,
    IfMatch=dist_etag,
)
print(f"  Distribution updated  Status={update['Distribution']['Status']}")
print(f"  New ETag: {update['ETag']}")

print("\nWaiting ~2 minutes for CloudFront to propagate ...")
for i in range(12):
    time.sleep(10)
    print(f"  {(i+1)*10}s...", end='\r', flush=True)
print()

# ── 4. Quick smoke test ─────────────────────────────────────────────────────

from urllib.request import urlopen
from urllib.error import HTTPError

print("\nSmoke test after propagation:")
CLOUDFRONT_URL = "https://db0i745ypndsx.cloudfront.net"
pages = [
    ('/', 'CONSEJOTECNICO'),
    ('/auth/register', 'Crear cuenta'),
    ('/auth/login', 'sesión'),
    ('/catalog', 'Catálogo'),
    ('/checkout', 'checkout'),
    ('/dashboard', 'dashboard'),
]

for path, keyword in pages:
    try:
        r = urlopen(CLOUDFRONT_URL + path, timeout=10)
        body = r.read(8192).decode('utf-8', errors='ignore')
        if keyword.lower() in body.lower():
            print(f"  OK   {path}  ('{keyword}' found)")
        elif 'AccessDenied' in body or '<Error>' in body:
            print(f"  FAIL {path}  (AccessDenied)")
        else:
            print(f"  WARN {path}  ('{keyword}' not found — may be wrong page)")
    except HTTPError as e:
        print(f"  HTTP{e.code} {path}")
    except Exception as e:
        print(f"  ERR  {path}  {e}")
