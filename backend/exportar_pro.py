"""
Endpoint /api/exportar/excel-pro
Genera un libro Excel profesional con hasta 5 hojas:
  - Dashboard Ejecutivo
  - Kardex de Movimientos
  - Resumen por Producto
  - Stock Actual
  - Análisis de Ganancias
"""
from io import BytesIO
from datetime import date
from typing import Optional

import pandas as pd
from fastapi import APIRouter, Depends, Query
from fastapi.responses import StreamingResponse
from openpyxl import load_workbook
from openpyxl.styles import (
    Font, PatternFill, Alignment, Border, Side,
    GradientFill,
)
from openpyxl.utils import get_column_letter
from openpyxl.chart import BarChart, Reference
from openpyxl.chart.series import DataPoint

from auth import usuario_actual
from database import get_db

router = APIRouter(prefix="/api", dependencies=[Depends(usuario_actual)])
XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"

# ─────────────── helpers de estilo ───────────────
NAVY     = "0F2340"
INDIGO   = "3B4FD8"
EMERALD  = "059669"
ROSE     = "E11D48"
VIOLET   = "7C3AED"
SLATE    = "475569"
LIGHT_BG = "F8FAFC"
WHITE    = "FFFFFF"
YELLOW   = "D97706"

def _fill(hex_color: str) -> PatternFill:
    return PatternFill("solid", fgColor=hex_color)

def _font(bold=False, size=11, color=NAVY, italic=False) -> Font:
    return Font(bold=bold, size=size, color=color, italic=italic, name="Calibri")

def _border_bottom(color="AAAAAA") -> Border:
    s = Side(style="thin", color=color)
    return Border(top=s, bottom=s, left=s, right=s)

def _full_border(color="AAAAAA") -> Border:
    s = Side(style="thin", color=color)
    return Border(top=s, bottom=s, left=s, right=s)

def _align(h="left", v="center", wrap=False) -> Alignment:
    return Alignment(horizontal=h, vertical=v, wrap_text=wrap)

def _style_header_row(ws, row: int, cols: int, fill_hex=NAVY, font_color=WHITE):
    """Aplica estilo de encabezado a una fila."""
    for c in range(1, cols + 1):
        cell = ws.cell(row=row, column=c)
        cell.fill = _fill(fill_hex)
        cell.font = _font(bold=True, color=font_color, size=10)
        cell.alignment = _align(h="center")
        cell.border = _full_border("FFFFFF")

def _autofit(ws, min_w=8, max_w=48):
    for col in ws.columns:
        max_len = 0
        col_letter = get_column_letter(col[0].column)
        for cell in col:
            try:
                val = str(cell.value or "")
                max_len = max(max_len, len(val))
            except Exception:
                pass
        ws.column_dimensions[col_letter].width = min(max(max_len + 2, min_w), max_w)

def _sin_datos(ws, fila: int, cols: int):
    """Fila con borde negro cuando no hay datos, para que la tabla siempre se vea."""
    for c in range(1, cols + 1):
        ws.cell(fila, c).border = _full_border()
        ws.cell(fila, c).fill = _fill(WHITE)
    ws.merge_cells(start_row=fila, start_column=1, end_row=fila, end_column=cols)
    cell = ws.cell(fila, 1, "Sin datos para los filtros seleccionados")
    cell.font = _font(italic=True, color=SLATE)
    cell.alignment = _align(h="center")
    ws.row_dimensions[fila].height = 22


def _zebra(ws, data_start: int, data_end: int, cols: int):
    for row in range(data_start, data_end + 1):
        bg = LIGHT_BG if row % 2 == 0 else WHITE
        for c in range(1, cols + 1):
            cell = ws.cell(row=row, column=c)
            cell.fill = _fill(bg)
            cell.border = _border_bottom()
            cell.alignment = _align(v="center")


