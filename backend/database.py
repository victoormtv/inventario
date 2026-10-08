import os
import sqlite3
from contextlib import contextmanager
import libsql_client

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

TURSO_URL = os.environ.get("TURSO_DATABASE_URL", "")
TURSO_TOKEN = os.environ.get("TURSO_AUTH_TOKEN", "")

# Local (sin Turso): archivo SQLite junto al código
DB_PATH = os.environ.get("INVENTARIO_DB", os.path.join(BASE_DIR, "inventario.db"))

ALMACEN_ID = 1


class Row:
    """Imita sqlite3.Row: acceso por índice, por nombre, keys() y dict(row)."""

    __slots__ = ("_cols", "_vals")

    def __init__(self, cols, vals):
        self._cols = list(cols)
        self._vals = tuple(vals)

    def __getitem__(self, k):
        if isinstance(k, (int, slice)):
            return self._vals[k]
        return self._vals[self._cols.index(k)]

    def keys(self):
        return list(self._cols)

    def __iter__(self):
        return iter(self._vals)

    def __len__(self):
        return len(self._vals)

    def __repr__(self):
        return f"Row({dict(zip(self._cols, self._vals))})"


class CursorAdaptador:
    """Adaptador para normalizar las respuestas tanto de sqlite3 como de Turso/libsql_client."""

    def __init__(self, raw_conn, is_turso=False):
        self._raw_conn = raw_conn
        self._is_turso = is_turso
        self._last_result = None
        self._row_index = 0
        self._lastrowid = None
        self._rowcount = -1

    def execute(self, sql, params=()):
        if self._is_turso:
            # Convierte tuplas de parámetros a listas para compatibilidad con libsql_client
            args = list(params) if isinstance(params, (tuple, list)) else params
            res = self._raw_conn.execute(sql, args)
            self._last_result = res
            self._row_index = 0
            self._lastrowid = getattr(res, "last_insert_rowid", None)
            self._rowcount = getattr(res, "affected_row_count", -1)
        else:
            cur = self._raw_conn.cursor()
            cur.execute(sql, tuple(params))
            self._last_result = cur
            self._lastrowid = cur.lastrowid
            self._rowcount = cur.rowcount
        return self

    def executemany(self, sql, seq):
        if self._is_turso:
            for params in seq:
                self.execute(sql, params)
        else:
            cur = self._raw_conn.cursor()
            cur.executemany(sql, seq)
            self._last_result = cur
            self._lastrowid = cur.lastrowid
            self._rowcount = cur.rowcount
        return self

    def fetchone(self):
        if self._last_result is None:
            return None
        if self._is_turso:
            rows = getattr(self._last_result, "rows", [])
            cols = getattr(self._last_result, "columns", [])
            if self._row_index < len(rows):
                row = rows[self._row_index]
                self._row_index += 1
                return Row(cols, row)
            return None
        else:
            r = self._last_result.fetchone()
            if r is None:
                return None
            cols = [c[0] for c in self._last_result.description] if self._last_result.description else []
            return Row(cols, r)

    def fetchall(self):
        if self._last_result is None:
            return []
        if self._is_turso:
            rows = getattr(self._last_result, "rows", [])
            cols = getattr(self._last_result, "columns", [])
            restante = rows[self._row_index:]
            self._row_index = len(rows)
            return [Row(cols, r) for r in restante]
        else:
            cols = [c[0] for c in self._last_result.description] if self._last_result.description else []
            return [Row(cols, r) for r in self._last_result.fetchall()]

    def __iter__(self):
        return iter(self.fetchall())

    @property
    def lastrowid(self):
        return self._lastrowid

    @property
    def rowcount(self):
        return self._rowcount


class Conexion:
    def __init__(self, raw_conn, is_turso=False):
        self._raw_conn = raw_conn
        self.is_turso = is_turso
        self._en_tx = False

    def cursor(self):
        return CursorAdaptador(self._raw_conn, is_turso=self.is_turso)

    def execute(self, sql, params=()):
        cur = self.cursor()
        cur.execute(sql, params)
        return cur

    def executemany(self, sql, seq):
        cur = self.cursor()
        cur.executemany(sql, seq)
        return cur

    def commit(self):
        if not self.is_turso and hasattr(self._raw_conn, "commit"):
            self._raw_conn.commit()

    def rollback(self):
        if not self.is_turso and hasattr(self._raw_conn, "rollback"):
            self._raw_conn.rollback()

    def close(self):
        try:
            if hasattr(self._raw_conn, "close"):
                self._raw_conn.close()
        except Exception:
            pass


def conectar():
    """Retorna una conexión unificada compatible tanto para Turso como para SQLite local."""
    if TURSO_URL and TURSO_TOKEN:
        url = TURSO_URL.replace("libsql://", "https://")
        raw = libsql_client.create_client_sync(url=url, auth_token=TURSO_TOKEN)
        return Conexion(raw, is_turso=True)
    
    conn = sqlite3.connect(DB_PATH, check_same_thread=False)
    return Conexion(conn, is_turso=False)


def get_db():
    conn = conectar()
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def transaccion(conn: Conexion):
    conn._en_tx = True
    try:
        yield conn
        conn.commit()
    except BaseException:
        conn.rollback()
        raise
    finally:
        conn._en_tx = False


