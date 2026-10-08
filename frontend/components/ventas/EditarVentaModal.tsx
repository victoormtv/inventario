'use client';

import { useEffect, useState } from 'react';
import { FaSave, FaTrash } from 'react-icons/fa';
import { api, ApiError } from '@/lib/api';
import { moneda } from '@/lib/format';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import { Callout } from '@/components/ui/Form';
import { useToast } from '@/components/ui/Toast';

type Linea = {
    id_variante: number;
    descripcion: string;
    sku_producto: string;
    cantidad: number;
    precio_venta: string;
};

type Props = {
    idVenta: number;
    onCerrar: () => void;
    onGuardada: () => void;
};

export default function EditarVentaModal({ idVenta, onCerrar, onGuardada }: Props) {
    const toast = useToast();
    const [cargando, setCargando] = useState(true);
    const [guardando, setGuardando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [titulo, setTitulo] = useState('');
    const [lineas, setLineas] = useState<Linea[]>([]);
    const [descuento, setDescuento] = useState('0');
    const [metodoPago, setMetodoPago] = useState('efectivo');
    const [observaciones, setObservaciones] = useState('');

    useEffect(() => {
        let vivo = true;
        (async () => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const v: any = await api(`/api/ventas/${idVenta}`);
                if (!vivo) return;
                setTitulo(`${v.serie || ''}-${String(v.numero ?? v.id).padStart(8, '0')}`);
                setLineas(
                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    (v.items || []).map((i: any) => ({
                        id_variante: i.id_variante,
                        descripcion: i.descripcion || i.sku_producto,
                        sku_producto: i.sku_producto,
                        cantidad: i.cantidad,
                        precio_venta: String(i.precio_venta),
                    })),
                );
                setDescuento(String(v.descuento || 0));
                setMetodoPago(v.metodo_pago || 'efectivo');
                setObservaciones(v.observaciones || '');
            } catch (e) {
                setError(e instanceof ApiError ? e.message : 'No se pudo cargar la venta.');
            } finally {
                if (vivo) setCargando(false);
            }
        })();
        return () => { vivo = false; };
    }, [idVenta]);

    const num = (s: string) => parseFloat(s) || 0;
    const subtotal = lineas.reduce((s, l) => s + l.cantidad * num(l.precio_venta), 0);
    const total = Math.max(0, subtotal - num(descuento));

    const cambiar = (id: number, campo: 'cantidad' | 'precio_venta', valor: string) =>
        setLineas((ls) => ls.map((l) => (l.id_variante === id
            ? { ...l, [campo]: campo === 'cantidad' ? Math.max(1, parseInt(valor) || 1) : valor }
            : l)));

    const guardar = async () => {
        setError(null);
        if (lineas.length === 0) return setError('La venta debe tener al menos un producto.');
        if (lineas.some((l) => num(l.precio_venta) <= 0)) return setError('Todos los precios deben ser mayores a 0.');
        setGuardando(true);
        try {
            await api(`/api/ventas/${idVenta}`, {
                method: 'PUT',
                json: {
                    items: lineas.map((l) => ({
                        id_variante: l.id_variante,
                        cantidad: l.cantidad,
                        precio_venta: num(l.precio_venta),
                    })),
                    descuento: num(descuento),
                    metodo_pago: metodoPago,
                    observaciones: observaciones.trim() || null,
                },
            });
            toast('Venta actualizada');
            onGuardada();
        } catch (e) {
            setError(e instanceof ApiError ? e.message : 'No se pudo guardar.');
        } finally {
            setGuardando(false);
        }
    };

    const input = 'w-full bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500';

    return (
        <Modal abierto onCerrar={onCerrar} titulo={`Editar venta ${titulo}`} subtitulo="Cambia cantidades, precios o quita productos. El stock se ajusta solo." ancho anchoMax={900}>
            {cargando ? (
                <p className="text-sm text-slate-400 py-8 text-center">Cargando…</p>
            ) : (
                <div className="space-y-5">
                    <div className="overflow-x-auto border border-slate-200 rounded-xl">
                        <table className="w-full text-xs">
                            <thead className="bg-slate-50 text-slate-500 font-semibold">
                                <tr>
                                    <th className="px-4 py-2.5 text-left">Producto</th>
                                    <th className="px-3 py-2.5 w-24">Cant.</th>
                                    <th className="px-3 py-2.5 w-32">Precio</th>
                                    <th className="px-3 py-2.5 w-28 text-right">Subtotal</th>
                                    <th className="px-3 py-2.5 w-10" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {lineas.map((l) => (
                                    <tr key={l.id_variante}>
                                        <td className="px-4 py-2.5">
                                            <div className="font-semibold text-slate-800">{l.descripcion}</div>
                                            <div className="text-[10px] text-slate-400 font-mono">{l.sku_producto}</div>
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <input type="number" min={1} value={l.cantidad} className={input}
                                                onChange={(e) => cambiar(l.id_variante, 'cantidad', e.target.value)} />
                                        </td>
                                        <td className="px-3 py-2.5">
                                            <input type="number" min={0} step="0.01" value={l.precio_venta} className={input}
                                                onChange={(e) => cambiar(l.id_variante, 'precio_venta', e.target.value)} />
                                        </td>
                                        <td className="px-3 py-2.5 text-right font-bold tabular-nums">
                                            {moneda(l.cantidad * num(l.precio_venta))}
                                        </td>
                                        <td className="px-3 py-2.5 text-right">
                                            <button type="button" title="Quitar" className="text-rose-500 hover:text-rose-700 cursor-pointer"
                                                onClick={() => setLineas((ls) => ls.filter((x) => x.id_variante !== l.id_variante))}>
                                                <FaTrash />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
                        <label className="space-y-1 font-semibold text-slate-500">
                            Método de pago
                            <select value={metodoPago} onChange={(e) => setMetodoPago(e.target.value)} className={input}>
                                <option value="efectivo">Efectivo</option>
                                <option value="yape">Yape</option>
                                <option value="plin">Plin</option>
                                <option value="tarjeta">Tarjeta</option>
                                <option value="transferencia">Transferencia</option>
                            </select>
                        </label>
                        <label className="space-y-1 font-semibold text-slate-500">
                            Descuento (S/)
                            <input type="number" min={0} step="0.01" value={descuento} className={input}
                                onChange={(e) => setDescuento(e.target.value)} />
                        </label>
                        <label className="space-y-1 font-semibold text-slate-500 sm:col-span-3">
                            Observaciones
                            <input type="text" value={observaciones} className={input}
                                onChange={(e) => setObservaciones(e.target.value)} />
                        </label>
                    </div>

                    <div className="flex justify-end text-sm font-bold text-slate-700">
                        Total: <span className="ml-2 text-slate-900 font-black">{moneda(total)}</span>
                    </div>

                    {error && <Callout tono="danger">{error}</Callout>}

                    <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                        <Button onClick={onCerrar}>Cancelar</Button>
                        <Button variante="primario" onClick={guardar} cargando={guardando} icono={<FaSave style={{ fontSize: 11 }} />}>
                            Guardar cambios
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}