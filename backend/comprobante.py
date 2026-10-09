"""Comprobante: HTML para el correo y PDF adjunto (mismo diseño que la hoja imprimible)."""
import html
import io
from datetime import datetime, timedelta, timezone

from reportlab.lib.pagesizes import A4
from reportlab.lib.utils import simpleSplit
from reportlab.pdfgen import canvas

IGV_TASA = 0.18
LIMA = timezone(timedelta(hours=-5))

EMPRESA = {
    "nombre": "INVERSIONES NATHAN S.R.L",
    "ruc": "20610124616",
    "direccion": "CALLE SANTA CARMELA 337 URB. PALAO ET. 2",
    "telefonos": "950 549 676",
    "giro": "VENTA DE PEGAMENTOS, PORCELANATOS, PISOS, MAYÓLICAS NACIONALES E IMPORTADOS, SANITARIOS Y GRIFERÍA EN GENERAL",
    "terminos": [
        "No se aceptan cambios ni devoluciones después de emitida la mercadería.",
        "Verifique la mercadería y cantidad al momento de la entrega.",
        "¡Gracias por su preferencia!",
    ],
}

_UNI = ["", "uno", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce",
        "trece", "catorce", "quince", "dieciséis", "diecisiete", "dieciocho", "diecinueve", "veinte", "veintiuno",
        "veintidós", "veintitrés", "veinticuatro", "veinticinco", "veintiséis", "veintisiete", "veintiocho",
        "veintinueve"]
_DEC = ["", "", "", "treinta", "cuarenta", "cincuenta", "sesenta", "setenta", "ochenta", "noventa"]
_CEN = ["", "ciento", "doscientos", "trescientos", "cuatrocientos", "quinientos", "seiscientos", "setecientos",
        "ochocientos", "novecientos"]


def _menor_mil(n: int) -> str:
    if n == 0:
        return ""
    if n == 100:
        return "cien"
    c, r = divmod(n, 100)
    p = []
    if c:
        p.append(_CEN[c])
    if r:
        if r < 30:
            p.append(_UNI[r])
        else:
            d, u = divmod(r, 10)
            p.append(f"{_DEC[d]} y {_UNI[u]}" if u else _DEC[d])
    return " ".join(p)


def _entero_letras(n: int) -> str:
    if n == 0:
        return "cero"
    mill, resto = divmod(n, 1_000_000)
    miles, cientos = divmod(resto, 1000)
    p = []
    if mill:
        p.append("un millón" if mill == 1 else f"{_entero_letras(mill)} millones")
    if miles:
        p.append("mil" if miles == 1 else f"{_menor_mil(miles).removesuffix('uno')}{'un' if _menor_mil(miles).endswith('uno') else ''} mil")
    if cientos:
        p.append(_menor_mil(cientos))
    return " ".join(p)


def total_en_letras(total: float) -> str:
    entero = int(total + 1e-9)
    cent = round((total - entero) * 100)
    return f"{_entero_letras(entero).upper()} CON {cent:02d}/100 SOLES"


def _num(n) -> str:
    return f"{(n or 0):,.2f}"


def _um(u) -> str:
    return "UND" if not u or u == "NIU" else u


def _fecha(f) -> str:
    try:
        d = datetime.fromisoformat(str(f).replace(" ", "T").replace("Z", "+00:00"))
        if d.tzinfo is None:
            d = d.replace(tzinfo=timezone.utc)
        return d.astimezone(LIMA).strftime("%d/%m/%Y")
    except Exception:
        return str(f)


def _datos(v: dict):
    es_factura = v["tipo_comprobante"] == "factura"
    titulo = "FACTURA ELECTRÓNICA" if es_factura else "BOLETA DE VENTA ELECTRÓNICA"
    total = v["total"] or 0
    grav = total / (1 + IGV_TASA)
    totales = [
        ("OP. GRAVADAS", grav), ("OP. INAFECTAS", 0), ("OP. EXONERADAS", 0), ("OP. GRATUITAS", 0),
        ("OTROS CARGOS", 0), ("OTROS TRIBUTOS", 0), ("DESCUENTO", v.get("descuento") or 0),
        ("IGV 18%", total - grav),
    ]
    return titulo, total, totales


