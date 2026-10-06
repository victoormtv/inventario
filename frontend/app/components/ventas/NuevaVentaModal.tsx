'use client';
import { useState } from 'react';
import {
    FaBoxOpen, FaFileInvoice, FaPlus, FaReceipt,
    FaTrash, FaUserTie, FaUser
} from 'react-icons/fa';
import { api, ApiError } from '../../lib/api';
import { moneda } from '../../lib/format';
import type { Contacto, ResultadoVenta, UnidadMedida } from '../../lib/types';
import { UNIDADES_MEDIDA } from '../../lib/types';
import Modal from '../Modal';
import Button from '../ui/Button';
import ConfirmarModal from '../ui/ConfirmarModal';
import { Callout } from '../ui/Form';
import { EmptyState } from '../ui/States';
import { useToast } from '../ui/Toast';
import ClienteSelector from './ClienteSelector';
import ProductoPickerModal from './ProductoPickerModal';
import { useApi } from '../../lib/useApi';

const IGV_TASA = 0.18;

interface ItemCarrito {
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

interface UsuarioVendedor {
    id: number;
    usuario: string;
    nombre?: string;
}

interface Props {
    onCerrar: () => void;
    onEmitida: (venta: ResultadoVenta) => void;
}

export default function NuevaVentaModal({ onCerrar, onEmitida }: Props) {
    const toast = useToast();
    const [cliente, setCliente] = useState<Contacto | null>(null);
    const [vendedorId, setVendedorId] = useState<string>('');
    const [tipoComprobante, setTipoComprobante] = useState<'boleta' | 'factura'>('boleta');
    const [carrito, setCarrito] = useState<ItemCarrito[]>([]);
    const [pickerAbierto, setPickerAbierto] = useState<boolean>(false);
    const [confirmando, setConfirmando] = useState<boolean>(false);
    const [enviando, setEnviando] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Cargar la lista de vendedores desde la API
    const { data: usuarios } = useApi<UsuarioVendedor[]>('/api/usuarios');

    const agregarAlCarrito = (item: { sku: string; nombre: string; id_variante: number; talla: string; color: string; precio_costo: number; precio_venta: number }) => {
        setCarrito((c) => {
            if (c.some((x) => x.id_variante === item.id_variante)) {
                toast('Esa variante ya está en la venta', 'error');
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

                    {/* ── Bloque 1: Cliente y Vendedor ── */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50/70 p-4 rounded-2xl border border-slate-200/80">
                        {/* Selector de Cliente */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider">
                                <FaUser className="text-indigo-600" /> Cliente *
                            </label>
                            <ClienteSelector clienteElegido={cliente} onElegir={setCliente} />
                        </div>

                        {/* Selector de Vendedor */}
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-bold text-slate-700 uppercase tracking-wider" htmlFor="vendedor">
                                <FaUserTie className="text-indigo-600" /> Vendedor asignado *
                            </label>
                            <div className="relative">
                                <select
                                    id="vendedor"
                                    className="w-full bg-white border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
                                    value={vendedorId}
                                    onChange={(e) => setVendedorId(e.target.value)}
                                    required
                                >
                                    <option value="">Seleccionar vendedor...</option>
                                    {(usuarios || []).map((u) => (
                                        <option key={u.id} value={u.id}>
                                            {u.nombre ? `${u.nombre} (@${u.usuario})` : u.usuario}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    </div>

                    {/* ── Bloque 2: Tipo de Comprobante ── */}
                    <div className="space-y-2">
                        <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                            Tipo de comprobante
                        </label>
                        <div className="flex gap-3">
                            <button
                                type="button"
                                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${tipoComprobante === 'boleta'
                                    ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-xs'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                onClick={() => setTipoComprobante('boleta')}>
                                <FaReceipt className={tipoComprobante === 'boleta' ? 'text-blue-600' : 'text-slate-400'} />
                                <span>Boleta de Venta (B001)</span>
                            </button>
                            <button
                                type="button"
                                className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${tipoComprobante === 'factura'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
                                    : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                                    }`}
                                onClick={() => setTipoComprobante('factura')}>
                                <FaFileInvoice className={tipoComprobante === 'factura' ? 'text-emerald-600' : 'text-slate-400'} />
                                <span>Factura Electrónica (F001)</span>
                            </button>
                        </div>
                        {tipoComprobante === 'factura' && !clienteValidoParaFactura && cliente && (
                            <Callout tono="warn">Este cliente no tiene RUC de 11 dígitos registrado. No se puede emitir factura.</Callout>
                        )}
                    </div>

                    {/* ── Bloque 3: Tabla de Productos ── */}
                    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-xs">
                        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                            <div>
                                <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                                    Productos agregados {carrito.length ? `(${carrito.length})` : ''}
                                </h3>
                                <p className="text-[11px] text-slate-400">Selecciona artículos e ingresa el precio final</p>
                            </div>
                            <Button
                                variante="primario"
                                onClick={() => setPickerAbierto(true)}
                                icono={<FaPlus style={{ fontSize: 10 }} />}>
                                Agregar producto
                            </Button>
                        </div>

                        {carrito.length === 0 ? (
                            <div className="p-8">
                                <EmptyState icono={<FaBoxOpen />} titulo="Sin productos" texto="Agrega productos a la lista utilizando el botón superior." />
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                                        <tr>
                                            <th className="px-4 py-2.5 text-left">Producto / SKU</th>
                                            {tipoComprobante === 'factura' && <th className="px-3 py-2.5 text-left w-24">Tipo</th>}
                                            <th className="px-3 py-2.5 text-left w-32">Unidad</th>
                                            <th className="px-3 py-2.5 text-right w-20">Cant.</th>
                                            <th className="px-3 py-2.5 text-right w-24">Costo</th>
                                            <th className="px-3 py-2.5 text-right w-36">Precio venta</th>
                                            <th className="px-3 py-2.5 text-right w-28">Ganancia</th>
                                            <th className="px-3 py-2.5 w-10" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-100">
                                        {carrito.map((i) => (
                                            <tr key={i.id_variante} className="hover:bg-slate-50/60 transition">
                                                <td className="px-4 py-3">
                                                    <div className="font-bold text-slate-800 truncate max-w-[220px]">{i.nombre}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono">{i.sku} · {i.talla}/{i.color}</div>
                                                </td>
                                                {tipoComprobante === 'factura' && (
                                                    <td className="px-3 py-3">
                                                        <select
                                                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 font-medium focus:outline-none"
                                                            value={i.tipo_item}
                                                            onChange={(e) => actualizar(i.id_variante, 'tipo_item', e.target.value as 'bien' | 'servicio')}
                                                        >
                                                            <option value="bien">Bien</option>
                                                            <option value="servicio">Servicio</option>
                                                        </select>
                                                    </td>
                                                )}
                                                <td className="px-3 py-3">
                                                    <select
                                                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 font-medium focus:outline-none w-full"
                                                        value={i.unidad_medida}
                                                        onChange={(e) => actualizar(i.id_variante, 'unidad_medida', e.target.value as UnidadMedida)}
                                                    >
                                                        {UNIDADES_MEDIDA.map((u) => (
                                                            <option key={u.codigo} value={u.codigo}>{u.etiqueta}</option>
                                                        ))}
                                                    </select>
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <input
                                                        type="number" min={1} value={i.cantidad}
                                                        onChange={(e) => actualizar(i.id_variante, 'cantidad', Math.max(1, parseInt(e.target.value) || 1))}
                                                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 text-right w-16 focus:outline-none"
                                                    />
                                                </td>
                                                <td className="px-3 py-3 text-right text-slate-400 font-medium tabular-nums">{moneda(i.precio_costo)}</td>
                                                <td className="px-3 py-3 text-right">
                                                    <input
                                                        type="number" step="0.01" min={0}
                                                        placeholder={i.precio_registrado > 0 ? moneda(i.precio_registrado) : '0.00'}
                                                        value={i.precio_venta}
                                                        onChange={(e) => actualizar(i.id_variante, 'precio_venta', e.target.value)}
                                                        className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-900 text-right w-28 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                                    />
                                                    {precioNum(i) > 0 && (
                                                        <div className="text-[9px] text-slate-400 mt-0.5 text-right">
                                                            Val {moneda(valorUnitario(i))} · IGV {moneda(igvUnitario(i))}
                                                        </div>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-right font-bold tabular-nums">
                                                    {precioNum(i) > 0 ? (
                                                        <span className={gananciaUnitaria(i) >= 0 ? 'text-emerald-600' : 'text-rose-600'}>
                                                            {moneda(gananciaUnitaria(i) * i.cantidad)}
                                                        </span>
                                                    ) : (
                                                        <span className="text-slate-300">—</span>
                                                    )}
                                                </td>
                                                <td className="px-3 py-3 text-right">
                                                    <button
                                                        onClick={() => quitar(i.id_variante)}
                                                        className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer"
                                                        title="Quitar ítem">
                                                        <FaTrash className="text-[11px]" />
                                                    </button>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot className="bg-slate-50/80 font-bold border-t border-slate-200">
                                        <tr>
                                            <td colSpan={tipoComprobante === 'factura' ? 5 : 4} className="px-4 py-3 text-right text-slate-600">
                                                Totales (IGV: {moneda(igvTotal)})
                                            </td>
                                            <td className="px-3 py-3 text-right text-slate-900 text-sm font-extrabold tabular-nums">
                                                {moneda(subtotal)}
                                            </td>
                                            <td className="px-3 py-3 text-right text-emerald-600 font-extrabold tabular-nums">
                                                {moneda(gananciaTotal)}
                                            </td>
                                            <td />
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        )}
                    </div>

                    {error && <Callout tono="danger">{error}</Callout>}

                    {/* Acciones del Modal */}
                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                        <Button onClick={onCerrar}>Cancelar</Button>
                        <Button
                            variante="primario"
                            onClick={pedirConfirmacion}
                            icono={<FaReceipt style={{ fontSize: 11 }} />}>
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