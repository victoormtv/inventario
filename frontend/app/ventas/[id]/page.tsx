'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
    FaArrowLeft,
    FaBoxOpen,
    FaBuilding,
    FaCoins,
    FaDollarSign,
    FaEnvelope,
    FaPrint,
    FaUser,
} from 'react-icons/fa';
import { useApi } from '@/hooks/useApi';
import { moneda } from '@/lib/format';
import type { ResultadoVenta } from '@/types';
import ComprobanteImprimible from '@/components/ventas/ComprobanteImprimible';
import EnviarCorreoModal from '@/components/ventas/EnviarCorreoModal';
import { EmptyState, ErrorState, TablaSkeleton } from '@/components/ui/States';

export default function DetalleVentaPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const router = useRouter();
    const [mostrarComprobante, setMostrarComprobante] = useState(false);
    const [mostrarCorreo, setMostrarCorreo] = useState(false);

    const { data: venta, loading, error, refetch } = useApi<ResultadoVenta>(`/api/ventas/${id}`);

    if (loading) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 md:p-8 max-w-7xl mx-auto space-y-6">
                <div className="h-10 bg-slate-200 rounded-xl w-48 animate-pulse" />
                <TablaSkeleton filas={6} />
            </div>
        );
    }

    if (error || !venta) {
        return (
            <div className="min-h-screen bg-slate-50 p-6 md:p-8 max-w-3xl mx-auto">
                <ErrorState
                    mensaje={error || 'No se encontró la venta solicitada.'}
                    onReintentar={refetch}
                />
            </div>
        );
    }

    const esBoleta = venta.tipo_comprobante === 'boleta';
    const numeroFormateado = `${venta.serie || (esBoleta ? 'B001' : 'F001')}-${String(venta.numero || venta.id).padStart(8, '0')}`;
    const esEmpresa = venta.cliente_documento?.length === 11;

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div className="flex items-center gap-3">
                        <button
                            onClick={() => router.push('/ventas')}
                            className="p-2.5 text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all cursor-pointer shadow-xs"
                            title="Volver a Ventas"
                        >
                            <FaArrowLeft className="text-xs" />
                        </button>
                        <div>
                            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-1">
                                Detalle de Venta
                            </p>
                            <div className="flex items-center gap-2">
                                <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${esBoleta
                                    ? 'bg-blue-50 text-blue-700 border-blue-200'
                                    : 'bg-violet-50 text-violet-700 border-violet-200'
                                    }`}>
                                    {esBoleta ? 'Boleta de Venta' : 'Factura Electrónica'}
                                </span>
                                <p className="text-xs font-semibold text-slate-400 font-mono">ID #{venta.id}</p>
                            </div>
                            <h1 className="text-3xl font-black text-slate-900 leading-tight mt-1">
                                Comprobante {numeroFormateado}
                            </h1>
                            <p className="text-slate-500 text-sm mt-1.5">
                                Registrado el {new Date(venta.fecha).toLocaleString('es-PE', { dateStyle: 'medium', timeStyle: 'short' })}
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => setMostrarCorreo(true)}
                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-xl transition-all cursor-pointer"
                        >
                            <FaEnvelope className="text-xs" />
                            Enviar por correo
                        </button>
                        <button
                            onClick={() => setMostrarComprobante(true)}
                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all cursor-pointer shadow-lg shadow-indigo-600/20"
                        >
                            <FaPrint className="text-xs" />
                            Ver / Imprimir Comprobante
                        </button>
                    </div>
                </div>

                {/* ── Grid Paneles ── */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                    {/* Panel Cliente */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-xs border border-indigo-100">
                                    {esEmpresa ? <FaBuilding /> : <FaUser />}
                                </div>
                                <div>
                                    <h2 className="font-bold text-slate-900 text-sm">Datos del Cliente</h2>
                                    <p className="text-xs text-slate-400 mt-0.5">Receptor asignado al comprobante</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 space-y-3 text-xs">
                            <div className="flex justify-between py-1.5 border-b border-slate-100">
                                <span className="font-semibold text-slate-500">Nombre / Razón Social:</span>
                                <span className="font-bold text-slate-800">{venta.cliente_nombre || 'Cliente General'}</span>
                            </div>
                            {venta.cliente_documento && (
                                <div className="flex justify-between py-1.5 border-b border-slate-100">
                                    <span className="font-semibold text-slate-500">{esEmpresa ? 'RUC:' : 'DNI:'}</span>
                                    <span className="font-bold font-mono text-slate-800 bg-slate-100 px-2 py-0.5 rounded">
                                        {venta.cliente_documento}
                                    </span>
                                </div>
                            )}
                            {venta.cliente_email && (
                                <div className="flex justify-between py-1.5 border-b border-slate-100">
                                    <span className="font-semibold text-slate-500">Correo:</span>
                                    <span className="font-medium text-slate-700">{venta.cliente_email}</span>
                                </div>
                            )}
                            {venta.cliente_direccion && (
                                <div className="flex justify-between py-1.5 border-b border-slate-100">
                                    <span className="font-semibold text-slate-500">Dirección:</span>
                                    <span className="font-medium text-slate-700 text-right max-w-xs">{venta.cliente_direccion}</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Panel Pago */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div className="flex items-center gap-2.5">
                                <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-600 flex items-center justify-center text-xs border border-emerald-100">
                                    <FaDollarSign />
                                </div>
                                <div>
                                    <h2 className="font-bold text-slate-900 text-sm">Información de Pago</h2>
                                    <p className="text-xs text-slate-400 mt-0.5">Detalles de la transacción y operador</p>
                                </div>
                            </div>
                        </div>
                        <div className="p-6 space-y-3 text-xs">
                            <div className="flex justify-between py-1.5 border-b border-slate-100">
                                <span className="font-semibold text-slate-500">Método de Pago:</span>
                                <span className="font-bold text-slate-800 uppercase">{venta.metodo_pago || 'Efectivo'}</span>
                            </div>
                            {venta.usuario && (
                                <div className="flex justify-between py-1.5 border-b border-slate-100">
                                    <span className="font-semibold text-slate-500">Vendedor Asignado:</span>
                                    <span className="font-bold text-slate-800">{venta.usuario}</span>
                                </div>
                            )}
                            {venta.monto_pagado !== undefined && venta.monto_pagado !== null && (
                                <div className="flex justify-between py-1.5 border-b border-slate-100">
                                    <span className="font-semibold text-slate-500">Monto Entregado / Vuelto:</span>
                                    <span className="font-medium text-slate-700 tabular-nums">
                                        Entregado: <strong>{moneda(venta.monto_pagado)}</strong> {!!venta.vuelto && `· Vuelto: ${moneda(venta.vuelto)}`}
                                    </span>
                                </div>
                            )}
                            {venta.observaciones && (
                                <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-amber-900 text-[11px] mt-2">
                                    <strong>Notas:</strong> {venta.observaciones}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* ── Tabla Artículos ── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h2 className="font-bold text-slate-900 text-sm">Detalle de Artículos Vendidos</h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {venta.items?.length || 0} producto(s) en la transacción
                            </p>
                        </div>
                        <div className="flex items-center gap-4 text-xs font-bold">
                            <div className="flex items-center gap-1.5 text-slate-600">
                                <FaDollarSign className="text-emerald-500" />
                                Total: <span className="text-slate-900 font-black">{moneda(venta.total)}</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-slate-600">
                                <FaCoins className="text-indigo-500" />
                                Ganancia Neta: <span className="text-emerald-600 font-black">{moneda(venta.ganancia_total)}</span>
                            </div>
                        </div>
                    </div>

                    {!venta.items || venta.items.length === 0 ? (
                        <div className="p-12">
                            <EmptyState
                                icono={<FaBoxOpen />}
                                titulo="Sin detalles"
                                texto="Esta venta no cuenta con artículos asociados."
                            />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-xs">
                                <thead className="bg-slate-50 border-b border-slate-100 text-slate-500 font-semibold">
                                    <tr>
                                        <th className="px-5 py-3 text-left">Producto / SKU</th>
                                        <th className="px-4 py-3 text-right w-20">Cant.</th>
                                        <th className="px-4 py-3 text-right w-28">Costo Unit.</th>
                                        <th className="px-4 py-3 text-right w-32">Precio Venta</th>
                                        <th className="px-4 py-3 text-right w-32">Subtotal</th>
                                        <th className="px-5 py-3 text-right w-32">Ganancia Neta</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {venta.items.map((it, idx) => {
                                        const subtotalItem = it.cantidad * it.precio_venta;
                                        const gananciaItem = it.ganancia ?? ((it.precio_venta - (it.precio_costo || 0)) * it.cantidad);
                                        return (
                                            <tr key={idx} className="hover:bg-slate-50/60 transition-colors">
                                                <td className="px-5 py-3.5">
                                                    <div className="font-bold text-slate-800">{it.descripcion}</div>
                                                    <div className="text-[10px] text-slate-400 font-mono mt-0.5">{it.sku_producto}</div>
                                                </td>
                                                <td className="px-4 py-3.5 text-right font-bold text-slate-800 tabular-nums">{it.cantidad}</td>
                                                <td className="px-4 py-3.5 text-right text-slate-400 font-medium tabular-nums">{moneda(it.precio_costo || 0)}</td>
                                                <td className="px-4 py-3.5 text-right font-semibold text-slate-800 tabular-nums">{moneda(it.precio_venta)}</td>
                                                <td className="px-4 py-3.5 text-right font-bold text-slate-900 tabular-nums">{moneda(subtotalItem)}</td>
                                                <td className="px-5 py-3.5 text-right font-bold text-emerald-600 tabular-nums">{moneda(gananciaItem)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                                <tfoot className="bg-slate-50/80 border-t border-slate-200 font-bold">
                                    <tr>
                                        <td colSpan={4} className="px-5 py-3.5 text-right text-slate-600 uppercase text-[11px] tracking-wider">
                                            Totales Generales:
                                        </td>
                                        <td className="px-4 py-3.5 text-right text-slate-900 text-sm font-extrabold tabular-nums">
                                            {moneda(venta.total)}
                                        </td>
                                        <td className="px-5 py-3.5 text-right text-emerald-600 text-sm font-extrabold tabular-nums">
                                            {moneda(venta.ganancia_total)}
                                        </td>
                                    </tr>
                                </tfoot>
                            </table>
                        </div>
                    )}
                </div>

            </div>

            {mostrarComprobante && (
                <ComprobanteImprimible venta={venta} onCerrar={() => setMostrarComprobante(false)} />
            )}
            {mostrarCorreo && (
                <EnviarCorreoModal venta={venta} onCerrar={() => setMostrarCorreo(false)} />
            )}
        </div>
    );
}