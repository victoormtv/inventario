'use client';
import { useState } from 'react';
import { FaBoxOpen, FaChartLine, FaEdit, FaLayerGroup, FaPlus, FaSync, FaTrash } from 'react-icons/fa';
import { api } from '../lib/api';
import { moneda } from '../lib/format';
import { useApi } from '../lib/useApi';
import type { Paginado, ProductoDetalle, ProductoResumen, Variante } from '../lib/types';
import Button from '../components/ui/Button';
import Badge from '../components/ui/Badge';
import ConfirmarModal from '../components/ui/ConfirmarModal';
import { Callout, Field } from '../components/ui/Form';
import Modal from '../components/Modal';
import { PageHeader, Panel, PanelHead } from '../components/ui/Panel';
import Pagination from '../components/ui/Pagination';
import SearchInput from '../components/ui/SearchInput';
import { EmptyState, ErrorState, TablaSkeleton } from '../components/ui/States';
import StockLevel from '../components/ui/StockLevel';
import { useToast } from '../components/ui/Toast';
import IngresoMercaderiaModal from './IngresoMercaderia';
import HistorialPreciosModal from './HistorialPreciosModal';

interface FormProducto {
    sku: string; nombre: string; categoria: string;
    precio_costo: string; precio_venta: string; stock_minimo: string;
}
interface FormVariante { talla: string; color: string; stock_inicial: string; }

const FORM_PROD_VACIO: FormProducto = { sku: '', nombre: '', categoria: '', precio_costo: '', precio_venta: '', stock_minimo: '5' };
const FORM_VAR_VACIO: FormVariante = { talla: '', color: '', stock_inicial: '0' };

