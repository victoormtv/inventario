import os
import sqlite3
from contextlib import contextmanager

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Detección de entorno Vercel: en Vercel solo la carpeta /tmp tiene permisos de escritura
IS_VERCEL = os.environ.get("VERCEL") == "1"
DEFAULT_DB_PATH = "/tmp/inventario.db" if IS_VERCEL else os.path.join(BASE_DIR, "inventario.db")

DB_PATH = os.environ.get("INVENTARIO_DB", DEFAULT_DB_PATH)

ALMACEN_ID = 1


def conectar() -> sqlite3.Connection:
    conn = sqlite3.connect(
        DB_PATH,
        check_same_thread=False,
        isolation_level=None,
        timeout=10,
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    
    # En Vercel /tmp no soporta WAL mode correctamente
    if not IS_VERCEL:
        conn.execute("PRAGMA journal_mode = WAL")
        
    conn.execute("PRAGMA busy_timeout = 5000")
    return conn


def get_db():
    conn = conectar()
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def transaccion(conn: sqlite3.Connection):
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
            tipo_movimiento TEXT,
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
        CREATE TABLE IF NOT EXISTS reportes_enviados (
            periodo TEXT PRIMARY KEY,
            fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
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

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ventas (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo_comprobante TEXT CHECK(tipo_comprobante IN ('boleta','factura')),
            serie TEXT,
            numero INTEGER,
            id_cliente INTEGER,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            subtotal REAL,
            total REAL,
            ganancia_total REAL,
            usuario TEXT,
            estado TEXT DEFAULT 'emitida',
            FOREIGN KEY(id_cliente) REFERENCES terceros(id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS ventas_detalle (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            id_venta INTEGER,
            id_variante INTEGER,
            sku_producto TEXT,
            descripcion TEXT,
            cantidad INTEGER,
            precio_costo REAL,
            precio_venta REAL,
            ganancia REAL,
            FOREIGN KEY(id_venta) REFERENCES ventas(id),
            FOREIGN KEY(id_variante) REFERENCES variantes(id)
        )
    """)

    cursor.execute("""
        CREATE TABLE IF NOT EXISTS correlativos (
            serie TEXT PRIMARY KEY,
            ultimo INTEGER DEFAULT 0
        )
    """)

    # ── Migraciones existentes ──
    _agregar_columna(cursor, "kardex", "id_variante", "INTEGER")
    _agregar_columna(cursor, "kardex", "stock_anterior", "INTEGER")
    _agregar_columna(cursor, "kardex", "stock_resultante", "INTEGER")
    _agregar_columna(cursor, "kardex", "usuario", "TEXT")
    _agregar_columna(cursor, "terceros", "email", "TEXT")
    _agregar_columna(cursor, "terceros", "direccion", "TEXT")
    _agregar_columna(cursor, "kardex", "id_proveedor", "INTEGER")
    _agregar_columna(cursor, "kardex", "precio_unitario", "REAL")
    _agregar_columna(cursor, "kardex", "precio_anterior", "REAL")
    _agregar_columna(cursor, "ventas", "metodo_pago", "TEXT DEFAULT 'efectivo'")
    _agregar_columna(cursor, "ventas", "monto_pagado", "REAL")
    _agregar_columna(cursor, "ventas", "vuelto", "REAL DEFAULT 0")
    _agregar_columna(cursor, "ventas", "descuento", "REAL DEFAULT 0")
    _agregar_columna(cursor, "ventas", "observaciones", "TEXT")
    _agregar_columna(cursor, "ventas", "igv_total", "REAL DEFAULT 0")
    _agregar_columna(cursor, "ventas_detalle", "unidad_medida", "TEXT DEFAULT 'NIU'")
    _agregar_columna(cursor, "ventas_detalle", "tipo_item", "TEXT DEFAULT 'bien'")
    _agregar_columna(cursor, "ventas_detalle", "valor_unitario", "REAL")
    _agregar_columna(cursor, "ventas_detalle", "igv", "REAL DEFAULT 0")
    _agregar_columna(cursor, "ventas", "id_vendedor", "INTEGER")

    # ── Nuevas columnas en variantes ──
    _agregar_columna(cursor, "variantes", "detalle", "TEXT")
    _agregar_columna(cursor, "variantes", "kg",      "REAL")
    _agregar_columna(cursor, "variantes", "lote",    "TEXT")

    # Índices
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_variantes_sku ON variantes(sku_producto)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_kardex_sku ON kardex(sku_producto)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_kardex_fecha ON kardex(fecha)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_kardex_variante ON kardex(id_variante)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_kardex_proveedor ON kardex(id_proveedor)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha)")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_ventas_detalle_venta ON ventas_detalle(id_venta)")

    cursor.execute(
        "INSERT OR IGNORE INTO sucursales (id, nombre) VALUES (?, ?)",
        (ALMACEN_ID, "Almacén principal"),
    )
    cursor.execute(
        "INSERT OR IGNORE INTO terceros (id, tipo, nombre, documento) VALUES (1, 'cliente', 'Cliente General', '00000000')",
    )

    conn.close()


if __name__ == "__main__":
    inicializar_bd()
    print("Base de datos lista.")