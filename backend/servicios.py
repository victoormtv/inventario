"""Lógica compartida: movimientos de stock y auditoría."""
from fastapi import HTTPException


def auditar(db, usuario: str, accion: str) -> None:
    db.execute("INSERT INTO auditoria (usuario, accion) VALUES (?, ?)", (usuario, accion))


def stock_total(db, sku: str) -> int:
    return db.execute(
        "SELECT COALESCE(SUM(stock_actual), 0) FROM variantes WHERE sku_producto = ?", (sku,)
    ).fetchone()[0]


def aplicar_movimiento(db, id_variante: int, tipo: str, cantidad: int, referencia: str, usuario: str) -> dict:
    """Cambia el stock de UNA variante y deja el rastro en el kardex.

    Debe llamarse dentro de `with transaccion(db):` para que el stock y el
    kardex se guarden juntos.
      - ENTRADA: suma `cantidad`.
      - SALIDA:  resta `cantidad` (no permite dejar el stock en negativo).
      - AJUSTE:  `cantidad` es el stock real contado; se guarda la diferencia.
    """
    v = db.execute(
        """SELECT v.id, v.sku_producto, v.stock_actual, p.nombre, p.stock_minimo
           FROM variantes v JOIN productos p ON p.sku = v.sku_producto
           WHERE v.id = ?""",
        (id_variante,),
    ).fetchone()
    if v is None:
        raise HTTPException(404, "La variante no existe.")

    anterior = v["stock_actual"]
    total_antes = stock_total(db, v["sku_producto"])

    if tipo == "ENTRADA":
        nuevo = anterior + cantidad
        registrada = cantidad
    elif tipo == "SALIDA":
        if cantidad > anterior:
            raise HTTPException(409, f"Stock insuficiente: hay {anterior} unidades y intentas sacar {cantidad}.")
        nuevo = anterior - cantidad
        registrada = cantidad
    elif tipo == "AJUSTE":
        nuevo = cantidad
        registrada = abs(nuevo - anterior)
        if registrada == 0:
            raise HTTPException(400, "El stock contado es igual al actual; no hay nada que ajustar.")
    else:
        raise HTTPException(400, "Tipo de movimiento no válido.")

    db.execute("UPDATE variantes SET stock_actual = ? WHERE id = ?", (nuevo, id_variante))
    cur = db.execute(
        """INSERT INTO kardex
           (sku_producto, tipo_movimiento, cantidad, referencia, id_sucursal,
            id_variante, stock_anterior, stock_resultante, usuario)
           VALUES (?, ?, ?, ?, 1, ?, ?, ?, ?)""",
        (v["sku_producto"], tipo, registrada, referencia, id_variante, anterior, nuevo, usuario),
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
    }

"""Crea (o cambia la contraseña de) un usuario administrador.

Uso:
    python crear_usuario.py            -> te pregunta el nombre y la contraseña
    python crear_usuario.py maria      -> crea/actualiza al usuario "maria"
    python crear_usuario.py --listar   -> muestra los usuarios existentes
"""
