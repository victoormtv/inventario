import argparse
import getpass
import sys

from auth import hashear
from database import conectar, inicializar_bd


def main():
    parser = argparse.ArgumentParser(description="Gestiona los administradores del sistema.")
    parser.add_argument("usuario", nargs="?", help="nombre de usuario")
    parser.add_argument("--listar", action="store_true", help="lista los usuarios existentes")
    args = parser.parse_args()

    inicializar_bd()
    db = conectar()

    if args.listar:
        filas = db.execute("SELECT usuario, rol FROM usuarios ORDER BY usuario").fetchall()
        if not filas:
            print("Todavía no hay usuarios.")
        for f in filas:
            print(f"- {f['usuario']} ({f['rol']})")
        return

    usuario = (args.usuario or input("Nombre de usuario: ")).strip()
    if not usuario:
        sys.exit("El nombre de usuario no puede estar vacío.")

    password = getpass.getpass("Contraseña (mínimo 8 caracteres): ")
    if len(password) < 8:
        sys.exit("La contraseña debe tener al menos 8 caracteres.")
    if len(password.encode("utf-8")) > 72:
        sys.exit("La contraseña es demasiado larga (máximo 72 bytes).")
    if password != getpass.getpass("Repite la contraseña: "):
        sys.exit("Las contraseñas no coinciden.")

    existe = db.execute("SELECT 1 FROM usuarios WHERE lower(usuario) = lower(?)", (usuario,)).fetchone()
    if existe:
        db.execute("UPDATE usuarios SET password = ? WHERE lower(usuario) = lower(?)", (hashear(password), usuario))
        print(f"Contraseña actualizada para '{usuario}'.")
    else:
        db.execute(
            "INSERT INTO usuarios (usuario, password, rol) VALUES (?, ?, 'admin')",
            (usuario, hashear(password)),
        )
        print(f"Administrador '{usuario}' creado.")


if __name__ == "__main__":
    main()