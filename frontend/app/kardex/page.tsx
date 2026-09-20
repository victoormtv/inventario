'use client';
import { useState } from 'react';
import { FaExchangeAlt, FaPlus } from 'react-icons/fa';
import { api } from '../lib/api';
import { fechaLocal, hoy } from '../lib/format';
import { useApi } from '../lib/useApi';
import type { Movimiento, Paginado, ProductoDetalle, ProductoResumen, ResultadoMovimiento, Variante } from '../lib/types';
import Badge from '../components/ui/Badge';
import Button from '../components/ui/Button';
import { Callout, Field } from '../components/ui/Form';
import Modal from '../components/Modal';
import { PageHeader, Panel, PanelHead } from '../components/ui/Panel';
import Pagination from '../components/ui/Pagination';
import SearchInput from '../components/ui/SearchInput';
import { EmptyState, ErrorState, TablaSkeleton } from '../components/ui/States';
import { FaArrowRight } from 'react-icons/fa';

// ─── colores por tipo ───
const TONO = { ENTRADA: 'ok', SALIDA: 'danger', AJUSTE: 'brand' } as const;
const TEXTO = { ENTRADA: 'Entrada', SALIDA: 'Salida', AJUSTE: 'Ajuste' } as const;

// ─── modal de resultado tras registrar ───
function ResultadoModal({ r, onCerrar }: { r: ResultadoMovimiento; onCerrar: () => void }) {
    const bajoCruce = r.total_antes > r.stock_minimo && r.total_despues <= r.stock_minimo;
    const agotado = r.total_despues <= 0;
    return (
        <Modal abierto onCerrar={onCerrar} titulo="Movimiento registrado">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <Badge tono={TONO[r.tipo]}>{TEXTO[r.tipo]}</Badge>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{r.nombre}</span>
                    <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>{r.sku}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {[
                        { label: 'Cantidad', valor: r.cantidad, color: 'var(--ink)' },
                        { label: 'Stock anterior', valor: r.stock_anterior, color: 'var(--ink-2)' },
                        { label: 'Stock resultante', valor: r.stock_resultante, color: r.stock_resultante <= r.stock_minimo ? 'var(--danger)' : 'var(--ok)' },
                    ].map(({ label, valor, color }) => (
                        <div key={label} className="chip">
                            <strong style={{ color }}>{valor}</strong>
                            {label}
                        </div>
                    ))}
                </div>

                {agotado && <Callout tono="danger">Este producto quedó sin stock. Se enviará un aviso por correo.</Callout>}
                {!agotado && bajoCruce && <Callout tono="warn">El stock cruzó el mínimo ({r.stock_minimo} u.). Se enviará un aviso por correo.</Callout>}
                {!agotado && !bajoCruce && r.stock_resultante <= r.stock_minimo && (
                    <Callout tono="warn">El stock sigue por debajo del mínimo ({r.stock_minimo} u.).</Callout>
                )}

                <div className="form__actions">
                    <Button variante="primario" onClick={onCerrar}>Aceptar</Button>
                </div>
            </div>
        </Modal>
    );
}

