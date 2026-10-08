"""Lógica compartida: movimientos de stock y auditoría."""
from fastapi import HTTPException


def auditar(db, usuario: str, accion: str) -> None:
    db.execute("INSERT INTO auditoria (usuario, accion) VALUES (?, ?)", (usuario, accion))


def stock_total(db, sku: str) -> int:
    return db.execute(
        "SELECT COALESCE(SUM(stock_actual), 0) FROM variantes WHERE sku_producto = ?", (sku,)
    ).fetchone()[0]


def aplicar_movimiento(
    db,
    id_variante: int,
    tipo: str,
    cantidad: int,
    referencia: str,
    usuario: str,
    id_proveedor: int | None = None,
    precio_unitario: float | None = None,
) -> dict:
    """Cambia el stock de UNA variante y actualiza su costo si es una entrada.

    Debe llamarse dentro de `with transaccion(db):` para que el stock y el
    kardex se guarden juntos.
      - ENTRADA: suma `cantidad` y actualiza el costo de la variante si cambió.
      - SALIDA:  resta `cantidad` (no permite dejar el stock en negativo).
      - AJUSTE:  `cantidad` es el stock real contado; se guarda la diferencia.
    """
    v = db.execute(
        """SELECT v.id, v.sku_producto, v.stock_actual, v.precio_costo, p.nombre, p.stock_minimo
           FROM variantes v 
           JOIN productos p ON p.sku = v.sku_producto
           WHERE v.id = ?""",
        (id_variante,),
    ).fetchone()

    if v is None:
        raise HTTPException(404, "La variante no existe.")

    anterior = v["stock_actual"]
    total_antes = stock_total(db, v["sku_producto"])
    precio_anterior = None

    if tipo == "ENTRADA":
        nuevo = anterior + cantidad
        registrada = cantidad
        # Se obtiene y actualiza el precio_costo específico de la VARIANTE
        if precio_unitario is not None and precio_unitario != v["precio_costo"]:
            precio_anterior = v["precio_costo"]
            db.execute("UPDATE variantes SET precio_costo = ? WHERE id = ?", (precio_unitario, id_variante))

    elif tipo == "SALIDA":
        if cantidad > anterior:
            raise HTTPException(409, f"Stock insuficiente: hay {anterior} unidades e intentas sacar {cantidad}.")
        nuevo = anterior - cantidad
        registrada = cantidad

    elif tipo == "AJUSTE":
        nuevo = cantidad
        registrada = abs(nuevo - anterior)
        if registrada == 0:
            raise HTTPException(400, "El stock contado es igual al actual; no hay nada que ajustar.")

    else:
        raise HTTPException(400, "Tipo de movimiento no válido.")

    # Actualizar stock de la variante
    db.execute("UPDATE variantes SET stock_actual = ? WHERE id = ?", (nuevo, id_variante))

    # Registrar en el kardex
    cur = db.execute(
        """INSERT INTO kardex
           (sku_producto, tipo_movimiento, cantidad, referencia, id_sucursal,
            id_variante, stock_anterior, stock_resultante, usuario,
            id_proveedor, precio_unitario, precio_anterior)
           VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?, ?, ?, ?)""",
        (
            v["sku_producto"],
            tipo,
            registrada,
            referencia,
            id_variante,
            anterior,
            nuevo,
            usuario,
            id_proveedor,
            precio_unitario,
            precio_anterior,
        ),
    )

    return {
        "id": cur.lastrowid,
        "sku": v["sku_producto"],
        "nombre": v["nombre"],
        "tipo": tipo,
        "cantidad": registrada,
        "stock_anterior": anterior,
        "stock_resultante": nuevo,
        "stock_minimo": v["stock_minimo"],
        "total_antes": total_antes,
        "total_despues": total_antes + (nuevo - anterior),
        "precio_anterior": precio_anterior,
        "precio_nuevo": precio_unitario,
    }