'use client';

import { useState } from 'react';
import { FaPlus } from 'react-icons/fa';
import { useApi } from '@/hooks/useApi';
import { moneda } from '@/lib/format';
import type { Paginado, ProductoDetalle, ProductoResumen } from '@/types';
import Modal from '@/components/ui/Modal';
import Button from '@/components/ui/Button';
import SearchInput from '@/components/ui/SearchInput';
import { TablaSkeleton } from '@/components/ui/States';

interface Props {
    onAgregar: (data: { sku: string; nombre: string; id_variante: number; talla: string; color: string; precio_costo: number; precio_venta: number }) => void;
    onCerrar: () => void;
}

export default function ProductoPickerModal({ onAgregar, onCerrar }: Props) {
    const [q, setQ] = useState('');
    const [skuAbierto, setSkuAbierto] = useState<string | null>(null);

    const { data: productos, loading } = useApi<Paginado<ProductoResumen>>(`/api/productos?q=${encodeURIComponent(q)}&limit=50`);
    const { data: detalle } = useApi<ProductoDetalle>(skuAbierto ? `/api/productos/${skuAbierto}` : null);

    return (
        <Modal abierto onCerrar={onCerrar} titulo="Agregar producto" subtitulo="Busca y elige la variante a vender" ancho>
            <SearchInput valor={q} onCambio={setQ} placeholder="Buscar por SKU o nombre…" />

            <div style={{ marginTop: 16, maxHeight: 420, overflowY: 'auto' }}>
                {loading ? (
                    <TablaSkeleton filas={4} />
                ) : !productos?.items.length ? (
                    <p style={{ color: 'var(--ink-2)', fontSize: 14, padding: '20px 0' }}>Sin resultados.</p>
                ) : (
                    productos.items.map((p) => (
                        <div key={p.sku} className="picker-row">
                            <button type="button" className="picker-row__head" onClick={() => setSkuAbierto(skuAbierto === p.sku ? null : p.sku)}>
                                <div>
                                    <div className="picker-row__nombre">{p.nombre}</div>
                                    <div className="picker-row__sku">{p.sku} · stock {p.stock_total}</div>
                                </div>
                            </button>

                            {skuAbierto === p.sku && (
                                <div className="picker-row__variantes">
                                    {!detalle ? (
                                        <TablaSkeleton filas={2} />
                                    ) : detalle.variantes.length === 0 ? (
                                        <p style={{ fontSize: 12, color: 'var(--ink-2)' }}>Sin variantes.</p>
                                    ) : (
                                        detalle.variantes.map((v) => {
                                            const costo = v.precio_costo || p.precio_costo || 0;
                                            const venta = v.precio_venta || p.precio_venta || 0;
                                            return (
                                                <div key={v.id} className="picker-variante">
                                                    <span>{v.talla} / {v.color}</span>
                                                    <span className="muted">costo {moneda(costo)} · venta {moneda(venta)}</span>
                                                    <span className={v.stock_actual <= 0 ? 'stock-now' : 'muted'}>stock: {v.stock_actual}</span>
                                                    <Button
                                                        variante="primario"
                                                        disabled={v.stock_actual <= 0}
                                                        onClick={() => onAgregar({
                                                            sku: p.sku, nombre: p.nombre, id_variante: v.id,
                                                            talla: v.talla, color: v.color,
                                                            precio_costo: costo, precio_venta: venta,
                                                        })}
                                                        icono={<FaPlus style={{ fontSize: 10 }} />}>
                                                        Agregar
                                                    </Button>
                                                </div>
                                            );
                                        })
                                    )}
                                </div>
                            )}
                        </div>
                    ))
                )}
            </div>
        </Modal>
    );
}