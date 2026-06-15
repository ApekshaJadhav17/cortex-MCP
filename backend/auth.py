import os
from datetime import datetime, timedelta

import jwt
from dotenv import load_dotenv
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

load_dotenv()

_SECRET = os.getenv("JWT_SECRET", "cortex-dev-secret-change-in-production")
_PASSWORD = os.getenv("CORTEX_PASSWORD", "cortex")
_ALGORITHM = "HS256"
_EXPIRE_DAYS = 30

_bearer = HTTPBearer(auto_error=False)


def create_token() -> str:
    payload = {
        "sub": "cortex",
        "exp": datetime.utcnow() + timedelta(days=_EXPIRE_DAYS),
    }
    return jwt.encode(payload, _SECRET, algorithm=_ALGORITHM)


def check_password(password: str) -> bool:
    return password == _PASSWORD


def require_auth(
    credentials: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> None:
    if not credentials:
        raise HTTPException(status_code=401, detail="Authentication required")
    try:
        jwt.decode(credentials.credentials, _SECRET, algorithms=[_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Session expired — please log in again")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Invalid token")
