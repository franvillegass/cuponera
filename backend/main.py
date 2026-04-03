from pathlib import Path
from fastapi import FastAPI, WebSocket, WebSocketDisconnect, Depends
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from backend.database import init_db
from backend.auth import get_current_negocio
import backend.websocket as ws_manager
from backend.routes import negocios, cupones, canjes, stats

# Rutas absolutas basadas en la ubicación de este archivo
BASE_DIR = Path(__file__).resolve().parent          # .../cuponera/backend
FRONTEND_DIR = BASE_DIR.parent / "frontend"         # .../cuponera/frontend
PAGES_DIR = FRONTEND_DIR / "pages"

app = FastAPI(title="Cuponera del Barrio")

@app.on_event("startup")
def startup():
    init_db()

# Rutas API
app.include_router(negocios.router, prefix="/api")
app.include_router(cupones.router, prefix="/api")
app.include_router(canjes.router, prefix="/api")
app.include_router(stats.router, prefix="/api")

# WebSocket
@app.websocket("/ws/panel")
async def ws_panel(websocket: WebSocket, negocio_id: int = Depends(get_current_negocio)):
    await ws_manager.connect(negocio_id, websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        ws_manager.disconnect(negocio_id, websocket)

# Archivos estáticos
app.mount("/static", StaticFiles(directory=str(FRONTEND_DIR)), name="static")

# Páginas
@app.get("/")
def index():
    return FileResponse(PAGES_DIR / "index.html")

@app.get("/login")
def login_page():
    return FileResponse(PAGES_DIR / "login.html")

@app.get("/panel")
def panel_page():
    return FileResponse(PAGES_DIR / "panel.html")

@app.get("/canjear/{cupon_id}")
def cupon_page(cupon_id: int):
    return FileResponse(PAGES_DIR / "cupon.html")