# ─────────────── hoja: DASHBOARD ───────────────
def _hoja_dashboard(wb, db, desde: str, hasta: str, q: str, categoria: str):
    ws = wb.create_sheet("📊 Dashboard")
    ws.sheet_view.showGridLines = False

    # Título principal
    ws.merge_cells("A1:H1")
    ws["A1"] = "REPORTE EJECUTIVO DE INVENTARIO"
    ws["A1"].fill = _fill(NAVY)
    ws["A1"].font = _font(bold=True, size=16, color=WHITE)
    ws["A1"].alignment = _align(h="center")
    ws.row_dimensions[1].height = 38

    ws.merge_cells("A2:H2")
    ws["A2"] = f"Período: {desde}  →  {hasta}   |   Generado el {date.today():%d/%m/%Y}"
    ws["A2"].fill = _fill(INDIGO)
    ws["A2"].font = _font(size=10, color=WHITE, italic=True)
    ws["A2"].alignment = _align(h="center")
    ws.row_dimensions[2].height = 22

    # ── KPIs principales ──
    params, where = [], []
    if desde: where.append("date(k.fecha,'localtime') >= ?"); params.append(desde)
    if hasta: where.append("date(k.fecha,'localtime') <= ?"); params.append(hasta)
    if q.strip():
        like = f"%{q.strip()}%"
        where.append("(k.sku_producto LIKE ? OR p.nombre LIKE ? OR k.referencia LIKE ?)")
        params += [like, like, like]
    if categoria.strip():
        where.append("p.categoria = ?"); params.append(categoria.strip())
    cond = (" WHERE " + " AND ".join(where)) if where else ""

    totales = db.execute(f"""
        SELECT
            SUM(CASE WHEN k.tipo_movimiento='ENTRADA' THEN k.cantidad ELSE 0 END) AS total_entradas,
            SUM(CASE WHEN k.tipo_movimiento='SALIDA'  THEN k.cantidad ELSE 0 END) AS total_salidas,
            SUM(CASE WHEN k.tipo_movimiento='AJUSTE'  THEN k.cantidad ELSE 0 END) AS total_ajustes,
            COUNT(DISTINCT k.sku_producto) AS productos_activos,
            SUM(CASE WHEN k.tipo_movimiento='SALIDA' THEN k.cantidad * COALESCE(p.precio_venta,0) ELSE 0 END) AS ingresos_venta,
            SUM(CASE WHEN k.tipo_movimiento='SALIDA' THEN k.cantidad * COALESCE(p.precio_costo,0) ELSE 0 END) AS costo_ventas
        FROM kardex k
        LEFT JOIN productos p ON p.sku = k.sku_producto
        {cond}
    """, params).fetchone()

    inv = db.execute("""
        SELECT
            COUNT(DISTINCT p.sku) AS total_productos,
            COALESCE(SUM(v.stock_actual), 0) AS total_unidades,
            COALESCE(SUM(v.stock_actual * p.precio_costo), 0) AS valor_costo,
            COALESCE(SUM(v.stock_actual * p.precio_venta), 0) AS valor_venta,
            COUNT(CASE WHEN v.stock_actual <= p.stock_minimo THEN 1 END) AS alertas_stock
        FROM productos p
        LEFT JOIN variantes v ON v.sku_producto = p.sku
    """).fetchone()

    ingresos = totales["ingresos_venta"] or 0
    costo_v  = totales["costo_ventas"]  or 0
    ganancia = ingresos - costo_v
    margen   = (ganancia / ingresos * 100) if ingresos > 0 else 0

    kpis = [
        ("📦 Unidades en Stock",     f"{inv['total_unidades']:,}",        INDIGO,   "Total unidades disponibles"),
        ("💰 Ingresos por Ventas",   f"S/ {ingresos:,.2f}",               EMERALD,  f"Ventas del período"),
        ("📈 Ganancia Bruta",        f"S/ {ganancia:,.2f}",               VIOLET,   f"Margen: {margen:.1f}%"),
        ("⚠️  Alertas de Stock Bajo", f"{inv['alertas_stock']:,}",         ROSE,     "Variantes bajo mínimo"),
        ("🔄 Entradas Período",      f"{totales['total_entradas'] or 0:,}", "1D4ED8", "Unidades ingresadas"),
        ("🔻 Salidas Período",       f"{totales['total_salidas'] or 0:,}", "0F766E", "Unidades despachadas"),
        ("🏷️  Valor Costo Stock",    f"S/ {inv['valor_costo']:,.2f}",      SLATE,    "Inversión en inventario"),
        ("💎 Valor Venta Stock",     f"S/ {inv['valor_venta']:,.2f}",      YELLOW,   "Precio de venta potencial"),
    ]

    ws.row_dimensions[3].height = 14  # espacio
    row = 4
    ws.merge_cells(f"A{row}:H{row}")
    ws[f"A{row}"] = "INDICADORES CLAVE (KPIs)"
    ws[f"A{row}"].font = _font(bold=True, size=11, color=NAVY)
    ws[f"A{row}"].alignment = _align()
    row += 1

    for i, (titulo, valor, color, nota) in enumerate(kpis):
        col = (i % 4) * 2 + 1  # 4 columnas de 2 celdas c/u
        if i % 4 == 0 and i > 0:
            row += 4
        r = row
        ws.merge_cells(start_row=r, start_column=col, end_row=r, end_column=col+1)
        ws.cell(r, col, titulo).fill = _fill(color)
        ws.cell(r, col).font = _font(bold=True, size=9, color=WHITE)
        ws.cell(r, col).alignment = _align(h="center")
        ws.row_dimensions[r].height = 20

        ws.merge_cells(start_row=r+1, start_column=col, end_row=r+1, end_column=col+1)
        ws.cell(r+1, col, valor).fill = _fill(LIGHT_BG)
        ws.cell(r+1, col).font = _font(bold=True, size=16, color=color)
        ws.cell(r+1, col).alignment = _align(h="center")
        ws.row_dimensions[r+1].height = 28

        ws.merge_cells(start_row=r+2, start_column=col, end_row=r+2, end_column=col+1)
        ws.cell(r+2, col, nota).fill = _fill(WHITE)
        ws.cell(r+2, col).font = _font(size=8, color=SLATE, italic=True)
        ws.cell(r+2, col).alignment = _align(h="center")
        ws.row_dimensions[r+2].height = 14

    row += 7

    # ── Top 10 productos por movimiento ──
    ws.row_dimensions[row].height = 14
    row += 1
    ws.merge_cells(f"A{row}:H{row}")
    ws[f"A{row}"] = "TOP 10 PRODUCTOS POR SALIDAS EN EL PERÍODO"
    ws[f"A{row}"].font = _font(bold=True, size=11, color=NAVY)
    ws[f"A{row}"].alignment = _align()
    row += 1

    top = db.execute(f"""
        SELECT k.sku_producto AS SKU, p.nombre AS Producto, p.categoria AS Categoría,
               SUM(CASE WHEN k.tipo_movimiento='SALIDA' THEN k.cantidad ELSE 0 END) AS Salidas,
               SUM(CASE WHEN k.tipo_movimiento='ENTRADA' THEN k.cantidad ELSE 0 END) AS Entradas,
               SUM(CASE WHEN k.tipo_movimiento='SALIDA' THEN k.cantidad * COALESCE(p.precio_venta,0) ELSE 0 END) AS "Ingresos S/",
               SUM(CASE WHEN k.tipo_movimiento='SALIDA' THEN k.cantidad * COALESCE(p.precio_costo,0) ELSE 0 END) AS "Costo S/",
               SUM(CASE WHEN k.tipo_movimiento='SALIDA' THEN
                   k.cantidad * (COALESCE(p.precio_venta,0) - COALESCE(p.precio_costo,0))
               ELSE 0 END) AS "Ganancia S/"
        FROM kardex k
        LEFT JOIN productos p ON p.sku = k.sku_producto
        {cond}
        GROUP BY k.sku_producto
        ORDER BY Salidas DESC
        LIMIT 10
    """, params).fetchall()

    headers = ["SKU", "Producto", "Categoría", "Salidas", "Entradas", "Ingresos S/", "Costo S/", "Ganancia S/"]
    _style_header_row(ws, row, len(headers), NAVY, WHITE)
    for c, h in enumerate(headers, 1):
        ws.cell(row, c, h)
    row += 1

    if not top:
        _sin_datos(ws, row, len(headers))

    for i, r_db in enumerate(top):
        bg = LIGHT_BG if i % 2 == 0 else WHITE
        vals = [r_db[0], r_db[1], r_db[2], r_db[3], r_db[4],
                round(r_db[5] or 0, 2), round(r_db[6] or 0, 2), round(r_db[7] or 0, 2)]
        for c, v in enumerate(vals, 1):
            cell = ws.cell(row, c, v)
            cell.fill = _fill(bg)
            cell.border = _border_bottom()
            cell.alignment = _align(v="center", h="right" if c >= 4 else "left")
            if c == 8:  # ganancia
                v_num = r_db[7] or 0
                cell.font = _font(bold=True, color=EMERALD if v_num >= 0 else ROSE)
        row += 1

    # Anchos de columna
    widths = [10, 28, 16, 10, 10, 14, 14, 14]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w


