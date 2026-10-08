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

export interface VarianteInventario {
    id_variante: number;
    sku: string;
    nombre: string;
    categoria: string | null;
    precio_costo: number;
    precio_venta: number;
    stock_minimo: number;
    talla: string;
    color: string;
    detalle: string | null;
    kg: number | null;
    lote: string | null;
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

export interface TopProducto {
    nombre: string;
    sku: string;
    unidades: number;
    ganancia: number;
}

export interface GananciaPorProducto {
    nombre: string;
    sku: string;
    ganancia: number;
    unidades: number;
}

export interface KpiData {
    total_productos: number;
    unidades_totales: number;
    stock_valorizado: number;
    alertas_stock_bajo: number;
    detalle_alertas: AlertaStock[];
    ganancia_diaria?: number;
    ganancia_semanal?: number;
    ganancia_mensual?: number;
    top_diario?: TopProducto | null;
    top_semanal?: TopProducto | null;
    top_mensual?: TopProducto | null;
    ganancia_por_producto_diaria?: GananciaPorProducto[];
    ganancia_por_producto_semanal?: GananciaPorProducto[];
    ganancia_por_producto_mensual?: GananciaPorProducto[];
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

export interface Contacto {
    id: number;
    tipo: 'cliente' | 'proveedor';
    nombre: string;
    documento: string | null;
    telefono: string | null;
    email: string | null;
    direccion: string | null;
}

export interface ResultadoIngreso {
    id: number;
    sku: string;
    nombre: string;
    tipo: 'ENTRADA';
    cantidad: number;
    stock_anterior: number;
    stock_resultante: number;
    stock_minimo: number;
    total_antes: number;
    total_despues: number;
    precio_anterior: number | null;
    precio_nuevo: number;
    proveedor: string;
}

export interface HistorialPrecio {
    id: number;
    fecha: string;
    cantidad: number;
    precio_anterior: number | null;
    precio_nuevo: number;
    proveedor: string | null;
    referencia: string | null;
    variacion_pct: number | null;
}

export interface ResultadoDocumento {
    tipo: 'dni' | 'ruc';
    numero: string;
    nombre: string;
    direccion: string;
    estado?: string;
    condicion?: string;
}

export type UnidadMedida =
    | 'NIU' | 'ZZ' | 'PR' | 'DZN' | 'SET' | 'BX' | 'BG' | 'GLL'
    | 'KGM' | 'LTR' | 'MTR' | 'MTK' | 'HLT';

export const UNIDADES_MEDIDA: { codigo: UnidadMedida; etiqueta: string }[] = [
    { codigo: 'NIU', etiqueta: 'UNIDAD' },
    { codigo: 'PR', etiqueta: 'PAR' },
    { codigo: 'DZN', etiqueta: 'DOCENA' },
    { codigo: 'SET', etiqueta: 'JUEGO / SET' },
    { codigo: 'BX', etiqueta: 'CAJA' },
    { codigo: 'BG', etiqueta: 'BOLSA' },
    { codigo: 'KGM', etiqueta: 'KILOGRAMO' },
    { codigo: 'GLL', etiqueta: 'GALÓN' },
    { codigo: 'LTR', etiqueta: 'LITRO' },
    { codigo: 'MTR', etiqueta: 'METRO LINEAL' },
    { codigo: 'MTK', etiqueta: 'METRO CUADRADO' },
    { codigo: 'HLT', etiqueta: 'HECTOLITRO' },
    { codigo: 'ZZ', etiqueta: 'SERVICIO' },
];

export interface ItemVenta {
    sku_producto: string;
    descripcion: string;
    cantidad: number;
    precio_costo: number;
    precio_venta: number;
    ganancia: number;
    unidad_medida: UnidadMedida;
    tipo_item: 'bien' | 'servicio';
    valor_unitario: number;
    igv: number;
}

export interface ResultadoVenta {
    id: number;
    tipo_comprobante: 'boleta' | 'factura';
    serie: string;
    numero: number;
    id_cliente: number;
    cliente_nombre: string;
    cliente_documento: string | null;
    cliente_direccion: string | null;
    fecha: string;
    subtotal: number;
    descuento?: number;
    total: number;
    ganancia_total: number;
    igv_total?: number;
    metodo_pago?: string;
    monto_pagado?: number;
    vuelto?: number;
    observaciones?: string;
    usuario?: string;
    estado: string;
    items: ItemVenta[];
}

export interface VentaResumen {
    id: number;
    tipo_comprobante: 'boleta' | 'factura';
    serie: string;
    numero: number;
    fecha: string;
    total: number;
    ganancia_total: number;
    estado: string;
    cliente_nombre: string;
}
