import os
import sqlite3
import threading
import time
from typing import Annotated, Literal, Optional

from dotenv import load_dotenv
from fastapi import APIRouter, BackgroundTasks, Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, StringConstraints, model_validator

from alertas import correo_configurado, destinatarios, enviar_correo, notificar_cruce, productos_bajo_minimo
from auth import (
    HASH_FALSO,
    crear_token,
    limpiar_fallos,
    registrar_fallo,
    usuario_actual,
    verificar,
    verificar_bloqueo,
)
from database import ALMACEN_ID, conectar, get_db, inicializar_bd, transaccion
from exportar_pro import router as exportar_pro_router
from mercaderia import router as mercaderia_router
from reportes import router as reportes_router, verificar_y_enviar_reporte_mensual_automatico
from servicios import aplicar_movimiento, auditar
from ventas import router as ventas_router

load_dotenv()


def cargar_seed():
    ruta = os.path.join(os.path.dirname(os.path.abspath(__file__)), "seed.sql")
    if not os.path.exists(ruta):
        return
    conn = conectar()
    try:
        if conn.execute("SELECT COUNT(*) FROM variantes").fetchone()[0] == 0:
            with open(ruta, encoding="utf-8") as f:
                conn.executescript(f.read())
    finally:
        conn.close()


def _agregar_columna(conn, tabla: str, columna: str, tipo: str):
    cols = [r[1] for r in conn.execute(f"PRAGMA table_info({tabla})").fetchall()]
    if columna not in cols:
        conn.execute(f"ALTER TABLE {tabla} ADD COLUMN {columna} {tipo}")


def migrar_bd():
    if os.environ.get("TURSO_DATABASE_URL") and os.environ.get("INIT_DB") != "1":
        return
    """Precio por variante + columnas usadas por comprobantes. Se puede correr muchas veces."""
    conn = conectar()
    try:
        _agregar_columna(conn, "variantes", "precio_costo", "REAL")
        _agregar_columna(conn, "variantes", "precio_venta", "REAL")
        _agregar_columna(conn, "variantes", "detalle", "TEXT")
        _agregar_columna(conn, "variantes", "kg", "REAL")
        _agregar_columna(conn, "variantes", "lote", "TEXT")
        _agregar_columna(conn, "ventas", "serie", "TEXT")
        _agregar_columna(conn, "ventas", "numero", "INTEGER")
        _agregar_columna(conn, "ventas", "ganancia_total", "REAL")
        conn.execute(
            """UPDATE variantes SET
                 precio_costo = (SELECT precio_costo FROM productos WHERE sku = variantes.sku_producto),
                 precio_venta = (SELECT precio_venta FROM productos WHERE sku = variantes.sku_producto)
               WHERE precio_costo IS NULL OR precio_venta IS NULL"""
        )
        conn.commit()
    finally:
        conn.close()


app = FastAPI(title="API Sistema de Inventario", version="2.0")


def _planificador_reporte_mensual():
    while True:
        try:
            verificar_y_enviar_reporte_mensual_automatico()
        except Exception:
            pass
        time.sleep(14400)


def asegurar_admin():
    from auth import hashear
    conn = conectar()
    try:
        if conn.execute("SELECT COUNT(*) FROM usuarios").fetchone()[0] == 0:
            clave = os.environ.get("ADMIN_PASSWORD")
            if clave:
                conn.execute(
                    "INSERT INTO usuarios (usuario, password, rol) VALUES (?, ?, 'admin')",
                    ("admin", hashear(clave)),
                )
    finally:
        conn.close()


def _arranque():
    import traceback
    for paso in (inicializar_bd, cargar_seed, migrar_bd, asegurar_admin):
        try:
            paso()
        except Exception:
            traceback.print_exc()
    if os.environ.get("VERCEL") != "1":
        threading.Thread(target=_planificador_reporte_mensual, daemon=True).start()


_arranque()


# Configuración de CORS segura
origins = [
    "https://nathaninventario.online",
    "https://www.nathaninventario.online",
    "http://localhost:3000",
    "http://127.0.0.1:3000",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins if os.environ.get("VERCEL") == "1" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Texto = Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=120)]
TextoOpcional = Annotated[str, StringConstraints(strip_whitespace=True, max_length=120)]


