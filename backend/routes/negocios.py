from fastapi import APIRouter, HTTPException, Response, Depends
from pydantic import BaseModel
from database import get_conn
from auth import hash_password, verify_password, create_session, get_current_negocio

router = APIRouter(prefix="/negocios", tags=["negocios"])

class LoginData(BaseModel):
    nombre: str
    password: str

class RegisterData(BaseModel):
    nombre: str
    password: str
    descripcion: str = ""
    direccion: str = ""
    lat: float | None = None
    lng: float | None = None

@router.post("/registro")
def registrar(data: RegisterData, response: Response):
    with get_conn() as conn:
        existe = conn.execute(
            "SELECT id FROM negocios WHERE nombre = ?", (data.nombre,)
        ).fetchone()
        if existe:
            raise HTTPException(status_code=400, detail="Ese nombre ya está en uso")
        cur = conn.execute(
            "INSERT INTO negocios (nombre, password_hash, descripcion, direccion, lat, lng) VALUES (?, ?, ?, ?, ?, ?)",
            (data.nombre, hash_password(data.password), data.descripcion, data.direccion, data.lat, data.lng)
        )
        negocio_id = cur.lastrowid

    token = create_session(negocio_id)
    response.set_cookie("session", token, httponly=True, samesite="lax")
    return {"ok": True, "negocio_id": negocio_id}

@router.post("/login")
def login(data: LoginData, response: Response):
    with get_conn() as conn:
        negocio = conn.execute(
            "SELECT id, password_hash FROM negocios WHERE nombre = ?", (data.nombre,)
        ).fetchone()
    if not negocio or not verify_password(data.password, negocio["password_hash"]):
        raise HTTPException(status_code=401, detail="Nombre o contraseña incorrectos")

    token = create_session(negocio["id"])
    response.set_cookie("session", token, httponly=True, samesite="lax")
    return {"ok": True, "negocio_id": negocio["id"]}

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("session")
    return {"ok": True}

@router.get("/me")
def me(negocio_id: int = Depends(get_current_negocio)):
    with get_conn() as conn:
        negocio = conn.execute(
            "SELECT id, nombre, descripcion, direccion, lat, lng, creado_en FROM negocios WHERE id = ?",
            (negocio_id,)
        ).fetchone()
    return dict(negocio)
