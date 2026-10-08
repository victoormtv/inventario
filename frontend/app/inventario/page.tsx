'use client';
import { useState } from 'react';
import {
    FaBoxOpen, FaChartLine, FaEdit, FaLayerGroup,
    FaPlus, FaSync, FaTrash, FaSearch, FaFilter,
    FaTag
} from 'react-icons/fa';
import { api } from '@/lib/api';
import { moneda } from '@/lib/format';
import { useApi } from '@/hooks/useApi';
import type { Paginado, ProductoDetalle, ProductoResumen, Variante, VarianteInventario } from '@/types';
import Button from '@/components/ui/Button';
import ConfirmarModal from '@/components/ui/ConfirmarModal';
import { Callout, Field } from '@/components/ui/Form';
import Modal from '@/components/ui/Modal';
import Pagination from '@/components/ui/Pagination';
import { EmptyState, ErrorState, TablaSkeleton } from '@/components/ui/States';
import StockLevel from '@/components/ui/StockLevel';
import { useToast } from '@/components/ui/Toast';
import IngresoMercaderiaModal from '@/components/inventario/IngresoMercaderia';
import HistorialPreciosModal from '@/components/inventario/HistorialPreciosModal';
import ProductoModal, { type VarianteEditable } from '@/components/inventario/ProductoModal';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface FormVariante { talla: string; color: string; stock_inicial: string; }
const FORM_VAR_VACIO: FormVariante = { talla: '', color: '', stock_inicial: '0' };

const CAT_COLOR: Record<string, { bg: string; text: string; border: string }> = {
    Pegamentos: { bg: 'bg-blue-50', text: 'text-blue-700', border: 'border-blue-200' },
    Fraguas: { bg: 'bg-teal-50', text: 'text-teal-700', border: 'border-teal-200' },
    Accesorios: { bg: 'bg-violet-50', text: 'text-violet-700', border: 'border-violet-200' },
};
function catStyle(cat: string) {
    return CAT_COLOR[cat] ?? { bg: 'bg-slate-50', text: 'text-slate-600', border: 'border-slate-200' };
}

function StockPill({ stock, minimo }: { stock: number; minimo: number }) {
    if (stock <= 0)
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-semibold bg-red-50 text-red-700 border-red-200">Sin stock</span>;
    if (stock <= minimo)
        return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-semibold bg-amber-50 text-amber-700 border-amber-200">{stock} u.</span>;
    return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border text-xs font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">{stock} u.</span>;
}

