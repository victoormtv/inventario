"""Ingreso de mercadería por proveedor, con igualación de precio."""
from typing import Annotated

from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException
from pydantic import BaseModel, Field, StringConstraints

from alertas import notificar_cruce
from auth import usuario_actual
from database import get_db, transaccion
from servicios import aplicar_movimiento, auditar

router = APIRouter(prefix="/api/mercaderia", dependencies=[Depends(usuario_actual)])


class IngresoIn(BaseModel):
    id_variante: int
    id_proveedor: int
    cantidad: int = Field(gt=0)
    precio_unitario: float = Field(ge=0)
    referencia: Annotated[str, StringConstraints(strip_whitespace=True, max_length=200)] = ""


@router.post("/ingreso", status_code=201)
def registrar_ingreso(
    m: IngresoIn,
    fondo: BackgroundTasks,
    db=Depends(get_db),
    usuario: str = Depends(usuario_actual),
):
    proveedor = db.execute(
        "SELECT id, nombre FROM terceros WHERE id = ? AND tipo = 'proveedor'", (m.id_proveedor,)
    ).fetchone()
    if not proveedor:
        raise HTTPException(404, "El proveedor no existe.")

    with transaccion(db):
        r = aplicar_movimiento(
            db, m.id_variante, "ENTRADA", m.cantidad, m.referencia, usuario,
            id_proveedor=m.id_proveedor, precio_unitario=m.precio_unitario,
        )
        detalle = f"Ingreso de {r['cantidad']} u. de {r['sku']} desde {proveedor['nombre']}"
        if r["precio_anterior"] is not None:
            detalle += f" (precio actualizado de {r['precio_anterior']} a {r['precio_nuevo']})"
        auditar(db, usuario, detalle)

    r["proveedor"] = proveedor["nombre"]
    fondo.add_task(notificar_cruce, r)
    return r