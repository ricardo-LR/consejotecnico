"""
Plan limits and validation for Workspace Maestro.
"""

from typing import Optional

PLAN_LIMITS = {
    "gratuito": {
        "grupos": 1,
        "alumnos_por_grupo": 50,
        "evaluaciones_por_grupo": 5,
        "pdf": False,
        "imprimir": False,
        "diario": False,
        "recursos": False,
    },
    "grado": {
        "grupos": 3,
        "alumnos_por_grupo": 999999,
        "evaluaciones_por_grupo": 999999,
        "pdf": True,
        "imprimir": True,
        "diario": True,
        "recursos": True,
    },
    "pro": {
        "grupos": 999999,
        "alumnos_por_grupo": 999999,
        "evaluaciones_por_grupo": 999999,
        "pdf": True,
        "imprimir": True,
        "diario": True,
        "recursos": True,
    },
}


def get_limits(plan_type: str) -> dict:
    return PLAN_LIMITS.get(plan_type, PLAN_LIMITS["gratuito"])


def can_create_grupo(plan_type: str, current_count: int) -> tuple[bool, Optional[str]]:
    limits = get_limits(plan_type)
    if current_count >= limits["grupos"]:
        return (
            False,
            f"Tu plan {plan_type} permite máximo {limits['grupos']} grupo(s). Actualiza tu plan para crear más.",
        )
    return True, None


def can_add_alumno(plan_type: str, current_count: int) -> tuple[bool, Optional[str]]:
    limits = get_limits(plan_type)
    if current_count >= limits["alumnos_por_grupo"]:
        return False, f"Tu plan permite máximo {limits['alumnos_por_grupo']} alumnos por grupo."
    return True, None


def can_create_evaluacion(plan_type: str, current_count: int) -> tuple[bool, Optional[str]]:
    limits = get_limits(plan_type)
    if current_count >= limits["evaluaciones_por_grupo"]:
        return False, f"Tu plan permite máximo {limits['evaluaciones_por_grupo']} evaluaciones por grupo."
    return True, None


def can_use_feature(plan_type: str, feature: str) -> tuple[bool, Optional[str]]:
    limits = get_limits(plan_type)
    if not limits.get(feature, False):
        return False, f"La función '{feature}' no está disponible en tu plan actual. Actualiza a Plan Grado o Pro."
    return True, None
