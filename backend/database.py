import sqlite3
from pathlib import Path
from contextlib import contextmanager

DB_PATH = str(Path(__file__).resolve().parent / "cuponera.db")

def init_db():
    with get_conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS negocios (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nombre TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                descripcion TEXT DEFAULT '',
                direccion TEXT DEFAULT '',
                lat REAL DEFAULT NULL,
                lng REAL DEFAULT NULL,
                creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS cupones (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                negocio_id INTEGER NOT NULL REFERENCES negocios(id),
                producto TEXT NOT NULL,
                precio_base REAL NOT NULL,
                precio_final REAL NOT NULL,
                tipo_precio TEXT NOT NULL DEFAULT 'unidad',
                activo BOOLEAN NOT NULL DEFAULT 0,
                limite_canjes INTEGER DEFAULT NULL,
                un_canje_por_ip BOOLEAN NOT NULL DEFAULT 0,
                creado_en DATETIME DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS canjes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                cupon_id INTEGER NOT NULL REFERENCES cupones(id),
                cantidad REAL NOT NULL,
                ip_cliente TEXT NOT NULL,
                total REAL NOT NULL,
                confirmado BOOLEAN NOT NULL DEFAULT 0,
                fecha DATETIME DEFAULT CURRENT_TIMESTAMP
            );
        """)
        # Migración no destructiva para bases de datos existentes
        for col, tipo in [("direccion", "TEXT DEFAULT ''"), ("lat", "REAL DEFAULT NULL"), ("lng", "REAL DEFAULT NULL")]:
            try:
                conn.execute(f"ALTER TABLE negocios ADD COLUMN {col} {tipo}")
            except Exception:
                pass  # columna ya existe

@contextmanager
def get_conn():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()
