"""
Input validators for Consejo Técnico handlers.
"""

import re

# ──────────────────────────────────────────────
# Constants
# ──────────────────────────────────────────────

_EMAIL_RE = re.compile(r"^[a-zA-Z0-9_.+\-]+@[a-zA-Z0-9\-]+\.[a-zA-Z0-9.\-]+$")
PASSWORD_MIN_LEN = 8
NOMBRE_MIN_LEN = 3

# ──────────────────────────────────────────────
# Public validators
# ──────────────────────────────────────────────


def validate_email(email: str) -> tuple[bool, str]:
    """
    Validate email format.
    Returns (valid: bool, error_message: str).
    """
    if not email or not isinstance(email, str):
        return False, "El correo electrónico es obligatorio."
    email = email.strip()
    if not _EMAIL_RE.match(email):
        return False, "El formato del correo electrónico no es válido."
    return True, ""


def validate_password(password: str) -> tuple[bool, str]:
    """
    Validate password strength.
    Minimum 8 characters required.
    Returns (valid: bool, error_message: str).
    """
    if not password or not isinstance(password, str):
        return False, "La contraseña es obligatoria."
    if len(password) < PASSWORD_MIN_LEN:
        return False, f"La contraseña debe tener al menos {PASSWORD_MIN_LEN} caracteres."
    return True, ""


def validate_nombre(nombre: str) -> tuple[bool, str]:
    """
    Validate display name.
    Minimum 3 characters required.
    Returns (valid: bool, error_message: str).
    """
    if not nombre or not isinstance(nombre, str):
        return False, "El nombre es obligatorio."
    nombre = nombre.strip()
    if len(nombre) < NOMBRE_MIN_LEN:
        return False, f"El nombre debe tener al menos {NOMBRE_MIN_LEN} caracteres."
    return True, ""


def validate_registration_input(email: str, password: str, nombre: str) -> tuple[bool, list[str]]:
    """
    Run all registration validations at once.
    Returns (valid: bool, errors: list[str]).
    """
    errors: list[str] = []

    ok, msg = validate_email(email)
    if not ok:
        errors.append(msg)

    ok, msg = validate_password(password)
    if not ok:
        errors.append(msg)

    ok, msg = validate_nombre(nombre)
    if not ok:
        errors.append(msg)

    return len(errors) == 0, errors
