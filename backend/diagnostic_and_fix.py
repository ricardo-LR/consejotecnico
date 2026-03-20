"""
diagnostic_and_fix.py — Full diagnostic + auto-fix for CloudFront/S3 access issues.
"""

import boto3
import json
import time
from urllib.request import urlopen
from urllib.error import HTTPError, URLError

session = boto3.Session(profile_name='consejotecnico', region_name='us-east-1')
s3 = session.client('s3')
cf = session.client('cloudfront')

BUCKET           = 'consejotecnico-frontend-dev'
DISTRIBUTION_ID  = 'E1HBW81B60RV92'
CLOUDFRONT_URL   = 'https://db0i745ypndsx.cloudfront.net'

PAGES = [
    ('/',               'index.html'),
    ('/auth/login',     'auth/login.html'),
    ('/auth/register',  'auth/register.html'),
    ('/catalog',        'catalog.html'),
    ('/checkout',       'checkout.html'),
    ('/dashboard',      'dashboard.html'),
]

# ── helpers ──────────────────────────────────────────────────────────────────

def test_page(page: str) -> str:
    url = f"{CLOUDFRONT_URL}{page}"
    try:
        resp = urlopen(url, timeout=8)
        body = resp.read(4096).decode('utf-8', errors='ignore')
        if 'AccessDenied' in body or '<Error>' in body:
            return 'DENIED'
        return 'OK'
    except HTTPError as e:
        body = e.read(512).decode('utf-8', errors='ignore')
        if 'AccessDenied' in body or '<Error>' in body:
            return 'DENIED'
        return f'HTTP{e.code}'
    except URLError as e:
        return f'ERR:{str(e.reason)[:30]}'
    except Exception as e:
        return f'ERR:{str(e)[:30]}'

# ── 1. S3 files ───────────────────────────────────────────────────────────────

print("=" * 60)
print("DIAGNOSTIC COMPLETO - CONSEJOTECNICO")
print("=" * 60)

print("\n1. VERIFICANDO ARCHIVOS EN S3...")
for page, key in PAGES:
    try:
        s3.head_object(Bucket=BUCKET, Key=key)
        print(f"  OK  {key}")
    except Exception:
        print(f"  MISSING  {key}")

# ── 2. Bucket policy ──────────────────────────────────────────────────────────

print("\n2. VERIFICANDO BUCKET POLICY...")
try:
    pol = json.loads(s3.get_bucket_policy(Bucket=BUCKET)['Policy'])
    for stmt in pol['Statement']:
        principal = stmt.get('Principal', {})
        arn = principal.get('AWS', principal) if isinstance(principal, dict) else principal
        print(f"  Principal : {arn}")
        if 'E4YNFUCPP3LO9' in str(arn):
            print(f"  OAI E4YNFUCPP3LO9 presente OK")
        else:
            print(f"  OAI INCORRECTO o diferente")
except Exception as e:
    print(f"  ERROR leyendo policy: {e}")

# ── 3. CloudFront config ──────────────────────────────────────────────────────

print("\n3. VERIFICANDO CLOUDFRONT CONFIG...")
try:
    dist_cfg = cf.get_distribution(Id=DISTRIBUTION_ID)['Distribution']['DistributionConfig']

    for origin in dist_cfg['Origins']['Items']:
        print(f"  Origin ID : {origin['Id']}")
        oai_val = origin.get('S3OriginConfig', {}).get('OriginAccessIdentity', 'NONE')
        print(f"  OAI       : {oai_val}")

    cust = dist_cfg.get('CustomErrorResponses', {})
    qty  = cust.get('Quantity', 0)
    if qty:
        print(f"  CustomErrorResponses: {qty} rule(s)")
        for rule in cust.get('Items', []):
            print(f"    {rule['ErrorCode']} -> {rule['ResponsePagePath']} ({rule['ResponseCode']})")
    else:
        print("  NO CustomErrorResponses configured")
except Exception as e:
    print(f"  ERROR: {e}")

# ── 4. Live page test ─────────────────────────────────────────────────────────

