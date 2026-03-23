from fastapi import APIRouter, HTTPException, Request, Depends
from pydantic import BaseModel
from database import get_conn
from auth import get_current_negocio
import websocket as ws_manager

router = APIRouter(prefix="/canjes", tags=["canjes"])

class ConfirmarCanje(BaseModel):
    cantidad: float

def get_client_ip(request: Request) -> str:
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host

@router.post("/escanear/{cupon_id}")
async def escanear(cupon_id: int, request: Request):
    """
    El cliente escanea el QR. Se valida el cupón y se notifica al dueño via WS.
    No requiere autenticación.
    """
    ip = get_client_ip(request)

    with get_conn() as conn:
        cupon = conn.execute("""
            SELECT c.*, n.nombre AS negocio_nombre, n.id AS negocio_id
            FROM cupones c
            JOIN negocios n ON n.id = c.negocio_id
            WHERE c.id = ?
        """, (cupon_id,)).fetchone()

        if not cupon:
            raise HTTPException(status_code=404, detail="Cupón no encontrado")
        if not cupon["activo"]:
            raise HTTPException(status_code=400, detail="Este cupón no está disponible")

        # Control de un canje por IP
        if cupon["un_canje_por_ip"]:
            ya_canjeo = conn.execute(
                "SELECT id FROM canjes WHERE cupon_id = ? AND ip_cliente = ? AND confirmado = 1",
                (cupon_id, ip)
            ).fetchone()
            if ya_canjeo:
                raise HTTPException(status_code=400, detail="Ya usaste este cupón")

        # Control de límite total
        if cupon["limite_canjes"] is not None:
            total_canjes = conn.execute(
                "SELECT COUNT(*) as cnt FROM canjes WHERE cupon_id = ? AND confirmado = 1",
                (cupon_id,)
            ).fetchone()["cnt"]
            if total_canjes >= cupon["limite_canjes"]:
                raise HTTPException(status_code=400, detail="Este cupón ya alcanzó su límite de usos")

        # Crear canje pendiente de confirmación
        cur = conn.execute(
            "INSERT INTO canjes (cupon_id, cantidad, ip_cliente, total, confirmado) VALUES (?, 0, ?, 0, 0)",
            (cupon_id, ip)
        )
        canje_id = cur.lastrowid

    # Notificar al dueño del local via WebSocket
    await ws_manager.notify(cupon["negocio_id"], {
        "tipo": "nuevo_canje",
        "canje_id": canje_id,
        "cupon_id": cupon_id,
        "producto": cupon["producto"],
        "precio_final": cupon["precio_final"],
        "tipo_precio": cupon["tipo_precio"],
        "ip_cliente": ip,
    })

    return {
        "ok": True,
        "canje_id": canje_id,
        "producto": cupon["producto"],
        "negocio": cupon["negocio_nombre"],
        "precio_final": cupon["precio_final"],
        "tipo_precio": cupon["tipo_precio"],
        "mensaje": "Escaneo recibido. El vendedor va a confirmar tu compra."
    }

@router.post("/confirmar/{canje_id}")
async def confirmar(canje_id: int, data: ConfirmarCanje, negocio_id: int = Depends(get_current_negocio)):
    """El dueño confirma el canje e ingresa la cantidad."""
    if data.cantidad <= 0:
        raise HTTPException(status_code=400, detail="La cantidad debe ser mayor a 0")

    with get_conn() as conn:
        canje = conn.execute("""
            SELECT ca.*, cu.precio_final, cu.negocio_id, cu.activo
            FROM canjes ca
            JOIN cupones cu ON cu.id = ca.cupon_id
            WHERE ca.id = ?
        """, (canje_id,)).fetchone()

        if not canje:
            raise HTTPException(status_code=404, detail="Canje no encontrado")
        if canje["negocio_id"] != negocio_id:
            raise HTTPException(status_code=403, detail="No autorizado")
        if canje["confirmado"]:
            raise HTTPException(status_code=400, detail="Este canje ya fue confirmado")

        total = round(canje["precio_final"] * data.cantidad, 2)
        conn.execute(
            "UPDATE canjes SET cantidad = ?, total = ?, confirmado = 1 WHERE id = ?",
            (data.cantidad, total, canje_id)
        )

    return {"ok": True, "total": total, "cantidad": data.cantidad}

@router.delete("/cancelar/{canje_id}")
async def cancelar(canje_id: int, negocio_id: int = Depends(get_current_negocio)):
    """El dueño cancela (rechaza) un canje pendiente."""
    with get_conn() as conn:
        canje = conn.execute("""
            SELECT ca.*, cu.negocio_id
            FROM canjes ca JOIN cupones cu ON cu.id = ca.cupon_id
            WHERE ca.id = ?
        """, (canje_id,)).fetchone()

        if not canje:
            raise HTTPException(status_code=404, detail="Canje no encontrado")
        if canje["negocio_id"] != negocio_id:
            raise HTTPException(status_code=403, detail="No autorizado")

        conn.execute("DELETE FROM canjes WHERE id = ?", (canje_id,))

    return {"ok": True}
