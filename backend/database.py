import os
import sqlite3
from contextlib import contextmanager

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DB_PATH = os.environ.get("INVENTARIO_DB", os.path.join(BASE_DIR, "inventario.db"))

# Sistema de un solo almacén: todas las variantes viven en la sucursal 1.
ALMACEN_ID = 1


def conectar() -> sqlite3.Connection:
    """Abre una conexión lista para usar (claves foráneas activas, modo WAL)."""
    conn = sqlite3.connect(
        DB_PATH,
        check_same_thread=False,  # FastAPI puede atender una petición desde distintos hilos
        isolation_level=None,     # las transacciones se manejan a mano (ver transaccion())
        timeout=10,
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def get_db():
    """Dependencia de FastAPI: una conexión por petición, siempre cerrada al final."""
    conn = conectar()
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def transaccion(conn: sqlite3.Connection):
    """Agrupa varias escrituras en una sola operación: o se guardan todas o ninguna.

    BEGIN IMMEDIATE toma el bloqueo de escritura desde el inicio, así dos
    movimientos simultáneos no pueden leer el mismo stock y pisarse.
    """
    conn.execute("BEGIN IMMEDIATE")
    try:
        yield conn
        conn.execute("COMMIT")
    except BaseException:
        conn.execute("ROLLBACK")
        raise


def _agregar_columna(cursor, tabla: str, columna: str, definicion: str):
    existentes = [r[1] for r in cursor.execute(f"PRAGMA table_info({tabla})")]
    if columna not in existentes:
        cursor.execute(f"ALTER TABLE {tabla} ADD COLUMN {columna} {definicion}")


def inicializar_bd():
    conn = conectar()
    cursor = conn.cursor()

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS sucursales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            direccion TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS productos (
            sku TEXT PRIMARY KEY,
            nombre TEXT NOT NULL,
            categoria TEXT,
            precio_costo REAL,
            precio_venta REAL,
            stock_minimo INTEGER DEFAULT 5
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS variantes (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sku_producto TEXT,
            talla TEXT,
            color TEXT,
            stock_actual INTEGER DEFAULT 0,
            id_sucursal INTEGER,
            FOREIGN KEY(sku_producto) REFERENCES productos(sku),
            FOREIGN KEY(id_sucursal) REFERENCES sucursales(id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS kardex (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            sku_producto TEXT,
            tipo_movimiento TEXT, -- ENTRADA, SALIDA, AJUSTE
            cantidad INTEGER,
            referencia TEXT,
            id_sucursal INTEGER
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS terceros (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT CHECK(tipo IN ('cliente', 'proveedor')),
            nombre TEXT NOT NULL,
            documento TEXT,
            telefono TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            rol TEXT CHECK(rol IN ('admin', 'vendedor', 'almacenero'))
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS auditoria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            usuario TEXT,
            accion TEXT
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS transacciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT CHECK(tipo IN ('venta', 'compra')),
            tercero_id INTEGER,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            total REAL,
            FOREIGN KEY(tercero_id) REFERENCES terceros(id)
        )
    """)

    # --- Migraciones: el kardex ahora sabe qué variante se movió, quién y cuánto quedó ---
    _agregar_columna(cursor, "kardex", "id_variante", "INTEGER")
    _agregar_columna(cursor, "kardex", "stock_anterior", "INTEGER")
    _agregar_columna(cursor, "kardex", "stock_resultante", "INTEGER")
    _agregar_columna(cursor, "kardex", "usuario", "TEXT")

    # Índices para que las búsquedas sigan rápidas cuando crezca el inventario
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_variantes_sku ON variantes(sku_producto)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_kardex_sku ON kardex(sku_producto)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_kardex_fecha ON kardex(fecha)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_kardex_variante ON kardex(id_variante)")

    # Almacén único
    cursor.execute(
        "INSERT OR IGNORE INTO sucursales (id, nombre) VALUES (?, ?)",
        (ALMACEN_ID, "Almacén principal"),
    )

    conn.close()


if __name__ == "__main__":
    inicializar_bd()
    print("Base de datos lista.")