function ProductoModal({ producto, onGuardado, onCerrar }: {
    producto: ProductoResumen | null;
    onGuardado: () => void; onCerrar: () => void;
}) {
    const toast = useToast();
    const [form, setForm] = useState<FormProducto>(
        producto
            ? {
                sku: producto.sku, nombre: producto.nombre, categoria: producto.categoria ?? '',
                precio_costo: String(producto.precio_costo), precio_venta: String(producto.precio_venta),
                stock_minimo: String(producto.stock_minimo)
            }
            : FORM_PROD_VACIO
    );
    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);

    const set = (k: keyof FormProducto) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(f => ({ ...f, [k]: e.target.value }));

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        setEnviando(true); setError(null);
        const body = {
            nombre: form.nombre.trim(), categoria: form.categoria.trim(),
            precio_costo: parseFloat(form.precio_costo), precio_venta: parseFloat(form.precio_venta),
            stock_minimo: parseInt(form.stock_minimo),
        };
        try {
            if (producto) {
                await api(`/api/productos/${producto.sku}`, { method: 'PUT', json: body });
                toast('Producto actualizado');
            } else {
                await api('/api/productos', { method: 'POST', json: { sku: form.sku.trim().toUpperCase(), ...body } });
                toast('Producto registrado');
            }
            onGuardado();
        } catch (err) { setError((err as Error).message); }
        finally { setEnviando(false); }
    };

    return (
        <Modal abierto onCerrar={onCerrar} titulo={producto ? 'Editar producto' : 'Nuevo producto'}
            subtitulo={producto ? producto.sku : 'Los campos marcados con * son obligatorios'}>
            <form className="form" onSubmit={guardar}>
                {error && <Callout tono="danger">{error}</Callout>}
                {!producto && (
                    <Field label="SKU *" hint="Ej: POL-001. No se puede cambiar después.">
                        <input className="input" value={form.sku} onChange={set('sku')} placeholder="POL-001" required />
                    </Field>
                )}
                <Field label="Nombre *">
                    <input className="input" value={form.nombre} onChange={set('nombre')} required autoFocus={!!producto} />
                </Field>
                <Field label="Categoría">
                    <input className="input" value={form.categoria} onChange={set('categoria')} placeholder="Ej: Polos" />
                </Field>
                <div className="field-row">
                    <Field label="Precio costo *">
                        <input className="input" type="number" step="0.01" min="0" value={form.precio_costo} onChange={set('precio_costo')} required />
                    </Field>
                    <Field label="Precio venta *">
                        <input className="input" type="number" step="0.01" min="0" value={form.precio_venta} onChange={set('precio_venta')} required />
                    </Field>
                </div>
                <Field label="Stock mínimo" hint="Recibirás un aviso por correo cuando llegue a este nivel.">
                    <input className="input" type="number" min="0" value={form.stock_minimo} onChange={set('stock_minimo')} required />
                </Field>
                <div className="form__actions">
                    <Button onClick={onCerrar}>Cancelar</Button>
                    <Button type="submit" variante="primario" cargando={enviando}>
                        {producto ? 'Guardar cambios' : 'Registrar producto'}
                    </Button>
                </div>
            </form>
        </Modal>
    );
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
            <div style={{ marginBottom: 24 }}>
                {loading ? <TablaSkeleton filas={3} /> : !data?.variantes.length ? (
                    <p style={{ color: 'var(--ink-2)', fontSize: 14 }}>Este producto todavía no tiene variantes.</p>
                ) : (
                    <div className="table-wrap">
                        <table className="table table--compact">
                            <thead><tr><th>Talla</th><th>Color</th><th className="cell-num">Stock</th><th /></tr></thead>
                            <tbody>
                                {data.variantes.map(v => (
                                    <tr key={v.id}>
                                        <td style={{ fontWeight: 600 }}>{v.talla}</td>
                                        <td>{v.color}</td>
                                        <td className="cell-num">
                                            <span className={v.stock_actual <= 0 ? 'stock-now' : ''}>{v.stock_actual}</span>
                                        </td>
                                        <td className="table__actions">
                                            <button className="icon-btn icon-btn--danger" disabled={eliminando === v.id}
                                                onClick={() => eliminar(v)} title="Eliminar variante" aria-label="Eliminar">
                                                <FaTrash style={{ fontSize: 12 }} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>

            <div style={{ borderTop: '1px solid var(--line-soft)', paddingTop: 20 }}>
                <p style={{ fontSize: 13, fontWeight: 700, marginBottom: 14 }}>Agregar variante</p>
                {error && <Callout tono="danger" >{error}</Callout>}
                <form className="form" onSubmit={agregar}>
                    <div className="field-row field-row--3">
                        <Field label="Talla *">
                            <input className="input" value={form.talla} onChange={set('talla')} placeholder="M" required />
                        </Field>
                        <Field label="Color *">
                            <input className="input" value={form.color} onChange={set('color')} placeholder="Negro" required />
                        </Field>
                        <Field label="Stock inicial">
                            <input className="input" type="number" min="0" value={form.stock_inicial} onChange={set('stock_inicial')} />
                        </Field>
                    </div>
                    <div className="form__actions">
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
    const LIMIT = 20;

    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (q) params.set('q', q);
    if (categoria) params.set('categoria', categoria);
    if (estado) params.set('estado', estado);

    const lista = useApi<Paginado<ProductoResumen>>(`/api/productos?${params}`);
    const cats = useApi<string[]>('/api/categorias');

    const [modalProducto, setModalProducto] = useState<'nuevo' | ProductoResumen | null>(null);
    const [modalIngreso, setModalIngreso] = useState(false);
    const [modalVariantes, setModalVariantes] = useState<string | null>(null);
    const [confirmarEliminar, setConfirmarEliminar] = useState<ProductoResumen | null>(null);
    const [eliminando, setEliminando] = useState(false);
    const [modalHistorial, setModalHistorial] = useState<ProductoResumen | null>(null);

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

    return (
        <div className="page stack">
            <PageHeader
                titulo="Inventario"
                descripcion="Productos y sus variantes por talla y color"
                acciones={
                    <>
                        <Button onClick={refetch} disabled={lista.loading}
                            icono={<FaSync className={lista.loading ? 'spin' : undefined} style={{ fontSize: 11 }} />}>
                            Actualizar
                        </Button>
                        <Button variante="primario" onClick={() => setModalProducto('nuevo')}
                            icono={<FaPlus style={{ fontSize: 11 }} />}>
                            Nuevo producto
                        </Button>
                        <Button onClick={() => setModalIngreso(true)} icono={<FaBoxOpen style={{ fontSize: 11 }} />}>
                            Ingreso de mercadería
                        </Button>
                    </>
                }
            />

            <Panel etiqueta="Lista de productos">
                <PanelHead titulo="Productos" descripcion={lista.data ? `${lista.data.total} en total` : undefined} />

                {/* Barra de filtros */}
                <div className="toolbar" style={{ padding: '0 28px 16px' }}>
                    <SearchInput valor={q} onCambio={v => cambiarFiltro(() => setQ(v))} placeholder="Buscar por SKU o nombre…" />
                    <select className="select select--sm" value={categoria}
                        onChange={e => cambiarFiltro(() => setCategoria(e.target.value))}>
                        <option value="">Todas las categorías</option>
                        {(cats.data ?? []).map(c => <option key={c} value={c}>{c}</option>)}
                    </select>
                    <select className="select select--sm" value={estado}
                        onChange={e => cambiarFiltro(() => setEstado(e.target.value))}>
                        <option value="">Todos los estados</option>
                        <option value="bajo">Solo bajo el mínimo</option>
                    </select>
                </div>

                {lista.error ? (
                    <ErrorState mensaje={lista.error} onReintentar={refetch} />
                ) : !lista.data ? (
                    <TablaSkeleton />
                ) : lista.data.items.length === 0 ? (
                    <EmptyState icono={<FaBoxOpen />} titulo="Sin productos"
                        texto={q || categoria || estado ? 'Ningún producto coincide con los filtros.' : 'Registra tu primer producto con el botón de arriba.'}
                        accion={q || categoria || estado
                            ? <Button onClick={() => { setQ(''); setCategoria(''); setEstado(''); setPage(1); }}>Limpiar filtros</Button>
                            : undefined} />
                ) : (
                    <>
                        <div className="table-wrap">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Producto</th>
                                        <th>Categoría</th>
                                        <th className="cell-num">Costo</th>
                                        <th className="cell-num">Venta</th>
                                        <th className="cell-num">Stock</th>
                                        <th>Nivel</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {lista.data.items.map(p => (
                                        <tr key={p.sku}>
                                            <td>
                                                <div className="prod__name">{p.nombre}</div>
                                                <div className="prod__sku">{p.sku}</div>
                                            </td>
                                            <td>
                                                {p.categoria
                                                    ? <Badge tono="neutral">{p.categoria}</Badge>
                                                    : <span className="muted">—</span>}
                                            </td>
                                            <td className="cell-num muted">{moneda(p.precio_costo)}</td>
                                            <td className="cell-num" style={{ fontWeight: 600 }}>{moneda(p.precio_venta)}</td>
                                            <td className="cell-num">
                                                <span className={p.stock_total <= p.stock_minimo ? 'stock-now' : ''}>
                                                    {p.stock_total}
                                                </span>
                                            </td>
                                            <td><StockLevel stock={p.stock_total} minimo={p.stock_minimo} /></td>
                                            <td className="table__actions">
                                                <button className="icon-btn" title="Variantes"
                                                    onClick={() => setModalVariantes(p.sku)} aria-label="Ver variantes">
                                                    <FaLayerGroup style={{ fontSize: 12 }} />
                                                </button>
                                                <button className="icon-btn" title="Historial de precios"
                                                    onClick={() => setModalHistorial(p)} aria-label="Historial de precios">
                                                    <FaChartLine style={{ fontSize: 12 }} />
                                                </button>
                                                <button className="icon-btn" title="Editar"
                                                    onClick={() => setModalProducto(p)} aria-label="Editar producto">
                                                    <FaEdit style={{ fontSize: 12 }} />
                                                </button>
                                                <button className="icon-btn icon-btn--danger" title="Eliminar"
                                                    onClick={() => setConfirmarEliminar(p)} aria-label="Eliminar producto">
                                                    <FaTrash style={{ fontSize: 12 }} />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <Pagination page={page} limit={LIMIT} total={lista.data.total} onPage={setPage} />
                    </>
                )}
            </Panel>

            {modalProducto && (
                <ProductoModal
                    producto={modalProducto === 'nuevo' ? null : modalProducto}
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