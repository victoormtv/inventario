'use client';

import { useState, useEffect } from 'react';
import {
    FaFileExcel,
    FaCalendarAlt,
    FaSpinner,
    FaExclamationCircle,
    FaDownload,
    FaFilter,
    FaRegCalendarCheck,
    FaSearch,
    FaTag,
    FaChartLine,
    FaBoxes,
    FaListAlt,
    FaLayerGroup,
    FaCheckCircle,
} from 'react-icons/fa';
import { api, descargar } from '../lib/api';

type HojaExcel = 'dashboard' | 'kardex' | 'resumen' | 'stock' | 'ganancias';

const HOJAS: { key: HojaExcel; label: string; desc: string; icon: React.ReactNode; color: string }[] = [
    {
        key: 'dashboard',
        label: 'Dashboard Ejecutivo',
        desc: 'KPIs, resumen mensual y alertas',
        icon: <FaChartLine />,
        color: 'indigo',
    },
    {
        key: 'kardex',
        label: 'Kardex de Movimientos',
        desc: 'Entradas, salidas y ajustes cronológicos',
        icon: <FaListAlt />,
        color: 'blue',
    },
    {
        key: 'resumen',
        label: 'Resumen por Producto',
        desc: 'Totales agrupados por SKU y categoría',
        icon: <FaLayerGroup />,
        color: 'teal',
    },
    {
        key: 'stock',
        label: 'Stock Actual',
        desc: 'Inventario completo con alertas de mínimos',
        icon: <FaBoxes />,
        color: 'emerald',
    },
    {
        key: 'ganancias',
        label: 'Análisis de Ganancias',
        desc: 'Rentabilidad, márgenes y ventas estimadas',
        icon: <FaChartLine />,
        color: 'violet',
    },
];

const COLOR_MAP: Record<string, string> = {
    indigo: 'bg-indigo-50 text-indigo-700 border-indigo-200 ring-indigo-500',
    blue: 'bg-blue-50 text-blue-700 border-blue-200 ring-blue-500',
    teal: 'bg-teal-50 text-teal-700 border-teal-200 ring-teal-500',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-200 ring-emerald-500',
    violet: 'bg-violet-50 text-violet-700 border-violet-200 ring-violet-500',
};

const ICON_MAP: Record<string, string> = {
    indigo: 'bg-indigo-100 text-indigo-600',
    blue: 'bg-blue-100 text-blue-600',
    teal: 'bg-teal-100 text-teal-600',
    emerald: 'bg-emerald-100 text-emerald-600',
    violet: 'bg-violet-100 text-violet-600',
};