# ───────────────────────── Modelos ─────────────────────────
class LoginIn(BaseModel):
    usuario: str
    password: str


class ProductoIn(BaseModel):
    sku: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=40)]
    nombre: Texto
    categoria: TextoOpcional = ""
    precio_costo: float = Field(ge=0)
    precio_venta: float = Field(ge=0)
    stock_minimo: int = Field(default=5, ge=0)


class ProductoEdit(BaseModel):
    nombre: Texto
    categoria: TextoOpcional = ""
    precio_costo: float | None = Field(default=None, ge=0)
    precio_venta: float | None = Field(default=None, ge=0)
    stock_minimo: int = Field(ge=0)


class VarianteIn(BaseModel):
    talla: Texto
    color: Texto
    stock_inicial: int = Field(default=0, ge=0)


class VarianteEdit(BaseModel):
    color: Texto
    detalle: TextoOpcional | None = None
    kg: float | None = Field(default=None, ge=0)
    lote: TextoOpcional | None = None
    precio_costo: float = Field(ge=0)
    precio_venta: float = Field(ge=0)


class MovimientoIn(BaseModel):
    id_variante: int
    tipo_movimiento: Literal["ENTRADA", "SALIDA", "AJUSTE"]
    cantidad: int = Field(ge=0)
    referencia: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] = ""

    @model_validator(mode="after")
    def _cantidad_positiva(self):
        if self.tipo_movimiento != "AJUSTE" and self.cantidad <= 0:
            raise ValueError("La cantidad debe ser mayor que cero.")
        return self


class ContactoIn(BaseModel):
    tipo: Literal["cliente", "proveedor"]
    nombre: Texto
    documento: TextoOpcional = ""
    telefono: TextoOpcional = ""
    email: TextoOpcional = ""
    direccion: TextoOpcional = ""


class UsuarioResponse(BaseModel):
    id: int
    usuario: str
    nombre: Optional[str] = None
    rol: Optional[str] = None


class ItemVentaCreate(BaseModel):
    id_variante: int
    cantidad: int
    precio_venta: float
    unidad_medida: str = "NIU"
    tipo_item: str = "bien"


class VentaCreate(BaseModel):
    tipo_comprobante: str
    id_cliente: int
    id_vendedor: Optional[int] = None
    items: list[ItemVentaCreate]


# ───────────────────────── Rutas Públicas (Auth / Usuarios / Ventas) ─────────────────────────
# Se mapean tanto /auth/login como /api/auth/login para evitar el 404 por /api/api/
@app.post("/auth/login")
@app.post("/api/auth/login")
def login(datos: LoginIn, db=Depends(get_db)):
    clave = datos.usuario.strip().lower()
    verificar_bloqueo(clave)
    fila = db.execute(
        "SELECT usuario, password, rol FROM usuarios WHERE lower(usuario) = ?", (clave,)
    ).fetchone()
    correcto = verificar(datos.password, fila["password"] if fila else HASH_FALSO)
    if fila is None or not correcto:
        registrar_fallo(clave)
        raise HTTPException(401, "Usuario o contraseña incorrectos.")
    limpiar_fallos(clave)
    auditar(db, fila["usuario"], "Inició sesión")
    return {"token": crear_token(fila["usuario"], fila["rol"]), "usuario": fila["usuario"], "rol": fila["rol"]}


@app.get("/usuarios", response_model=list[UsuarioResponse])
@app.get("/api/usuarios", response_model=list[UsuarioResponse])
def listar_usuarios(db=Depends(get_db)):
    cursor = db.cursor()
    cursor.execute("SELECT id, usuario, nombre, rol FROM usuarios ORDER BY usuario ASC")
    return [dict(row) for row in cursor.fetchall()]

# ───────────────────────── Rutas Protegidas ─────────────────────────
router = APIRouter(prefix="/api", dependencies=[Depends(usuario_actual)])


@router.get("/auth/me")
def yo(usuario: str = Depends(usuario_actual)):
    return {"usuario": usuario}


