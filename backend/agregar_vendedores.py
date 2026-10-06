import sqlite3
from database import conectar

vendedores = [
    ("kristian", "123456", "vendedor", "Kristian Burgos"),
    ("cristina", "123456", "vendedor", "Cristina Burgos"),
    ("luzmila",  "123456", "vendedor", "Luzmila Robles")
]

def registrar_vendedores():
    conn = conectar()
    cursor = conn.cursor()
    
    # Asegurarse de que exista la columna 'nombre' opcional si no la tenías
    try:
        cursor.execute("ALTER TABLE usuarios ADD COLUMN nombre TEXT")
    except sqlite3.OperationalError:
        pass  # La columna ya existe

    for usuario, clave, rol, nombre in vendedores:
        try:
            cursor.execute("""
                INSERT INTO usuarios (usuario, password, rol, nombre)
                VALUES (?, ?, ?, ?)
            """, (usuario, clave, rol, nombre))
            print(f"Vendedor '{nombre}' registrado correctamente.")
        except sqlite3.IntegrityError:
            print(f"El usuario '{usuario}' ya existe en la base de datos.")

    conn.commit()
    conn.close()

if __name__ == "__main__":
    registrar_vendedores()