# ─────────────── hoja: KARDEX ───────────────
def _hoja_kardex(wb, db, desde: str, hasta: str, q: str, categoria: str):
    ws = wb.create_sheet("📋 Kardex")
    ws.sheet_view.showGridLines = False

    params, where = [], []
    if desde: where.append("date(k.fecha,'localtime') >= ?"); params.append(desde)
    if hasta: where.append("date(k.fecha,'localtime') <= ?"); params.append(hasta)
    if q.strip():
        like = f"%{q.strip()}%"
        where.append("(k.sku_producto LIKE ? OR p.nombre LIKE ? OR k.referencia LIKE ?)")
        params += [like, like, like]
    if categoria.strip():
        where.append("p.categoria = ?"); params.append(categoria.strip())
    cond = (" WHERE " + " AND ".join(where)) if where else ""

    rows = db.execute(f"""
        SELECT datetime(k.fecha,'localtime') AS Fecha,
               k.sku_producto AS SKU, p.nombre AS Producto, p.categoria AS Categoría,
               v.talla AS Talla, v.color AS Color,
               k.tipo_movimiento AS Tipo, k.cantidad AS Cantidad,
               k.stock_anterior AS "Stock Anterior", k.stock_resultante AS "Stock Resultante",
               COALESCE(p.precio_costo, 0) AS "Costo Unit.",
               COALESCE(p.precio_venta, 0) AS "Venta Unit.",
               CASE k.tipo_movimiento
                   WHEN 'SALIDA' THEN ROUND(k.cantidad * COALESCE(p.precio_venta,0), 2)
                   ELSE 0
               END AS "Ingreso S/",
               CASE k.tipo_movimiento
                   WHEN 'SALIDA' THEN ROUND(k.cantidad * (COALESCE(p.precio_venta,0)-COALESCE(p.precio_costo,0)), 2)
                   ELSE 0
               END AS "Ganancia S/",
               k.referencia AS Referencia, k.usuario AS Usuario
        FROM kardex k
        LEFT JOIN productos p ON p.sku = k.sku_producto
        LEFT JOIN variantes v ON v.id = k.id_variante
        {cond}
        ORDER BY k.fecha DESC, k.id DESC
    """, params).fetchall()

    # Título
    headers = list(rows[0].keys()) if rows else [
        "Fecha","SKU","Producto","Categoría","Talla","Color","Tipo","Cantidad",
        "Stock Anterior","Stock Resultante","Costo Unit.","Venta Unit.","Ingreso S/","Ganancia S/","Referencia","Usuario"
    ]

    ws.merge_cells(f"A1:{get_column_letter(len(headers))}1")
    ws["A1"] = "KARDEX DE MOVIMIENTOS"
    ws["A1"].fill = _fill(NAVY)
    ws["A1"].font = _font(bold=True, size=14, color=WHITE)
    ws["A1"].alignment = _align(h="center")
    ws.row_dimensions[1].height = 32

    ws.merge_cells(f"A2:{get_column_letter(len(headers))}2")
    ws["A2"] = f"Período {desde} → {hasta}  |  {len(rows)} movimientos"
    ws["A2"].fill = _fill(INDIGO)
    ws["A2"].font = _font(size=9, color=WHITE, italic=True)
    ws["A2"].alignment = _align(h="center")
    ws.row_dimensions[2].height = 18

    ws.freeze_panes = "A4"
    _style_header_row(ws, 3, len(headers))
    for c, h in enumerate(headers, 1):
        ws.cell(3, c, h)

    if not rows:
        _sin_datos(ws, 4, len(headers))

    TIPO_COLOR = {"ENTRADA": EMERALD, "SALIDA": ROSE, "AJUSTE": YELLOW}
    for i, row in enumerate(rows, 4):
        bg = LIGHT_BG if i % 2 == 0 else WHITE
        vals = list(row)
        tipo = vals[6]
        for c, v in enumerate(vals, 1):
            cell = ws.cell(i, c, v)
            cell.fill = _fill(bg)
            cell.border = _border_bottom()
            if c == 7:  # Tipo
                cell.font = _font(bold=True, color=TIPO_COLOR.get(tipo, SLATE))
            elif c in (13, 14):  # Ingreso / Ganancia
                v_num = v or 0
                cell.font = _font(color=EMERALD if v_num > 0 else SLATE)
            cell.alignment = _align(v="center", h="right" if c >= 8 else "left")

    _autofit(ws)


