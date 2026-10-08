'use client';

import { useState } from 'react';
import { FaReceipt } from 'react-icons/fa';
import { api, ApiError } from '@/lib/api';
import { moneda } from '@/lib/format';
import type { Contacto, ResultadoVenta } from '@/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import ConfirmarModal from '@/components/ui/ConfirmarModal';
import { Callout } from '@/components/ui/Form';
import { useToast } from '@/components/ui/Toast';
import ProductoPickerModal from '../ProductoPickerModal';
import { VentaDatosForm } from './VentaDatosForm';
import { VentaComprobanteSelector } from './VentaComprobanteSelector';
import { VentaCarritoTabla } from './VentaCarritoTabla';
import type { ItemCarrito, NuevaVentaModalProps } from './types';

const IGV_TASA = 0.18;

export default function NuevaVentaModal({ onCerrar, onEmitida }: NuevaVentaModalProps) {
    const toast = useToast();
    const [cliente, setCliente] = useState<Contacto | null>(null);
    const [vendedorId, setVendedorId] = useState<string>('');
    const [tipoComprobante, setTipoComprobante] = useState<'boleta' | 'factura'>('boleta');
    const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
    const [pickerAbierto, setPickerAbierto] = useState<boolean>(false);
    const [confirmando, setConfirmando] = useState<boolean>(false);
    const [enviando, setEnviando] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const agregarAlCarrito = (item: { sku: string; nombre: string; id_variante: number; talla: string; color: string; precio_costo: number; precio_venta: number }) => {
        setCarrito((c) => {
            if (c.some((x) => x.id_variante === item.id_variante)) {
                toast('Esa variante ya está en la venta', 'aviso');
                return c;
            }
            return [...c, {
                id_variante: item.id_variante, sku: item.sku, nombre: item.nombre, talla: item.talla, color: item.color,
                cantidad: 1, precio_costo: item.precio_costo, precio_registrado: item.precio_venta,
                precio_venta: '', unidad_medida: 'NIU', tipo_item: 'bien',
            }];
        });
        setPickerAbierto(false);
    };

    const quitar = (id_variante: number) => setCarrito((c) => c.filter((i) => i.id_variante !== id_variante));

    const actualizar = <K extends keyof ItemCarrito>(id_variante: number, campo: K, valor: ItemCarrito[K]) =>
        setCarrito((c) => c.map((i) => (i.id_variante === id_variante ? { ...i, [campo]: valor } : i)));

    const precioNum = (i: ItemCarrito) => parseFloat(i.precio_venta) || 0;
    const valorUnitario = (i: ItemCarrito) => precioNum(i) / (1 + IGV_TASA);
    const igvUnitario = (i: ItemCarrito) => precioNum(i) - valorUnitario(i);
    const gananciaUnitaria = (i: ItemCarrito) => precioNum(i) - i.precio_costo;
    const subtotal = carrito.reduce((s, i) => s + i.cantidad * precioNum(i), 0);
    const igvTotal = carrito.reduce((s, i) => s + igvUnitario(i) * i.cantidad, 0);
    const gananciaTotal = carrito.reduce((s, i) => s + gananciaUnitaria(i) * i.cantidad, 0);

    const clienteValidoParaFactura = tipoComprobante !== 'factura' || cliente?.documento?.length === 11;
    const todosConPrecio = carrito.every((i) => precioNum(i) > 0);

    const pedirConfirmacion = () => {
        setError(null);
        if (!cliente) return setError('Elige un cliente.');
        if (!vendedorId) return setError('Selecciona un vendedor para registrar la venta.');
        if (carrito.length === 0) return setError('Agrega al menos un producto.');
        if (!todosConPrecio) return setError('Falta el precio de venta en uno o más productos.');
        if (!clienteValidoParaFactura) return setError('Para factura el cliente necesita RUC (11 dígitos).');
        setConfirmando(true);
    };

    const confirmarVenta = async () => {
        if (!cliente) return;
        setEnviando(true);
        setError(null);
        try {
            const r = await api<ResultadoVenta>('/api/ventas', {
                method: 'POST',
                json: {
                    tipo_comprobante: tipoComprobante,
                    id_cliente: cliente.id,
                    id_vendedor: parseInt(vendedorId),
                    items: carrito.map((i) => ({
                        id_variante: i.id_variante,
                        cantidad: i.cantidad,
                        precio_venta: precioNum(i),
                        unidad_medida: i.unidad_medida,
                        tipo_item: tipoComprobante === 'factura' ? i.tipo_item : 'bien',
                    })),
                },
            });
            toast('Venta registrada');
            setConfirmando(false);
            onEmitida(r);
        } catch (err) {
            setConfirmando(false);
            setError(err instanceof ApiError ? err.message : 'Error al registrar la venta.');
        } finally {
            setEnviando(false);
        }
    };

    return (
        <>
            <Modal abierto onCerrar={onCerrar} titulo="Nueva venta" subtitulo="Registra la transacción, asigna el vendedor y emite el comprobante" ancho anchoMax={1180}>
                <div className="space-y-6">
                    <VentaDatosForm
                        cliente={cliente}
                        onClienteChange={setCliente}
                        vendedorId={vendedorId}
                        onVendedorIdChange={setVendedorId}
                    />

                    <VentaComprobanteSelector
                        tipoComprobante={tipoComprobante}
                        onTipoComprobanteChange={setTipoComprobante}
                        cliente={cliente}
                        clienteValidoParaFactura={clienteValidoParaFactura}
                    />

                    <VentaCarritoTabla
                        carrito={carrito}
                        tipoComprobante={tipoComprobante}
                        onAbrirPicker={() => setPickerAbierto(true)}
                        onQuitar={quitar}
                        onActualizar={actualizar}
                        precioNum={precioNum}
                        valorUnitario={valorUnitario}
                        igvUnitario={igvUnitario}
                        gananciaUnitaria={gananciaUnitaria}
                        subtotal={subtotal}
                        igvTotal={igvTotal}
                        gananciaTotal={gananciaTotal}
                    />

                    {error && <Callout tono="danger">{error}</Callout>}

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                        <Button onClick={onCerrar}>Cancelar</Button>
                        <Button
                            variante="primario"
                            onClick={pedirConfirmacion}
                            icono={<FaReceipt style={{ fontSize: 11 }} />}
                        >
                            Emitir {tipoComprobante === 'boleta' ? 'boleta' : 'factura'}
                        </Button>
                    </div>
                </div>
            </Modal>

            {pickerAbierto && <ProductoPickerModal onAgregar={agregarAlCarrito} onCerrar={() => setPickerAbierto(false)} />}

            <ConfirmarModal
                abierto={confirmando}
                titulo={`Confirmar ${tipoComprobante}`}
                texto={`¿Emitir ${tipoComprobante} a "${cliente?.nombre}" por un total de ${moneda(subtotal)}? Se registrará con el vendedor asignado y se descontará el stock de ${carrito.length} producto(s). Ganancia estimada: ${moneda(gananciaTotal)}.`}
                textoConfirmar="Sí, emitir comprobante"
                cargando={enviando}
                onConfirmar={confirmarVenta}
                onCancelar={() => setConfirmando(false)}
            />
        </>
    );
}
