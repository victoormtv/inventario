'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  FaBoxOpen, FaCoins, FaExclamationTriangle, FaLayerGroup,
  FaSync, FaTrophy, FaWarehouse,
} from 'react-icons/fa';
import { useApi } from '@/hooks/useApi';
import { entero, fechaLocal, moneda } from '@/lib/format';
import type { KpiData, Movimiento, Paginado } from '@/types';
import { EmptyState, ErrorState, TablaSkeleton } from '@/components/ui/States';

type Periodo = 'diaria' | 'semanal' | 'mensual';

const PERIODOS: { id: Periodo; label: string }[] = [
  { id: 'diaria', label: 'Hoy' },
  { id: 'semanal', label: '7 días' },
  { id: 'mensual', label: 'Mes' },
];

const TIPO_STYLE: Record<string, string> = {
  ENTRADA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  SALIDA: 'bg-red-50 text-red-700 border-red-200',
  AJUSTE: 'bg-amber-50 text-amber-700 border-amber-200',
};

export default function DashboardPage() {
  const kpis = useApi<KpiData>('/api/dashboard/kpis');
  const movimientos = useApi<Paginado<Movimiento>>('/api/kardex?limit=6');
  const [periodo, setPeriodo] = useState<Periodo>('diaria');

  const recargar = () => {
    kpis.refetch();
    movimientos.refetch();
  };

  const hora = kpis.actualizado?.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  const d = kpis.data;

  const ganancia = d ? (d[`ganancia_${periodo}`] ?? 0) : 0;
  const top = d ? d[`top_${periodo === 'diaria' ? 'diario' : periodo === 'semanal' ? 'semanal' : 'mensual'}` as 'top_diario'] : null;
  const porProducto = d ? (d[`ganancia_por_producto_${periodo}`] ?? []) : [];
  const maxGanancia = Math.max(1, ...porProducto.map(p => p.ganancia));

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

        {/* ── Header ── */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-1">Panel general</p>
            <h1 className="text-3xl font-black text-slate-900 leading-tight">Resumen del inventario</h1>
            <p className="text-slate-500 text-sm mt-1.5 max-w-lg">
              {kpis.error && d
                ? 'No se pudo actualizar. Mostrando los últimos datos.'
                : hora ? `Actualizado a las ${hora}` : 'Stock, ganancias y alertas en una sola vista.'}
            </p>
          </div>
          <button
            onClick={recargar}
            disabled={kpis.loading}
            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50 shadow-xs">
            <FaSync className={`text-slate-400 ${kpis.loading ? 'animate-spin' : ''}`} />
            {kpis.loading ? 'Actualizando…' : 'Actualizar'}
          </button>
        </div>

        {!d ? (
          kpis.error ? (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-8">
              <ErrorState mensaje={kpis.error} onReintentar={recargar} />
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-8">
              <TablaSkeleton filas={5} />
            </div>
          )
        ) : (
          <>
            {/* ── KPIs ── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Productos</p>
                  <p className="text-2xl font-extrabold text-slate-800 mt-1">{entero(d.total_productos)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Registrados en catálogo</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center text-xl shrink-0">
                  <FaLayerGroup />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Unidades en stock</p>
                  <p className="text-2xl font-extrabold text-slate-800 mt-1">{entero(d.unidades_totales)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">Suma de todas las variantes</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-violet-50 text-violet-600 flex items-center justify-center text-xl shrink-0">
                  <FaBoxOpen />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Stock valorizado</p>
                  <p className="text-2xl font-extrabold text-emerald-600 mt-1">{moneda(d.stock_valorizado)}</p>
                  <p className="text-xs text-slate-400 mt-0.5">A precio de costo</p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-xl shrink-0">
                  <FaWarehouse />
                </div>
              </div>

              <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
                <div>
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Alertas de stock</p>
                  <p className={`text-2xl font-extrabold mt-1 ${d.alertas_stock_bajo > 0 ? 'text-amber-600' : 'text-slate-800'}`}>
                    {entero(d.alertas_stock_bajo)}
                  </p>
                  <p className="text-xs text-slate-400 mt-0.5">Bajo el mínimo</p>
                </div>
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${d.alertas_stock_bajo > 0 ? 'bg-amber-50 text-amber-600' : 'bg-slate-50 text-slate-400'}`}>
                  <FaExclamationTriangle />
                </div>
              </div>
            </div>

            {/* ── Ganancias ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Ganancias</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Margen de ventas por periodo</p>
                </div>
                <div className="inline-flex p-1 bg-slate-100 rounded-xl">
                  {PERIODOS.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setPeriodo(p.id)}
                      className={`px-3.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${periodo === p.id
                        ? 'bg-white text-indigo-600 shadow-sm'
                        : 'text-slate-500 hover:text-slate-700'}`}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 px-6 py-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center text-xl shrink-0">
                      <FaCoins />
                    </div>
                    <div>
                      <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Ganancia</p>
                      <p className="text-2xl font-extrabold text-indigo-600">{moneda(ganancia)}</p>
                    </div>
                  </div>
                  <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                    <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                      <FaTrophy className="text-amber-500" /> Más vendido
                    </p>
                    {top ? (
                      <>
                        <p className="font-semibold text-slate-800 mt-1 leading-tight">{top.nombre}</p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          <span className="font-mono">{top.sku}</span> · {entero(top.unidades)} u. · {moneda(top.ganancia)}
                        </p>
                      </>
                    ) : (
                      <p className="text-sm text-slate-400 mt-1">Sin ventas en este periodo.</p>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-2">
                  <p className="text-xs font-semibold text-slate-500 mb-3">Ganancia por producto (top 5)</p>
                  {porProducto.length === 0 ? (
                    <p className="text-sm text-slate-400">Sin ventas en este periodo.</p>
                  ) : (
                    <div className="space-y-3">
                      {porProducto.map(p => (
                        <div key={p.sku}>
                          <div className="flex items-baseline justify-between gap-3 text-sm">
                            <span className="font-semibold text-slate-700 truncate">{p.nombre}</span>
                            <span className="font-bold text-emerald-600 tabular-nums shrink-0">{moneda(p.ganancia)}</span>
                          </div>
                          <div className="mt-1 h-2 rounded-full bg-slate-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-indigo-500"
                              style={{ width: `${Math.max(3, (p.ganancia / maxGanancia) * 100)}%` }}
                            />
                          </div>
                          <p className="text-[11px] text-slate-400 mt-0.5">{entero(p.unidades)} unidades</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Alertas ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Alertas de stock bajo</h2>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {d.detalle_alertas.length
                      ? `${d.detalle_alertas.length} producto(s) por reponer`
                      : 'Todo en orden'}
                  </p>
                </div>
                <Link
                  href="/inventario"
                  className="px-3.5 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all">
                  Ir al inventario
                </Link>
              </div>

              {d.detalle_alertas.length === 0 ? (
                <div className="px-6 py-10">
                  <EmptyState
                    icono={<FaBoxOpen />}
                    titulo="Sin alertas"
                    texto="Ningún producto está por debajo de su stock mínimo."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Producto</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Stock</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Mínimo</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {d.detalle_alertas.map(a => (
                        <tr key={a.sku} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-slate-800 leading-tight">{a.nombre}</div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">{a.sku}</div>
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            <span className={`inline-flex px-2 py-0.5 rounded-md border text-xs font-semibold ${a.stock_total <= 0
                              ? 'bg-red-50 text-red-700 border-red-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                              {a.stock_total <= 0 ? 'Sin stock' : `${entero(a.stock_total)} u.`}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right text-slate-500 tabular-nums">{entero(a.stock_minimo)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* ── Últimos movimientos ── */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h2 className="font-bold text-slate-900 text-sm">Últimos movimientos</h2>
                  <p className="text-xs text-slate-400 mt-0.5">Lo más reciente del kardex</p>
                </div>
                <Link
                  href="/kardex"
                  className="px-3.5 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-all">
                  Ver kardex
                </Link>
              </div>

              {movimientos.error ? (
                <div className="px-6 py-8">
                  <ErrorState mensaje={movimientos.error} onReintentar={movimientos.refetch} />
                </div>
              ) : !movimientos.data ? (
                <div className="px-6 py-8"><TablaSkeleton filas={4} /></div>
              ) : movimientos.data.items.length === 0 ? (
                <div className="px-6 py-10">
                  <EmptyState icono={<FaBoxOpen />} titulo="Sin movimientos" texto="Aún no hay movimientos registrados." />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="bg-slate-50 border-b border-slate-100">
                      <tr>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Fecha</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Producto</th>
                        <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Tipo</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Cantidad</th>
                        <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-50">
                      {movimientos.data.items.map(m => (
                        <tr key={m.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="px-5 py-3.5 text-xs text-slate-500 whitespace-nowrap">{fechaLocal(m.fecha)}</td>
                          <td className="px-5 py-3.5">
                            <div className="font-semibold text-slate-800 leading-tight">{m.nombre ?? m.sku}</div>
                            <div className="text-xs text-slate-400 font-mono mt-0.5">
                              {m.sku}
                              {(m.talla || m.color) && ` · ${[m.talla, m.color].filter(Boolean).join(' · ')}`}
                            </div>
                          </td>
                          <td className="px-5 py-3.5">
                            <span className={`inline-flex px-2 py-0.5 rounded-md border text-[10px] font-bold uppercase tracking-wider ${TIPO_STYLE[m.tipo] ?? ''}`}>
                              {m.tipo}
                            </span>
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-slate-800 tabular-nums">{entero(m.cantidad)}</td>
                          <td className="px-5 py-3.5 text-right text-slate-500 tabular-nums">
                            {m.stock_resultante != null ? entero(m.stock_resultante) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}