# ─────────────── hoja: RESUMEN ───────────────
def _hoja_resumen(wb, db, desde: str, hasta: str, q: str, categoria: str):
    ws = wb.create_sheet("📦 Resumen")
    ws.sheet_view.showGridLines = False

    params, where = [], []
    if desde: where.append("date(k.fecha,'localtime') >= ?"); params.append(desde)
    if hasta: where.append("date(k.fecha,'localtime') <= ?"); params.append(hasta)
    if q.strip():
        like = f"%{q.strip()}%"
        where.append("(k.sku_producto LIKE ? OR p.nombre LIKE ? OR k.referencia LIKE ?)")
        params += [like, like, like]
    if categoria.strip():
        where.append("p.categoria = ?"); params.append(categoria.strip())
    cond = (" WHERE " + " AND ".join(where)) if where else ""

    rows = db.execute(f"""
        SELECT k.sku_producto AS SKU, p.nombre AS Producto, p.categoria AS Categoría,
               COALESCE(p.precio_costo,0) AS "Costo Unit.",
               COALESCE(p.precio_venta,0) AS "Venta Unit.",
               SUM(CASE WHEN k.tipo_movimiento='ENTRADA' THEN k.cantidad ELSE 0 END) AS "Total Entradas",
               SUM(CASE WHEN k.tipo_movimiento='SALIDA'  THEN k.cantidad ELSE 0 END) AS "Total Salidas",
               SUM(CASE WHEN k.tipo_movimiento='AJUSTE'  THEN k.cantidad ELSE 0 END) AS "Ajustes",
               ROUND(SUM(CASE WHEN k.tipo_movimiento='SALIDA' THEN k.cantidad * COALESCE(p.precio_venta,0) ELSE 0 END),2) AS "Ingresos S/",
               ROUND(SUM(CASE WHEN k.tipo_movimiento='SALIDA' THEN k.cantidad * COALESCE(p.precio_costo,0) ELSE 0 END),2) AS "Costo Ventas S/",
               ROUND(SUM(CASE WHEN k.tipo_movimiento='SALIDA' THEN
                   k.cantidad*(COALESCE(p.precio_venta,0)-COALESCE(p.precio_costo,0)) ELSE 0 END),2) AS "Ganancia S/",
               ROUND(
                   CASE WHEN SUM(CASE WHEN k.tipo_movimiento='SALIDA' THEN k.cantidad*COALESCE(p.precio_venta,0) ELSE 0 END) > 0
                   THEN 100.0 * SUM(CASE WHEN k.tipo_movimiento='SALIDA' THEN
                       k.cantidad*(COALESCE(p.precio_venta,0)-COALESCE(p.precio_costo,0)) ELSE 0 END)
                       / SUM(CASE WHEN k.tipo_movimiento='SALIDA' THEN k.cantidad*COALESCE(p.precio_venta,0) ELSE 0 END)
                   ELSE 0 END, 2) AS "Margen %"
        FROM kardex k
        LEFT JOIN productos p ON p.sku = k.sku_producto
        {cond}
        GROUP BY k.sku_producto, p.nombre, p.categoria, p.precio_costo, p.precio_venta
        ORDER BY "Ingresos S/" DESC
    """, params).fetchall()

    headers = ["SKU","Producto","Categoría","Costo Unit.","Venta Unit.",
               "Total Entradas","Total Salidas","Ajustes","Ingresos S/","Costo Ventas S/","Ganancia S/","Margen %"]

    ws.merge_cells(f"A1:{get_column_letter(len(headers))}1")
    ws["A1"] = "RESUMEN POR PRODUCTO"
    ws["A1"].fill = _fill(NAVY)
    ws["A1"].font = _font(bold=True, size=14, color=WHITE)
    ws["A1"].alignment = _align(h="center")
    ws.row_dimensions[1].height = 32

    ws.freeze_panes = "A3"
    _style_header_row(ws, 2, len(headers))
    for c, h in enumerate(headers, 1):
        ws.cell(2, c, h)

    if not rows:
        _sin_datos(ws, 3, len(headers))

    for i, row in enumerate(rows, 3):
        bg = LIGHT_BG if i % 2 == 0 else WHITE
        vals = list(row)
        for c, v in enumerate(vals, 1):
            cell = ws.cell(i, c, v)
            cell.fill = _fill(bg)
            cell.border = _border_bottom()
            cell.alignment = _align(v="center", h="right" if c >= 4 else "left")
            if c == 11:  # Ganancia
                cell.font = _font(bold=True, color=EMERALD if (v or 0) >= 0 else ROSE)
            elif c == 12:  # Margen %
                m = v or 0
                cell.font = _font(bold=True, color=EMERALD if m >= 30 else (YELLOW if m >= 10 else ROSE))
                cell.number_format = '0.00"%"'

    # Fila de totales — valores calculados en Python, sin fórmulas
    total_row = max(len(rows), 1) + 3
    # col indices (1-based): 6=Entradas,7=Salidas,8=Ajustes,9=Ingresos,10=CostoVentas,11=Ganancia
    sumas = {6: 0, 7: 0, 8: 0, 9: 0.0, 10: 0.0, 11: 0.0}
    for row in rows:
        vals = list(row)
        sumas[6]  += vals[5] or 0   # Total Entradas
        sumas[7]  += vals[6] or 0   # Total Salidas
        sumas[8]  += vals[7] or 0   # Ajustes
        sumas[9]  += vals[8] or 0   # Ingresos S/
        sumas[10] += vals[9] or 0   # Costo Ventas S/
        sumas[11] += vals[10] or 0  # Ganancia S/

    for c in range(1, len(headers) + 1):
        cell = ws.cell(total_row, c)
        cell.fill = _fill(NAVY)
        cell.font = _font(bold=True, color=WHITE)
        cell.border = _full_border()
        cell.alignment = _align(h="right" if c >= 4 else "left", v="center")
    ws.cell(total_row, 1, "TOTALES")
    for col_num, valor in sumas.items():
        ws.cell(total_row, col_num, round(valor, 2))

    _autofit(ws)