# ───────────────────────── Productos ─────────────────────────
@router.get("/productos")
def listar_productos(
    q: str = "",
    categoria: str = "",
    estado: str = "",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    db=Depends(get_db),
):
    where, params = [], []
    if q.strip():
        like = f"%{q.strip()}%"
        where.append("(p.sku LIKE ? OR p.nombre LIKE ?)")
        params += [like, like]
    if categoria:
        where.append("p.categoria = ?")
        params.append(categoria)

    sql = """
        SELECT p.sku, p.nombre, p.categoria, p.precio_costo, p.precio_venta, p.stock_minimo,
               COALESCE(SUM(v.stock_actual), 0) AS stock_total,
               COUNT(v.id) AS num_variantes
        FROM productos p
        LEFT JOIN variantes v ON v.sku_producto = p.sku
    """
    if where:
        sql += " WHERE " + " AND ".join(where)
    sql += " GROUP BY p.sku"
    if estado == "bajo":
        sql += " HAVING stock_total <= p.stock_minimo"

    total = db.execute(f"SELECT COUNT(*) FROM ({sql})", params).fetchone()[0]
    filas = db.execute(
        sql + " ORDER BY p.nombre COLLATE NOCASE LIMIT ? OFFSET ?",
        params + [limit, (page - 1) * limit],
    ).fetchall()
    return {"items": [dict(f) for f in filas], "total": total, "page": page, "limit": limit}


@router.get("/inventario/variantes")
def listar_variantes_inventario(
    q: str = "",
    categoria: str = "",
    estado: str = "",
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    db=Depends(get_db),
):
    where, params = [], []
    if q.strip():
        like = f"%{q.strip()}%"
        where.append("(p.sku LIKE ? OR p.nombre LIKE ? OR v.talla LIKE ? OR v.color LIKE ?)")
        params += [like, like, like, like]
    if categoria:
        where.append("p.categoria = ?")
        params.append(categoria)

    cond = (" WHERE " + " AND ".join(where)) if where else ""
    extra = ""
    if estado == "bajo":
        extra = (" AND " if cond else " WHERE ") + "v.stock_actual <= p.stock_minimo"

    sql = f"""
        SELECT v.id AS id_variante, p.sku, p.nombre, p.categoria,
               COALESCE(NULLIF(v.precio_costo, 0), p.precio_costo) AS precio_costo,
               COALESCE(NULLIF(v.precio_venta, 0), p.precio_venta) AS precio_venta,
               p.stock_minimo,
               v.talla, v.color, v.detalle, v.kg, v.lote, v.stock_actual
        FROM variantes v
        JOIN productos p ON p.sku = v.sku_producto
        {cond}{extra}
    """
    total = db.execute(f"SELECT COUNT(*) FROM ({sql})", params).fetchone()[0]
    filas = db.execute(
        sql + " ORDER BY p.nombre COLLATE NOCASE, v.talla COLLATE NOCASE, v.color COLLATE NOCASE LIMIT ? OFFSET ?",
        params + [limit, (page - 1) * limit],
    ).fetchall()
    return {"items": [dict(f) for f in filas], "total": total, "page": page, "limit": limit}
def listar_variantes_inventario(
    q: str = "",
    categoria: str = "",
    estado: str = "",
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    db=Depends(get_db),
):
    where, params = [], []
    if q.strip():
        like = f"%{q.strip()}%"
        where.append("(p.sku LIKE ? OR p.nombre LIKE ? OR v.talla LIKE ? OR v.color LIKE ?)")
        params += [like, like, like, like]
    if categoria:
        where.append("p.categoria = ?")
        params.append(categoria)

    cond = (" WHERE " + " AND ".join(where)) if where else ""
    extra = ""
    if estado == "bajo":
        extra = (" AND " if cond else " WHERE ") + "v.stock_actual <= p.stock_minimo"

    sql = f"""
        SELECT v.id AS id_variante, p.sku, p.nombre, p.categoria,
               COALESCE(v.precio_costo, p.precio_costo) AS precio_costo,
               COALESCE(v.precio_venta, p.precio_venta) AS precio_venta,
               p.stock_minimo,
               v.talla, v.color, v.detalle, v.kg, v.lote, v.stock_actual
        FROM variantes v
        JOIN productos p ON p.sku = v.sku_producto
        {cond}{extra}
    """
    total = db.execute(f"SELECT COUNT(*) FROM ({sql})", params).fetchone()[0]
    filas = db.execute(
        sql + " ORDER BY p.nombre COLLATE NOCASE, v.talla COLLATE NOCASE, v.color COLLATE NOCASE LIMIT ? OFFSET ?",
        params + [limit, (page - 1) * limit],
    ).fetchall()
    return {"items": [dict(f) for f in filas], "total": total, "page": page, "limit": limit}


