import os
import secrets
import time
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from database import BASE_DIR, get_db

HORAS_SESION = 12
MAX_INTENTOS = 5
BLOQUEO_SEGUNDOS = 300


def _cargar_secreto() -> str:
    """Clave para firmar sesiones: variable de entorno o archivo .secret_key (se crea solo)."""
    desde_env = os.environ.get("INVENTARIO_SECRET")
    if desde_env:
        return desde_env
    ruta = os.path.join(BASE_DIR, ".secret_key")
    if os.path.exists(ruta):
        with open(ruta, "r", encoding="utf-8") as f:
            return f.read().strip()
    secreto = secrets.token_hex(32)
    with open(ruta, "w", encoding="utf-8") as f:
        f.write(secreto)
    return secreto


SECRETO = _cargar_secreto()
_bearer = HTTPBearer(auto_error=False)


# ───────── Contraseñas ─────────
def hashear(password: str) -> str:
    return bcrypt.hashpw(password.encode("utf-8"), bcrypt.gensalt()).decode("utf-8")


def verificar(password: str, hash_guardado: str) -> bool:
    try:
        return bcrypt.checkpw(password.encode("utf-8"), hash_guardado.encode("utf-8"))
    except ValueError:  # p. ej. contraseña de más de 72 bytes
        return False


# Se compara contra este hash cuando el usuario no existe, para que responder
# "usuario inválido" tarde lo mismo que "clave inválida".
HASH_FALSO = hashear("contraseña-inexistente")


# ───────── Bloqueo por intentos fallidos ─────────
_fallos: dict[str, tuple[int, float]] = {}


def verificar_bloqueo(clave: str):
    intentos, desde = _fallos.get(clave, (0, 0.0))
    if intentos >= MAX_INTENTOS:
        restante = int(BLOQUEO_SEGUNDOS - (time.time() - desde))
        if restante > 0:
            minutos = max(1, restante // 60 + (1 if restante % 60 else 0))
            raise HTTPException(429, f"Demasiados intentos. Espera {minutos} min e inténtalo de nuevo.")
        _fallos.pop(clave, None)


def registrar_fallo(clave: str):
    intentos, _ = _fallos.get(clave, (0, 0.0))
    _fallos[clave] = (intentos + 1, time.time())


def limpiar_fallos(clave: str):
    _fallos.pop(clave, None)


# ───────── Sesiones (JWT) ─────────
def crear_token(usuario: str, rol: str) -> str:
    payload = {
        "sub": usuario,
        "rol": rol,
        "exp": datetime.now(timezone.utc) + timedelta(hours=HORAS_SESION),
    }
    return jwt.encode(payload, SECRETO, algorithm="HS256")


def usuario_actual(
    cred: HTTPAuthorizationCredentials | None = Depends(_bearer),
    db=Depends(get_db),
) -> str:
    """Dependencia que protege los endpoints. Devuelve el nombre del usuario."""
    if cred is None:
        raise HTTPException(401, "Inicia sesión para continuar.", headers={"WWW-Authenticate": "Bearer"})
    try:
        datos = jwt.decode(cred.credentials, SECRETO, algorithms=["HS256"])
    except jwt.PyJWTError:
        raise HTTPException(401, "Tu sesión expiró. Inicia sesión de nuevo.", headers={"WWW-Authenticate": "Bearer"})
    fila = db.execute("SELECT usuario FROM usuarios WHERE usuario = ?", (datos.get("sub"),)).fetchone()
    if fila is None:
        raise HTTPException(401, "Esta cuenta ya no existe.", headers={"WWW-Authenticate": "Bearer"})
    return fila["usuario"]