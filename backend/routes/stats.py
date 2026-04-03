from fastapi import APIRouter, Depends
from backend.database import get_conn
from backend.auth import get_current_negocio

router = APIRouter(prefix="/stats", tags=["stats"])

@router.get("/ingresos")
def ingresos(periodo: str = "dia", negocio_id: int = Depends(get_current_negocio)):
    """
    Dinero total generado a lo largo del tiempo.
    periodo: 'dia' | 'semana' | 'mes'
    """
    if periodo == "mes":
        fmt = "%Y-%m"
        label = "strftime('%Y-%m', fecha)"
    elif periodo == "semana":
        fmt = "%Y-W%W"
        label = "strftime('%Y-W%W', fecha)"
    else:  # dia
        fmt = "%Y-%m-%d"
        label = "strftime('%Y-%m-%d', fecha)"

    with get_conn() as conn:
        rows = conn.execute(f"""
            SELECT {label} AS periodo, SUM(total) AS total
            FROM canjes
            WHERE confirmado = 1
              AND cupon_id IN (SELECT id FROM cupones WHERE negocio_id = ?)
            GROUP BY periodo
            ORDER BY periodo ASC
        """, (negocio_id,)).fetchall()

    return [{"periodo": r["periodo"], "total": round(r["total"], 2)} for r in rows]


@router.get("/productos")
def productos(negocio_id: int = Depends(get_current_negocio)):
    """Lista de productos (cupones) del negocio para el selector."""
    with get_conn() as conn:
        rows = conn.execute("""
            SELECT id, producto FROM cupones
            WHERE negocio_id = ?
            ORDER BY producto ASC
        """, (negocio_id,)).fetchall()
    return [{"id": r["id"], "producto": r["producto"]} for r in rows]


@router.get("/ventas-producto")
def ventas_producto(
    cupon_id: int,
    periodo: str = "dia",
    metrica: str = "dinero",
    negocio_id: int = Depends(get_current_negocio)
):
    """
    Ventas de un producto específico a lo largo del tiempo.
    metrica: 'dinero' | 'canjes' | 'ambos'
    """
    if periodo == "mes":
        label = "strftime('%Y-%m', fecha)"
    elif periodo == "semana":
        label = "strftime('%Y-W%W', fecha)"
    else:
        label = "strftime('%Y-%m-%d', fecha)"

    with get_conn() as conn:
        # Verificar que el cupón pertenece al negocio
        cupon = conn.execute(
            "SELECT id FROM cupones WHERE id = ? AND negocio_id = ?",
            (cupon_id, negocio_id)
        ).fetchone()
        if not cupon:
            return []

        rows = conn.execute(f"""
            SELECT {label} AS periodo,
                   SUM(total) AS dinero,
                   COUNT(*) AS canjes
            FROM canjes
            WHERE confirmado = 1 AND cupon_id = ?
            GROUP BY periodo
            ORDER BY periodo ASC
        """, (cupon_id,)).fetchall()

    return [
        {
            "periodo": r["periodo"],
            "dinero": round(r["dinero"], 2),
            "canjes": r["canjes"]
        }
        for r in rows
    ]
