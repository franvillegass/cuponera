from fastapi import WebSocket

# negocio_id -> lista de websockets activos
_connections: dict[int, list[WebSocket]] = {}

async def connect(negocio_id: int, ws: WebSocket):
    await ws.accept()
    _connections.setdefault(negocio_id, []).append(ws)

def disconnect(negocio_id: int, ws: WebSocket):
    if negocio_id in _connections:
        _connections[negocio_id].remove(ws)
        if not _connections[negocio_id]:
            del _connections[negocio_id]

async def notify(negocio_id: int, data: dict):
    """Envía un mensaje JSON a todos los paneles abiertos del negocio."""
    dead = []
    for ws in _connections.get(negocio_id, []):
        try:
            await ws.send_json(data)
        except Exception:
            dead.append(ws)
    for ws in dead:
        disconnect(negocio_id, ws)
