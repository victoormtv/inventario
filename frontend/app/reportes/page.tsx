'use client';

import { useState, useEffect } from 'react';
import {
    FaFileExcel,
    FaFilePdf,
    FaCalendarAlt,
    FaSpinner,
    FaExclamationCircle,
    FaDownload,
    FaFilter,
    FaLayerGroup,
    FaRegCalendarCheck,
    FaSearch,
    FaTag,
} from 'react-icons/fa';
import { api, descargar } from '../lib/api';

export default function ReportesPage() {
    const hoy = new Date();
    const hoyIso = hoy.toISOString().split('T')[0];
    const primerDiaMesIso = new Date(hoy.getFullYear(), hoy.getMonth(), 1).toISOString().split('T')[0];

    // Filtros de búsqueda y rango
    const [desde, setDesde] = useState(primerDiaMesIso);
    const [hasta, setHasta] = useState(hoyIso);
    const [busqueda, setBusqueda] = useState('');
    const [categoria, setCategoria] = useState('');
    const [categorias, setCategorias] = useState<string[]>([]);
    const [tipoReporte, setTipoReporte] = useState<'consolidado' | 'kardex'>('consolidado');
    const [presetActivo, setPresetActivo] = useState<string>('este_mes');

    // Estados de carga y error
    const [cargandoRango, setCargandoRango] = useState(false);
    const [errorRango, setErrorRango] = useState<string | null>(null);

    // Cargar categorías disponibles
    useEffect(() => {
        api<string[]>('/api/categorias')
            .then(setCategorias)
            .catch(() => {});
    }, []);

    // Aplicar presets de fecha
    const aplicarPreset = (preset: string) => {
        setPresetActivo(preset);
        const ahora = new Date();
        let fDesde = new Date();
        let fHasta = new Date();

        if (preset === 'hoy') {
            fDesde = ahora;
            fHasta = ahora;
        } else if (preset === '7dias') {
            fDesde.setDate(ahora.getDate() - 7);
        } else if (preset === '30dias') {
            fDesde.setDate(ahora.getDate() - 30);
        } else if (preset === 'este_mes') {
            fDesde = new Date(ahora.getFullYear(), ahora.getMonth(), 1);
            fHasta = ahora;
        } else if (preset === 'mes_anterior') {
            fDesde = new Date(ahora.getFullYear(), ahora.getMonth() - 1, 1);
            fHasta = new Date(ahora.getFullYear(), ahora.getMonth(), 0);
        } else if (preset === 'este_anio') {
            fDesde = new Date(ahora.getFullYear(), 0, 1);
            fHasta = ahora;
        }

        setDesde(fDesde.toISOString().split('T')[0]);
        setHasta(fHasta.toISOString().split('T')[0]);
    };

    const handleDescargarGeneral = async (tipo: 'excel' | 'pdf') => {
        try {
            if (tipo === 'excel') {
                await descargar('/api/exportar/excel', `inventario_${hoyIso}.xlsx`);
            } else {
                await descargar('/api/exportar/pdf', `inventario_${hoyIso}.pdf`);
            }
        } catch (e) {
            alert((e as Error).message || 'Error al descargar el archivo.');
        }
    };

    const handleDescargarRango = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorRango(null);
        setCargandoRango(true);
        try {
            const params = new URLSearchParams();
            if (desde) params.set('desde', desde);
            if (hasta) params.set('hasta', hasta);
            if (busqueda.trim()) params.set('q', busqueda.trim());
            if (categoria) params.set('categoria', categoria);

            const endpoint = tipoReporte === 'kardex' ? '/api/exportar/kardex' : '/api/exportar/excel-rango';
            const prefix = tipoReporte === 'kardex' ? 'kardex' : 'reporte_inventario';
            const nombre = `${prefix}_${desde || 'inicio'}_a_${hasta || 'fin'}.xlsx`;

            await descargar(`${endpoint}?${params.toString()}`, nombre);
        } catch (err) {
            setErrorRango((err as Error).message || 'No se pudo generar el reporte en Excel.');
        } finally {
            setCargandoRango(false);
        }
    };

    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-12">
            {/* Encabezado Principal */}
            <div>
                <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Reportes y Exportación</h1>
                <p className="text-gray-500 text-sm mt-1">
                    Genera informes ejecutivos en Excel con filtros avanzados por fechas, productos, categorías y lotes.
                </p>
            </div>

            {/* Accesos Rápidos de Descarga Inmediata */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <button
                    onClick={() => handleDescargarGeneral('excel')}
                    className="group relative bg-gradient-to-br from-emerald-600 to-teal-700 hover:from-emerald-500 hover:to-teal-600 text-white p-6 rounded-2xl font-semibold flex items-center justify-between shadow-lg shadow-emerald-600/10 hover:shadow-emerald-600/20 transition-all duration-200 cursor-pointer overflow-hidden border border-emerald-500/20">
                    <div className="flex items-center gap-4 z-10">
                        <div className="p-3 bg-white/15 backdrop-blur-md rounded-xl text-white group-hover:scale-110 transition duration-200">
                            <FaFileExcel className="text-3xl" />
                        </div>
                        <div>
                            <div className="text-lg font-bold">Inventario Completo en Excel</div>
                            <div className="text-xs text-emerald-100 font-normal">Descarga inmediata de productos y variantes</div>
                        </div>
                    </div>
                    <FaDownload className="text-emerald-200 text-xl group-hover:translate-y-0.5 transition" />
                </button>

                <button
                    onClick={() => handleDescargarGeneral('pdf')}
                    className="group relative bg-gradient-to-br from-rose-600 to-pink-700 hover:from-rose-500 hover:to-pink-600 text-white p-6 rounded-2xl font-semibold flex items-center justify-between shadow-lg shadow-rose-600/10 hover:shadow-rose-600/20 transition-all duration-200 cursor-pointer overflow-hidden border border-rose-500/20">
                    <div className="flex items-center gap-4 z-10">
                        <div className="p-3 bg-white/15 backdrop-blur-md rounded-xl text-white group-hover:scale-110 transition duration-200">
                            <FaFilePdf className="text-3xl" />
                        </div>
                        <div>
                            <div className="text-lg font-bold">Reporte Ejecutivo PDF</div>
                            <div className="text-xs text-rose-100 font-normal">Formato imprimible con alerta de stock bajo</div>
                        </div>
                    </div>
                    <FaDownload className="text-rose-200 text-xl group-hover:translate-y-0.5 transition" />
                </button>
            </div>

            {/* Panel Principal: Filtros por Fechas, Productos y Categorías */}
            <div className="bg-white rounded-3xl p-7 shadow-sm border border-gray-100 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-5">
                    <div className="flex items-center gap-3">
                        <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl border border-emerald-100">
                            <FaCalendarAlt className="text-2xl" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold text-gray-900">Generador de Excel Personalizado</h2>
                            <p className="text-xs text-gray-500 mt-0.5">Filtra por producto, lote, referencia, categoría y rango de fechas.</p>
                        </div>
                    </div>
                </div>

                {/* Atajos Rápidos de Rango */}
                <div>
                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-wider mb-2.5 flex items-center gap-1.5">
                        <FaFilter className="text-emerald-500" />
                        <span>Atajos de Fecha Rápida</span>
                    </label>
                    <div className="flex flex-wrap gap-2">
                        {[
                            { key: 'hoy', label: 'Hoy' },
                            { key: '7dias', label: 'Últimos 7 días' },
                            { key: 'este_mes', label: 'Este Mes' },
                            { key: 'mes_anterior', label: 'Mes Anterior' },
                            { key: '30dias', label: 'Últimos 30 días' },
                            { key: 'este_anio', label: 'Este Año' },
                        ].map((p) => (
                            <button
                                key={p.key}
                                type="button"
                                onClick={() => aplicarPreset(p.key)}
                                className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all duration-150 cursor-pointer ${
                                    presetActivo === p.key
                                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20 scale-105'
                                        : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                                }`}>
                                {p.label}
                            </button>
                        ))}
                    </div>
                </div>

                <form onSubmit={handleDescargarRango} className="space-y-6 pt-2">
                    {/* Fila 1: Filtro de Producto/Lote y Categoría */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                <FaSearch className="text-emerald-600" />
                                <span>Buscar Producto, SKU o Lote / Referencia</span>
                            </label>
                            <input
                                type="text"
                                placeholder="Ej: POL-001, Lote 2026, Polo..."
                                value={busqueda}
                                onChange={(e) => setBusqueda(e.target.value)}
                                className="w-full bg-gray-50/50 border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                <FaTag className="text-emerald-600" />
                                <span>Filtrar por Categoría</span>
                            </label>
                            <select
                                value={categoria}
                                onChange={(e) => setCategoria(e.target.value)}
                                className="w-full bg-gray-50/50 border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition cursor-pointer">
                                <option value="">Todas las categorías</option>
                                {categorias.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Fila 2: Fechas y Estructura */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                <FaRegCalendarCheck className="text-emerald-600" />
                                <span>Fecha Desde</span>
                            </label>
                            <input
                                type="date"
                                value={desde}
                                onChange={(e) => {
                                    setDesde(e.target.value);
                                    setPresetActivo('personalizado');
                                }}
                                className="w-full bg-gray-50/50 border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                <FaRegCalendarCheck className="text-emerald-600" />
                                <span>Fecha Hasta</span>
                            </label>
                            <input
                                type="date"
                                value={hasta}
                                onChange={(e) => {
                                    setHasta(e.target.value);
                                    setPresetActivo('personalizado');
                                }}
                                className="w-full bg-gray-50/50 border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 font-medium focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                                required
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="block text-xs font-bold text-gray-700 flex items-center gap-1.5">
                                <FaLayerGroup className="text-emerald-600" />
                                <span>Estructura del Excel</span>
                            </label>
                            <select
                                value={tipoReporte}
                                onChange={(e) => setTipoReporte(e.target.value as 'consolidado' | 'kardex')}
                                className="w-full bg-gray-50/50 border border-gray-200 hover:border-gray-300 rounded-xl px-4 py-3 text-sm text-gray-800 font-semibold focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition cursor-pointer">
                                <option value="consolidado">Consolidado (Kardex + Resumen + Stock)</option>
                                <option value="kardex">Detalle de Movimientos (Kardex)</option>
                            </select>
                        </div>
                    </div>

                    {errorRango && (
                        <div className="p-4 bg-red-50 text-red-700 text-sm rounded-2xl border border-red-100 flex items-center gap-3">
                            <FaExclamationCircle className="shrink-0 text-red-500 text-lg" />
                            <span>{errorRango}</span>
                        </div>
                    )}

                    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-2">
                        <div className="text-xs text-gray-400 font-medium">
                            Se generará un archivo <strong className="text-gray-700">.xlsx</strong> con filtros aplicados.
                        </div>

                        <button
                            type="submit"
                            disabled={cargandoRango}
                            className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold py-3.5 px-8 rounded-xl flex items-center justify-center gap-3 transition shadow-lg shadow-emerald-600/20 disabled:opacity-50 cursor-pointer">
                            {cargandoRango ? (
                                <>
                                    <FaSpinner className="animate-spin text-lg" />
                                    <span>Generando Excel...</span>
                                </>
                            ) : (
                                <>
                                    <FaFileExcel className="text-xl" />
                                    <span>Descargar Excel Filtrado</span>
                                </>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}