"""Carga inicial de mercadería desde PDF, sin precios ni proveedor todavía.
Ejecutar con el backend corriendo: python cargar_inventario.py
"""
import requests

API = "http://127.0.0.1:8000"
USUARIO = "admin"
PASSWORD = "administrador123"

sesion = requests.post(f"{API}/api/auth/login", json={"usuario": USUARIO, "password": PASSWORD})
sesion.raise_for_status()
token = sesion.json()["token"]
headers = {"Authorization": f"Bearer {token}"}

productos = [
    {
        "sku": "PEG-CAS", "nombre": "Pegamento Casacor", "categoria": "Pegamentos",
        "precio_costo": 0, "precio_venta": 0, "stock_minimo": 5,
        "variantes": [
            {"talla": "Blanco", "color": "Flexible", "stock_inicial": 299},
            {"talla": "Gris", "color": "Interiores", "stock_inicial": 255},
        ],
    },
    {
        "sku": "PEG-TRE", "nombre": "Pegamento Trébol", "categoria": "Pegamentos",
        "precio_costo": 0, "precio_venta": 0, "stock_minimo": 5,
        "variantes": [
            {"talla": "Blanco", "color": "Extrafuerte", "stock_inicial": 153},
            {"talla": "Gris", "color": "Interiores", "stock_inicial": 101},
        ],
    },
    {
        "sku": "FRA-CAS", "nombre": "Fragua Casacor", "categoria": "Fraguas",
        "precio_costo": 0, "precio_venta": 0, "stock_minimo": 5,
        "variantes": [
            {"talla": "Único", "color": "Madera", "stock_inicial": 32},
            {"talla": "Único", "color": "Cuero", "stock_inicial": 50},
            {"talla": "Único", "color": "Gris", "stock_inicial": 72},
            {"talla": "Único", "color": "Grafito", "stock_inicial": 42},
            {"talla": "Único", "color": "Gris Plata", "stock_inicial": 82},
            {"talla": "Único", "color": "Mármol", "stock_inicial": 49},
            {"talla": "Único", "color": "Marfil", "stock_inicial": 22},
            {"talla": "Único", "color": "Marrón Claro", "stock_inicial": 24},
            {"talla": "Único", "color": "Beige", "stock_inicial": 22},
            {"talla": "Único", "color": "Marrón Oscuro", "stock_inicial": 42},
            {"talla": "Único", "color": "Crema", "stock_inicial": 45},
            {"talla": "Único", "color": "Rojo", "stock_inicial": 8},
            {"talla": "Único", "color": "Azul Pastel", "stock_inicial": 7},
            {"talla": "Único", "color": "Chocolate", "stock_inicial": 50},
            {"talla": "Único", "color": "Guinda", "stock_inicial": 19},
            {"talla": "Único", "color": "Negro", "stock_inicial": 11},
            {"talla": "Único", "color": "Arena", "stock_inicial": 20},
            {"talla": "Único", "color": "Verde Flora", "stock_inicial": 25},
            {"talla": "Único", "color": "Hueso", "stock_inicial": 29},
            {"talla": "Único", "color": "Blanco", "stock_inicial": 94},
            {"talla": "Único", "color": "Turquesa", "stock_inicial": 25},
            {"talla": "Único", "color": "Crepúsculo", "stock_inicial": 7},
        ],
    },
    {
        "sku": "CRU", "nombre": "Crucetas", "categoria": "Nivelación",
        "precio_costo": 0, "precio_venta": 0, "stock_minimo": 5,
        "variantes": [
            {"talla": "3x3", "color": "Paquete x100", "stock_inicial": 7},
            {"talla": "2x2", "color": "Paquete x100", "stock_inicial": 2},
            {"talla": "1x1", "color": "Paquete x100", "stock_inicial": 2},
        ],
    },
    {
        "sku": "SIS-NIV", "nombre": "Sistema de nivelación para porcelanato", "categoria": "Nivelación",
        "precio_costo": 0, "precio_venta": 0, "stock_minimo": 5,
        "variantes": [
            {"talla": "Único", "color": "Único", "stock_inicial": 2},
        ],
    },
]

for p in productos:
    variantes = p.pop("variantes")
    r = requests.post(f"{API}/api/productos", json=p, headers=headers)
    if r.status_code not in (201, 409):
        print(f"ERROR creando {p['sku']}: {r.text}")
        continue
    if r.status_code == 409:
        print(f"{p['sku']} ya existía, se saltó la creación del producto.")

    for v in variantes:
        rv = requests.post(f"{API}/api/productos/{p['sku']}/variantes", json=v, headers=headers)
        if rv.status_code == 201:
            print(f"OK  {p['sku']} — {v['talla']}/{v['color']} ({v['stock_inicial']})")
        else:
            print(f"ERROR variante {p['sku']} {v['talla']}/{v['color']}: {rv.text}")

print("Listo.")