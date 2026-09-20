"""Alertas de stock bajo: consulta para el sistema + aviso por correo (SMTP)."""
import logging
import os
import smtplib
import ssl
from email.message import EmailMessage

log = logging.getLogger("inventario.alertas")


def productos_bajo_minimo(db) -> list[dict]:
    """Productos cuyo stock total (suma de variantes) es menor o igual al mínimo.

    Usa LEFT JOIN para incluir también los productos que aún no tienen variantes.
    """
    filas = db.execute("""
        SELECT p.sku, p.nombre,
               COALESCE(SUM(v.stock_actual), 0) AS stock_total,
               p.stock_minimo
        FROM productos p
        LEFT JOIN variantes v ON v.sku_producto = p.sku
        GROUP BY p.sku
        HAVING stock_total <= p.stock_minimo
        ORDER BY stock_total ASC, p.nombre COLLATE NOCASE
    """).fetchall()
    return [dict(f) for f in filas]


# ───────── Correo ─────────
def correo_configurado() -> bool:
    return bool(os.environ.get("SMTP_HOST") and os.environ.get("SMTP_USER") and os.environ.get("SMTP_PASSWORD"))


def destinatarios() -> list[str]:
    """A quién le llegan los avisos: ALERTAS_EMAIL_A (separados por coma) o, si no está, el propio SMTP_USER."""
    crudo = os.environ.get("ALERTAS_EMAIL_A") or os.environ.get("SMTP_USER", "")
    return [d.strip() for d in crudo.split(",") if d.strip()]


def enviar_correo(asunto: str, texto: str) -> str | None:
    """Envía un correo. Devuelve None si salió bien, o el motivo del error (sin lanzar excepción)."""
    if not correo_configurado():
        return "El correo no está configurado."
    usuario = os.environ["SMTP_USER"]
    clave = os.environ["SMTP_PASSWORD"]
    host = os.environ["SMTP_HOST"]

    msg = EmailMessage()
    msg["From"] = os.environ.get("SMTP_FROM") or usuario
    msg["To"] = ", ".join(destinatarios())
    msg["Subject"] = asunto
    msg.set_content(texto)

    try:
        puerto = int(os.environ.get("SMTP_PORT", "587"))
        contexto = ssl.create_default_context()
        if puerto == 465:  # SSL directo
            with smtplib.SMTP_SSL(host, puerto, context=contexto, timeout=10) as servidor:
                servidor.login(usuario, clave)
                servidor.send_message(msg)
        else:  # 587: conexión normal que se cifra con STARTTLS
            with smtplib.SMTP(host, puerto, timeout=10) as servidor:
                servidor.starttls(context=contexto)
                servidor.login(usuario, clave)
                servidor.send_message(msg)
        return None
    except Exception as exc:  # contraseña incorrecta, sin internet, puerto bloqueado, etc.
        log.warning("No se pudo enviar el correo de alerta: %s", exc)
        return str(exc)


def notificar_cruce(mov: dict) -> None:
    """Avisa por correo solo cuando un producto CRUZA su mínimo (no en cada movimiento)."""
    antes, despues, minimo = mov["total_antes"], mov["total_despues"], mov["stock_minimo"]
    if not (antes > minimo and despues <= minimo):
        return
    nombre, sku = mov["nombre"], mov["sku"]
    if despues <= 0:
        asunto = f"🚫 Agotado: {nombre} ({sku})"
        cuerpo = f"El producto {nombre} ({sku}) se quedó sin stock.\n\nRegistra una entrada cuando repongas."
    else:
        asunto = f"⚠️ Stock bajo: {nombre} ({sku})"
        cuerpo = (
            f"El producto {nombre} ({sku}) quedó en {despues} unidades.\n"
            f"Su stock mínimo es {minimo}.\n\nConviene reponerlo."
        )
    enviar_correo(asunto, cuerpo)