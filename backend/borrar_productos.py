"""Borra productos por SKU directamente en la base de datos SQLite,
incluyendo variantes, kardex y cualquier registro que dependa de ellos.

USO:
  1. Apaga el backend (Ctrl+C en su terminal).
  2. Ejecuta:  python borrar_productos_db.py
  3. Vuelve a encender el backend.

Hace un respaldo automático de la base antes de borrar.
Pensado para datos de carga inicial. Si esos productos ya tuvieron ventas reales,
el script lo mostrará en el resumen y podrás cancelar.
"""
import glob
import os
import shutil
import sqlite3
import sys
from datetime import datetime

SKUS_A_BORRAR = [
    "PEG-CAS", "PEG-TRE",
    "PEG-CAS-FLEX", "PEG-CAS-INT", "PEG-TRE-EXT", "PEG-TRE-INT",
    "FRA-CAS", "CRU", "SIS-NIV",
]

DB_PATH = None


def q(nombre):
    return '"' + nombre.replace('"', '""') + '"'


def buscar_db():
    base = os.path.dirname(os.path.abspath(__file__))
    encontrados = []
    for patron in ("*.db", "*.sqlite", "*.sqlite3"):
        for ruta in glob.glob(os.path.join(base, "**", patron), recursive=True):
            if any(x in ruta for x in ("venv", ".venv", "site-packages", "node_modules", "respaldo")):
                continue
            encontrados.append(ruta)
    return encontrados


def tablas(con):
    return [r[0] for r in con.execute(
        "SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'")]


def columnas(con, tabla):
    return con.execute(f"PRAGMA table_info({q(tabla)})").fetchall()

def pk_de(con, tabla):
    pks = [c[1] for c in columnas(con, tabla) if c[5]]
    return pks[0] if pks else "rowid"


def hijos(con, padre):
    """Tablas con clave foránea hacia 'padre': (tabla_hija, columna_hija, columna_padre)."""
    res = []
    for t in tablas(con):
        for fk in con.execute(f"PRAGMA foreign_key_list({q(t)})").fetchall():
            if fk[2] == padre:
                res.append((t, fk[3], fk[4] or pk_de(con, padre)))
    return res


def planear(con, tabla, where, params, plan, camino=()):
    """Agrega al plan (hijos primero) lo que hay que borrar."""
    if tabla in camino:
        return
    for hija, col_hija, col_padre in hijos(con, tabla):
        sub = f"{q(col_hija)} IN (SELECT {q(col_padre)} FROM {q(tabla)} WHERE {where})"
        planear(con, hija, sub, params, plan, camino + (tabla,))
    plan.append((tabla, where, params))


def main():
    ruta = DB_PATH
    if not ruta:
        encontrados = buscar_db()
        if len(encontrados) == 1:
            ruta = encontrados[0]
        elif not encontrados:
            print("No encontré ninguna base .db/.sqlite en esta carpeta. Pon la ruta en DB_PATH.")
            print("Si tu base no es SQLite (Postgres, MySQL...), avísame y lo adapto.")
            sys.exit(1)
        else:
            print("Encontré varias bases, elige una y ponla en DB_PATH dentro del script:")
            for e in encontrados:
                print("  ", e)
            sys.exit(1)

    print(f"Base de datos: {ruta}")
    con = sqlite3.connect(ruta)

    candidatas = [t for t in tablas(con) if any(c[1] == "sku" for c in columnas(con, t))]
    if "productos" in candidatas:
        tabla_prod = "productos"
    elif len(candidatas) == 1:
        tabla_prod = candidatas[0]
    else:
        print(f"No pude determinar la tabla de productos. Candidatas con columna sku: {candidatas}")
        sys.exit(1)
    print(f"Tabla de productos: {tabla_prod}")

    marcas = ",".join("?" for _ in SKUS_A_BORRAR)
    where = f"{q('sku')} IN ({marcas})"
    plan = []
    planear(con, tabla_prod, where, list(SKUS_A_BORRAR), plan)

    existentes = con.execute(f"SELECT sku FROM {q(tabla_prod)} WHERE {where}", SKUS_A_BORRAR).fetchall()
    if not existentes:
        print("Ninguno de esos SKUs existe en la base. Nada que borrar.")
        return

    print("\nSe borrarán estos registros:")
    for tabla, w, p in plan:
        n = con.execute(f"SELECT COUNT(*) FROM {q(tabla)} WHERE {w}", p).fetchone()[0]
        if n:
            print(f"  {tabla:<28} {n} registro(s)")
    print(f"\nProductos: {', '.join(r[0] for r in existentes)}")

    if input("\n¿Continuar? escribe SI para confirmar: ").strip().upper() != "SI":
        print("Cancelado.")
        return

    # Respaldo
    sello = datetime.now().strftime("%Y%m%d_%H%M%S")
    respaldo = f"{ruta}.respaldo_{sello}"
    con.close()
    shutil.copy2(ruta, respaldo)
    print(f"Respaldo creado: {respaldo}")

    con = sqlite3.connect(ruta)
    try:
        for tabla, w, p in plan:
            con.execute(f"DELETE FROM {q(tabla)} WHERE {w}", p)
        con.commit()
        print("OK  Productos borrados.")
    except Exception as e:
        con.rollback()
        print(f"ERROR, no se borró nada: {e}")
    finally:
        con.close()


if __name__ == "__main__":
    main()