'use client';

import { useState } from 'react';
import { FaBoxOpen, FaCheck, FaDollarSign, FaExclamationTriangle, FaChartLine } from 'react-icons/fa';
import type { KpiData } from '../../lib/types';
import { entero, moneda } from '../../lib/format';

export default function MetricsBand({ kpis }: { kpis: KpiData }) {
    const [periodoGanancia, setPeriodoGanancia] = useState<'diario' | 'semanal' | 'mensual'>('diario');
    const hayAlertas = kpis.alertas_stock_bajo > 0;

    const gananciaActual =
        periodoGanancia === 'diario'
            ? kpis.ganancia_diaria ?? 0
            : periodoGanancia === 'semanal'
            ? kpis.ganancia_semanal ?? 0
            : kpis.ganancia_mensual ?? 0;

    const labelPeriodo =
        periodoGanancia === 'diario'
            ? 'Ganancias de hoy'
            : periodoGanancia === 'semanal'
            ? 'Ganancias esta semana'
            : 'Ganancias este mes';

    const hintPeriodo =
        periodoGanancia === 'diario'
            ? 'Margen de ventas de hoy'
            : periodoGanancia === 'semanal'
            ? 'Margen de últimos 7 días'
            : 'Margen acumulado del mes';

    return (
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Indicadores principales">
            {/* KPI 1: Productos */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Productos registrados</p>
                    <p className="text-2xl font-extrabold text-gray-800 mt-1">{entero(kpis.total_productos)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{entero(kpis.unidades_totales)} unidades en stock</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">
                    <FaBoxOpen />
                </div>
            </div>

            {/* KPI 2: Valor del stock */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center justify-between">
                <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Valor del stock</p>
                    <p className="text-2xl font-extrabold text-gray-800 mt-1">{moneda(kpis.stock_valorizado)}</p>
                    <p className="text-xs text-gray-400 mt-0.5">Valorizado a costo</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-xl shrink-0">
                    <FaDollarSign />
                </div>
            </div>

            {/* KPI 3: Ganancias con Conmutador Diario / Semanal / Mensual */}
            <div className="bg-white p-5 rounded-2xl border border-emerald-100/80 shadow-sm flex items-center justify-between relative overflow-hidden">
                <div className="flex-1 min-w-0 pr-2">
                    <div className="flex items-center justify-between mb-1 gap-1">
                        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider truncate">{labelPeriodo}</p>
                        {/* Selector de periodo pequeñito */}
                        <div className="inline-flex rounded-lg bg-gray-100 p-0.5 text-[10px] font-bold shrink-0">
                            {(['diario', 'semanal', 'mensual'] as const).map((p) => (
                                <button
                                    key={p}
                                    type="button"
                                    onClick={() => setPeriodoGanancia(p)}
                                    className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                                        periodoGanancia === p
                                            ? 'bg-emerald-600 text-white shadow-xs'
                                            : 'text-gray-500 hover:text-gray-900'
                                    }`}>
                                    {p === 'diario' ? 'Día' : p === 'semanal' ? 'Sem' : 'Mes'}
                                </button>
                            ))}
                        </div>
                    </div>
                    <p className="text-2xl font-extrabold text-emerald-600 mt-0.5">{moneda(gananciaActual)}</p>
                    <p className="text-xs text-gray-400 mt-0.5 truncate">{hintPeriodo}</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
                    <FaChartLine />
                </div>
            </div>

            {/* KPI 4: Alertas de Stock */}
            <div
                className={`bg-white p-5 rounded-2xl border shadow-sm flex items-center justify-between ${
                    hayAlertas ? 'border-amber-200 bg-amber-50/20' : 'border-gray-100'
                }`}>
                <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Productos por reponer</p>
                    <p className="text-2xl font-extrabold text-gray-800 mt-1">{kpis.alertas_stock_bajo}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                        {hayAlertas ? `${kpis.alertas_stock_bajo} bajo el stock mínimo` : 'Todos sobre su mínimo'}
                    </p>
                </div>
                <div
                    className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                        hayAlertas ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-600'
                    }`}>
                    {hayAlertas ? <FaExclamationTriangle /> : <FaCheck />}
                </div>
            </div>
        </section>
    );
}