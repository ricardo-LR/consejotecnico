"""
Pricing model for Consejo Técnico.
Prices in MXN.
"""

# ──────────────────────────────────────────────
# Pricing tiers
# ──────────────────────────────────────────────

PRICING_TIERS = {
    # ── Per-document purchase (price stored on the planeacion record) ─────────
    "individual": {
        "price_min": 0,
        "price_max": 150,
        "planeaciones": 1,
        "label": "Individual",
        "description": "Una planeacion individual ($0-$150 MXN segun completitud)",
        "variable_price": True,
    },
    # ── Subscription plans ────────────────────────────────────────────────────
    "gratuito": {
        "price": 0,
        "planeaciones": -1,          # unlimited (free docs only)
        "label": "Gratuito",
        "description": "Cuenta gratuita — compra documentos individuales",
    },
    "grado": {
        "price": 499,
        "planeaciones": -1,          # unlimited within locked grade
        "days": 365,
        "grado_restricted": True,
        "label": "Plan Grado",
        "description": "Todos los documentos de tu grado por 365 dias",
    },
    "pro": {
        "price": 999,
        "planeaciones": -1,          # unlimited, all grades
        "days": 365,
        "grado_restricted": False,
        "label": "Plan Pro",
        "description": "Todos los documentos de todos los grados por 365 dias",
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

    plan_type = user_plan.get("plan_type", "gratuito")
    # backwards-compat: old "gratis" key maps to "gratuito"
    if plan_type == "gratis":
        plan_type = "gratuito"
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