// ─── modal de nuevo movimiento ───
function MovimientoModal({ onGuardado, onCerrar }: { onGuardado: (r: ResultadoMovimiento) => void; onCerrar: () => void }) {
    const [tipo, setTipo] = useState<'ENTRADA' | 'SALIDA' | 'AJUSTE'>('ENTRADA');
    const [q, setQ] = useState('');
    const [skuSel, setSkuSel] = useState<string | null>(null);
    const [varianteSel, setVarianteSel] = useState<Variante | null>(null);
    const [cantidad, setCantidad] = useState('');
    const [referencia, setReferencia] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);

    const busqueda = useApi<Paginado<ProductoResumen>>(q.length >= 1 ? `/api/productos?q=${encodeURIComponent(q)}&limit=8` : null);
    const detalle = useApi<ProductoDetalle>(skuSel ? `/api/productos/${skuSel}` : null);

    const seleccionarProducto = (p: ProductoResumen) => {
        setSkuSel(p.sku); setQ(p.nombre); setVarianteSel(null);
    };

    const registrar = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!varianteSel) { setError('Selecciona una variante.'); return; }
        setEnviando(true); setError(null);
        try {
            const r = await api<ResultadoMovimiento>('/api/kardex', {
                method: 'POST',
                json: { id_variante: varianteSel.id, tipo_movimiento: tipo, cantidad: parseInt(cantidad), referencia },
            });
            onGuardado(r);
        } catch (err) { setError((err as Error).message); }
        finally { setEnviando(false); }
    };

    const limpiar = () => { setSkuSel(null); setQ(''); setVarianteSel(null); };

    return (
        <Modal abierto onCerrar={onCerrar} titulo="Registrar movimiento" subtitulo="Entrada, salida o ajuste de stock">
            <form className="form" onSubmit={registrar}>
                {error && <Callout tono="danger">{error}</Callout>}

                {/* Tipo */}
                <Field label="Tipo de movimiento">
                    <div className="segmented">
                        {(['ENTRADA', 'SALIDA', 'AJUSTE'] as const).map(t => (
                            <label key={t}>
                                <input type="radio" name="tipo" value={t} checked={tipo === t} onChange={() => setTipo(t)} />
                                <span>{TEXTO[t]}</span>
                            </label>
                        ))}
                    </div>
                </Field>

                {/* Buscar producto */}
                <Field label="Producto" hint={skuSel ? undefined : 'Escribe al menos una letra para buscar.'}>
                    {skuSel ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                            <span style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--line)', borderRadius: 'var(--radius-md)', fontSize: 14, background: '#f8fafb' }}>
                                {detalle.data?.nombre ?? skuSel} <span style={{ color: 'var(--ink-3)', fontSize: 12 }}>{skuSel}</span>
                            </span>
                            <Button pequeno onClick={limpiar}>Cambiar</Button>
                        </div>
                    ) : (
                        <>
                            <input className="input" value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar producto…" autoFocus />
                            {busqueda.data && busqueda.data.items.length > 0 && (
                                <div className="picker" style={{ marginTop: 6 }}>
                                    {busqueda.data.items.map(p => (
                                        <button key={p.sku} type="button" className="picker__item" onClick={() => seleccionarProducto(p)}>
                                            <span>{p.nombre}</span>
                                            <span className="picker__sku">{p.sku} · {p.stock_total} u.</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {busqueda.data?.items.length === 0 && q && (
                                <p style={{ fontSize: 13, color: 'var(--ink-3)', marginTop: 6 }}>Sin resultados para {q}.</p>
                            )}
                        </>
                    )}
                </Field>

                {/* Variante */}
                {detalle.data && (
                    <Field label="Variante" hint="Selecciona la talla y color exactos.">
                        {detalle.data.variantes.length === 0 ? (
                            <Callout tono="warn">Este producto no tiene variantes. Agrégalas desde Inventario.</Callout>
                        ) : (
                            <div className="picker">
                                {detalle.data.variantes.map(v => (
                                    <button key={v.id} type="button" className="picker__item"
                                        aria-pressed={varianteSel?.id === v.id}
                                        onClick={() => setVarianteSel(v)}>
                                        <span>{v.talla} · {v.color}</span>
                                        <span className="picker__sku">{v.stock_actual} u. en stock</span>
                                    </button>
                                ))}
                            </div>
                        )}
                    </Field>
                )}

                {/* Cantidad y referencia */}
                <div className="field-row">
                    <Field label={tipo === 'AJUSTE' ? 'Stock real contado' : 'Cantidad'} hint={tipo === 'AJUSTE' ? 'El sistema calcula la diferencia.' : undefined}>
                        <input className="input" type="number" min={tipo === 'AJUSTE' ? '0' : '1'}
                            value={cantidad} onChange={e => setCantidad(e.target.value)} required />
                    </Field>
                    <Field label="Referencia" hint="Ej: Factura #123, Conteo físico…">
                        <input className="input" value={referencia} onChange={e => setReferencia(e.target.value)}
                            placeholder="Opcional" />
                    </Field>
                </div>

                <div className="form__actions">
                    <Button onClick={onCerrar}>Cancelar</Button>
                    <Button type="submit" variante="primario" cargando={enviando}
                        icono={<FaPlus style={{ fontSize: 11 }} />}>
                        Registrar
                    </Button>
                </div>
            </form>
        </Modal>
    );
}

// ─── página ───
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

    const onGuardado = (r: ResultadoMovimiento) => {
        setModalNuevo(false);
        setResultado(r);
        lista.refetch();
    };

    return (
        <div className="page stack">
            <PageHeader
                titulo="Kardex"
                descripcion="Historial de entradas, salidas y ajustes de stock"
                acciones={
                    <Button variante="primario" onClick={() => setModalNuevo(true)}
                        icono={<FaPlus style={{ fontSize: 11 }} />}>
                        Registrar movimiento
                    </Button>
                }
            />

            <Panel etiqueta="Movimientos">
                <PanelHead titulo="Movimientos" descripcion={lista.data ? `${lista.data.total} registros` : undefined} />

                {/* Filtros */}
                <div className="toolbar" style={{ padding: '0 28px 16px' }}>
                    <SearchInput valor={q} onCambio={v => cambiarFiltro(() => setQ(v))} placeholder="Buscar por SKU o nombre…" />
                    <select className="select select--sm" value={tipo} onChange={e => cambiarFiltro(() => setTipo(e.target.value))}>
                        <option value="">Todos los tipos</option>
                        <option value="ENTRADA">Entradas</option>
                        <option value="SALIDA">Salidas</option>
                        <option value="AJUSTE">Ajustes</option>
                    </select>
                    <input className="input input--sm input--date" type="date" value={desde}
                        max={hasta || hoy()} onChange={e => cambiarFiltro(() => setDesde(e.target.value))}
                        title="Desde" aria-label="Desde" />
                    <input className="input input--sm input--date" type="date" value={hasta}
                        min={desde} max={hoy()} onChange={e => cambiarFiltro(() => setHasta(e.target.value))}
                        title="Hasta" aria-label="Hasta" />
                    {(q || tipo || desde || hasta) && (
                        <Button pequeno variante="fantasma" onClick={() => { setQ(''); setTipo(''); setDesde(''); setHasta(''); setPage(1); }}>
                            Limpiar
                        </Button>
                    )}
                    <div className="toolbar__spacer" />
                    <Button pequeno disabled={lista.loading} onClick={() => lista.refetch()}>Actualizar</Button>
                </div>

                {/* Tabla */}
                {lista.error ? (
                    <ErrorState mensaje={lista.error} onReintentar={lista.refetch} />
                ) : !lista.data ? (
                    <TablaSkeleton filas={6} />
                ) : lista.data.items.length === 0 ? (
                    <EmptyState icono={<FaExchangeAlt />} titulo="Sin movimientos"
                        texto={q || tipo || desde || hasta
                            ? 'Ningún movimiento coincide con los filtros.'
                            : 'Registra el primer movimiento con el botón de arriba.'} />
                ) : (
                    <>
                        <div className="table-wrap">
                            <table className="table">
                                <thead>
                                    <tr>
                                        <th>Fecha</th>
                                        <th>Producto</th>
                                        <th>Tipo</th>
                                        <th className="cell-num">Cantidad</th>
                                        <th>Stock</th>
                                        <th>Referencia</th>
                                        <th>Usuario</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {lista.data.items.map(m => {
                                        const subio = (m.stock_resultante ?? 0) >= (m.stock_anterior ?? 0);
                                        return (
                                            <tr key={m.id}>
                                                <td className="muted" style={{ whiteSpace: 'nowrap', fontSize: 13 }}>
                                                    {fechaLocal(m.fecha)}
                                                </td>
                                                <td>
                                                    <div className="prod__name">{m.nombre ?? m.sku}</div>
                                                    <div className="prod__sku">
                                                        {m.sku}{m.talla || m.color ? ` · ${[m.talla, m.color].filter(Boolean).join(' / ')}` : ''}
                                                    </div>
                                                </td>
                                                <td><Badge tono={TONO[m.tipo]}>{TEXTO[m.tipo]}</Badge></td>
                                                <td className="cell-num">
                                                    {m.tipo === 'ENTRADA' && <span className="mov-qty mov-qty--in">+{m.cantidad}</span>}
                                                    {m.tipo === 'SALIDA' && <span className="mov-qty mov-qty--out">−{m.cantidad}</span>}
                                                    {m.tipo === 'AJUSTE' && <span className="mov-qty mov-qty--adj">{subio ? '+' : '−'}{m.cantidad}</span>}
                                                </td>
                                                <td>
                                                    {m.stock_anterior !== null && m.stock_resultante !== null ? (
                                                        <span className="flow">
                                                            {m.stock_anterior}
                                                            <FaArrowRight style={{ fontSize: 9 }} />
                                                            <strong>{m.stock_resultante}</strong>
                                                        </span>
                                                    ) : <span className="muted">—</span>}
                                                </td>
                                                <td style={{ maxWidth: 200, fontSize: 13 }}>
                                                    {m.referencia || <span className="muted">—</span>}
                                                </td>
                                                <td className="muted" style={{ fontSize: 13 }}>{m.usuario ?? '—'}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                        <Pagination page={page} limit={LIMIT} total={lista.data.total} onPage={setPage} />
                    </>
                )}
            </Panel>

            {modalNuevo && <MovimientoModal onGuardado={onGuardado} onCerrar={() => setModalNuevo(false)} />}
            {resultado && <ResultadoModal r={resultado} onCerrar={() => setResultado(null)} />}
        </div>
    );
}