@router.get("/categorias")
def listar_categorias(db=Depends(get_db)):
    filas = db.execute(
        "SELECT DISTINCT categoria FROM productos WHERE categoria IS NOT NULL AND categoria != '' ORDER BY categoria COLLATE NOCASE"
    ).fetchall()
    return [f["categoria"] for f in filas]


def _producto_o_404(db, sku: str):
    p = db.execute("SELECT * FROM productos WHERE sku = ?", (sku,)).fetchone()
    if p is None:
        raise HTTPException(404, f"No existe el producto {sku}.")
    return p


@router.get("/productos/{sku}")
def detalle_producto(sku: str, db=Depends(get_db)):
    p = _producto_o_404(db, sku)
    variantes = db.execute(
        """SELECT id, talla, color, stock_actual,
                  COALESCE(NULLIF(precio_costo, 0), p.precio_costo) AS precio_costo,
                  COALESCE(NULLIF(precio_venta, 0), p.precio_venta) AS precio_venta
            FROM variantes WHERE sku_producto = ? ORDER BY talla, color""",
        (p["precio_costo"], p["precio_venta"], sku),
    ).fetchall()
    return {**dict(p), "variantes": [dict(v) for v in variantes]}


@router.post("/productos", status_code=201)
def crear_producto(p: ProductoIn, db=Depends(get_db), usuario: str = Depends(usuario_actual)):
    sku = p.sku.upper()
    with transaccion(db):
        if db.execute("SELECT 1 FROM productos WHERE sku = ?", (sku,)).fetchone():
            raise HTTPException(409, f"Ya existe un producto con el SKU {sku}.")
        db.execute(
            "INSERT INTO productos (sku, nombre, categoria, precio_costo, precio_venta, stock_minimo) VALUES (?, ?, ?, ?, ?, ?)",
            (sku, p.nombre, p.categoria, p.precio_costo, p.precio_venta, p.stock_minimo),
        )
        auditar(db, usuario, f"Creó el producto {sku} ({p.nombre})")
    return {"sku": sku}


@router.put("/productos/{sku}")
def editar_producto(sku: str, p: ProductoEdit, db=Depends(get_db), usuario: str = Depends(usuario_actual)):
    with transaccion(db):
        _producto_o_404(db, sku)
        db.execute(
            """UPDATE productos
               SET nombre=?, categoria=?,
                   precio_costo=COALESCE(?, precio_costo),
                   precio_venta=COALESCE(?, precio_venta),
                   stock_minimo=?
               WHERE sku=?""",
            (p.nombre, p.categoria, p.precio_costo, p.precio_venta, p.stock_minimo, sku),
        )
        # Sincronizar el costo en todas las variantes del producto
        if p.precio_costo is not None:
            db.execute(
                "UPDATE variantes SET precio_costo = ? WHERE sku_producto = ?",
                (p.precio_costo, sku),
            )
        if p.precio_venta is not None:
            db.execute(
                "UPDATE variantes SET precio_venta = ? WHERE sku_producto = ?",
                (p.precio_venta, sku),
            )
        auditar(db, usuario, f"Editó el producto {sku}")
    return {"sku": sku}


@router.delete("/productos/{sku}")
def eliminar_producto(sku: str, db=Depends(get_db), usuario: str = Depends(usuario_actual)):
    with transaccion(db):
        p = _producto_o_404(db, sku)
        if db.execute("SELECT 1 FROM kardex WHERE sku_producto = ? LIMIT 1", (sku,)).fetchone():
            raise HTTPException(409, "Este producto tiene movimientos en el kardex y no se puede eliminar. Déjalo con stock 0.")
        if db.execute("SELECT 1 FROM variantes WHERE sku_producto = ? AND stock_actual > 0 LIMIT 1", (sku,)).fetchone():
            raise HTTPException(409, "Este producto todavía tiene stock. Regístrale una salida o un ajuste a 0 antes de eliminarlo.")
        db.execute("DELETE FROM variantes WHERE sku_producto = ?", (sku,))
        db.execute("DELETE FROM productos WHERE sku = ?", (sku,))
        auditar(db, usuario, f"Eliminó el producto {sku} ({p['nombre']})")
    return {"sku": sku}


