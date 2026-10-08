"""Borra TODAS las ventas y restaura el stock.
Uso:  python eliminar_ventas.py            (solo muestra)
      python eliminar_ventas.py --aplicar  (borra)
Usa la misma BD que database.py (Turso si hay TURSO_*, si no el .db local).
"""
import shutil
import sys

import database as d

aplicar = "--aplicar" in sys.argv
conn = d.conectar()

ventas = conn.execute("SELECT id, serie, numero, total, fecha FROM ventas ORDER BY id").fetchall()
print(f"BD: {'Turso' if d.TURSO_URL else d.DB_PATH}")
print(f"Ventas a borrar: {len(ventas)}")
for v in ventas:
    print(f"  #{v['id']} {v['serie']}-{v['numero']} S/ {v['total']} {v['fecha']}")

variantes = [r[0] for r in conn.execute(
    "SELECT DISTINCT id_variante FROM ventas_detalle WHERE id_variante IS NOT NULL").fetchall()]

if not aplicar:
    print("\nSimulación. Para borrar: python eliminar_ventas.py --aplicar")
    sys.exit()

if not d.TURSO_URL:
    shutil.copy(d.DB_PATH, d.DB_PATH + ".bak")
    print("Respaldo: " + d.DB_PATH + ".bak")

with d.transaccion(conn):
    conn.execute("DELETE FROM kardex WHERE tipo_movimiento='SALIDA' AND referencia LIKE 'Venta%'")
    conn.execute("DELETE FROM ventas_detalle")
    conn.execute("DELETE FROM ventas")
    conn.execute("DELETE FROM correlativos")
    for vid in variantes:
        k = conn.execute(
            "SELECT stock_resultante FROM kardex WHERE id_variante=? AND stock_resultante IS NOT NULL "
            "ORDER BY id DESC LIMIT 1", (vid,)).fetchone()
        if k:
            conn.execute("UPDATE variantes SET stock_actual=? WHERE id=?", (k[0], vid))
            print(f"  stock variante {vid} -> {k[0]}")

print("Listo.")