function VariantesModal({ sku, onCerrar }: { sku: string; onCerrar: () => void }) {
    const toast = useToast();
    const { data, loading, refetch } = useApi<ProductoDetalle>(`/api/productos/${sku}`);
    const [form, setForm] = useState<FormVariante>(FORM_VAR_VACIO);
    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [eliminando, setEliminando] = useState<number | null>(null);

    const set = (k: keyof FormVariante) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(f => ({ ...f, [k]: e.target.value }));

    const agregar = async (e: React.FormEvent) => {
        e.preventDefault();
        setEnviando(true); setError(null);
        try {
            await api(`/api/productos/${sku}/variantes`, {
                method: 'POST',
                json: { talla: form.talla.trim(), color: form.color.trim(), stock_inicial: parseInt(form.stock_inicial) || 0 },
            });
            toast('Variante agregada');
            setForm(FORM_VAR_VACIO);
            refetch();
        } catch (err) { setError((err as Error).message); }
        finally { setEnviando(false); }
    };

    const eliminar = async (v: Variante) => {
        setEliminando(v.id);
        try {
            await api(`/api/variantes/${v.id}`, { method: 'DELETE' });
            toast('Variante eliminada');
            refetch();
        } catch (err) { toast((err as Error).message, 'error'); }
        finally { setEliminando(null); }
    };

    return (
        <Modal abierto onCerrar={onCerrar} titulo="Variantes" subtitulo={`${data?.nombre ?? sku} · ${sku}`} ancho>
            <div className="mb-6">
                {loading ? <TablaSkeleton filas={3} /> : !data?.variantes.length ? (
                    <p className="text-sm text-slate-400">Este producto todavía no tiene variantes.</p>
                ) : (
                    <div className="rounded-xl border border-slate-200 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-100">
                                <tr>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Medida / peso</th>
                                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-slate-500">Color</th>
                                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-slate-500">Stock</th>
                                    <th className="px-4 py-2.5" />
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-50">
                                {data!.variantes.map(v => (
                                    <tr key={v.id} className="hover:bg-slate-50/60 transition-colors">
                                        <td className="px-4 py-3 font-semibold text-slate-800">{v.talla}</td>
                                        <td className="px-4 py-3 text-slate-600">{v.color}</td>
                                        <td className="px-4 py-3 text-right">
                                            <StockPill stock={v.stock_actual} minimo={5} />
                                        </td>
                                        <td className="px-4 py-3 text-right">
                                            <button
                                                disabled={eliminando === v.id}
                                                onClick={() => eliminar(v)}
                                                className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer"
                                                title="Eliminar variante">
                                                <FaTrash style={{ fontSize: 11 }} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div className="border-t border-slate-100 pt-5">
                <p className="text-sm font-bold text-slate-800 mb-4">Agregar variante</p>
                {error && <Callout tono="danger">{error}</Callout>}
                <form className="form" onSubmit={agregar}>
                    <div className="grid grid-cols-3 gap-3">
                        <Field label="Medida / peso *">
                            <input className="input" value={form.talla} onChange={set('talla')} placeholder="Ej: 25 kg, Único" required />
                        </Field>
                        <Field label="Color *">
                            <input className="input" value={form.color} onChange={set('color')} placeholder="Negro" required />
                        </Field>
                        <Field label="Stock inicial">
                            <input className="input" type="number" min="0" value={form.stock_inicial} onChange={set('stock_inicial')} />
                        </Field>
                    </div>
                    <div className="form__actions mt-3">
                        <Button type="submit" variante="primario" cargando={enviando}
                            icono={<FaPlus style={{ fontSize: 11 }} />}>
                            Agregar
                        </Button>
                    </div>
                </form>
            </div>
        </Modal>
    );
}

export default function InventarioPage() {
    const toast = useToast();
    const [q, setQ] = useState('');
    const [categoria, setCategoria] = useState('');
    const [estado, setEstado] = useState('');
    const [page, setPage] = useState(1);
    const LIMIT = 50;

    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (q) params.set('q', q);
    if (categoria) params.set('categoria', categoria);
    if (estado) params.set('estado', estado);

    const lista = useApi<Paginado<VarianteInventario>>(`/api/inventario/variantes?${params}`);
    const cats = useApi<string[]>('/api/categorias');

    const [modalProducto, setModalProducto] = useState<'nuevo' | { producto: ProductoResumen; variante: VarianteEditable } | null>(null);
    const [modalIngreso, setModalIngreso] = useState(false);
    const [modalVariantes, setModalVariantes] = useState<string | null>(null);
    const [confirmarEliminar, setConfirmarEliminar] = useState<ProductoResumen | null>(null);
    const [eliminando, setEliminando] = useState(false);
    const [modalHistorial, setModalHistorial] = useState<{ sku: string; nombre: string } | null>(null);

    const refetch = () => lista.refetch();

    const eliminar = async () => {
        if (!confirmarEliminar) return;
        setEliminando(true);
        try {
            await api(`/api/productos/${confirmarEliminar.sku}`, { method: 'DELETE' });
            toast('Producto eliminado');
            setConfirmarEliminar(null);
            refetch();
        } catch (err) { toast((err as Error).message, 'error'); }
        finally { setEliminando(false); }
    };

    const cambiarFiltro = (fn: () => void) => { fn(); setPage(1); };
    const hayFiltros = !!(q || categoria || estado);

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-1">Módulo de Inventario</p>
                        <h1 className="text-3xl font-black text-slate-900 leading-tight">Stock y variantes</h1>
                        <p className="text-slate-500 text-sm mt-1.5 max-w-lg">
                            Cada variante como ítem individual — talla, color, stock y precios en una sola vista.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={refetch}
                            disabled={lista.loading}
                            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50 shadow-xs">
                            <FaSync className={`text-slate-400 ${lista.loading ? 'animate-spin' : ''}`} />
                            Actualizar
                        </button>
                        <button
                            onClick={() => setModalIngreso(true)}
                            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all cursor-pointer shadow-xs">
                            <FaBoxOpen className="text-slate-400" />
                            Ingreso de mercadería
                        </button>
                        <button
                            onClick={() => setModalProducto('nuevo')}
                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/20">
                            <FaPlus />
                            Nuevo producto
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5">
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-1.5">
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
                                    placeholder="SKU, nombre, talla o color…"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition placeholder:text-slate-300"
                                />
                            </div>
                        </div>

                        <div className="w-52 space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                <FaTag className="text-indigo-400" />
                                Categoría
                            </label>
                            <Select value={categoria || 'todas'} onValueChange={(v) => cambiarFiltro(() => setCategoria(v === 'todas' || !v ? '' : v))}>
                                <SelectTrigger
                                    className="w-full bg-slate-50 border-slate-200 rounded-xl px-3.5 py-2.5 h-auto text-sm text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                                    style={{ width: '100%' }}
                                >
                                    <SelectValue placeholder="Todas las categorías" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todas">Todas las categorías</SelectItem>
                                    {(cats.data ?? []).map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="w-48 space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                <FaFilter className="text-indigo-400" />
                                Estado
                            </label>
                            <Select value={estado || 'todos'} onValueChange={(v) => cambiarFiltro(() => setEstado(v === 'todos' || !v ? '' : v))}>
                                <SelectTrigger
                                    className="w-full bg-slate-50 border-slate-200 rounded-xl px-3.5 py-2.5 h-auto text-sm text-slate-800 font-medium focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                                    style={{ width: '100%' }}
                                >
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="todos">Todos</SelectItem>
                                    <SelectItem value="bajo">Solo bajo el mínimo</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        {hayFiltros && (
                            <button
                                onClick={() => { setQ(''); setCategoria(''); setEstado(''); setPage(1); }}
                                className="px-3.5 py-2.5 text-xs font-semibold text-slate-400 hover:text-slate-600 bg-slate-50 border border-slate-200 rounded-xl transition-all cursor-pointer whitespace-nowrap">
                                Limpiar filtros
                            </button>
                        )}
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">

                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h2 className="font-bold text-slate-900 text-sm">Variantes en inventario</h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {lista.data ? `${lista.data.total} en total` : 'Cargando…'}
                            </p>
                        </div>
                        {hayFiltros && (
                            <div className="flex gap-1.5">
                                {q && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold">
                                        <FaSearch style={{ fontSize: 9 }} /> {q}
                                    </span>
                                )}
                                {categoria && (
                                    <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border text-xs font-semibold ${catStyle(categoria).bg} ${catStyle(categoria).text} ${catStyle(categoria).border}`}>
                                        {categoria}
                                    </span>
                                )}
                                {estado === 'bajo' && (
                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 text-amber-700 border border-amber-200 text-xs font-semibold">
                                        Bajo mínimo
                                    </span>
                                )}
                            </div>
                        )}
                    </div>

                    {lista.error ? (
                        <div className="px-6 py-8">
                            <ErrorState mensaje={lista.error} onReintentar={refetch} />
                        </div>
                    ) : !lista.data ? (
                        <div className="px-6 py-8"><TablaSkeleton /></div>
                    ) : lista.data.items.length === 0 ? (
                        <div className="px-6 py-12">
                            <EmptyState
                                icono={<FaBoxOpen />}
                                titulo="Sin variantes"
                                texto={hayFiltros ? 'Ninguna variante coincide con los filtros.' : 'Registra tu primer producto con el botón de arriba.'}
                                accion={hayFiltros
                                    ? <button onClick={() => { setQ(''); setCategoria(''); setEstado(''); setPage(1); }}
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
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Producto</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Medida / peso</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Color</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Categoría</th>
                                            <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Costo</th>
                                            <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Venta</th>
                                            <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500">Stock</th>
                                            <th className="px-5 py-3 text-left text-xs font-semibold text-slate-500">Nivel</th>
                                            <th className="px-5 py-3" />
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-50">
                                        {lista.data.items.map((v) => {
                                            const cs = catStyle(v.categoria ?? '');
                                            return (
                                                <tr key={v.id_variante} className="hover:bg-slate-50/60 transition-colors group">
                                                    <td className="px-5 py-3.5">
                                                        <div className="font-semibold text-slate-800 leading-tight">{v.nombre}</div>
                                                        <div className="text-xs text-slate-400 font-mono mt-0.5">{v.sku}</div>
                                                    </td>
                                                    <td className="px-5 py-3.5 font-semibold text-slate-700">{v.talla}</td>
                                                    <td className="px-5 py-3.5 text-slate-600">{v.color}</td>
                                                    <td className="px-5 py-3.5">
                                                        {v.categoria
                                                            ? <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-xs font-semibold ${cs.bg} ${cs.text} ${cs.border}`}>{v.categoria}</span>
                                                            : <span className="text-slate-300">—</span>}
                                                    </td>
                                                    <td className="px-5 py-3.5 text-right text-slate-400 font-medium tabular-nums">{moneda(v.precio_costo)}</td>
                                                    <td className="px-5 py-3.5 text-right font-bold text-slate-800 tabular-nums">{moneda(v.precio_venta)}</td>
                                                    <td className="px-5 py-3.5 text-right">
                                                        <StockPill stock={v.stock_actual} minimo={v.stock_minimo} />
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        <StockLevel stock={v.stock_actual} minimo={v.stock_minimo} />
                                                    </td>
                                                    <td className="px-5 py-3.5">
                                                        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                                            <button
                                                                onClick={() => setModalVariantes(v.sku)}
                                                                title="Variantes del producto"
                                                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer">
                                                                <FaLayerGroup style={{ fontSize: 12 }} />
                                                            </button>
                                                            <button
                                                                onClick={() => setModalHistorial({ sku: v.sku, nombre: v.nombre })}
                                                                title="Historial de precios"
                                                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer">
                                                                <FaChartLine style={{ fontSize: 12 }} />
                                                            </button>
                                                            <button
                                                                onClick={() => setModalProducto({
                                                                    producto: { sku: v.sku, nombre: v.nombre, categoria: v.categoria, precio_costo: v.precio_costo, precio_venta: v.precio_venta, stock_minimo: v.stock_minimo, stock_total: 0, num_variantes: 0 },
                                                                    variante: { id: v.id_variante, talla: v.talla, color: v.color, detalle: v.detalle, kg: v.kg, lote: v.lote, stock_actual: v.stock_actual },
                                                                })}
                                                                title="Editar producto"
                                                                className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer">
                                                                <FaEdit style={{ fontSize: 12 }} />
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>

                            <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/50">
                                <Pagination page={page} limit={LIMIT} total={lista.data.total} onPage={setPage} />
                            </div>
                        </>
                    )}
                </div>
            </div>

            {modalProducto && (
                <ProductoModal
                    producto={modalProducto === 'nuevo' ? null : modalProducto.producto}
                    variante={modalProducto === 'nuevo' ? null : modalProducto.variante}
                    onCerrar={() => setModalProducto(null)}
                    onGuardado={() => { setModalProducto(null); refetch(); }}
                />
            )}
            {modalHistorial && (
                <HistorialPreciosModal sku={modalHistorial.sku} nombre={modalHistorial.nombre} onCerrar={() => setModalHistorial(null)} />
            )}
            {modalVariantes && (
                <VariantesModal sku={modalVariantes} onCerrar={() => { setModalVariantes(null); refetch(); }} />
            )}
            {modalIngreso && (
                <IngresoMercaderiaModal onCerrar={() => setModalIngreso(false)} onGuardado={() => { setModalIngreso(false); refetch(); }} />
            )}
            <ConfirmarModal
                abierto={!!confirmarEliminar}
                titulo="Eliminar producto"
                texto={`¿Eliminar "${confirmarEliminar?.nombre}"? Solo se puede si no tiene movimientos en el kardex.`}
                textoConfirmar="Sí, eliminar"
                cargando={eliminando}
                onConfirmar={eliminar}
                onCancelar={() => setConfirmarEliminar(null)}
            />
        </div>
    );
}