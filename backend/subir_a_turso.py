"""Copia tu inventario.db local a Turso (tablas, índices y datos).
  $env:TURSO_DATABASE_URL="https://..."
  $env:TURSO_AUTH_TOKEN="..."
  python subir_a_turso.py            (revisa y muestra qué haría)
  python subir_a_turso.py --aplicar  (copia)
No pisa nada: si Turso ya tiene datos, se detiene.
"""
import os
import sqlite3
import sys

import database as d

ORIGEN = os.path.join(os.path.dirname(os.path.abspath(__file__)), "inventario.db")
aplicar = "--aplicar" in sys.argv

if not d.TURSO_URL:
    sys.exit("Define TURSO_DATABASE_URL y TURSO_AUTH_TOKEN antes de correr esto.")

src = sqlite3.connect(ORIGEN)
src.row_factory = sqlite3.Row
tablas = [r for r in src.execute(
    "SELECT name, sql FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY rowid")]
indices = [r["sql"] for r in src.execute(
    "SELECT sql FROM sqlite_master WHERE type='index' AND sql IS NOT NULL")]

dst = d.conectar()

# Lectura adaptada a libsql_client usando .rows
res = dst.execute("SELECT name FROM sqlite_master WHERE type='table'")
existentes = {r[0] for r in res.rows}

for t in ("variantes", "productos", "ventas"):
    if t in existentes:
        res_count = dst.execute(f"SELECT COUNT(*) FROM {t}")
        if res_count.rows and res_count.rows[0][0] > 0:
            sys.exit(f"Turso ya tiene datos en '{t}'. No copio nada para no pisarlos.")

print(f"Origen: {ORIGEN}")
for t in tablas:
    n = src.execute(f"SELECT COUNT(*) FROM {t['name']}").fetchone()[0]
    print(f"  {t['name']}: {n} filas")

if not aplicar:
    sys.exit("\nSimulación. Para copiar: python subir_a_turso.py --aplicar")

for t in tablas:
    if t["name"] not in existentes:
        dst.execute(t["sql"])

for sql in indices:
    dst.execute(sql.replace("CREATE INDEX", "CREATE INDEX IF NOT EXISTS", 1))

for t in tablas:
    nombre = t["name"]
    filas = src.execute(f"SELECT * FROM {nombre}").fetchall()
    if not filas:
        continue
    cols = filas[0].keys()
    sql = f"INSERT OR REPLACE INTO {nombre} ({','.join(cols)}) VALUES ({','.join('?' * len(cols))})"
    for f in filas:
        dst.execute(sql, list(tuple(f)))
    print(f"  copiado {nombre}: {len(filas)}")

print("Listo.")