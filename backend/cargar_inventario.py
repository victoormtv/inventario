"""Carga inicial de mercadería según Inventario_21_09.pdf (sin precios ni proveedor todavía).

ORDEN:
  1. Con el backend apagado:  python borrar_productos_db.py
  2. Enciende el backend.
  3. Ejecuta:                 python cargar_inventario.py

Convención de variantes:
  talla = medida (solo crucetas: 3x3, 2x2, 1x1); "Único" si no aplica
  color = color real del producto; "Único" si no aplica
  Lo que no es color (Flexible, Interiores, Extrafuerte) va en el nombre del producto.
"""
import requests

API = "http://127.0.0.1:8000"
USUARIO = "admin"
PASSWORD = "administrador123"

# Totales del PDF, para verificar al final
ESPERADO_VARIANTES = 30
ESPERADO_UNIDADES = 1598


def producto(sku, nombre, categoria, variantes):
    return {
        "sku": sku, "nombre": nombre, "categoria": categoria,
        "precio_costo": 0, "precio_venta": 0, "stock_minimo": 5,
        "variantes": [{"talla": t, "color": c, "stock_inicial": s} for t, c, s in variantes],
    }


productos = [
    producto("PEG-CAS-FLEX", "Pegamento Casacor Flexible", "Pegamentos", [("Único", "Blanco", 299)]),
    producto("PEG-CAS-INT", "Pegamento Casacor Interiores", "Pegamentos", [("Único", "Gris", 255)]),
    producto("PEG-TRE-EXT", "Pegamento Trébol Extrafuerte", "Pegamentos", [("Único", "Blanco", 153)]),
    producto("PEG-TRE-INT", "Pegamento Trébol Interiores", "Pegamentos", [("Único", "Gris", 101)]),
    producto("FRA-CAS", "Fragua Casacor", "Fraguas", [
        ("Único", "Madera", 32),
        ("Único", "Cuero", 50),
        ("Único", "Gris", 72),
        ("Único", "Grafito", 42),
        ("Único", "Gris Plata", 82),
        ("Único", "Mármol", 49),
        ("Único", "Marfil", 22),
        ("Único", "Marrón Claro", 24),
        ("Único", "Beige", 22),
        ("Único", "Marrón Oscuro", 42),
        ("Único", "Crema", 45),
        ("Único", "Rojo", 8),
        ("Único", "Azul Pastel", 7),
        ("Único", "Chocolate", 50),
        ("Único", "Guinda", 19),
        ("Único", "Negro", 11),
        ("Único", "Arena", 20),
        ("Único", "Verde Flora", 25),
        ("Único", "Hueso", 29),
        ("Único", "Blanco", 94),
        ("Único", "Turquesa", 25),
        ("Único", "Crepúsculo", 7),
    ]),
    producto("CRU", "Crucetas (100 und)", "Nivelación", [
        ("3x3", "Único", 7),
        ("2x2", "Único", 2),
        ("1x1", "Único", 2),
    ]),
    producto("SIS-NIV", "Sistema de nivelación para porcelanato", "Nivelación", [("Único", "Único", 2)]),
]

# Verificación de los datos contra el PDF antes de tocar nada
n_var = sum(len(p["variantes"]) for p in productos)
n_uni = sum(v["stock_inicial"] for p in productos for v in p["variantes"])
if (n_var, n_uni) != (ESPERADO_VARIANTES, ESPERADO_UNIDADES):
    raise SystemExit(f"Los datos del script no cuadran con el PDF: {n_var} variantes / {n_uni} unidades "
                     f"(esperado {ESPERADO_VARIANTES} / {ESPERADO_UNIDADES}).")

sesion = requests.post(f"{API}/api/auth/login", json={"usuario": USUARIO, "password": PASSWORD})
sesion.raise_for_status()
headers = {"Authorization": f"Bearer {sesion.json()['token']}"}

# Protección: si alguno de estos SKUs ya existe, no se crea nada
try:
    r = requests.get(f"{API}/api/productos", headers=headers)
    if r.status_code == 200:
        data = r.json()
        lista = data if isinstance(data, list) else next((v for v in data.values() if isinstance(v, list)), [])
        existentes = {x.get("sku") for x in lista if isinstance(x, dict)}
        repetidos = [p["sku"] for p in productos if p["sku"] in existentes]
        if repetidos:
            raise SystemExit(f"Ya existen estos productos: {', '.join(repetidos)}. "
                             "Ejecuta primero borrar_productos_db.py (con el backend apagado). No se creó nada.")
except requests.RequestException:
    pass

ok_var = 0
ok_uni = 0
errores = []

for p in productos:
    variantes = p.pop("variantes")
    r = requests.post(f"{API}/api/productos", json=p, headers=headers)
    if r.status_code == 409:
        raise SystemExit(f"{p['sku']} ya existe. Ejecuta primero borrar_productos_db.py. Proceso detenido.")
    if r.status_code != 201:
        print(f"ERROR creando {p['sku']}: {r.text}")
        errores.append(p["sku"])
        continue
    print(f"Producto {p['sku']} — {p['nombre']}")

    for v in variantes:
        rv = requests.post(f"{API}/api/productos/{p['sku']}/variantes", json=v, headers=headers)
        if rv.status_code == 201:
            ok_var += 1
            ok_uni += v["stock_inicial"]
            print(f"   OK  {v['talla']} / {v['color']} ({v['stock_inicial']})")
        else:
            errores.append(f"{p['sku']} {v['talla']}/{v['color']}")
            print(f"   ERROR {v['talla']} / {v['color']}: {rv.text}")

print()
print(f"Variantes creadas: {ok_var} de {ESPERADO_VARIANTES}")
print(f"Unidades cargadas: {ok_uni} de {ESPERADO_UNIDADES}")
if errores:
    print("Con errores en:", ", ".join(errores))
elif (ok_var, ok_uni) == (ESPERADO_VARIANTES, ESPERADO_UNIDADES):
    print("Todo coincide con el PDF.")