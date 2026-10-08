'use client';
import { useState } from 'react';
import {
    FaChartLine, FaEye, FaPlus, FaSearch, FaSync,
    FaFileInvoice, FaDollarSign, FaCoins,
} from 'react-icons/fa';
import { moneda } from '@/lib/format';
import type { Paginado, ResultadoVenta } from '@/types';
import Button from '@/components/ui/Button';
import ComprobanteImprimible from '@/components/ventas/ComprobanteImprimible';
import NuevaVentaModal from '@/components/ventas/NuevaVentaModal';
import { useApi } from '@/hooks/useApi';
import { useRouter } from 'next/navigation';
import { EmptyState, ErrorState, TablaSkeleton } from '@/components/ui/States';

export default function VentasPage() {
    const router = useRouter();
    const [busqueda, setBusqueda] = useState('');
    const [modalAbierto, setModalAbierto] = useState(false);
    const [ventaEmitida, setVentaEmitida] = useState<ResultadoVenta | null>(null);

    const { data: ventasPaginadas, loading: cargandoVentas, error: errorVentas, refetch: recargarVentas } = useApi<Paginado<ResultadoVenta>>('/api/ventas?limit=100');

    const ventasFiltradas = ventasPaginadas?.items.filter(v =>
        v.cliente_nombre?.toLowerCase().includes(busqueda.toLowerCase()) ||
        `${v.serie}-${String(v.numero).padStart(6, '0')}`.toLowerCase().includes(busqueda.toLowerCase())
    ) || [];

    const totalRecaudado = ventasFiltradas.reduce((acc, v) => acc + (v.total || 0), 0);
    const totalGanancia = ventasFiltradas.reduce((acc, v) => acc + (v.ganancia_total || 0), 0);
    const cantidadVentas = ventasFiltradas.length;

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-1">Módulo de Ventas</p>
                        <h1 className="text-3xl font-black text-slate-900 leading-tight">Historial y Transacciones</h1>
                        <p className="text-slate-500 text-sm mt-1.5 max-w-lg">
                            Registro de comprobantes, recaudación diaria, margen de ganancias y detalle de ventas.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={recargarVentas}
                            disabled={cargandoVentas}
                            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50 shadow-xs">
                            <FaSync className={`text-slate-400 ${cargandoVentas ? 'animate-spin' : ''}`} />
                            Actualizar
                        </button>
                        <button
                            onClick={() => setModalAbierto(true)}
                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/20">
                            <FaPlus />
                            Nueva venta
                        </button>
                    </div>
                </div>

                {/* ── KPIs / Métricas rápidas ── */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Comprobantes emitidos</p>
                            <p className="text-2xl font-extrabold text-slate-800 mt-1">{cantidadVentas}</p>
                            <p className="text-xs text-slate-400 mt-0.5">Transacciones registradas</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">
                            <FaFileInvoice />
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Total recaudado</p>
                            <p className="text-2xl font-extrabold text-emerald-600 mt-1">{moneda(totalRecaudado)}</p>
                            <p className="text-xs text-slate-400 mt-0.5">Ingreso bruto acumulado</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
                            <FaDollarSign />
                        </div>
                    </div>

                    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                        <div>
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ganancia total</p>
                            <p className="text-2xl font-extrabold text-indigo-600 mt-1">{moneda(totalGanancia)}</p>
                            <p className="text-xs text-slate-400 mt-0.5">Margen neto proyectado</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0">
                            <FaCoins />
                        </div>
                    </div>
                </div>

                {/* ── Buscador ── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5">
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                <FaSearch className="text-indigo-400" />
                                Buscar venta
                            </label>
                            <div className="relative">
                                <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-xs" />
                                <input
                                    type="text"
                                    value={busqueda}
                                    onChange={(e) => setBusqueda(e.target.value)}
                                    placeholder="Buscar por cliente o número de comprobante (ej. B001-000001)…"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition placeholder:text-slate-300"
                                />
                            </div>
                        </div>

                        {busqueda && (
                            <button
                                onClick={() => setBusqueda('')}
                                className="px-3.5 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600 bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer whitespace-nowrap">
                                Limpiar búsqueda
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Tabla de Ventas ── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h2 className="font-bold text-slate-900 text-sm">Ventas realizadas</h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {ventasPaginadas ? `${ventasFiltradas.length} comprobante(s) registrado(s)` : 'Cargando…'}
                            </p>
                        </div>
                        {busqueda && (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold">
                                <FaSearch style={{ fontSize: 9 }} /> {busqueda}
                            </span>
                        )}
                    </div>

                    {errorVentas ? (
                        <div className="px-6 py-8">
                            <ErrorState mensaje={errorVentas} onReintentar={recargarVentas} />
                        </div>
                    ) : cargandoVentas ? (
                        <div className="px-6 py-8"><TablaSkeleton filas={5} /></div>
                    ) : ventasFiltradas.length === 0 ? (
                        <div className="px-6 py-12">
                            <EmptyState
                                icono={<FaChartLine />}
                                titulo="Sin ventas registradas"
                                texto={busqueda ? 'Ninguna venta coincide con la búsqueda.' : 'Aún no se han emitido comprobantes.'}
                                accion={busqueda
                                    ? <button onClick={() => setBusqueda('')}
                                        className="mt-3 px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all cursor-pointer">
                                        Limpiar búsqueda
                                    </button>
                                    : undefined}
                            />
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 border-b border-slate-100">
                                    <tr>
                                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Comprobante</th>
                                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Fecha y Hora</th>
                                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Cliente</th>
                                        <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Total</th>
                                        <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Ganancia</th>
                                        <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Acciones</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-50">
                                    {ventasFiltradas.map((v) => (
                                        <tr key={v.id} className="hover:bg-slate-50/60 transition-colors group">
                                            <td className="px-5 py-3.5">
                                                <div className="flex items-center gap-2">
                                                    <span className={`px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${v.tipo_comprobante === 'boleta'
                                                        ? 'bg-blue-50 text-blue-700 border-blue-200'
                                                        : 'bg-violet-50 text-violet-700 border-violet-200'
                                                        }`}>
                                                        {v.tipo_comprobante === 'boleta' ? 'BOL' : 'FAC'}
                                                    </span>
                                                    <span className="font-semibold text-slate-800 font-mono">
                                                        {v.serie}-{String(v.numero).padStart(6, '0')}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-5 py-3.5 text-slate-500 text-xs">
                                                {new Date(v.fecha).toLocaleString('es-PE', { dateStyle: 'short', timeStyle: 'short' })}
                                            </td>
                                            <td className="px-5 py-3.5 font-medium text-slate-700">
                                                {v.cliente_nombre || 'Cliente General'}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-bold text-slate-800 tabular-nums">
                                                {moneda(v.total)}
                                            </td>
                                            <td className="px-5 py-3.5 text-right font-bold text-emerald-600 tabular-nums">
                                                {moneda(v.ganancia_total)}
                                            </td>
                                            <td className="px-5 py-3.5 text-right">
                                                <button
                                                    onClick={() => router.push(`/ventas/${v.id}`)}
                                                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all cursor-pointer">
                                                    <FaEye style={{ fontSize: 11 }} />
                                                    Ver detalle
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>

            </div>

            {/* ── Modales ── */}
            {modalAbierto && (
                <NuevaVentaModal
                    onCerrar={() => setModalAbierto(false)}
                    onEmitida={(v) => { setModalAbierto(false); setVentaEmitida(v); recargarVentas(); }}
                />
            )}

            {ventaEmitida && <ComprobanteImprimible venta={ventaEmitida} onCerrar={() => setVentaEmitida(null)} />}
        </div>
    );
}