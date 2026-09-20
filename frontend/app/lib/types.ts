export type TipoMovimiento = 'ENTRADA' | 'SALIDA' | 'AJUSTE';

export interface Paginado<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
}

export interface ProductoResumen {
    sku: string;
    nombre: string;
    categoria: string | null;
    precio_costo: number;
    precio_venta: number;
    stock_minimo: number;
    stock_total: number;
    num_variantes: number;
}

export interface Variante {
    id: number;
    talla: string;
    color: string;
    stock_actual: number;
}

export interface ProductoDetalle {
    sku: string;
    nombre: string;
    categoria: string | null;
    precio_costo: number;
    precio_venta: number;
    stock_minimo: number;
    variantes: Variante[];
}

export interface Movimiento {
    id: number;
    fecha: string;
    sku: string;
    nombre: string | null;
    talla: string | null;
    color: string | null;
    tipo: TipoMovimiento;
    cantidad: number;
    stock_anterior: number | null;
    stock_resultante: number | null;
    referencia: string | null;
    usuario: string | null;
}

export interface ResultadoMovimiento {
    id: number;
    sku: string;
    nombre: string;
    tipo: TipoMovimiento;
    cantidad: number;
    stock_anterior: number;
    stock_resultante: number;
    stock_minimo: number;
    total_antes: number;
    total_despues: number;
}

export interface AlertaStock {
    sku: string;
    nombre: string;
    stock_total: number;
    stock_minimo: number;
}

export interface KpiData {
    total_productos: number;
    unidades_totales: number;
    stock_valorizado: number;
    alertas_stock_bajo: number;
    detalle_alertas: AlertaStock[];
}

export interface EstadoAlertas {
    total: number;
    items: AlertaStock[];
    correo_configurado: boolean;
    destinatarios: string[];
}

export interface ResultadoImportacion {
    valido: boolean;
    aplicado: boolean;
    resumen: {
        filas: number;
        productos_nuevos: number;
        productos_existentes: number;
        variantes_nuevas: number;
        unidades: number;
    };
    errores: { fila: number; errores: string[] }[];
    total_errores: number;
}