export default function ReportesPage() {
    const hoy = new Date();
    const hoyIso = hoy.toISOString().split('T')[0];
    const primerDiaMesIso = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];

    const [desde, setDesde] = useState(primerDiaMesIso);
    const [hasta, setHasta] = useState(hoyIso);
    const [busqueda, setBusqueda] = useState('');
    const [categoria, setCategoria] = useState('');
    const [categorias, setCategorias] = useState<string[]>([]);
    const [hojasSeleccionadas, setHojasSeleccionadas] = useState<Set<HojaExcel>>(
        new Set(['dashboard', 'kardex', 'resumen', 'stock', 'ganancias'])
    );
    const [presetActivo, setPresetActivo] = useState<string>('este_mes');
    const [cargando, setCargando] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [exito, setExito] = useState(false);

    useEffect(() => {
        api<string[]>('/api/categorias')
            .then(setCategorias)
            .catch(() => { });
    }, []);

    const aplicarPreset = (preset: string) => {
        setPresetActivo(preset);
        const ahora = new Date();
        let fDesde = new Date(ahora);
        let fHasta = new Date(ahora);

        if (preset === 'hoy') {
            // ambos = hoy
        } else if (preset === '7dias') {
            fDesde.setDate(ahora.getDate() - 7);
        } else if (preset === '30dias') {
            fDesde.setDate(ahora.getDate() - 30);
        } else if (preset === 'este_mes') {
            fDesde = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
        } else if (preset === 'mes_anterior') {
            fDesde = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
            fHasta = new Date(ahora.getFullYear(), ahora.getMonth(), 0);
        } else if (preset === 'este_anio') {
            fDesde = new Date(ahora.getFullYear(), 0, 1);
        }

        setDesde(fDesde.toISOString().split('T')[0]);
        setHasta(fHasta.toISOString().split('T')[0]);
    };

    const toggleHoja = (key: HojaExcel) => {
        setHojasSeleccionadas((prev) => {
            const next = new Set(prev);
            if (next.has(key)) {
                if (next.size === 1) return prev; // mínimo 1
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const seleccionarTodas = () => setHojasSeleccionadas(new Set(HOJAS.map((h) => h.key)));
    const deseleccionarTodas = () => setHojasSeleccionadas(new Set(['dashboard']));

    const handleDescargar = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setExito(false);
        setCargando(true);
        try {
            const params = new URLSearchParams();
            if (desde) params.set('desde', desde);
            if (hasta) params.set('hasta', hasta);
            if (busqueda.trim()) params.set('q', busqueda.trim());
            if (categoria) params.set('categoria', categoria);
            params.set('hojas', [...hojasSeleccionadas].join(','));

            const nombre = `reporte_pro_${desde}_a_${hasta}.xlsx`;
            await descargar(`/api/exportar/excel-pro?${params.toString()}`, nombre);
            setExito(true);
            setTimeout(() => setExito(false), 4000);
        } catch (err) {
            setError((err as Error).message || 'No se pudo generar el reporte.');
        } finally {
            setCargando(false);
        }
    };

    const totalHojas = hojasSeleccionadas.size;

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-6xl mx-auto px-4 py-8 space-y-8">

                {/* Header */}
                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-1">Módulo de Reportes</p>
                        <h1 className="text-3xl font-black text-slate-900 leading-tight">Exportación Excel Pro</h1>
                        <p className="text-slate-500 text-sm mt-1.5 max-w-lg">
                            Genera libros Excel profesionales con dashboard ejecutivo, kardex, rentabilidad y stock — todo en un solo archivo.
                        </p>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-slate-500 bg-white border border-slate-200 rounded-xl px-4 py-2.5 shadow-xs">
                        <FaCalendarAlt className="text-indigo-500" />
                        <span className="font-medium text-slate-700">{new Date().toLocaleDateString('es-PE', { day: 'numeric', month: 'long', year: 'numeric' })}</span>
                    </div>
                </div>

                <form onSubmit={handleDescargar} className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-6 items-start">

                    {/* Panel izquierdo: Hojas */}
                    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                            <div>
                                <h2 className="font-bold text-slate-900 text-sm">Hojas del Excel</h2>
                                <p className="text-xs text-slate-400 mt-0.5">{totalHojas} de {HOJAS.length} seleccionadas</p>
                            </div>
                            <div className="flex gap-2">
                                <button type="button" onClick={seleccionarTodas} className="text-xs text-indigo-600 hover:text-indigo-800 font-semibold cursor-pointer">Todas</button>
                                <span className="text-slate-300">·</span>
                                <button type="button" onClick={deseleccionarTodas} className="text-xs text-slate-400 hover:text-slate-600 font-medium cursor-pointer">Limpiar</button>
                            </div>
                        </div>

                        <div className="divide-y divide-slate-50">
                            {HOJAS.map((hoja) => {
                                const activa = hojasSeleccionadas.has(hoja.key);
                                return (
                                    <button
                                        key={hoja.key}
                                        type="button"
                                        onClick={() => toggleHoja(hoja.key)}
                                        className={`w-full text-left px-5 py-3.5 flex items-center gap-3.5 transition-all duration-150 cursor-pointer group ${activa ? 'bg-slate-50' : 'hover:bg-slate-50/60'
                                            }`}>
                                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0 transition-all ${activa ? ICON_MAP[hoja.color] : 'bg-slate-100 text-slate-400'
                                            }`}>
                                            {hoja.icon}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className={`text-sm font-semibold truncate ${activa ? 'text-slate-800' : 'text-slate-400'}`}>
                                                {hoja.label}
                                            </div>
                                            <div className={`text-xs truncate mt-0.5 ${activa ? 'text-slate-400' : 'text-slate-300'}`}>
                                                {hoja.desc}
                                            </div>
                                        </div>
                                        <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center shrink-0 transition-all ${activa
                                                ? `border-indigo-500 bg-indigo-500 text-white`
                                                : 'border-slate-200 bg-white'
                                            }`}>
                                            {activa && <svg className="w-3 h-3" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>}
                                        </div>
                                    </button>
                                );
                            })}
                        </div>

                        {/* Preview de hojas */}
                        <div className="px-5 py-4 bg-slate-50 border-t border-slate-100">
                            <p className="text-xs font-semibold text-slate-500 mb-2.5">Vista previa del libro</p>
                            <div className="flex flex-wrap gap-1.5">
                                {HOJAS.filter(h => hojasSeleccionadas.has(h.key)).map(h => (
                                    <span key={h.key} className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs font-medium ${COLOR_MAP[h.color]}`}>
                                        <span className="text-[10px]">{h.icon}</span>
                                        {h.label.split(' ')[0]}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Panel derecho: Filtros + acción */}
                    <div className="space-y-5">

                        {/* Presets */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5">
                            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                                <FaFilter className="text-indigo-400" />
                                Rango rápido
                            </label>
                            <div className="flex flex-wrap gap-2">
                                {[
                                    { key: 'hoy', label: 'Hoy' },
                                    { key: '7dias', label: 'Últ. 7 días' },
                                    { key: 'este_mes', label: 'Este mes' },
                                    { key: 'mes_anterior', label: 'Mes anterior' },
                                    { key: '30dias', label: 'Últ. 30 días' },
                                    { key: 'este_anio', label: 'Este año' },
                                ].map((p) => (
                                    <button
                                        key={p.key}
                                        type="button"
                                        onClick={() => aplicarPreset(p.key)}
                                        className={`px-3.5 py-2 text-xs font-semibold rounded-lg border transition-all duration-150 cursor-pointer ${presetActivo === p.key
                                                ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                                                : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                                            }`}>
                                        {p.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Filtros detallados */}
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5 space-y-5">
                            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                                <FaFilter className="text-indigo-400 text-xs" />
                                Filtros de datos
                            </h3>

                            {/* Fechas */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                                        <FaRegCalendarCheck className="text-indigo-400" />
                                        Desde
                                    </label>
                                    <input
                                        type="date"
                                        value={desde}
                                        onChange={(e) => { setDesde(e.target.value); setPresetActivo('personalizado'); }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                                        required
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                                        <FaRegCalendarCheck className="text-indigo-400" />
                                        Hasta
                                    </label>
                                    <input
                                        type="date"
                                        value={hasta}
                                        onChange={(e) => { setHasta(e.target.value); setPresetActivo('personalizado'); }}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Búsqueda y categoría */}
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                                        <FaSearch className="text-indigo-400" />
                                        Producto / SKU / Lote
                                    </label>
                                    <input
                                        type="text"
                                        placeholder="Ej: POL-001, Lote 2026..."
                                        value={busqueda}
                                        onChange={(e) => setBusqueda(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition placeholder:text-slate-300"
                                    />
                                </div>
                                <div className="space-y-1.5">
                                    <label className="block text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                                        <FaTag className="text-indigo-400" />
                                        Categoría
                                    </label>
                                    <select
                                        value={categoria}
                                        onChange={(e) => setCategoria(e.target.value)}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition cursor-pointer">
                                        <option value="">Todas las categorías</option>
                                        {categorias.map((cat) => (
                                            <option key={cat} value={cat}>{cat}</option>
                                        ))}
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Resumen de lo que se va a generar */}
                        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-6 py-4">
                            <div className="flex items-start gap-3">
                                <FaFileExcel className="text-indigo-600 text-lg mt-0.5 shrink-0" />
                                <div className="flex-1">
                                    <p className="text-sm font-semibold text-indigo-800">
                                        Se generará un libro Excel con {totalHojas} hoja{totalHojas !== 1 ? 's' : ''}
                                    </p>
                                    <p className="text-xs text-indigo-600 mt-1">
                                        Período: <strong>{desde}</strong> → <strong>{hasta}</strong>
                                        {busqueda && <> · Filtro: <strong>{busqueda}</strong></>}
                                        {categoria && <> · Categoría: <strong>{categoria}</strong></>}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="p-4 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 flex items-center gap-3">
                                <FaExclamationCircle className="shrink-0 text-red-500" />
                                <span>{error}</span>
                            </div>
                        )}

                        {/* Éxito */}
                        {exito && (
                            <div className="p-4 bg-emerald-50 text-emerald-700 text-sm rounded-xl border border-emerald-100 flex items-center gap-3">
                                <FaCheckCircle className="shrink-0 text-emerald-500" />
                                <span>Excel generado y descargado correctamente.</span>
                            </div>
                        )}

                        {/* Botón */}
                        <button
                            type="submit"
                            disabled={cargando}
                            className="w-full bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 text-white font-bold py-4 px-8 rounded-2xl flex items-center justify-center gap-3 transition-all shadow-lg shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer text-sm">
                            {cargando ? (
                                <>
                                    <FaSpinner className="animate-spin text-lg" />
                                    <span>Generando libro Excel...</span>
                                </>
                            ) : (
                                <>
                                    <FaDownload className="text-lg" />
                                    <span>Descargar Excel Pro</span>
                                    <span className="ml-auto bg-white/20 text-white text-xs font-bold px-2.5 py-1 rounded-lg">
                                        {totalHojas} hojas
                                    </span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}