print("\n4. PROBANDO ACCESO A PAGINAS...")
results = {}
for page, _ in PAGES:
    status = test_page(page)
    icon   = 'OK' if status == 'OK' else 'FAIL'
    print(f"  {icon}  {page:25} -> {status}")
    results[page] = status

ok_count    = sum(1 for v in results.values() if v == 'OK')
error_count = len(results) - ok_count

print(f"\n  OK: {ok_count}/6   FAIL: {error_count}/6")

# ── 5. Auto-fix ───────────────────────────────────────────────────────────────

if error_count == 0:
    print("\nAll pages OK — no fix needed.")
else:
    print(f"\n5. APLICANDO FIX AUTOMATICO...\n")

    # Get OAI ID
    dist_cfg = cf.get_distribution(Id=DISTRIBUTION_ID)['Distribution']['DistributionConfig']
    oai_full = dist_cfg['Origins']['Items'][0]['S3OriginConfig']['OriginAccessIdentity']
    oai_id   = oai_full.split('/')[-1]
    print(f"  OAI ID   : {oai_id}")
    print(f"  OAI full : {oai_full}")

    # Apply correct bucket policy
    new_policy = {
        "Version": "2012-10-17",
        "Statement": [
            {
                "Sid": "CloudFrontOAIAccess",
                "Effect": "Allow",
                "Principal": {
                    "AWS": f"arn:aws:iam::cloudfront:user/CloudFront Origin Access Identity {oai_id}"
                },
                "Action": "s3:GetObject",
                "Resource": f"arn:aws:s3:::{BUCKET}/*"
            }
        ]
    }

    try:
        s3.put_bucket_policy(Bucket=BUCKET, Policy=json.dumps(new_policy))
        print(f"  Bucket policy updated OK")
    except Exception as e:
        print(f"  ERROR updating bucket policy: {e}")

    # Ensure CustomErrorResponses are set
    try:
        resp = cf.get_distribution_config(Id=DISTRIBUTION_ID)
        cfg  = resp['DistributionConfig']
        etag = resp['ETag']

        cfg['CustomErrorResponses'] = {
            'Quantity': 2,
            'Items': [
                {'ErrorCode': 403, 'ResponsePagePath': '/index.html', 'ResponseCode': '200', 'ErrorCachingMinTTL': 0},
                {'ErrorCode': 404, 'ResponsePagePath': '/index.html', 'ResponseCode': '200', 'ErrorCachingMinTTL': 0},
            ],
        }

        cf.update_distribution(Id=DISTRIBUTION_ID, DistributionConfig=cfg, IfMatch=etag)
        print(f"  CloudFront CustomErrorResponses updated OK")
    except Exception as e:
        print(f"  ERROR updating CloudFront: {e}")

    # Invalidate
    try:
        inv = cf.create_invalidation(
            DistributionId=DISTRIBUTION_ID,
            InvalidationBatch={
                'Paths': {'Quantity': 1, 'Items': ['/*']},
                'CallerReference': str(int(time.time())),
            }
        )
        inv_id = inv['Invalidation']['Id']
        print(f"  CloudFront invalidation created: {inv_id}")
    except Exception as e:
        print(f"  ERROR creating invalidation: {e}")

    # Wait for propagation
    print("\n  Waiting 90 seconds for CloudFront to propagate...")
    for i in range(9):
        time.sleep(10)
        print(f"    {(i+1)*10}s...", end='\r', flush=True)
    print()

    # Re-test
    print("\n6. RE-TESTANDO DESPUES DEL FIX...\n")
    results_after = {}
    for page, _ in PAGES:
        status = test_page(page)
        icon   = 'OK' if status == 'OK' else 'FAIL'
        print(f"  {icon}  {page:25} -> {status}")
        results_after[page] = status

    ok_after = sum(1 for v in results_after.values() if v == 'OK')
    print(f"\n  OK: {ok_after}/6   FAIL: {len(results_after)-ok_after}/6")

    if ok_after == 6:
        print("\nTODAS LAS PAGINAS FUNCIONAN CORRECTAMENTE")
    else:
        print("\nPAGINAS CON PROBLEMAS RESTANTES:")
        for page, st in results_after.items():
            if st != 'OK':
                print(f"  - {page}: {st}")

print("\n" + "=" * 60)
