import hashlib
import secrets
from datetime import datetime, timedelta
from fastapi import HTTPException, Cookie
from backend.database import get_conn

SESSION_DURATION_HOURS = 8

# Guardamos sesiones en memoria (simple, sin escalabilidad, perfecto para este proyecto)
_sessions: dict[str, dict] = {}

def hash_password(password: str) -> str:
    return hashlib.sha256(password.encode()).hexdigest()

def verify_password(password: str, hashed: str) -> bool:
    return hash_password(password) == hashed

def create_session(negocio_id: int) -> str:
    token = secrets.token_urlsafe(32)
    _sessions[token] = {
        "negocio_id": negocio_id,
        "expires": datetime.utcnow() + timedelta(hours=SESSION_DURATION_HOURS)
    }
    return token

def get_current_negocio(session: str | None = Cookie(default=None)) -> int:
    if not session or session not in _sessions:
        raise HTTPException(status_code=401, detail="No autenticado")
    data = _sessions[session]
    if datetime.utcnow() > data["expires"]:
        del _sessions[session]
        raise HTTPException(status_code=401, detail="Sesión expirada")
    return data["negocio_id"]
