'use client';
import { useState } from 'react';
import {
    FaArrowRight, FaExchangeAlt, FaPlus, FaSearch,
    FaSync, FaFilter, FaCalendarAlt
} from 'react-icons/fa';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { fechaLocal, hoy } from '@/lib/format';
import { useApi } from '@/hooks/useApi';
import type { Movimiento, Paginado, ResultadoMovimiento } from '@/types';
import Pagination from '@/components/ui/Pagination';
import { EmptyState, ErrorState, TablaSkeleton } from '@/components/ui/States';
import MovimientoModal from '@/components/kardex/MovimientoModal';
import ResultadoModal from '@/components/kardex/ResultadoModal';
import { TEXTO } from '@/components/kardex/constantes';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/Calendar';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

const TIPO_ESTILOS: Record<string, { bg: string; text: string; border: string }> = {
    ENTRADA: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
    SALIDA: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
    AJUSTE: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
};

const TEXTO_MAP = TEXTO as Record<string, string>;

export default function KardexPage() {
    const [q, setQ] = useState('');
    const [tipo, setTipo] = useState('');
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [page, setPage] = useState(1);
    const LIMIT = 25;

    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (q) params.set('q', q);
    if (tipo) params.set('tipo', tipo);
    if (desde) params.set('desde', desde);
    if (hasta) params.set('hasta', hasta);

    const lista = useApi<Paginado<Movimiento>>(`/api/kardex?${params}`);

    const [modalNuevo, setModalNuevo] = useState(false);
    const [resultado, setResultado] = useState<ResultadoMovimiento | null>(null);

    const cambiarFiltro = (fn: () => void) => { fn(); setPage(1); };
    const hayFiltros = !!(q || tipo || desde || hasta);

    const onGuardado = (r: ResultadoMovimiento) => {
        setModalNuevo(false);
        setResultado(r);
        lista.refetch();
    };

    const fechaDesdeObj = desde ? new Date(desde + 'T00:00:00') : undefined;
    const fechaHastaObj = hasta ? new Date(hasta + 'T00:00:00') : undefined;

    const formatearFecha = (d?: Date) => d ? format(d, "d 'de' MMMM, yyyy", { locale: es }) : 'Cualquier fecha';
    const aIso = (d: Date) => {
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    };

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

                {/* ── Header ── */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-1">Módulo Kardex</p>
                        <h1 className="text-3xl font-black text-slate-900 leading-tight">Historial de Stock</h1>
                        <p className="text-slate-500 text-sm mt-1.5 max-w-lg">
                            Registro detallado de trazabilidad: entradas, salidas, ajustes y variaciones de inventario.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => lista.refetch()}
                            disabled={lista.loading}
                            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50 shadow-xs">
                            <FaSync className={`text-slate-400 ${lista.loading ? 'animate-spin' : ''}`} />
                            Actualizar
                        </button>
                        <button
                            onClick={() => setModalNuevo(true)}
                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/20">
                            <FaPlus />
                            Registrar movimiento
                        </button>
                    </div>
                </div>

                {/* ── Filtros ── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5">
                    <div className="flex flex-col lg:flex-row gap-4 items-end">
                        {/* Búsqueda */}
                        <div className="flex-1 space-y-1.5 w-full">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                <FaSearch className="text-indigo-400" />
                                Buscar
                            </label>
                            <div className="relative">
                                <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-xs" />
                                <input
                                    type="text"
                                    value={q}
                                    onChange={e => cambiarFiltro(() => setQ(e.target.value))}
                                    placeholder="Buscar por SKU o nombre de producto…"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition placeholder:text-slate-300"
                                />
                            </div>
                        </div>

                        {/* Tipo Movimiento */}
                        <div className="w-full lg:w-48 space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                <FaFilter className="text-indigo-400" />
                                Tipo
                            </label>
                            <Select value={tipo || 'todos'} onValueChange={(v) => cambiarFiltro(() => setTipo(v === 'todos' || !v ? '' : v))}>
                                <SelectTrigger
                                    className="w-full bg-slate-50 border-slate-200 rounded-xl px-3.5 py-2.5 h-auto text-sm text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                                    style={{ width: '100%' }}
                                >
                                    <SelectValue placeholder="Todos los tipos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos los tipos</SelectItem>
                                    <SelectItem value="ENTRADA">Entradas</SelectItem>
                                    <SelectItem value="SALIDA">Salidas</SelectItem>
                                    <SelectItem value="AJUSTE">Ajustes</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {/* Fecha Desde */}
                        <div className="w-full lg:w-44 space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                <FaCalendarAlt className="text-indigo-400" />
                                Desde
                            </label>
                            <Popover>
                                <PopoverTrigger
                                    className="flex w-full items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium text-left hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
                                    style={{ width: '100%' }}
                                >
                                    <span className="truncate">{formatearFecha(fechaDesdeObj)}</span>
                                    <FaCalendarAlt className="text-indigo-400 text-xs shrink-0" />
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={fechaDesdeObj}
                                        onSelect={(d) => {
                                            if (!d) return;
                                            cambiarFiltro(() => setDesde(aIso(d)));
                                        }}
                                        disabled={(d) => (hasta ? d > fechaHastaObj! : d > new Date())}
                                        locale={es}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {/* Fecha Hasta */}
                        <div className="w-full lg:w-44 space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                <FaCalendarAlt className="text-indigo-400" />
                                Hasta
                            </label>
                            <Popover>
                                <PopoverTrigger
                                    className="flex w-full items-center justify-between gap-2 bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-sm text-slate-800 font-medium text-left hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer"
                                    style={{ width: '100%' }}
                                >
                                    <span className="truncate">{formatearFecha(fechaHastaObj)}</span>
                                    <FaCalendarAlt className="text-indigo-400 text-xs shrink-0" />
                                </PopoverTrigger>
                                <PopoverContent className="w-auto p-0" align="start">
                                    <Calendar
                                        mode="single"
                                        selected={fechaHastaObj}
                                        onSelect={(d) => {
                                            if (!d) return;
                                            cambiarFiltro(() => setHasta(aIso(d)));
                                        }}
                                        disabled={(d) => (desde ? d < fechaDesdeObj! : false) || d > new Date()}
                                        locale={es}
                                    />
                                </PopoverContent>
                            </Popover>
                        </div>

                        {hayFiltros && (
                            <button
                                onClick={() => { setQ(''); setTipo(''); setDesde(''); setHasta(''); setPage(1); }}
                                className="px-3.5 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600 bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer whitespace-nowrap">
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                </div>

                {/* ── Tabla ── */}
                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h2 className="font-bold text-slate-900 text-sm">Movimientos de stock</h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {lista.data ? `${lista.data.total} movimiento(s) registrado(s)` : 'Cargando…'}
                            </p>
                        </div>
                        {hayFiltros && (
                            <div className="flex gap-1.5">
                                {q && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold">
                                        <FaSearch style={{ fontSize: 9 }} /> {q}
                                    </span>
                                )}
                                {tipo && (
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold ${TIPO_ESTILOS[tipo]?.bg} ${TIPO_ESTILOS[tipo]?.text} ${TIPO_ESTILOS[tipo]?.border}`}>
                                        {TEXTO_MAP[tipo] ?? tipo}
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {lista.error ? (
                        <div className="px-6 py-8">
                            <ErrorState mensaje={lista.error} onReintentar={lista.refetch} />
                        </div>
                    ) : !lista.data ? (
                        <div className="px-6 py-8"><TablaSkeleton filas={6} /></div>
                    ) : lista.data.items.length === 0 ? (
                        <div className="px-6 py-12">
                            <EmptyState
                                icono={<FaExchangeAlt />}
                                titulo="Sin movimientos"
                                texto={hayFiltros ? 'Ningún movimiento coincide con los filtros aplicados.' : 'Registra el primer movimiento con el botón de arriba.'}
                                accion={hayFiltros
                                    ? <button onClick={() => { setQ(''); setTipo(''); setDesde(''); setHasta(''); setPage(1); }}
                                        className="mt-3 px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all cursor-pointer">
                                        Limpiar filtros
                                    </button>
                                    : undefined}
                            />
                        </div>
                    ) : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead className="bg-slate-50 border-b border-slate-100">
                                        <tr>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Fecha y Hora</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Producto / Variante</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Tipo</th>
                                            <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Cantidad</th>
                                            <th className="px-5 py-3 text-center text-xs font-semibold text-slate-500">Variación stock</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Referencia</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Usuario</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {lista.data.items.map((m) => {
                                            const subio = (m.stock_resultante ?? 0) >= (m.stock_anterior ?? 0);
                                            const estiloTipo = TIPO_ESTILOS[m.tipo] ?? { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };

                                            return (
                                                <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                                                    <td className="px-5 py-3.5 text-xs text-slate-500 font-mono whitespace-nowrap">
                                                        {fechaLocal(m.fecha)}
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        <div className="font-semibold text-slate-800 leading-tight">{m.nombre ?? m.sku}</div>
                                                        <div className="text-xs text-slate-400 font-mono mt-0.5">
                                                            {m.sku}{m.talla || m.color ? ` · ${[m.talla, m.color].filter(Boolean).join(' / ')}` : ''}
                                                        </div>
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${estiloTipo.bg} ${estiloTipo.text} ${estiloTipo.border}`}>
                                                            {TEXTO_MAP[m.tipo] ?? m.tipo}
                                                        </span>
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right font-bold tabular-nums">
                                                        {m.tipo === 'ENTRADA' && <span className="text-emerald-600">+{m.cantidad}</span>}
                                                        {m.tipo === 'SALIDA' && <span className="text-rose-600">−{m.cantidad}</span>}
                                                        {m.tipo === 'AJUSTE' && <span className={subio ? 'text-emerald-600' : 'text-rose-600'}>{subio ? '+' : '−'}{m.cantidad}</span>}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-center">
                                                        {m.stock_anterior !== null && m.stock_resultante !== null ? (
                                                            <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg bg-slate-100 text-xs font-semibold text-slate-700">
                                                                <span className="text-slate-500">{m.stock_anterior}</span>
                                                                <FaArrowRight className="text-[9px] text-slate-400" />
                                                                <span className="font-bold text-slate-900">{m.stock_resultante}</span>
                                                            </div>
                                                        ) : (
                                                            <span className="text-slate-300">—</span>
                                                        )}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-xs text-slate-600 max-w-xs truncate">
                                                        {m.referencia || <span className="text-slate-300">—</span>}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-xs font-medium text-slate-500">
                                                        {m.usuario ?? '—'}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            {/* Paginación */}
                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                                <Pagination page={page} limit={LIMIT} total={lista.data.total} onPage={setPage} />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── Modales ── */}
            {modalNuevo && <MovimientoModal onGuardado={onGuardado} onCerrar={() => setModalNuevo(false)} />}
            {resultado && <ResultadoModal r={resultado} onCerrar={() => setResultado(null)} />}
        </div>
    );
}