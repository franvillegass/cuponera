from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from database import get_conn
from auth import get_current_negocio
from qr import generate_qr_base64

router = APIRouter(prefix="/cupones", tags=["cupones"])

class CuponData(BaseModel):
    producto: str
    precio_base: float
    precio_final: float
    tipo_precio: str = "unidad"          # 'unidad' | 'peso'
    limite_canjes: int | None = None
    un_canje_por_ip: bool = False

@router.get("/feed")
def feed():
    """Todos los cupones activos, para la página principal."""
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT c.id, c.producto, c.precio_base, c.precio_final,
                   c.tipo_precio, c.limite_canjes, c.un_canje_por_ip,
                   n.nombre AS negocio, n.descripcion AS negocio_desc, n.direccion AS negocio_direccion, n.lat AS negocio_lat, n.lng AS negocio_lng,
                   (SELECT COUNT(*) FROM canjes WHERE cupon_id = c.id AND confirmado = 1) AS total_canjes
            FROM cupones c
            JOIN negocios n ON n.id = c.negocio_id
            WHERE c.activo = 1
            ORDER BY c.id DESC
        """).fetchall()
    return [dict(r) for r in rows]

@router.get("/mios")
def mis_cupones(negocio_id: int = Depends(get_current_negocio)):
    """Todos los cupones del negocio autenticado."""
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT c.*,
                   (SELECT COUNT(*) FROM canjes WHERE cupon_id = c.id AND confirmado = 1) AS total_canjes
            FROM cupones c
            WHERE c.negocio_id = ?
            ORDER BY c.id DESC
        """, (negocio_id,)).fetchall()
    return [dict(r) for r in rows]

@router.post("/")
def crear_cupon(data: CuponData, negocio_id: int = Depends(get_current_negocio)):
    if data.tipo_precio not in ("unidad", "peso"):
        raise HTTPException(status_code=400, detail="tipo_precio debe ser 'unidad' o 'peso'")
    if data.precio_final > data.precio_base:
        raise HTTPException(status_code=400, detail="El precio final no puede ser mayor al base")
    with get_conn() as conn:
        cur = conn.execute("""
            INSERT INTO cupones (negocio_id, producto, precio_base, precio_final,
                                 tipo_precio, limite_canjes, un_canje_por_ip)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (negocio_id, data.producto, data.precio_base, data.precio_final,
              data.tipo_precio, data.limite_canjes, data.un_canje_por_ip))
        cupon_id = cur.lastrowid
    return {"ok": True, "cupon_id": cupon_id}

@router.patch("/{cupon_id}/toggle")
def toggle_cupon(cupon_id: int, negocio_id: int = Depends(get_current_negocio)):
    with get_conn() as conn:
        cupon = conn.execute(
            "SELECT id, activo FROM cupones WHERE id = ? AND negocio_id = ?",
            (cupon_id, negocio_id)
        ).fetchone()
        if not cupon:
            raise HTTPException(status_code=404, detail="Cupón no encontrado")
        nuevo_estado = not cupon["activo"]
        conn.execute("UPDATE cupones SET activo = ? WHERE id = ?", (nuevo_estado, cupon_id))
    return {"ok": True, "activo": nuevo_estado}

@router.delete("/{cupon_id}")
def eliminar_cupon(cupon_id: int, negocio_id: int = Depends(get_current_negocio)):
    with get_conn() as conn:
        cupon = conn.execute(
            "SELECT id FROM cupones WHERE id = ? AND negocio_id = ?",
            (cupon_id, negocio_id)
        ).fetchone()
        if not cupon:
            raise HTTPException(status_code=404, detail="Cupón no encontrado")
        conn.execute("DELETE FROM cupones WHERE id = ?", (cupon_id,))
    return {"ok": True}

@router.get("/{cupon_id}/qr")
def get_qr(cupon_id: int, negocio_id: int = Depends(get_current_negocio)):
    """Genera el QR para mostrar al cliente. Solo el dueño puede pedirlo."""
    with get_conn() as conn:
        cupon = conn.execute(
            "SELECT id, activo FROM cupones WHERE id = ? AND negocio_id = ?",
            (cupon_id, negocio_id)
        ).fetchone()
        if not cupon:
            raise HTTPException(status_code=404, detail="Cupón no encontrado")

    # El QR apunta a la URL de canje del cliente
    qr_data = f"/canjear/{cupon_id}"
    qr_base64 = generate_qr_base64(qr_data)
    return {"qr": qr_base64, "cupon_id": cupon_id}
