"""
Pricing handler — expose pricing tiers to the frontend.

Lambda entry point: handler(event, context)

Routes:
  GET /pricing  → get_pricing_tiers()
"""

import json

from src.models.pricing import PRICING_TIERS, calculate_price

# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

CORS_HEADERS = {
    "Content-Type": "application/json",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Access-Control-Allow-Methods": "GET,OPTIONS",
}


def _ok(body: dict, status: int = 200) -> dict:
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps(body, ensure_ascii=False),
    }


def _err(message: str, status: int = 400) -> dict:
    return {
        "statusCode": status,
        "headers": CORS_HEADERS,
        "body": json.dumps({"error": message}, ensure_ascii=False),
    }


# ──────────────────────────────────────────────
# Action
# ──────────────────────────────────────────────

def get_pricing_tiers() -> dict:
    """
    Return all pricing tiers with MXN prices.

    Response shape:
    {
      "currency": "MXN",
      "tiers": {
        "gratis":      { "price": 0,    "planeaciones": 5,  "days": 14,  ... },
        "individual":  { "price": "25-100", "planeaciones": 1, ... },
        "pack_5":      { "price": 300,  "planeaciones": 5,  ... },
        "anual_grado": { "price": 999,  "planeaciones": -1, "days": 365, "grado_restricted": true,  ... },
        "anual_total": { "price": 1499, "planeaciones": -1, "days": 365, "grado_restricted": false, ... }
      }
    }
    """
    # Build a clean, frontend-friendly copy of the tiers
    tiers: dict = {}
    for key, tier in PRICING_TIERS.items():
        entry = dict(tier)  # shallow copy
        # Represent variable price as a readable string for individual tier
        if key == "individual":
            entry["price"] = f"{tier['price_min']}-{tier['price_max']}"
            entry["price_min"] = tier["price_min"]
            entry["price_max"] = tier["price_max"]
        tiers[key] = entry

    return _ok(
        {
            "currency": "MXN",
            "tiers": tiers,
            "pricing_notes": [
                "Los precios están en pesos mexicanos (MXN).",
                "El plan Individual varía entre $25 y $100 MXN según la completitud de la planeación.",
                "Los planes Anuales tienen vigencia de 365 días a partir de la fecha de compra.",
                "El plan Gratis permite hasta 5 descargas en los primeros 14 días.",
            ],
        }
    )


# ──────────────────────────────────────────────
# Lambda entry point
# ──────────────────────────────────────────────

def handler(event: dict, context) -> dict:
    """AWS Lambda handler."""
    # Optionally support a ?plan_type=individual&score=0.8 query to get a specific price
    query_params = event.get("queryStringParameters") or {}
    plan_type = query_params.get("plan_type") or event.get("plan_type")
    score_raw = query_params.get("score") or event.get("score")

    if plan_type:
        try:
            score = float(score_raw) if score_raw is not None else 1.0
            price = calculate_price(plan_type, score)
        except ValueError as exc:
            return _err(str(exc), 400)
        return _ok({"plan_type": plan_type, "price": price, "currency": "MXN"})

    return get_pricing_tiers()