# ─────────────── hoja: STOCK ───────────────
def _hoja_stock(wb, db, q: str, categoria: str):
    ws = wb.create_sheet("🏷️ Stock Actual")
    ws.sheet_view.showGridLines = False

    params_inv, where_inv = [], []
    if q.strip():
        like = f"%{q.strip()}%"
        where_inv.append("(p.sku LIKE ? OR p.nombre LIKE ?)")
        params_inv += [like, like]
    if categoria.strip():
        where_inv.append("p.categoria = ?"); params_inv.append(categoria.strip())
    cond_inv = (" WHERE " + " AND ".join(where_inv)) if where_inv else ""

    rows = db.execute(f"""
        SELECT p.sku AS SKU, p.nombre AS Producto, p.categoria AS Categoría,
               v.talla AS Talla, v.color AS Color,
               COALESCE(v.stock_actual,0) AS "Stock Actual",
               p.stock_minimo AS "Stock Mín.",
               COALESCE(v.stock_actual,0) - p.stock_minimo AS "Diferencia",
               CASE WHEN COALESCE(v.stock_actual,0) <= 0 THEN 'SIN STOCK'
                    WHEN COALESCE(v.stock_actual,0) <= p.stock_minimo THEN 'BAJO'
                    WHEN COALESCE(v.stock_actual,0) <= p.stock_minimo * 2 THEN 'MODERADO'
                    ELSE 'OK'
               END AS Estado,
               COALESCE(p.precio_costo,0) AS "Costo Unit.",
               COALESCE(p.precio_venta,0) AS "Venta Unit.",
               ROUND(COALESCE(v.stock_actual,0) * COALESCE(p.precio_costo,0),2) AS "Valor Costo",
               ROUND(COALESCE(v.stock_actual,0) * COALESCE(p.precio_venta,0),2) AS "Valor Venta"
        FROM productos p
        LEFT JOIN variantes v ON v.sku_producto = p.sku
        {cond_inv}
        ORDER BY Estado, p.nombre COLLATE NOCASE
    """, params_inv).fetchall()

    headers = ["SKU","Producto","Categoría","Talla","Color","Stock Actual","Stock Mín.","Diferencia","Estado","Costo Unit.","Venta Unit.","Valor Costo","Valor Venta"]

    ws.merge_cells(f"A1:{get_column_letter(len(headers))}1")
    ws["A1"] = "STOCK ACTUAL DE INVENTARIO"
    ws["A1"].fill = _fill(NAVY)
    ws["A1"].font = _font(bold=True, size=14, color=WHITE)
    ws["A1"].alignment = _align(h="center")
    ws.row_dimensions[1].height = 32

    ws.freeze_panes = "A3"
    _style_header_row(ws, 2, len(headers))
    for c, h in enumerate(headers, 1):
        ws.cell(2, c, h)

    ESTADO_COLOR = {
        "SIN STOCK": ROSE,
        "BAJO": "F97316",
        "MODERADO": YELLOW,
        "OK": EMERALD,
    }

    if not rows:
        _sin_datos(ws, 3, len(headers))

    for i, row in enumerate(rows, 3):
        bg = LIGHT_BG if i % 2 == 0 else WHITE
        vals = list(row)
        estado = vals[8]
        for c, v in enumerate(vals, 1):
            cell = ws.cell(i, c, v)
            cell.fill = _fill(bg)
            cell.border = _border_bottom()
            cell.alignment = _align(v="center", h="right" if c >= 6 else "left")
            if c == 9:  # Estado
                cell.font = _font(bold=True, color=ESTADO_COLOR.get(estado, SLATE))
            elif c == 8:  # Diferencia
                cell.font = _font(color=EMERALD if (v or 0) > 0 else ROSE)

    _autofit(ws)