# ───────────────────────── Variantes ─────────────────────────
@router.post("/productos/{sku}/variantes", status_code=201)
def crear_variante(sku: str, v: VarianteIn, db=Depends(get_db), usuario: str = Depends(usuario_actual)):
    with transaccion(db):
        p = _producto_o_404(db, sku)
        repetida = db.execute(
            "SELECT 1 FROM variantes WHERE sku_producto = ? AND lower(talla) = lower(?) AND lower(color) = lower(?)",
            (sku, v.talla, v.color),
        ).fetchone()
        if repetida:
            raise HTTPException(409, f"Ya existe la variante {v.talla} / {v.color} para este producto.")
        cur = db.execute(
            """INSERT INTO variantes (sku_producto, talla, color, stock_actual, id_sucursal, precio_costo, precio_venta)
               VALUES (?, ?, ?, 0, ?, ?, ?)""",
            (sku, v.talla, v.color, ALMACEN_ID, p["precio_costo"], p["precio_venta"]),
        )
        id_variante = cur.lastrowid
        if v.stock_inicial > 0:
            aplicar_movimiento(db, id_variante, "ENTRADA", v.stock_inicial, "Stock inicial", usuario)
        auditar(db, usuario, f"Agregó la variante {v.talla}/{v.color} a {sku}")
    return {"id": id_variante}


def _variante_o_404(db, id_variante: int):
    v = db.execute("SELECT * FROM variantes WHERE id = ?", (id_variante,)).fetchone()
    if v is None:
        raise HTTPException(404, "La variante no existe.")
    return v


@router.put("/variantes/{id_variante}")
def editar_variante(id_variante: int, v: VarianteEdit, db=Depends(get_db), usuario: str = Depends(usuario_actual)):
    with transaccion(db):
        actual = _variante_o_404(db, id_variante)
        db.execute(
            "UPDATE variantes SET color=?, detalle=?, kg=?, lote=?, precio_costo=?, precio_venta=? WHERE id=?",
            (v.color, v.detalle or None, v.kg, v.lote or None, v.precio_costo, v.precio_venta, id_variante),
        )
        auditar(db, usuario, f"Editó la variante {id_variante} de {actual['sku_producto']}")
    return {"id": id_variante}


@router.delete("/variantes/{id_variante}")
def eliminar_variante(id_variante: int, db=Depends(get_db), usuario: str = Depends(usuario_actual)):
    with transaccion(db):
        actual = _variante_o_404(db, id_variante)
        if actual["stock_actual"] > 0:
            raise HTTPException(409, "Esta variante todavía tiene stock. Déjala en 0 antes de eliminarla.")
        if db.execute("SELECT 1 FROM kardex WHERE id_variante = ? LIMIT 1", (id_variante,)).fetchone():
            raise HTTPException(409, "Esta variante tiene movimientos en el kardex y no se puede eliminar.")
        db.execute("DELETE FROM variantes WHERE id = ?", (id_variante,))
        auditar(db, usuario, f"Eliminó la variante {id_variante} de {actual['sku_producto']}")
    return {"id": id_variante}


# ───────────────────────── Kardex ─────────────────────────
@router.post("/kardex", status_code=201)
def registrar_movimiento(
    m: MovimientoIn,
    fondo: BackgroundTasks,
    db=Depends(get_db),
    usuario: str = Depends(usuario_actual),
):
    with transaccion(db):
        r = aplicar_movimiento(db, m.id_variante, m.tipo_movimiento, m.cantidad, m.referencia, usuario)
        auditar(db, usuario, f"{r['tipo']} de {r['cantidad']} u. en {r['sku']} (quedó en {r['stock_resultante']})")
    fondo.add_task(notificar_cruce, r)
    return r