# ───────────────────────── HTML (correo) ─────────────────────────
def html_comprobante(v: dict, etiqueta: str) -> str:
    titulo, total, totales = _datos(v)
    e = html.escape
    doc = v.get("cliente_documento") or ""
    metodo = e((v.get("metodo_pago") or "efectivo").upper())
    b = "border:1px solid #000"
    th = f"{b};padding:6px 4px;font-size:10px;text-align:center"
    td = "border-left:1px solid #000;padding:4px;font-size:11px"

    filas = ""
    for idx, i in enumerate(v["items"]):
        vu = i["precio_venta"] / (1 + IGV_TASA)
        vt = i["cantidad"] * i["precio_venta"] / (1 + IGV_TASA)
        filas += (
            f"<tr style='vertical-align:top'>"
            f"<td style='{td}'>{e(str(i.get('codigo') or str(idx + 1).zfill(3)))}</td>"
            f"<td style='{td};text-align:right'>{_num(i['cantidad'])}</td>"
            f"<td style='{td}'>{e(i['descripcion'] or '')}</td>"
            f"<td style='{td};text-align:center'>{_um(i.get('unidad_medida'))}</td>"
            f"<td style='{td};text-align:right'>{_num(vu)}</td>"
            f"<td style='{td};text-align:right'>{_num(i['precio_venta'])}</td>"
            f"<td style='{td};text-align:right;border-right:0'>{_num(vt)}</td></tr>"
        )
    filas += "".join(f"<tr><td style='{td};height:6px'></td>" + "".join(f"<td style='{td}'></td>" for _ in range(5)) + "<td style='border-left:1px solid #000'></td></tr>" for _ in range(1))

    filas_tot = "".join(
        f"<tr><td style='text-align:right;padding:3px 6px;font-size:11px;border-bottom:1px solid #000'>{l}</td>"
        f"<td style='border-left:1px solid #000;border-bottom:1px solid #000;padding:3px 4px;font-size:11px'>S/</td>"
        f"<td style='text-align:right;border-bottom:1px solid #000;padding:3px 6px;font-size:11px'>{_num(x)}</td></tr>"
        for l, x in totales
    )
    terminos = "".join(f"<p style='margin:1px 0'>{e(t)}</p>" for t in EMPRESA["terminos"])
    obs = f"<p style='margin:1px 0'><b>Observaciones:</b> {e(v['observaciones'])}</p>" if v.get("observaciones") else ""
    pago = (
        f"<p style='margin:1px 0'>Monto Entregado: S/ {_num(v['monto_pagado'])} · Vuelto: S/ {_num(v.get('vuelto') or 0)}</p>"
        if v.get("monto_pagado") is not None else ""
    )

    return f"""<!DOCTYPE html><html><body style="margin:0;padding:16px;background:#f1f5f9">
<div style="max-width:720px;margin:auto;background:#fff;padding:24px;font-family:Arial,Helvetica,sans-serif;color:#000">
  <table width="100%" cellspacing="0" cellpadding="0"><tr>
    <td style="vertical-align:top;padding-right:16px">
      <div style="font-size:18px;font-weight:900">{EMPRESA['nombre']}</div>
      <div style="font-size:11px;margin-top:4px">{EMPRESA['direccion']}</div>
      <div style="font-size:11px"><b>Telf:</b> {EMPRESA['telefonos']}</div>
      <div style="font-size:10px;margin-top:6px">{EMPRESA['giro']}</div>
    </td>
    <td width="240" style="{b};text-align:center;padding:14px 8px;vertical-align:middle">
      <div style="font-size:15px;font-weight:bold">R.U.C. N° {EMPRESA['ruc']}</div>
      <div style="font-size:15px;font-weight:bold;margin:10px 0">{titulo}</div>
      <div style="font-size:16px;font-weight:bold;color:#dc2626">N° {etiqueta}</div>
    </td>
  </tr></table>

  <table width="100%" cellspacing="0" cellpadding="6" style="{b};margin-top:12px;font-size:11px"><tr>
    <td style="vertical-align:top;width:58%">
      <div><b>SR. (ES)</b>: {e((v.get('cliente_nombre') or 'Cliente General').upper())}</div>
      {f"<div><b>{'R.U.C.' if len(doc) == 11 else 'D.N.I.'}</b>: {e(doc)}</div>" if doc else ""}
      {f"<div><b>DIRECCIÓN</b>: {e(v['cliente_direccion'].upper())}</div>" if v.get('cliente_direccion') else ""}
    </td>
    <td style="vertical-align:top">
      <div><b>FECHA EMISIÓN</b>: {_fecha(v['fecha'])}</div>
      <div><b>CONDICIÓN DE PAGO</b>: CONTADO {metodo}</div>
      <div><b>MONEDA</b>: SOLES</div>
    </td>
  </tr></table>

  <table width="100%" cellspacing="0" cellpadding="0" style="{b};border-collapse:collapse;margin-top:12px">
    <thead><tr style="border-bottom:1px solid #000">
      <th style="{th};border:0">CÓDIGO</th><th style="{th};border:0;border-left:1px solid #000">CANTIDAD</th>
      <th style="{th};border:0;border-left:1px solid #000">DESCRIPCIÓN</th><th style="{th};border:0;border-left:1px solid #000">UM</th>
      <th style="{th};border:0;border-left:1px solid #000">VALOR UNITARIO</th><th style="{th};border:0;border-left:1px solid #000">PRECIO UNITARIO</th>
      <th style="{th};border:0;border-left:1px solid #000">VALOR VENTA TOTAL</th>
    </tr></thead>
    <tbody>{filas}</tbody>
  </table>

  <table width="100%" cellspacing="0" cellpadding="0" style="border:1px solid #000;border-top:0;border-collapse:collapse">
    <tr>
      <td style="vertical-align:bottom;padding:6px;font-size:11px"><b>SON:</b> {total_en_letras(total)}</td>
      <td width="270" style="border-left:1px solid #000;padding:0;vertical-align:top">
        <table width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse">
          {filas_tot}
          <tr><td style="text-align:right;padding:3px 6px;font-size:12px;font-weight:bold">TOTAL</td>
          <td style="border-left:1px solid #000;padding:3px 4px;font-size:12px;font-weight:bold">S/</td>
          <td style="text-align:right;padding:3px 6px;font-size:12px;font-weight:bold">{_num(total)}</td></tr>
        </table>
      </td>
    </tr>
  </table>

  <div style="margin-top:10px;font-size:10px">
    {pago}{obs}
    <div style="padding-top:4px">{terminos}</div>
    <p style="margin:6px 0 0;font-size:9px">Documento no valido ante la SUNAT, esto es una representación impresa de la {titulo} generada en el sistema interno.</p>
  </div>
</div></body></html>"""