# ─────────────── hoja: GANANCIAS ───────────────
def _hoja_ganancias(wb, db, desde: str, hasta: str, q: str, categoria: str):
    ws = wb.create_sheet("💹 Ganancias")
    ws.sheet_view.showGridLines = False

    params, where = [], []
    where.append("k.tipo_movimiento = 'SALIDA'")
    if desde: where.append("date(k.fecha,'localtime') >= ?"); params.append(desde)
    if hasta: where.append("date(k.fecha,'localtime') <= ?"); params.append(hasta)
    if q.strip():
        like = f"%{q.strip()}%"
        where.append("(k.sku_producto LIKE ? OR p.nombre LIKE ?)")
        params += [like, like]
    if categoria.strip():
        where.append("p.categoria = ?"); params.append(categoria.strip())
    cond = " WHERE " + " AND ".join(where)

    rows = db.execute(f"""
        SELECT p.categoria AS Categoría,
               k.sku_producto AS SKU, p.nombre AS Producto,
               SUM(k.cantidad) AS "Unid. Vendidas",
               COALESCE(p.precio_costo,0) AS "Costo Unit.",
               COALESCE(p.precio_venta,0) AS "Precio Venta",
               ROUND(COALESCE(p.precio_venta,0) - COALESCE(p.precio_costo,0),2) AS "Margen Unit.",
               ROUND(
                   CASE WHEN COALESCE(p.precio_venta,0) > 0
                   THEN 100.0*(COALESCE(p.precio_venta,0)-COALESCE(p.precio_costo,0))/COALESCE(p.precio_venta,0)
                   ELSE 0 END, 2) AS "Margen %",
               ROUND(SUM(k.cantidad * COALESCE(p.precio_venta,0)),2) AS "Ingresos S/",
               ROUND(SUM(k.cantidad * COALESCE(p.precio_costo,0)),2) AS "Costo Total S/",
               ROUND(SUM(k.cantidad * (COALESCE(p.precio_venta,0) - COALESCE(p.precio_costo,0))),2) AS "Ganancia S/"
        FROM kardex k
        LEFT JOIN productos p ON p.sku = k.sku_producto
        {cond}
        GROUP BY p.categoria, k.sku_producto, p.nombre, p.precio_costo, p.precio_venta
        HAVING SUM(k.cantidad) > 0
        ORDER BY "Ganancia S/" DESC
    """, params).fetchall()

    headers = ["Categoría","SKU","Producto","Unid. Vendidas","Costo Unit.","Precio Venta","Margen Unit.","Margen %","Ingresos S/","Costo Total S/","Ganancia S/"]

    ws.merge_cells(f"A1:{get_column_letter(len(headers))}1")
    ws["A1"] = "ANÁLISIS DE RENTABILIDAD Y GANANCIAS"
    ws["A1"].fill = _fill(NAVY)
    ws["A1"].font = _font(bold=True, size=14, color=WHITE)
    ws["A1"].alignment = _align(h="center")
    ws.row_dimensions[1].height = 32

    ws.merge_cells(f"A2:{get_column_letter(len(headers))}2")
    ws["A2"] = f"Período {desde} → {hasta}  |  Solo movimientos de SALIDA (ventas)"
    ws["A2"].fill = _fill(VIOLET)
    ws["A2"].font = _font(size=9, color=WHITE, italic=True)
    ws["A2"].alignment = _align(h="center")
    ws.row_dimensions[2].height = 18

    ws.freeze_panes = "A4"
    _style_header_row(ws, 3, len(headers), VIOLET, WHITE)
    for c, h in enumerate(headers, 1):
        ws.cell(3, c, h)

    if not rows:
        _sin_datos(ws, 4, len(headers))

    current_cat = None
    fila = 4
    n_cols = len(headers)
    for idx, row in enumerate(rows):
        vals = list(row)
        cat = vals[0]

        if cat != current_cat:
            for c in range(1, n_cols + 1):
                ws.cell(fila, c).fill = _fill("E0E7FF")
                ws.cell(fila, c).border = _full_border()
            ws.merge_cells(start_row=fila, start_column=1, end_row=fila, end_column=n_cols)
            ws.cell(fila, 1, f"  ▸  {cat or 'Sin categoría'}")
            ws.cell(fila, 1).font = _font(bold=True, size=10, color=INDIGO)
            ws.row_dimensions[fila].height = 20
            current_cat = cat
            fila += 1

        bg = LIGHT_BG if idx % 2 == 0 else WHITE
        for c, v in enumerate(vals, 1):
            cell = ws.cell(fila, c, v)
            cell.fill = _fill(bg)
            cell.border = _border_bottom()
            cell.alignment = _align(v="center", h="right" if c >= 4 else "left")
            if c == 8:  # Margen %
                m = v or 0
                cell.font = _font(bold=True, color=EMERALD if m >= 30 else (YELLOW if m >= 10 else ROSE))
            elif c == 11:  # Ganancia S/
                cell.font = _font(bold=True, color=EMERALD if (v or 0) >= 0 else ROSE)
        fila += 1

    _autofit(ws)


# ─────────────── endpoint principal ───────────────
@router.get("/exportar/excel-pro")
def exportar_excel_pro(
    desde: str = "",
    hasta: str = "",
    q: str = "",
    categoria: str = "",
    hojas: str = "dashboard,kardex,resumen,stock,ganancias",
    db=Depends(get_db),
):
    hojas_set = set(hojas.split(","))

    from openpyxl import Workbook
    wb = Workbook()
    del wb["Sheet"]

    if "dashboard" in hojas_set:
        _hoja_dashboard(wb, db, desde, hasta, q, categoria)
    if "kardex" in hojas_set:
        _hoja_kardex(wb, db, desde, hasta, q, categoria)
    if "resumen" in hojas_set:
        _hoja_resumen(wb, db, desde, hasta, q, categoria)
    if "stock" in hojas_set:
        _hoja_stock(wb, db, q, categoria)
    if "ganancias" in hojas_set:
        _hoja_ganancias(wb, db, desde, hasta, q, categoria)

    buf = BytesIO()
    wb.save(buf)
    buf.seek(0)

    nombre = f"reporte_pro_{desde or 'inicio'}_a_{hasta or 'fin'}.xlsx"
    return StreamingResponse(
        buf,
        media_type=XLSX,
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )