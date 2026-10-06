from database import conectar
from auth import hashear
conn = conectar()
conn.execute("INSERT OR IGNORE INTO usuarios (usuario, password, rol) VALUES ('admin', ?, 'admin')", (hashear('admin123'),))
conn.commit()
conn.close()
print('Listo')