@router.get("/kardex")
def ver_kardex(
    q: str = "",
    tipo: str = "",
    desde: str = "",
    hasta: str = "",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    db=Depends(get_db),
):
    where, params = [], []
    if q.strip():
        like = f"%{q.strip()}%"
        where.append("(k.sku_producto LIKE ? OR p.nombre LIKE ?)")
        params += [like, like]
    if tipo in ("ENTRADA", "SALIDA", "AJUSTE"):
        where.append("k.tipo_movimiento = ?")
        params.append(tipo)
    if desde:
        where.append("date(k.fecha, 'localtime') >= ?")
        params.append(desde)
    if hasta:
        where.append("date(k.fecha, 'localtime') <= ?")
        params.append(hasta)
    cond = (" WHERE " + " AND ".join(where)) if where else ""
    base = """
        FROM kardex k
        LEFT JOIN productos p ON p.sku = k.sku_producto
        LEFT JOIN variantes v ON v.id = k.id_variante
    """
    total = db.execute(f"SELECT COUNT(*) {base} {cond}", params).fetchone()[0]
    filas = db.execute(
        f"""SELECT k.id, k.fecha, k.sku_producto AS sku, p.nombre, v.talla, v.color,
                   k.tipo_movimiento AS tipo, k.cantidad, k.stock_anterior, k.stock_resultante,
                   k.referencia, k.usuario
            {base} {cond}
            ORDER BY k.fecha DESC, k.id DESC LIMIT ? OFFSET ?""",
        params + [limit, (page - 1) * limit],
    ).fetchall()
    return {"items": [dict(f) for f in filas], "total": total, "page": page, "limit": limit}


# ───────────────────────── Dashboard y alertas ─────────────────────────
@router.get("/dashboard/kpis")
def obtener_kpis(db=Depends(get_db)):
    total_productos = db.execute("SELECT COUNT(*) FROM productos").fetchone()[0]
    fila = db.execute(
        """SELECT COALESCE(SUM(v.stock_actual * COALESCE(v.precio_costo, p.precio_costo)), 0) AS valorizado,
                  COALESCE(SUM(v.stock_actual), 0) AS unidades
           FROM variantes v JOIN productos p ON p.sku = v.sku_producto"""
    ).fetchone()
    alertas = productos_bajo_minimo(db)

    ganancia_diaria = db.execute(
        """SELECT COALESCE(SUM(ganancia_total), 0) FROM ventas
           WHERE date(fecha, 'localtime') = date('now', 'localtime')"""
    ).fetchone()[0]
    ganancia_semanal = db.execute(
        """SELECT COALESCE(SUM(ganancia_total), 0) FROM ventas
           WHERE date(fecha, 'localtime') >= date('now', 'localtime', '-6 days')"""
    ).fetchone()[0]
    ganancia_mensual = db.execute(
        """SELECT COALESCE(SUM(ganancia_total), 0) FROM ventas
           WHERE strftime('%Y-%m', fecha, 'localtime') = strftime('%Y-%m', 'now', 'localtime')"""
    ).fetchone()[0]

    def top_producto(periodo_sql: str):
        fila = db.execute(f"""
            SELECT p.nombre, p.sku,
                   COALESCE(SUM(vd.cantidad), 0) AS unidades_vendidas,
                   COALESCE(SUM(vd.ganancia), 0) AS ganancia
            FROM ventas_detalle vd
            JOIN ventas v ON v.id = vd.id_venta
            JOIN productos p ON p.sku = vd.sku_producto
            WHERE {periodo_sql}
            GROUP BY vd.sku_producto
            ORDER BY unidades_vendidas DESC
            LIMIT 1
        """).fetchone()
        if fila and fila["unidades_vendidas"] > 0:
            return {"nombre": fila["nombre"], "sku": fila["sku"],
                    "unidades": fila["unidades_vendidas"], "ganancia": round(fila["ganancia"], 2)}
        return None

    def ganancia_por_producto(periodo_sql: str):
        filas = db.execute(f"""
            SELECT p.nombre, p.sku,
                   COALESCE(SUM(vd.ganancia), 0) AS ganancia,
                   COALESCE(SUM(vd.cantidad), 0) AS unidades
            FROM ventas_detalle vd
            JOIN ventas v ON v.id = vd.id_venta
            JOIN productos p ON p.sku = vd.sku_producto
            WHERE {periodo_sql}
            GROUP BY vd.sku_producto
            ORDER BY ganancia DESC
            LIMIT 5
        """).fetchall()
        return [{"nombre": f["nombre"], "sku": f["sku"],
                 "ganancia": round(f["ganancia"], 2), "unidades": f["unidades"]} for f in filas]

    hoy = "date(v.fecha, 'localtime') = date('now', 'localtime')"
    semana = "date(v.fecha, 'localtime') >= date('now', 'localtime', '-6 days')"
    mes = "strftime('%Y-%m', v.fecha, 'localtime') = strftime('%Y-%m', 'now', 'localtime')"

    return {
        "total_productos": total_productos,
        "unidades_totales": fila["unidades"],
        "stock_valorizado": round(fila["valorizado"], 2),
        "alertas_stock_bajo": len(alertas),
        "detalle_alertas": alertas,
        "ganancia_diaria": round(max(0, ganancia_diaria), 2),
        "ganancia_semanal": round(max(0, ganancia_semanal), 2),
        "ganancia_mensual": round(max(0, ganancia_mensual), 2),
        "top_diario": top_producto(hoy),
        "top_semanal": top_producto(semana),
        "top_mensual": top_producto(mes),
        "ganancia_por_producto_diaria": ganancia_por_producto(hoy),
        "ganancia_por_producto_semanal": ganancia_por_producto(semana),
        "ganancia_por_producto_mensual": ganancia_por_producto(mes),
    }


