"""Registro de ventas: boletas y facturas (fake por ahora, para imprimir localmente)."""
import os
import re
import smtplib
from email.message import EmailMessage
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from auth import usuario_actual
from comprobante import generar_pdf, html_comprobante
from database import get_db, transaccion
from servicios import aplicar_movimiento, auditar

router = APIRouter(prefix="/api/ventas", dependencies=[Depends(usuario_actual)])

SERIES = {"boleta": "B001", "factura": "F001"}
IGV_TASA = 0.18
TALLAS_NEUTRAS = {"", "-", "unico", "único", "unica", "única", "unidad"}
# Roles que pueden editar / eliminar ventas
ROLES_EDICION = {"admin"}


class ItemVentaIn(BaseModel):
    id_variante: int
    cantidad: int = Field(gt=0)
    precio_venta: float = Field(gt=0)
    unidad_medida: str = Field(default="NIU", max_length=20)
    tipo_item: Literal["bien", "servicio"] = "bien"


class VentaIn(BaseModel):
    tipo_comprobante: Literal["boleta", "factura"]
    id_cliente: int
    id_vendedor: int | None = None
    items: list[ItemVentaIn] = Field(min_length=1)
    metodo_pago: str = Field(default="efectivo")
    monto_pagado: float | None = Field(default=None, ge=0)
    vuelto: float = Field(default=0.0, ge=0)
    descuento: float = Field(default=0.0, ge=0)
    observaciones: str | None = None


class ItemVentaEdit(BaseModel):
    id_variante: int
    cantidad: int = Field(gt=0)
    precio_venta: float = Field(gt=0)


class VentaEdit(BaseModel):
    id_cliente: int | None = None
    items: list[ItemVentaEdit] = Field(min_length=1)
    metodo_pago: str | None = None
    monto_pagado: float | None = Field(default=None, ge=0)
    descuento: float = Field(default=0.0, ge=0)
    observaciones: str | None = None


class EnviarCorreoIn(BaseModel):
    email: str = Field(max_length=200)


def _siguiente_correlativo(db, serie: str) -> int:
    db.execute("INSERT OR IGNORE INTO correlativos (serie, ultimo) VALUES (?, 0)", (serie,))
    db.execute("UPDATE correlativos SET ultimo = ultimo + 1 WHERE serie = ?", (serie,))
    return db.execute("SELECT ultimo FROM correlativos WHERE serie = ?", (serie,)).fetchone()[0]


def _exigir_rol(db, usuario: str):
    fila = db.execute("SELECT rol FROM usuarios WHERE lower(usuario) = lower(?)", (usuario,)).fetchone()
    if not fila or fila["rol"] not in ROLES_EDICION:
        raise HTTPException(403, "Solo un administrador puede editar o eliminar ventas.")


def _etiqueta(v) -> str:
    serie = v["serie"] or SERIES.get(v["tipo_comprobante"], "")
    return f"{serie}-{int(v['numero'] or v['id']):08d}"


def _detalle_venta(db, id_venta: int) -> dict:
    v = db.execute(
        """SELECT ve.*, t.nombre AS cliente_nombre, t.documento AS cliente_documento,
                  t.direccion AS cliente_direccion, t.email AS cliente_email
           FROM ventas ve LEFT JOIN terceros t ON t.id = ve.id_cliente
           WHERE ve.id = ?""",
        (id_venta,),
    ).fetchone()
    if not v:
        raise HTTPException(404, "La venta no existe.")
    items = db.execute(
        """SELECT id_variante, sku_producto, sku_producto AS codigo, descripcion, cantidad, precio_costo, precio_venta, ganancia,
                  unidad_medida, tipo_item, valor_unitario, igv
           FROM ventas_detalle WHERE id_venta = ?""",
        (id_venta,),
    ).fetchall()
    return {**dict(v), "items": [dict(i) for i in items]}


def _descripcion_y_costo(db, id_variante: int, nombre: str):
    var = db.execute(
        """SELECT v.talla, v.color,
                  COALESCE(NULLIF(v.precio_costo, 0), NULLIF(p.precio_costo, 0), 0) AS precio_costo
           FROM variantes v JOIN productos p ON p.sku = v.sku_producto
           WHERE v.id = ?""",
        (id_variante,),
    ).fetchone()
    costo = (var["precio_costo"] if var else 0) or 0
    partes = [nombre]
    if var and (var["talla"] or "").strip().lower() not in TALLAS_NEUTRAS:
        partes.append(var["talla"].strip())
    if var and (var["color"] or "").strip():
        partes.append(var["color"].strip())
    return " ".join(partes), costo


