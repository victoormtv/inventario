'use client';

import { useState } from 'react';
import { FaPlus } from 'react-icons/fa';
import { api } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import type { Paginado, ProductoDetalle, ProductoResumen, ResultadoMovimiento, Variante } from '@/types';
import Button from '@/components/ui/Button';
import { Callout, Field } from '@/components/ui/Form';
import ModalSoloX from '@/components/ui/ModalSoloX';
import { TEXTO } from './constantes';

export default function MovimientoModal({ onGuardado, onCerrar }: { onGuardado: (r: ResultadoMovimiento) => void; onCerrar: () => void }) {
    const [tipo, setTipo] = useState<'ENTRADA' | 'SALIDA' | 'AJUSTE'>('ENTRADA');
    const [q, setQ] = useState('');
    const [skuSel, setSkuSel] = useState<string | null>(null);
    const [varianteSel, setVarianteSel] = useState<Variante | null>(null);
    const [cantidad, setCantidad] = useState('');
    const [referencia, setReferencia] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);

    const busqueda = useApi<Paginado<ProductoResumen>>(q.length >= 1 && !skuSel ? `/api/productos?q=${encodeURIComponent(q)}&limit=8` : null);
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
        <ModalSoloX onCerrar={onCerrar} titulo="Registrar movimiento" subtitulo="Entrada, salida o ajuste de stock" bloqueado={enviando}>
            <form className="form" onSubmit={registrar}>
                {error && <Callout tono="danger">{error}</Callout>}

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

                {detalle.data && (
                    <Field label="Variante" hint="Selecciona la medida y el color exactos.">
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
                    <Button type="submit" variante="primario" cargando={enviando}
                        icono={<FaPlus style={{ fontSize: 11 }} />}>
                        Registrar
                    </Button>
                </div>
            </form>
        </ModalSoloX>
    );
}
