import os
from contextlib import contextmanager

import libsql

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
        self._cols = cols
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


class Cursor:
    def __init__(self, cur, owner=None):
        self._cur = cur
        self._owner = owner

    def _autocommit(self):
        o = self._owner
        if o is not None and not o._en_tx:
            try:
                o._conn.commit()
            except Exception:
                pass

    def _cols(self):
        d = self._cur.description
        return [c[0] for c in d] if d else []

    def execute(self, sql, params=()):
        self._cur.execute(sql, tuple(params))
        self._autocommit()
        return self

    def executemany(self, sql, seq):
        self._cur.executemany(sql, seq)
        self._autocommit()
        return self

    def fetchone(self):
        r = self._cur.fetchone()
        return None if r is None else Row(self._cols(), r)

    def fetchall(self):
        cols = self._cols()
        return [Row(cols, r) for r in self._cur.fetchall()]

    def fetchmany(self, n=1):
        cols = self._cols()
        return [Row(cols, r) for r in self._cur.fetchmany(n)]

    def __iter__(self):
        return iter(self.fetchall())

    @property
    def lastrowid(self):
        return self._cur.lastrowid

    @property
    def rowcount(self):
        return self._cur.rowcount

    @property
    def description(self):
        return self._cur.description


class Conexion:
    def __init__(self, conn):
        self._conn = conn
        self._en_tx = False

    def cursor(self):
        return Cursor(self._conn.cursor(), self)

    def execute(self, sql, params=()):
        return self.cursor().execute(sql, params)

    def executemany(self, sql, seq):
        return self.cursor().executemany(sql, seq)

    def executescript(self, script):
        return self._conn.executescript(script)

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        try:
            self._conn.close()
        except Exception:
            pass


def conectar() -> Conexion:
    if TURSO_URL:
        raw = libsql.connect(database=TURSO_URL, auth_token=TURSO_TOKEN)
    else:
        raw = libsql.connect(DB_PATH)
    return Conexion(raw)


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


def _agregar_columna(cursor, tabla: str, columna: str, definicion: str):
    existentes = [r[1] for r in cursor.execute(f"PRAGMA table_info({tabla})").fetchall()]
    if columna not in existentes:
        cursor.execute(f"ALTER TABLE {tabla} ADD COLUMN {columna} {definicion}")


def inicializar_bd():
    # En Turso las tablas ya existen: evita ~40 viajes de red en cada arranque.
    # Para correr migraciones nuevas define INIT_DB=1 una vez.
    if TURSO_URL and os.environ.get("INIT_DB") != "1":
        return

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
    _agregar_columna(cursor, "variantes", "detalle", "TEXT")
    _agregar_columna(cursor, "variantes", "kg", "REAL")
    _agregar_columna(cursor, "variantes", "lote", "TEXT")
    _agregar_columna(cursor, "variantes", "precio_costo", "REAL")
    _agregar_columna(cursor, "variantes", "precio_venta", "REAL")

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