'use client';

import { FaBoxOpen, FaPlus, FaTrash } from 'react-icons/fa';
import { moneda } from '@/lib/format';
import type { UnidadMedida } from '@/types';
import { UNIDADES_MEDIDA } from '@/types';
import Button from '@/components/ui/Button';
import { EmptyState } from '@/components/ui/States';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { ItemCarrito } from './types';

const IGV_TASA = 0.18;

interface Props {
    carrito: ItemCarrito[];
    tipoComprobante: 'boleta' | 'factura';
    onAbrirPicker: () => void;
    onQuitar: (id_variante: number) => void;
    onActualizar: <K extends keyof ItemCarrito>(id_variante: number, campo: K, valor: ItemCarrito[K]) => void;
    precioNum: (i: ItemCarrito) => number;
    valorUnitario: (i: ItemCarrito) => number;
    igvUnitario: (i: ItemCarrito) => number;
    gananciaUnitaria: (i: ItemCarrito) => number;
    subtotal: number;
    igvTotal: number;
    gananciaTotal: number;
}

export function VentaCarritoTabla({
    carrito,
    tipoComprobante,
    onAbrirPicker,
    onQuitar,
    onActualizar,
    precioNum,
    valorUnitario,
    igvUnitario,
    gananciaUnitaria,
    subtotal,
    igvTotal,
    gananciaTotal,
}: Props) {

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-slate-900 text-sm">
                        Productos agregados {carrito.length ? `(${carrito.length})` : ''}
                    </h3>
                    <p className="text-xs text-slate-400 mt-0.5">Selecciona artículos e ingresa el precio final</p>
                </div>
                <Button
                    variante="primario"
                    onClick={onAbrirPicker}
                    icono={<FaPlus style={{ fontSize: 10 }} />}
                >
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
                                            <Select
                                                value={i.tipo_item}
                                                onValueChange={(v) => onActualizar(i.id_variante, 'tipo_item', (v as 'bien' | 'servicio') ?? 'bien')}
                                            >
                                                <SelectTrigger className="h-auto bg-slate-50 border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 font-medium" style={{ width: '100%' }}>
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="bien">Bien</SelectItem>
                                                    <SelectItem value="servicio">Servicio</SelectItem>
                                                </SelectContent>
                                            </Select>
                                        </td>
                                    )}
                                    <td className="px-3 py-3">
                                        <Select
                                            value={i.unidad_medida}
                                            onValueChange={(v) => onActualizar(i.id_variante, 'unidad_medida', (v as UnidadMedida) ?? 'NIU')}
                                        >
                                            <SelectTrigger className="h-auto bg-slate-50 border-slate-200 rounded-lg px-2 py-1 text-xs text-slate-700 font-medium" style={{ width: '100%' }}>
                                                <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {UNIDADES_MEDIDA.map((u) => (
                                                    <SelectItem key={u.codigo} value={u.codigo}>{u.etiqueta}</SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    </td>
                                    <td className="px-3 py-3 text-right">
                                        <input
                                            type="number" min={1} value={i.cantidad}
                                            onChange={(e) => onActualizar(i.id_variante, 'cantidad', Math.max(1, parseInt(e.target.value) || 1))}
                                            className="bg-slate-50 border border-slate-200 rounded-lg px-2 py-1 text-xs font-bold text-slate-800 text-right w-16 focus:outline-none"
                                        />
                                    </td>
                                    <td className="px-3 py-3 text-right text-slate-400 font-medium tabular-nums">{moneda(i.precio_costo)}</td>
                                    <td className="px-3 py-3 text-right">
                                        <input
                                            type="number" step="0.01" min={0}
                                            placeholder={i.precio_registrado > 0 ? moneda(i.precio_registrado) : '0.00'}
                                            value={i.precio_venta}
                                            onChange={(e) => onActualizar(i.id_variante, 'precio_venta', e.target.value)}
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
                                            onClick={() => onQuitar(i.id_variante)}
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
                                <td colSpan={tipoComprobante === 'factura' ? 5 : 4} className="px-4 py-3 text-right text-slate-600 uppercase text-[11px] tracking-wider">
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
    );
}
