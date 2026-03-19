"""
Pricing model for Consejo Técnico.
Prices in MXN.
"""

# ──────────────────────────────────────────────
# Pricing tiers
# ──────────────────────────────────────────────

PRICING_TIERS = {
    # ── Subscription / bundle plans ──────────────────────────────────────────
    "gratis": {
        "price": 0,
        "planeaciones": 5,          # max downloads on free tier
        "days": 14,                  # trial window in days
        "label": "Gratis",
        "description": "5 planeaciones gratuitas durante 14 días",
    },
    "individual": {
        "price_min": 0,
        "price_max": 150,
        "planeaciones": 1,           # one plan per purchase
        "label": "Individual",
        "description": "Una planeación individual (precio según completitud, $0–$150 MXN)",
        "variable_price": True,      # price stored on the planeacion record
    },
    "pack_5": {
        "price": 300,
        "planeaciones": 5,
        "label": "Pack 5",
        "description": "5 planeaciones a precio especial",
    },
    "anual_grado": {
        "price": 999,
        "planeaciones": -1,          # -1 = unlimited
        "days": 365,
        "grado_restricted": True,    # limited to a single grade level
        "label": "Anual por Grado",
        "description": "Acceso ilimitado a un grado específico durante 1 año",
    },
    "anual_total": {
        "price": 1499,
        "planeaciones": -1,          # -1 = unlimited
        "days": 365,
        "grado_restricted": False,   # all grade levels
        "label": "Anual Total",
        "description": "Acceso ilimitado a todos los grados durante 1 año",
    },
    # ── Account-level plans (new) ─────────────────────────────────────────────
    "basico": {
        "price": 0,
        "planeaciones": -1,          # unlimited, but only free docs
        "price_filter": 0,           # can only access docs with price == 0
        "label": "Cuenta Básica",
        "description": "Acceso gratuito a todas las planeaciones GRATIS",
    },
    "grado": {
        "price": 499,
        "planeaciones": -1,          # unlimited within the locked grade
        "days": 365,
        "grado_restricted": True,
        "label": "Cuenta Grado",
        "description": "Acceso ilimitado a todas las planeaciones de un grado durante 1 año",
    },
}

# ──────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────

def get_tier(plan_type: str) -> dict | None:
    """Return tier config or None if not found."""
    return PRICING_TIERS.get(plan_type)


def calculate_individual_price(completeness_score: float) -> int:
    """
    Calculate the price of a single planeacion based on its completeness.

    completeness_score: 0.0 – 1.0
      formula : int(completeness_score * 150)
      minimum : $25 MXN
      maximum : $150 MXN

    Examples:
      0.17  → $25  (minimum floor)
      0.50  → $75
      0.75  → $112
      0.90  → $135
      1.00  → $150
    """
    min_price = 25
    max_price = 150
    price = int(max(0.0, min(1.0, completeness_score)) * max_price)
    return max(min_price, price)


def calculate_price(plan_type: str, completeness_score: float = 1.0) -> float:
    """
    Return the price in MXN for the given plan.

    For 'individual' plans the price is calculated by calculate_individual_price().
    For all other plans the price is fixed (from PRICING_TIERS).
    """
    tier = get_tier(plan_type)
    if tier is None:
        raise ValueError(f"Plan desconocido: {plan_type}")

    if plan_type == "individual":
        return float(calculate_individual_price(completeness_score))

    return float(tier.get("price", 0))


def validate_access(user_plan: dict, planeacion_grado: str) -> tuple[bool, str]:
    """
    Verify whether the user can download a planeación.

    user_plan expected keys:
        plan_type   : str  – one of PRICING_TIERS keys
        downloads   : int  – total downloads already made
        grado       : str  – grade level locked for anual_grado/grado (or None)
        active      : bool – whether the subscription is still active

    Returns (allowed: bool, reason: str).
    """
    if not user_plan.get("active", False):
        return False, "Tu plan no está activo o ha expirado."

    plan_type = user_plan.get("plan_type", "gratis")
    tier = get_tier(plan_type)
    if tier is None:
        return False, "Plan desconocido."

    max_downloads = tier.get("planeaciones", 0)

    # Unlimited plans
    if max_downloads == -1:
        if tier.get("grado_restricted"):
            allowed_grado = user_plan.get("grado")
            if allowed_grado and planeacion_grado != allowed_grado:
                return (
                    False,
                    f"Tu plan solo permite descargas del grado {allowed_grado}.",
                )
        return True, "Acceso concedido."

    # Plans with a download cap
    used = user_plan.get("downloads", 0)
    if used >= max_downloads:
        return (
            False,
            f"Has alcanzado el límite de {max_downloads} planeación(es) para tu plan '{plan_type}'.",
        )

    return True, "Acceso concedido."
