"""
fix_cloudfront_routing.py — Configure CloudFront to serve Next.js static export correctly.

Problem: /auth/register returns 404 because S3 only has auth/register.html.
Solution: On any 404, serve /index.html with status 200 so Next.js client-side
          router can handle the path.
"""

import boto3

DISTRIBUTION_ID = 'E1HBW81B60RV92'
PROFILE = 'consejotecnico'

session = boto3.Session(profile_name=PROFILE, region_name='us-east-1')
cloudfront = session.client('cloudfront')

# -- Get current config --
print(f"Fetching config for distribution {DISTRIBUTION_ID} ...")
response = cloudfront.get_distribution_config(Id=DISTRIBUTION_ID)
config = response['DistributionConfig']
etag = response['ETag']
print(f"Current ETag: {etag}")

# -- Set CustomErrorResponses: 404 -> /index.html (200) --
# Next.js static export: all routes are pre-rendered but S3 won't
# know to serve auth/register.html for the path /auth/register.
# Returning index.html lets the Next.js bundle boot and handle routing.
config['CustomErrorResponses'] = {
    'Quantity': 2,
    'Items': [
        {
            'ErrorCode': 403,
            'ResponsePagePath': '/index.html',
            'ResponseCode': '200',
            'ErrorCachingMinTTL': 0,
        },
        {
            'ErrorCode': 404,
            'ResponsePagePath': '/index.html',
            'ResponseCode': '200',
            'ErrorCachingMinTTL': 0,
        },
    ],
}

# -- Apply update --
try:
    update = cloudfront.update_distribution(
        Id=DISTRIBUTION_ID,
        DistributionConfig=config,
        IfMatch=etag,
    )
    print("CloudFront updated successfully")
    print(f"New ETag : {update['ETag']}")
    print(f"Status   : {update['Distribution']['Status']}")
    print("Waiting for deployment (~2-5 min) before testing.")
except Exception as exc:
    print(f"Error: {exc}")
