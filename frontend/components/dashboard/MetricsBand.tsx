'use client';

import { useState } from 'react';
import { FaBoxOpen, FaCheck, FaDollarSign, FaExclamationTriangle, FaChartLine, FaTrophy, FaShoppingBag } from 'react-icons/fa';
import type { KpiData } from '@/types';
import { entero, moneda } from '@/lib/format';

type Periodo = 'diario' | 'semanal' | 'mensual';

const PERIODOS: { key: Periodo; corto: string; label: string; hint: string }[] = [
    { key: 'diario', corto: 'Día', label: 'Ganancias de hoy', hint: 'Margen de ventas de hoy' },
    { key: 'semanal', corto: 'Sem', label: 'Ganancias esta semana', hint: 'Margen de últimos 7 días' },
    { key: 'mensual', corto: 'Mes', label: 'Ganancias este mes', hint: 'Margen acumulado del mes' },
];

function PeriodoToggle({ valor, onChange }: { valor: Periodo; onChange: (p: Periodo) => void }) {
    return (
        <div className="inline-flex rounded-lg bg-slate-100 p-0.5 text-[10px] font-bold shrink-0">
            {PERIODOS.map(p => (
                <button
                    key={p.key}
                    type="button"
                    onClick={() => onChange(p.key)}
                    className={`px-2 py-0.5 rounded-md transition cursor-pointer ${valor === p.key
                        ? 'bg-indigo-600 text-white shadow-sm'
                        : 'text-slate-500 hover:text-slate-900'}`}>
                    {p.corto}
                </button>
            ))}
        </div>
    );
}

export default function MetricsBand({ kpis }: { kpis: KpiData }) {
    const [periodoGanancia, setPeriodoGanancia] = useState<Periodo>('diario');
    const [periodoTop, setPeriodoTop] = useState<Periodo>('diario');
    const [periodoProductos, setPeriodoProductos] = useState<Periodo>('diario');

    const hayAlertas = kpis.alertas_stock_bajo > 0;

    const pGanancia = PERIODOS.find(x => x.key === periodoGanancia)!;
    const ganancia =
        periodoGanancia === 'diario' ? kpis.ganancia_diaria ?? 0 :
            periodoGanancia === 'semanal' ? kpis.ganancia_semanal ?? 0 :
                kpis.ganancia_mensual ?? 0;

    const top =
        periodoTop === 'diario' ? kpis.top_diario :
            periodoTop === 'semanal' ? kpis.top_semanal :
                kpis.top_mensual;

    return (
        <div className="space-y-4">
            <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4" aria-label="Indicadores principales">
                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Productos registrados</p>
                        <p className="text-2xl font-extrabold text-slate-800 mt-1">{entero(kpis.total_productos)}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{entero(kpis.unidades_totales)} unidades en stock</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">
                        <FaBoxOpen />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Valor del stock</p>
                        <p className="text-2xl font-extrabold text-slate-800 mt-1">{moneda(kpis.stock_valorizado)}</p>
                        <p className="text-xs text-slate-400 mt-0.5">Valorizado a costo</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-teal-50 text-teal-600 flex items-center justify-center text-xl shrink-0">
                        <FaDollarSign />
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-emerald-100 shadow-sm flex items-center justify-between">
                    <div className="flex-1 min-w-0 pr-2">
                        <div className="flex items-center justify-between mb-1 gap-1">
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">{pGanancia.label}</p>
                            <PeriodoToggle valor={periodoGanancia} onChange={setPeriodoGanancia} />
                        </div>
                        <p className="text-2xl font-extrabold text-emerald-600 mt-0.5">{moneda(ganancia)}</p>
                        <p className="text-xs text-slate-400 mt-0.5 truncate">{pGanancia.hint}</p>
                    </div>
                    <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
                        <FaChartLine />
                    </div>
                </div>

                <div className={`bg-white p-5 rounded-2xl border shadow-sm flex items-center justify-between ${hayAlertas ? 'border-amber-200 bg-amber-50/20' : 'border-slate-200'}`}>
                    <div>
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Productos por reponer</p>
                        <p className="text-2xl font-extrabold text-slate-800 mt-1">{kpis.alertas_stock_bajo}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                            {hayAlertas ? `${kpis.alertas_stock_bajo} bajo el stock mínimo` : 'Todos sobre su mínimo'}
                        </p>
                    </div>
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${hayAlertas ? 'bg-amber-100 text-amber-700' : 'bg-emerald-50 text-emerald-600'}`}>
                        {hayAlertas ? <FaExclamationTriangle /> : <FaCheck />}
                    </div>
                </div>

                <div className="bg-white p-5 rounded-2xl border border-indigo-100 shadow-sm col-span-1 sm:col-span-2 lg:col-span-4">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <FaTrophy className="text-indigo-600 text-base" />
                            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Producto más vendido</p>
                        </div>
                        <PeriodoToggle valor={periodoTop} onChange={setPeriodoTop} />
                    </div>
                    {top ? (
                        <div className="flex items-center justify-between gap-4 bg-indigo-50/50 p-3 rounded-xl">
                            <div className="flex items-center gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center text-lg shrink-0">
                                    <FaShoppingBag />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-bold text-slate-800 text-sm truncate">{top.nombre}</p>
                                    <p className="text-xs font-mono text-slate-400">{top.sku}</p>
                                </div>
                            </div>
                            <div className="text-right shrink-0">
                                <span className="text-lg font-extrabold text-indigo-600">{entero(top.unidades)} u.</span>
                                <span className="text-xs font-bold text-emerald-600 block">{moneda(top.ganancia)}</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-sm text-slate-400 py-2">Sin ventas registradas en este período.</p>
                    )}
                </div>
            </section>

            <section className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-4">
                    <div>
                        <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">Ganancia por producto</h3>
                        <p className="text-xs text-slate-400">Desglose detallado de márgenes por artículo</p>
                    </div>
                    <PeriodoToggle valor={periodoProductos} onChange={setPeriodoProductos} />
                </div>

                {(() => {
                    const items =
                        periodoProductos === 'diario' ? kpis.ganancia_por_producto_diaria :
                            periodoProductos === 'semanal' ? kpis.ganancia_por_producto_semanal :
                                kpis.ganancia_por_producto_mensual;

                    if (!items || items.length === 0)
                        return <p className="text-sm text-slate-400 py-4 text-center">Sin ventas registradas en este período.</p>;

                    const maxGanancia = Math.max(...items.map(i => i.ganancia), 1);

                    return (
                        <div className="space-y-3">
                            {items.map(item => (
                                <div key={item.sku} className="p-2 hover:bg-slate-50 rounded-xl transition">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-2 min-w-0">
                                            <span className="text-xs font-bold text-slate-700 truncate">{item.nombre}</span>
                                            <span className="text-[10px] font-mono bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded shrink-0">{item.unidades} u.</span>
                                        </div>
                                        <span className="text-xs font-extrabold text-emerald-600 shrink-0 ml-2">{moneda(item.ganancia)}</span>
                                    </div>
                                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                                            style={{ width: `${(item.ganancia / maxGanancia) * 100}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    );
                })()}
            </section>
        </div>
    );
}
