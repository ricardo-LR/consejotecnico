from datetime import datetime, timedelta
from jose import JWTError, jwt
from src.config.settings import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_HOURS


def create_access_token(email: str, user_data: dict = None) -> str:
    """Create JWT token"""
    to_encode = {"email": email, **(user_data or {})}
    expire = datetime.utcnow() + timedelta(hours=JWT_EXPIRATION_HOURS)
    to_encode.update({"exp": expire})

    encoded_jwt = jwt.encode(to_encode, JWT_SECRET, algorithm=JWT_ALGORITHM)
    return encoded_jwt


def verify_token(token: str) -> dict:
    """Verify JWT token"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return payload
    except JWTError:
        return None