@router.get("/alertas")
def ver_alertas(db=Depends(get_db)):
    items = productos_bajo_minimo(db)
    return {
        "total": len(items),
        "items": items,
        "correo_configurado": correo_configurado(),
        "destinatarios": destinatarios() if correo_configurado() else [],
    }


@router.post("/alertas/probar")
def probar_correo(usuario: str = Depends(usuario_actual)):
    if not correo_configurado():
        raise HTTPException(400, "El correo no está configurado. Completa las variables SMTP_* en el archivo .env y reinicia el servidor.")
    error = enviar_correo(
        "✅ Prueba de avisos del inventario",
        f"Si recibes este mensaje, los avisos de stock bajo están funcionando.\n\nPrueba enviada por {usuario}.",
    )
    if error:
        raise HTTPException(502, f"No se pudo enviar el correo: {error}")
    return {"enviado": True}


# ───────────────────────── Auditoría ─────────────────────────
@router.get("/auditoria")
def ver_auditoria(page: int = Query(1, ge=1), limit: int = Query(50, ge=1, le=200), db=Depends(get_db)):
    total = db.execute("SELECT COUNT(*) FROM auditoria").fetchone()[0]
    filas = db.execute(
        "SELECT id, fecha, usuario, accion FROM auditoria ORDER BY id DESC LIMIT ? OFFSET ?",
        (limit, (page - 1) * limit),
    ).fetchall()
    return {"items": [dict(f) for f in filas], "total": total, "page": page, "limit": limit}


# ───────────────────────── Contactos / Terceros ─────────────────────────
@router.get("/contactos")
def listar_contactos(
    q: str = "",
    tipo: str = "",
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=200),
    db=Depends(get_db),
):
    where, params = [], []
    if q.strip():
        like = f"%{q.strip()}%"
        where.append("(nombre LIKE ? OR documento LIKE ? OR telefono LIKE ? OR email LIKE ?)")
        params += [like, like, like, like]
    if tipo in ("cliente", "proveedor"):
        where.append("tipo = ?")
        params.append(tipo)

    cond = (" WHERE " + " AND ".join(where)) if where else ""
    total = db.execute(f"SELECT COUNT(*) FROM terceros {cond}", params).fetchone()[0]
    filas = db.execute(
        f"SELECT id, tipo, nombre, documento, telefono, email, direccion FROM terceros {cond} ORDER BY nombre COLLATE NOCASE LIMIT ? OFFSET ?",
        params + [limit, (page - 1) * limit],
    ).fetchall()
    return {"items": [dict(f) for f in filas], "total": total, "page": page, "limit": limit}


