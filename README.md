# Cuponera del Barrio

Cuponera digital para negocios de barrio. Los negocios publican cupones de descuento y los clientes los escanean con el celular.

## Stack

- **Backend:** FastAPI (Python) + SQLite
- **Frontend:** HTML + CSS + JS vanilla
- **Tiempo real:** WebSockets (nativo en FastAPI)
- **QR:** librería `qrcode`

## Instalación

```bash
# 1. Clonar / descomprimir el proyecto
cd cuponera

# 2. Crear entorno virtual
python -m venv venv
source venv/bin/activate        # Linux/Mac
venv\Scripts\activate           # Windows

# 3. Instalar dependencias
pip install -r requirements.txt

# 4. Arrancar el servidor
cd backend
uvicorn main:app --reload --port 8000
```

Abrir en el navegador: http://localhost:8000

## Estructura

```
cuponera/
├── backend/
│   ├── main.py          # App FastAPI, rutas SPA, WebSocket
│   ├── database.py      # SQLite, init y context manager
│   ├── auth.py          # Hash, sesiones en memoria
│   ├── qr.py            # Generación QR en base64
│   ├── websocket.py     # Gestor de conexiones WS por negocio
│   ├── cuponera.db      # Se crea automáticamente al arrancar
│   └── routes/
│       ├── negocios.py  # Registro, login, logout
│       ├── cupones.py   # CRUD cupones + feed público
│       └── canjes.py    # Escanear, confirmar, cancelar
└── frontend/
    ├── pages/
    │   ├── index.html   # Feed público de cupones
    │   ├── login.html   # Login / registro de negocios
    │   ├── panel.html   # Panel del dueño
    │   └── cupon.html   # Página del cliente al escanear QR
    ├── css/
    │   └── main.css
    └── js/
        ├── feed.js      # Lógica del feed público
        ├── scanner.js   # Escáner QR con cámara
        ├── panel.js     # Lógica del panel del dueño
        └── websocket.js # Conexión WS para notificaciones
```

## Flujo principal

1. El dueño del negocio se registra en `/login` y crea cupones en `/panel`
2. Los cupones activos aparecen en la página principal `/`
3. El cliente toca un cupón, lo expande y toca "Escanear QR"
4. El dueño muestra el QR del cupón desde su panel
5. El cliente escanea → la página `/canjear/{id}` hace el POST automáticamente
6. El panel del dueño recibe una notificación en tiempo real (WebSocket)
7. El dueño ingresa la cantidad → se confirma y registra el canje

## Deploy en Railway

```bash
# En la raíz del proyecto
railway login
railway init
railway up
```

Configurar variable de entorno (opcional):
- `PORT` — Railway lo setea automáticamente

## Notas

- La base de datos `cuponera.db` se crea sola en `backend/` al primer arranque
- Las sesiones viven en memoria → se pierden al reiniciar el servidor (diseño intencional, simplicidad)
- El control de IP es aproximado y no es una medida de seguridad fuerte