@router.post("", status_code=201)
def crear_venta(v: VentaIn, db=Depends(get_db), usuario: str = Depends(usuario_actual)):
    cliente = db.execute("SELECT * FROM terceros WHERE id = ?", (v.id_cliente,)).fetchone()
    if not cliente:
        raise HTTPException(404, "El cliente no existe.")
    if v.tipo_comprobante == "factura" and (not cliente["documento"] or len(cliente["documento"]) != 11):
        raise HTTPException(400, "Para emitir factura el cliente debe tener RUC (11 dígitos) registrado.")

    vendedor = usuario
    if v.id_vendedor:
        fila = db.execute("SELECT usuario FROM usuarios WHERE id = ?", (v.id_vendedor,)).fetchone()
        if not fila:
            raise HTTPException(404, "El vendedor no existe.")
        vendedor = fila["usuario"]

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
            descripcion, costo = _descripcion_y_costo(db, item.id_variante, r["nombre"])

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
               (tipo_comprobante, serie, numero, id_cliente, subtotal, descuento, total, ganancia_total, igv_total, metodo_pago, monto_pagado, vuelto, observaciones, usuario, id_vendedor)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
            (
                v.tipo_comprobante, serie, numero, v.id_cliente, subtotal, v.descuento,
                total_final, ganancia_neta, round(igv_total, 2), v.metodo_pago,
                monto_recibido, vuelto_calculado, v.observaciones, vendedor, v.id_vendedor,
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


@router.put("/{id_venta}")
def editar_venta(id_venta: int, e: VentaEdit, db=Depends(get_db), usuario: str = Depends(usuario_actual)):
    ids = [i.id_variante for i in e.items]
    if len(ids) != len(set(ids)):
        raise HTTPException(400, "Hay una variante repetida en la venta.")

    with transaccion(db):
        _exigir_rol(db, usuario)
        venta = db.execute("SELECT * FROM ventas WHERE id = ?", (id_venta,)).fetchone()
        if not venta:
            raise HTTPException(404, "La venta no existe.")
        etiqueta = _etiqueta(venta)

        if e.id_cliente is not None:
            cli = db.execute("SELECT * FROM terceros WHERE id = ?", (e.id_cliente,)).fetchone()
            if not cli:
                raise HTTPException(404, "El cliente no existe.")
            if venta["tipo_comprobante"] == "factura" and len(cli["documento"] or "") != 11:
                raise HTTPException(400, "Para factura el cliente debe tener RUC (11 dígitos).")

        viejos = {
            r["id_variante"]: r
            for r in db.execute("SELECT * FROM ventas_detalle WHERE id_venta = ?", (id_venta,)).fetchall()
            if r["id_variante"] is not None
        }
        nuevos = {i.id_variante: i for i in e.items}

        # Ajuste de stock solo por la diferencia de cada variante
        nombres = {}
        for vid in set(viejos) | set(nuevos):
            delta = (nuevos[vid].cantidad if vid in nuevos else 0) - (viejos[vid]["cantidad"] if vid in viejos else 0)
            if delta < 0:
                aplicar_movimiento(db, vid, "ENTRADA", -delta, f"Edición {etiqueta}", usuario)
        for vid in set(viejos) | set(nuevos):
            delta = (nuevos[vid].cantidad if vid in nuevos else 0) - (viejos[vid]["cantidad"] if vid in viejos else 0)
            if delta > 0:
                r = aplicar_movimiento(db, vid, "SALIDA", delta, f"Edición {etiqueta}", usuario)
                nombres[vid] = (r["sku"], r["nombre"])

        db.execute("DELETE FROM ventas_detalle WHERE id_venta = ?", (id_venta,))

        subtotal = ganancia_total = igv_total = 0.0
        for item in e.items:
            if item.id_variante in viejos:
                o = viejos[item.id_variante]
                sku, descripcion, costo = o["sku_producto"], o["descripcion"], o["precio_costo"] or 0
                unidad, tipo = o["unidad_medida"] or "NIU", o["tipo_item"] or "bien"
            else:
                sku, nombre = nombres[item.id_variante]
                descripcion, costo = _descripcion_y_costo(db, item.id_variante, nombre)
                unidad, tipo = "NIU", "bien"

            gan = (item.precio_venta - costo) * item.cantidad
            valor_unitario = round(item.precio_venta / (1 + IGV_TASA), 4)
            igv_linea = round((item.precio_venta - valor_unitario) * item.cantidad, 2)
            subtotal += item.cantidad * item.precio_venta
            ganancia_total += gan
            igv_total += igv_linea
            db.execute(
                """INSERT INTO ventas_detalle
                   (id_venta, id_variante, sku_producto, descripcion, cantidad, precio_costo, precio_venta, ganancia,
                    unidad_medida, tipo_item, valor_unitario, igv)
                   VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
                (id_venta, item.id_variante, sku, descripcion, item.cantidad, costo, item.precio_venta, gan,
                 unidad, tipo, valor_unitario, igv_linea),
            )

        total_final = max(0.0, subtotal - e.descuento)
        ganancia_neta = max(0.0, ganancia_total - e.descuento)
        monto = e.monto_pagado if e.monto_pagado is not None else total_final
        vuelto = max(0.0, monto - total_final)

        db.execute(
            """UPDATE ventas SET id_cliente = COALESCE(?, id_cliente), subtotal = ?, descuento = ?, total = ?,
                      ganancia_total = ?, igv_total = ?, metodo_pago = COALESCE(?, metodo_pago),
                      monto_pagado = ?, vuelto = ?, observaciones = ?
               WHERE id = ?""",
            (e.id_cliente, subtotal, e.descuento, total_final, ganancia_neta, round(igv_total, 2),
             e.metodo_pago, monto, vuelto, e.observaciones, id_venta),
        )
        auditar(db, usuario, f"Editó {etiqueta}: total {venta['total']:.2f} -> {total_final:.2f}")

    return _detalle_venta(db, id_venta)


@router.delete("/{id_venta}")
def eliminar_venta(id_venta: int, db=Depends(get_db), usuario: str = Depends(usuario_actual)):
    with transaccion(db):
        _exigir_rol(db, usuario)
        venta = db.execute("SELECT * FROM ventas WHERE id = ?", (id_venta,)).fetchone()
        if not venta:
            raise HTTPException(404, "La venta no existe.")
        etiqueta = _etiqueta(venta)

        for d in db.execute("SELECT * FROM ventas_detalle WHERE id_venta = ?", (id_venta,)).fetchall():
            if d["id_variante"] is not None:
                aplicar_movimiento(db, d["id_variante"], "ENTRADA", d["cantidad"], f"Anulación {etiqueta}", usuario)

        db.execute("DELETE FROM ventas_detalle WHERE id_venta = ?", (id_venta,))
        db.execute("DELETE FROM ventas WHERE id = ?", (id_venta,))
        auditar(db, usuario, f"Eliminó {etiqueta} por S/ {venta['total']:.2f} y devolvió el stock")
    return {"id": id_venta}


@router.post("/{id_venta}/enviar-correo")
def enviar_comprobante(id_venta: int, d: EnviarCorreoIn, db=Depends(get_db), usuario: str = Depends(usuario_actual)):
    email = d.email.strip()
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        raise HTTPException(400, "Correo inválido.")

    host = os.environ.get("SMTP_HOST")
    user = os.environ.get("SMTP_USER")
    clave = os.environ.get("SMTP_PASSWORD") or os.environ.get("SMTP_PASS")
    if not (host and user and clave):
        raise HTTPException(400, "El correo no está configurado (SMTP_HOST, SMTP_USER, SMTP_PASSWORD).")
    puerto = int(os.environ.get("SMTP_PORT", "587"))

    v = _detalle_venta(db, id_venta)
    etiqueta = _etiqueta(v)

    msg = EmailMessage()
    msg["Subject"] = f"Comprobante {etiqueta} - INVERSIONES NATHAN S.R.L"
    msg["From"] = os.environ.get("SMTP_FROM", user)
    msg["To"] = email
    msg.set_content(
        f"Adjuntamos su comprobante {etiqueta} por S/ {v['total']:.2f}.\n\nINVERSIONES NATHAN S.R.L"
    )
    msg.add_alternative(html_comprobante(v, etiqueta), subtype="html")
    msg.add_attachment(
        generar_pdf(v, etiqueta),
        maintype="application",
        subtype="pdf",
        filename=f"{etiqueta}.pdf",
    )

    try:
        if puerto == 465:
            with smtplib.SMTP_SSL(host, puerto, timeout=15) as s:
                s.login(user, clave)
                s.send_message(msg)
        else:
            with smtplib.SMTP(host, puerto, timeout=15) as s:
                s.starttls()
                s.login(user, clave)
                s.send_message(msg)
    except Exception as ex:
        raise HTTPException(502, f"No se pudo enviar el correo: {ex}")

    auditar(db, usuario, f"Envió {etiqueta} a {email}")
    return {"enviado": True}


@router.get("/{id_venta}")
def obtener_venta(id_venta: int, db=Depends(get_db)):
    return _detalle_venta(db, id_venta)


@router.get("")
def listar_ventas(page: int = 1, limit: int = 20, db=Depends(get_db)):
    total = db.execute("SELECT COUNT(*) FROM ventas").fetchone()[0]
    filas = db.execute(
        """SELECT ve.id, ve.tipo_comprobante, ve.serie, ve.numero, ve.fecha, ve.subtotal, ve.descuento, ve.total, ve.ganancia_total, ve.metodo_pago, ve.monto_pagado, ve.vuelto, ve.observaciones, ve.estado, ve.usuario,
                  t.nombre AS cliente_nombre, t.email AS cliente_email
           FROM ventas ve LEFT JOIN terceros t ON t.id = ve.id_cliente
           ORDER BY ve.fecha DESC LIMIT ? OFFSET ?""",
        (limit, (page - 1) * limit),
    ).fetchall()
    return {"items": [dict(f) for f in filas], "total": total, "page": page, "limit": limit}