@router.post("/contactos", status_code=201)
def crear_contacto(c: ContactoIn, db=Depends(get_db), usuario: str = Depends(usuario_actual)):
    with transaccion(db):
        cur = db.execute(
            "INSERT INTO terceros (tipo, nombre, documento, telefono, email, direccion) VALUES (?, ?, ?, ?, ?, ?)",
            (c.tipo, c.nombre, c.documento, c.telefono, c.email, c.direccion),
        )
        auditar(db, usuario, f"Creó contacto ({c.tipo}): {c.nombre}")
    return {"id": cur.lastrowid}


@router.put("/contactos/{id_contacto}")
def editar_contacto(id_contacto: int, c: ContactoIn, db=Depends(get_db), usuario: str = Depends(usuario_actual)):
    with transaccion(db):
        actual = db.execute("SELECT * FROM terceros WHERE id = ?", (id_contacto,)).fetchone()
        if not actual:
            raise HTTPException(404, "Contacto no encontrado.")
        db.execute(
            "UPDATE terceros SET tipo=?, nombre=?, documento=?, telefono=?, email=?, direccion=? WHERE id=?",
            (c.tipo, c.nombre, c.documento, c.telefono, c.email, c.direccion, id_contacto),
        )
        auditar(db, usuario, f"Editó contacto ({c.tipo}): {c.nombre}")
    return {"id": id_contacto}


@router.delete("/contactos/{id_contacto}")
def eliminar_contacto(id_contacto: int, db=Depends(get_db), usuario: str = Depends(usuario_actual)):
    with transaccion(db):
        actual = db.execute("SELECT * FROM terceros WHERE id = ?", (id_contacto,)).fetchone()
        if not actual:
            raise HTTPException(404, "Contacto no encontrado.")
        db.execute("DELETE FROM terceros WHERE id = ?", (id_contacto,))
        auditar(db, usuario, f"Eliminó contacto {actual['nombre']}")
    return {"id": id_contacto}


# ───────────────────────── Consulta DNI / RUC (proxy apisperu.com) ─────────────────────────
@router.get("/consultar-documento")
def consultar_documento(numero: str, db=Depends(get_db)):
    import httpx
    numero = numero.strip()
    token = os.environ.get("APISPERU_TOKEN", "")
    if not token:
        raise HTTPException(503, "La consulta de DNI/RUC no está configurada. Agrega APISPERU_TOKEN en el archivo .env y reinicia el servidor.")

    if len(numero) == 8 and numero.isdigit():
        url = f"https://dniruc.apisperu.com/api/v1/dni/{numero}?token={token}"
        tipo = "dni"
    elif len(numero) == 11 and numero.isdigit():
        url = f"https://dniruc.apisperu.com/api/v1/ruc/{numero}?token={token}"
        tipo = "ruc"
    else:
        raise HTTPException(400, "Ingresa un DNI de 8 dígitos o un RUC de 11 dígitos.")

    try:
        resp = httpx.get(url, timeout=10)
    except Exception:
        raise HTTPException(502, "No se pudo conectar con el servicio de consulta. Verifica tu conexión.")

    if resp.status_code == 401:
        raise HTTPException(502, "Token de APISPERU_TOKEN inválido o expirado.")
    if resp.status_code != 200:
        raise HTTPException(502, f"El servicio respondió con error {resp.status_code}.")

    datos = resp.json()
    if not datos.get("success", True) and not datos.get("nombre") and not datos.get("razonSocial"):
        raise HTTPException(404, f"No se encontró información para el {'DNI' if tipo == 'dni' else 'RUC'} {numero}.")

    if tipo == "dni":
        return {
            "tipo": "dni",
            "numero": numero,
            "nombre": f"{datos.get('nombres', '')} {datos.get('apellidoPaterno', '')} {datos.get('apellidoMaterno', '')}".strip(),
            "direccion": datos.get("direccion", ""),
            "raw": datos,
        }
    return {
        "tipo": "ruc",
        "numero": numero,
        "nombre": datos.get("razonSocial", ""),
        "direccion": datos.get("direccion", "") or datos.get("domicilioFiscal", ""),
        "estado": datos.get("estado", ""),
        "condicion": datos.get("condicion", ""),
        "raw": datos,
    }

app.include_router(router)
app.include_router(reportes_router)
app.include_router(mercaderia_router)
app.include_router(ventas_router)
app.include_router(exportar_pro_router)