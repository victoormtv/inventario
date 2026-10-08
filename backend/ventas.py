"""Registro de ventas: boletas y facturas (fake por ahora, para imprimir localmente)."""
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import usuario_actual
from database import get_db, transaccion
from servicios import aplicar_movimiento, auditar

router = APIRouter(prefix="/api/ventas", dependencies=[Depends(usuario_actual)])

SERIES = {"boleta": "B001", "factura": "F001"}
IGV_TASA = 0.18
TALLAS_NEUTRAS = {"", "-", "unico", "único", "unica", "única", "unidad"}


class ItemVentaIn(BaseModel):
    id_variante: int
    cantidad: int = Field(gt=0)
    precio_venta: float = Field(gt=0)
    unidad_medida: str = Field(default="NIU", max_length=20)
    tipo_item: Literal["bien", "servicio"] = "bien"


class VentaIn(BaseModel):
    tipo_comprobante: Literal["boleta", "factura"]
    id_cliente: int
    items: list[ItemVentaIn] = Field(min_length=1)
    metodo_pago: str = Field(default="efectivo")
    monto_pagado: float | None = Field(default=None, ge=0)
    vuelto: float = Field(default=0.0, ge=0)
    descuento: float = Field(default=0.0, ge=0)
    observaciones: str | None = None


def _siguiente_correlativo(db, serie: str) -> int:
    db.execute("INSERT OR IGNORE INTO correlativos (serie, ultimo) VALUES (?, 0)", (serie,))
    db.execute("UPDATE correlativos SET ultimo = ultimo + 1 WHERE serie = ?", (serie,))
    return db.execute("SELECT ultimo FROM correlativos WHERE serie = ?", (serie,)).fetchone()[0]


def _detalle_venta(db, id_venta: int) -> dict:
    v = db.execute(
        """SELECT ve.*, t.nombre AS cliente_nombre, t.documento AS cliente_documento, t.direccion AS cliente_direccion
           FROM ventas ve LEFT JOIN terceros t ON t.id = ve.id_cliente
           WHERE ve.id = ?""",
        (id_venta,),
    ).fetchone()
    if not v:
        raise HTTPException(404, "La venta no existe.")
    items = db.execute(
        """SELECT sku_producto, sku_producto AS codigo, descripcion, cantidad, precio_costo, precio_venta, ganancia,
                  unidad_medida, tipo_item, valor_unitario, igv
           FROM ventas_detalle WHERE id_venta = ?""",
        (id_venta,),
    ).fetchall()
    return {**dict(v), "items": [dict(i) for i in items]}


@router.post("", status_code=201)
def crear_venta(v: VentaIn, db=Depends(get_db), usuario: str = Depends(usuario_actual)):
    cliente = db.execute("SELECT * FROM terceros WHERE id = ?", (v.id_cliente,)).fetchone()
    if not cliente:
        raise HTTPException(404, "El cliente no existe.")
    if v.tipo_comprobante == "factura" and (not cliente["documento"] or len(cliente["documento"]) != 11):
        raise HTTPException(400, "Para emitir factura el cliente debe tener RUC (11 dígitos) registrado.")

    with transaccion(db):
        serie = SERIES[v.tipo_comprobante]
        numero = _siguiente_correlativo(db, serie)
        etiqueta = f"{serie}-{numero:08d}"

        subtotal = 0.0
        ganancia_total = 0.0
        igv_total = 0.0
        detalles = []

        for item in v.items:
            r = aplicar_movimiento(
                db, item.id_variante, "SALIDA", item.cantidad,
                f"Venta {etiqueta}", usuario,
            )

            # Costo propio de la variante (si no tiene, el del producto) + medida y color
            var = db.execute(
                """SELECT COALESCE(v.precio_costo, p.precio_costo) AS costo, v.talla, v.color
                   FROM variantes v JOIN productos p ON p.sku = v.sku_producto
                   WHERE v.id = ?""",
                (item.id_variante,),
            ).fetchone()
            costo = (var["costo"] if var else 0) or 0

            partes = [r["nombre"]]
            if var and (var["talla"] or "").strip().lower() not in TALLAS_NEUTRAS:
                partes.append(var["talla"].strip())
            if var and (var["color"] or "").strip():
                partes.append(var["color"].strip())
            descripcion = " ".join(partes)

            sub = item.cantidad * item.precio_venta
            gan = (item.precio_venta - costo) * item.cantidad
            valor_unitario = round(item.precio_venta / (1 + IGV_TASA), 4)
            igv_linea = round((item.precio_venta - valor_unitario) * item.cantidad, 2)
            subtotal += sub
            ganancia_total += gan
            igv_total += igv_linea
            detalles.append((r["sku"], descripcion, item, costo, gan, valor_unitario, igv_linea))

        total_final = max(0.0, subtotal - v.descuento)
        ganancia_neta = max(0.0, ganancia_total - v.descuento)
        monto_recibido = v.monto_pagado if v.monto_pagado is not None else total_final
        vuelto_calculado = max(0.0, monto_recibido - total_final) if v.monto_pagado is not None else v.vuelto

        cur = db.execute(
            """INSERT INTO ventas
               (tipo_comprobante, serie, numero, id_cliente, subtotal, descuento, total, ganancia_total, igv_total, metodo_pago, monto_pagado, vuelto, observaciones, usuario)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                v.tipo_comprobante,
                serie,
                numero,
                v.id_cliente,
                subtotal,
                v.descuento,
                total_final,
                ganancia_neta,
                round(igv_total, 2),
                v.metodo_pago,
                monto_recibido,
                vuelto_calculado,
                v.observaciones,
                usuario,
            ),
        )
        id_venta = cur.lastrowid

        for sku, descripcion, item, costo, gan, valor_unitario, igv_linea in detalles:
            db.execute(
                """INSERT INTO ventas_detalle
                   (id_venta, id_variante, sku_producto, descripcion, cantidad, precio_costo, precio_venta, ganancia,
                    unidad_medida, tipo_item, valor_unitario, igv)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (id_venta, item.id_variante, sku, descripcion, item.cantidad, costo, item.precio_venta, gan,
                 item.unidad_medida, item.tipo_item, valor_unitario, igv_linea),
            )

        auditar(db, usuario, f"Emitió {etiqueta} a {cliente['nombre']} por S/ {total_final:.2f} ({v.metodo_pago})")

    return _detalle_venta(db, id_venta)


@router.get("/{id_venta}")
def obtener_venta(id_venta: int, db=Depends(get_db)):
    return _detalle_venta(db, id_venta)


@router.get("")
def listar_ventas(page: int = 1, limit: int = 20, db=Depends(get_db)):
    total = db.execute("SELECT COUNT(*) FROM ventas").fetchone()[0]
    filas = db.execute(
        """SELECT ve.id, ve.tipo_comprobante, ve.serie, ve.numero, ve.fecha, ve.subtotal, ve.descuento, ve.total, ve.ganancia_total, ve.metodo_pago, ve.monto_pagado, ve.vuelto, ve.observaciones, ve.estado, ve.usuario,
                  t.nombre AS cliente_nombre
           FROM ventas ve LEFT JOIN terceros t ON t.id = ve.id_cliente
           ORDER BY ve.fecha DESC LIMIT ? OFFSET ?""",
        (limit, (page - 1) * limit),
    ).fetchall()
    return {"items": [dict(f) for f in filas], "total": total, "page": page, "limit": limit}