def _agregar_columna(conn, tabla: str, columna: str, definicion: str):
    cursor = conn.execute(f"PRAGMA table_info({tabla})")
    existentes = [r[1] for r in cursor.fetchall()]
    if columna not in existentes:
        conn.execute(f"ALTER TABLE {tabla} ADD COLUMN {columna} {definicion}")


def inicializar_bd():
    # En Turso las tablas ya existen: evita sobrecargar las peticiones de red al arrancar.
    if TURSO_URL and os.environ.get("INIT_DB") != "1":
        return

    conn = conectar()

    conn.execute("""
        CREATE TABLE IF NOT EXISTS sucursales (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            nombre TEXT NOT NULL,
            direccion TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS productos (
            sku TEXT PRIMARY KEY,
            nombre TEXT NOT NULL,
            categoria TEXT,
            precio_costo REAL,
            precio_venta REAL,
            stock_minimo INTEGER DEFAULT 5
        )
    """)
    conn.execute("""
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
    conn.execute("""
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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS terceros (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT CHECK(tipo IN ('cliente', 'proveedor')),
            nombre TEXT NOT NULL,
            documento TEXT,
            telefono TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS usuarios (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            usuario TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            rol TEXT CHECK(rol IN ('admin', 'vendedor', 'almacenero'))
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS auditoria (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            usuario TEXT,
            accion TEXT
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS reportes_enviados (
            periodo TEXT PRIMARY KEY,
            fecha_envio TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        )
    """)
    conn.execute("""
        CREATE TABLE IF NOT EXISTS transacciones (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            tipo TEXT CHECK(tipo IN ('venta', 'compra')),
            tercero_id INTEGER,
            fecha TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            total REAL,
            FOREIGN KEY(tercero_id) REFERENCES terceros(id)
        )
    """)
    conn.execute("""
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
    conn.execute("""
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
    conn.execute("""
        CREATE TABLE IF NOT EXISTS correlativos (
            serie TEXT PRIMARY KEY,
            ultimo INTEGER DEFAULT 0
        )
    """)

    _agregar_columna(conn, "kardex", "id_variante", "INTEGER")
    _agregar_columna(conn, "kardex", "stock_anterior", "INTEGER")
    _agregar_columna(conn, "kardex", "stock_resultante", "INTEGER")
    _agregar_columna(conn, "kardex", "usuario", "TEXT")
    _agregar_columna(conn, "terceros", "email", "TEXT")
    _agregar_columna(conn, "terceros", "direccion", "TEXT")
    _agregar_columna(conn, "kardex", "id_proveedor", "INTEGER")
    _agregar_columna(conn, "kardex", "precio_unitario", "REAL")
    _agregar_columna(conn, "kardex", "precio_anterior", "REAL")
    _agregar_columna(conn, "ventas", "metodo_pago", "TEXT DEFAULT 'efectivo'")
    _agregar_columna(conn, "ventas", "monto_pagado", "REAL")
    _agregar_columna(conn, "ventas", "vuelto", "REAL DEFAULT 0")
    _agregar_columna(conn, "ventas", "descuento", "REAL DEFAULT 0")
    _agregar_columna(conn, "ventas", "observaciones", "TEXT")
    _agregar_columna(conn, "ventas", "igv_total", "REAL DEFAULT 0")
    _agregar_columna(conn, "ventas_detalle", "unidad_medida", "TEXT DEFAULT 'NIU'")
    _agregar_columna(conn, "ventas_detalle", "tipo_item", "TEXT DEFAULT 'bien'")
    _agregar_columna(conn, "ventas_detalle", "valor_unitario", "REAL")
    _agregar_columna(conn, "ventas_detalle", "igv", "REAL DEFAULT 0")
    _agregar_columna(conn, "ventas", "id_vendedor", "INTEGER")
    _agregar_columna(conn, "variantes", "detalle", "TEXT")
    _agregar_columna(conn, "variantes", "kg", "REAL")
    _agregar_columna(conn, "variantes", "lote", "TEXT")
    _agregar_columna(conn, "variantes", "precio_costo", "REAL")
    _agregar_columna(conn, "variantes", "precio_venta", "REAL")

    conn.execute("CREATE INDEX IF NOT EXISTS idx_variantes_sku ON variantes(sku_producto)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_kardex_sku ON kardex(sku_producto)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_kardex_fecha ON kardex(fecha)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_kardex_variante ON kardex(id_variante)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_kardex_proveedor ON kardex(id_proveedor)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ventas_fecha ON ventas(fecha)")
    conn.execute("CREATE INDEX IF NOT EXISTS idx_ventas_detalle_venta ON ventas_detalle(id_venta)")

    conn.execute(
        "INSERT OR IGNORE INTO sucursales (id, nombre) VALUES (?, ?)",
        (ALMACEN_ID, "Almacén principal"),
    )
    conn.execute(
        "INSERT OR IGNORE INTO terceros (id, tipo, nombre, documento) VALUES (1, 'cliente', 'Cliente General', '00000000')",
    )

    conn.close()


if __name__ == "__main__":
    inicializar_bd()
    print("Base de datos lista.")