# ───────────────────────── PDF (adjunto) ─────────────────────────
def generar_pdf(v: dict, etiqueta: str) -> bytes:
    titulo, total, totales = _datos(v)
    buf = io.BytesIO()
    c = canvas.Canvas(buf, pagesize=A4)
    c.setTitle(etiqueta)
    W, H = A4
    M = 28
    TW = W - 2 * M
    TB = 215  # borde inferior de la tabla de ítems
    anchos = [52, 44, TW - 52 - 44 - 30 - 56 - 56 - 66, 30, 56, 56, 66]
    xs = [M]
    for a in anchos:
        xs.append(xs[-1] + a)
    heads = ["CÓDIGO", "CANTIDAD", "DESCRIPCIÓN", "UM", "VALOR UNITARIO", "PRECIO UNITARIO", "VALOR VENTA TOTAL"]
    doc = v.get("cliente_documento") or ""

    def txt(x, y, s, font="Helvetica", size=8, align="l"):
        c.setFont(font, size)
        {"l": c.drawString, "r": c.drawRightString, "c": c.drawCentredString}[align](x, y, s)

    def cabecera() -> float:
        c.setLineWidth(0.8)
        c.setFillColorRGB(0, 0, 0)
        y = H - M - 12
        txt(M, y, EMPRESA["nombre"], "Helvetica-Bold", 14)
        y -= 13
        txt(M, y, EMPRESA["direccion"], size=8)
        y -= 11
        txt(M, y, f"Telf: {EMPRESA['telefonos']}", size=8)
        y -= 11
        for ln in simpleSplit(EMPRESA["giro"], "Helvetica", 7, TW - 206):
            txt(M, y, ln, size=7)
            y -= 9
        bx, bh = W - M - 190, 84
        by = H - M - bh
        c.rect(bx, by, 190, bh)
        cx = bx + 95
        txt(cx, by + bh - 24, f"R.U.C. N° {EMPRESA['ruc']}", "Helvetica-Bold", 11, "c")
        txt(cx, by + bh - 44, titulo, "Helvetica-Bold", 10, "c")
        c.setFillColorRGB(0.86, 0.15, 0.15)
        txt(cx, by + bh - 66, f"N° {etiqueta}", "Helvetica-Bold", 12, "c")
        c.setFillColorRGB(0, 0, 0)

        top = by - 8
        c.rect(M, top - 54, TW, 54)
        nombre = (v.get("cliente_nombre") or "Cliente General").upper()
        izq = [("SR. (ES)", nombre)]
        if doc:
            izq.append(("R.U.C." if len(doc) == 11 else "D.N.I.", doc))
        if v.get("cliente_direccion"):
            izq.append(("DIRECCIÓN", v["cliente_direccion"].upper()))
        for k, (l, val) in enumerate(izq):
            yy = top - 14 - 13 * k
            txt(M + 6, yy, l, "Helvetica-Bold", 8)
            txt(M + 58, yy, ": " + simpleSplit(val, "Helvetica", 8, 260)[0], size=8)
        der = [("FECHA EMISIÓN", _fecha(v["fecha"])),
               ("CONDICIÓN DE PAGO", "CONTADO " + (v.get("metodo_pago") or "efectivo").upper()),
               ("MONEDA", "SOLES")]
        for k, (l, val) in enumerate(der):
            yy = top - 14 - 13 * k
            txt(M + 330, yy, l, "Helvetica-Bold", 8)
            txt(M + 420, yy, ": " + val, size=8)
        return top - 54 - 8

    def marco(tabla_top: float):
        c.rect(M, TB, TW, tabla_top - TB)
        c.line(M, tabla_top - 24, M + TW, tabla_top - 24)
        for x in xs[1:-1]:
            c.line(x, tabla_top, x, TB)
        for k, h in enumerate(heads):
            lines = simpleSplit(h, "Helvetica-Bold", 6.5, anchos[k] - 3)
            yy = tabla_top - 10 if len(lines) > 1 else tabla_top - 15
            for ln in lines:
                txt(xs[k] + anchos[k] / 2, yy, ln, "Helvetica-Bold", 6.5, "c")
                yy -= 8

    items = v["items"]
    i = 0
    while True:
        tabla_top = cabecera()
        y = tabla_top - 24
        while i < len(items):
            it = items[i]
            lines = simpleSplit(it["descripcion"] or "", "Helvetica", 8, anchos[2] - 5) or [""]
            h = len(lines) * 10 + 4
            if y - h < TB:
                break
            vu = it["precio_venta"] / (1 + IGV_TASA)
            vt = it["cantidad"] * it["precio_venta"] / (1 + IGV_TASA)
            base = y - 10
            txt(xs[0] + 3, base, str(it.get("codigo") or str(i + 1).zfill(3))[:14], size=8)
            txt(xs[2] - 3, base, _num(it["cantidad"]), size=8, align="r")
            for k, ln in enumerate(lines):
                txt(xs[2] + 3, base - 10 * k, ln, size=8)
            txt(xs[3] + anchos[3] / 2, base, _um(it.get("unidad_medida")), size=8, align="c")
            txt(xs[5] - 3, base, _num(vu), size=8, align="r")
            txt(xs[6] - 3, base, _num(it["precio_venta"]), size=8, align="r")
            txt(xs[7] - 3, base, _num(vt), size=8, align="r")
            y -= h
            i += 1
        marco(tabla_top)
        if i < len(items):
            c.showPage()
            continue
        break

    # Totales
    fh, nfil = 12, len(totales) + 1
    th = fh * nfil
    rw = 200
    rx = M + TW - rw
    c.rect(M, TB - th, TW - rw, th)
    c.rect(rx, TB - th, rw, th)
    son = simpleSplit("SON: " + total_en_letras(total), "Helvetica", 8, TW - rw - 10)
    for k, ln in enumerate(reversed(son)):
        txt(M + 5, TB - th + 6 + 10 * k, ln, "Helvetica-Bold" if ln.startswith("SON:") else "Helvetica", 8)
    c.line(rx + rw - 82, TB, rx + rw - 82, TB - th)
    c.line(rx + rw - 60, TB, rx + rw - 60, TB - th)
    for k, (l, x) in enumerate(totales + [("TOTAL", total)]):
        yy = TB - fh * (k + 1)
        if k > 0:
            c.line(rx, yy + fh, rx + rw, yy + fh)
        f = "Helvetica-Bold" if l == "TOTAL" else "Helvetica"
        txt(rx + rw - 86, yy + 3.5, l, f, 7.5, "r")
        txt(rx + rw - 78, yy + 3.5, "S/", f, 7.5)
        txt(rx + rw - 4, yy + 3.5, _num(x), f, 7.5, "r")

    # Pie
    y = TB - th - 12
    if v.get("monto_pagado") is not None:
        txt(M, y, f"Monto Entregado: S/ {_num(v['monto_pagado'])} · Vuelto: S/ {_num(v.get('vuelto') or 0)}", size=8)
        y -= 10
    if v.get("observaciones"):
        for ln in simpleSplit("Observaciones: " + v["observaciones"], "Helvetica", 8, TW):
            txt(M, y, ln, size=8)
            y -= 10
    for t in EMPRESA["terminos"]:
        txt(M, y, t, size=8)
        y -= 10
    txt(M, y - 2, f"Documento no valido ante la SUNAT, esto es una representación impresa de la {titulo} generada en el sistema interno.", size=6.5)

    c.save()
    return buf.getvalue()