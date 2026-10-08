import sys
import unicodedata
from collections import Counter

from database import ALMACEN_ID, conectar

# Precios de COSTO por color
PRECIOS = {
    "Blanco": 1.50,
    "Beige": 1.60, "Hueso": 1.60, "Crema": 1.60, "Marfil": 1.60,
    "Gris Plata": 1.60, "Gris": 1.60, "Grafito": 1.60, "Arena": 1.60,
    "Mármol": 1.60, "Rosado Pastel": 1.60, "Cielo": 1.60,
    "Celeste Pastel": 1.60, "Verde Pastel": 1.60,
    "Madera": 1.70,
    "Cuero": 1.80, "Marrón Oscuro": 1.80, "Marrón Claro": 1.80,
    "Crepúsculo": 1.80, "Chocolate": 1.80, "Negro": 1.80,
    "Guinda": 2.10, "Azul Pastel": 2.10, "Verde Flora": 2.10,
    "Verde Limón": 3.10, "Rojo": 3.10, "Naranja": 3.10, "Turquesa": 3.10,
    "Lila": 3.10, "Amarillo": 3.10, "Azul Marino": 3.10,
}


def norm(s: str) -> str:
    s = unicodedata.normalize("NFD", s or "")
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")
    return " ".join(s.lower().split())


def main(aplicar: bool):
    conn = conectar()
    try:
        filas = conn.execute(
            """SELECT v.id, v.sku_producto, v.talla, v.color, v.precio_venta AS venta_var,
                      p.nombre, p.precio_venta AS venta_prod
               FROM variantes v JOIN productos p ON p.sku = v.sku_producto
               WHERE lower(p.nombre) LIKE '%fragua%'"""
        ).fetchall()
        if not filas:
            print("No hay productos de fragua en la BD.")
            return

        precios = {norm(k): (k, v) for k, v in PRECIOS.items()}
        encontrados, cambios = set(), []

        for f in filas:
            color, nombre = norm(f["color"]), norm(f["nombre"])
            clave = color if color in precios else None
            if not clave:
                for c in sorted(precios, key=len, reverse=True):
                    if nombre.endswith(c):
                        clave = c
                        break
            if clave:
                encontrados.add(clave)
                cambios.append((f, precios[clave][1]))

        print("== Costo de existentes (y deshacer venta mal guardada) ==")
        for f, precio in cambios:
            deshacer = f["venta_var"] is not None and abs(f["venta_var"] - precio) < 0.001 \
                and abs((f["venta_prod"] or 0) - precio) >= 0.001
            extra = f"  | venta vuelve a S/ {f['venta_prod']:.2f}" if deshacer else ""
            print(f"  {f['nombre']} / {f['color']} -> costo S/ {precio:.2f}{extra}")
            if aplicar:
                if deshacer:
                    conn.execute(
                        "UPDATE variantes SET precio_costo = ?, precio_venta = ? WHERE id = ?",
                        (precio, f["venta_prod"], f["id"]),
                    )
                else:
                    conn.execute("UPDATE variantes SET precio_costo = ? WHERE id = ?", (precio, f["id"]))

        por_sku = Counter(f["sku_producto"] for f in filas)
        sku_base = por_sku.most_common(1)[0][0]
        talla_base = Counter(f["talla"] for f in filas if f["sku_producto"] == sku_base).most_common(1)[0][0]
        prod = conn.execute("SELECT nombre, precio_venta FROM productos WHERE sku = ?", (sku_base,)).fetchone()

        print(f"\n== Crear faltantes en {sku_base} ({prod['nombre']}), medida '{talla_base}', stock 0 ==")
        existentes = {norm(f["color"]) for f in filas if f["sku_producto"] == sku_base}
        creadas = 0
        for k, (orig, precio) in precios.items():
            if k in encontrados or k in existentes:
                continue
            print(f"  {orig} -> costo S/ {precio:.2f}, venta S/ {prod['precio_venta']:.2f}")
            creadas += 1
            if aplicar:
                conn.execute(
                    """INSERT INTO variantes (sku_producto, talla, color, stock_actual, id_sucursal, precio_costo, precio_venta)
                       VALUES (?, ?, ?, 0, ?, ?, ?)""",
                    (sku_base, talla_base, orig, ALMACEN_ID, precio, prod["precio_venta"]),
                )

        print(f"\nActualizadas: {len(cambios)} | Creadas: {creadas}")
        if aplicar:
            conn.commit()
            print("Guardado.")
        else:
            print("Simulación. Usa --aplicar para guardar.")
    finally:
        conn.close()


if __name__ == "__main__":
    main("--aplicar" in sys.argv)