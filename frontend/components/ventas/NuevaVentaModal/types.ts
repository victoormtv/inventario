import type { Contacto, ResultadoVenta, UnidadMedida } from '@/types';

export interface ItemCarrito {
    id_variante: number;
    sku: string;
    nombre: string;
    talla: string;
    color: string;
    cantidad: number;
    precio_costo: number;
    precio_registrado: number;
    precio_venta: string;
    unidad_medida: UnidadMedida;
    tipo_item: 'bien' | 'servicio';
}

export interface UsuarioVendedor {
    id: number;
    usuario: string;
    nombre?: string;
}

export interface NuevaVentaModalProps {
    onCerrar: () => void;
    onEmitida: (venta: ResultadoVenta) => void;
}
