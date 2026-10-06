'use client';
import { useState } from 'react';
import { api } from '../../lib/api';
import type { ProductoResumen } from '../../lib/types';
import { useToast } from '../ui/Toast';
import ModalSoloX from '../ModalSoloX';
import { Callout, Field } from '../ui/Form';

export interface VarianteEditable {
    id: number;
    talla: string;
    color: string;
    detalle?: string | null;
    kg?: number | null;
    lote?: string | null;
    stock_actual: number;
}

interface Props {
    producto: ProductoResumen | null;
    variante?: VarianteEditable | null;
    onGuardado: () => void;
    onCerrar: () => void;
}

interface FormProducto {
    sku: string;
    nombre: string;
    categoria: string;
    precio_costo: string;
    precio_venta: string;
    stock_minimo: string;
}

interface FormVariante {
    color: string;
    detalle: string;
    kg: string;
    lote: string;
}

// ── Sección con título al estilo Reportes ────────────────────────────────
function Seccion({ titulo, subtitulo, children }: { titulo: string; subtitulo?: string; children: React.ReactNode }) {
    return (
        <div className="rounded-xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-100">
                <p className="text-xs font-bold text-slate-700">{titulo}</p>
                {subtitulo && <p className="text-xs text-slate-400 mt-0.5">{subtitulo}</p>}
            </div>
            <div className="px-4 py-4 space-y-4">
                {children}
            </div>
        </div>
    );
}

// ── Input con label inline (compacto) ────────────────────────────────────
function CampoInline({
    label, hint, children,
}: { label: string; hint?: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1">
            <label className="block text-xs font-semibold text-slate-600">{label}</label>
            {children}
            {hint && <p className="text-xs text-slate-400">{hint}</p>}
        </div>
    );
}

function inputCls(readOnly = false) {
    return `w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 font-medium
        focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition
        placeholder:text-slate-300 ${readOnly ? 'opacity-60 cursor-not-allowed' : ''}`;
}

export default function ProductoModal({ producto, variante, onGuardado, onCerrar }: Props) {
    const toast = useToast();

    const [formP, setFormP] = useState<FormProducto>({
        sku: producto?.sku ?? '',
        nombre: producto?.nombre ?? '',
        categoria: producto?.categoria ?? '',
        precio_costo: producto ? String(producto.precio_costo) : '',
        precio_venta: producto ? String(producto.precio_venta) : '',
        stock_minimo: producto ? String(producto.stock_minimo) : '5',
    });

    const [formV, setFormV] = useState<FormVariante>({
        color: variante?.color ?? '',
        detalle: variante?.detalle ?? '',
        kg: variante?.kg != null ? String(variante.kg) : '',
        lote: variante?.lote ?? '',
    });

    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);

    const setP = (k: keyof FormProducto) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setFormP(f => ({ ...f, [k]: e.target.value }));

    const setV = (k: keyof FormVariante) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setFormV(f => ({ ...f, [k]: e.target.value }));

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        setEnviando(true);
        setError(null);

        const bodyP = {
            nombre: formP.nombre.trim(),
            categoria: formP.categoria.trim(),
            precio_costo: parseFloat(formP.precio_costo) || 0,
            precio_venta: parseFloat(formP.precio_venta) || 0,
            stock_minimo: parseInt(formP.stock_minimo) || 0,
        };

        try {
            if (producto) {
                await api(`/api/productos/${producto.sku}`, { method: 'PUT', json: bodyP });
            } else {
                await api('/api/productos', { method: 'POST', json: { sku: formP.sku.trim().toUpperCase(), ...bodyP } });
            }
        } catch (err) {
            setError((err as Error).message);
            setEnviando(false);
            return;
        }

        if (producto && variante) {
            try {
                await api(`/api/variantes/${variante.id}`, {
                    method: 'PUT',
                    json: {
                        color: formV.color.trim(),
                        detalle: formV.detalle.trim() || null,
                        kg: formV.kg !== '' ? parseFloat(formV.kg) : null,
                        lote: formV.lote.trim() || null,
                    },
                });
            } catch (err) {
                setError(`El producto se guardó, pero no se pudo actualizar la variante: ${(err as Error).message}`);
                setEnviando(false);
                return;
            }
        }

        toast(producto ? 'Cambios guardados' : 'Producto registrado');
        setEnviando(false);
        onGuardado();
    };

    return (
        <ModalSoloX
            titulo={producto ? 'Editar producto' : 'Nuevo producto'}
            subtitulo={producto ? producto.sku : 'Los campos marcados con * son obligatorios'}
            onCerrar={onCerrar}
            bloqueado={enviando}
            ancho={680}
        >
            <form onSubmit={guardar} className="space-y-4">
                {error && (
                    <div className="flex items-start gap-3 p-3.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                        <span className="mt-0.5 shrink-0">⚠</span>
                        <span>{error}</span>
                    </div>
                )}

                {/* ── Sección producto ── */}
                <Seccion
                    titulo="Datos del producto"
                    subtitulo={producto ? undefined : 'El SKU no se puede cambiar después de crearlo'}
                >
                    {!producto && (
                        <CampoInline label="SKU *" hint="Ej: POL-001">
                            <input
                                className={inputCls()}
                                value={formP.sku}
                                onChange={setP('sku')}
                                placeholder="POL-001"
                                required
                                autoFocus
                            />
                        </CampoInline>
                    )}

                    <CampoInline label="Nombre *">
                        <input
                            className={inputCls()}
                            value={formP.nombre}
                            onChange={setP('nombre')}
                            placeholder="Ej: Pegamento Casacor"
                            required
                            autoFocus={!!producto}
                        />
                    </CampoInline>

                    <CampoInline label="Categoría">
                        <input
                            className={inputCls()}
                            value={formP.categoria}
                            onChange={setP('categoria')}
                            placeholder="Ej: Pegamentos, Fraguas, Accesorios"
                        />
                    </CampoInline>

                    <div className="grid grid-cols-3 gap-3">
                        <CampoInline label="Precio costo *">
                            <input
                                className={inputCls()}
                                type="number" step="0.01" min="0"
                                value={formP.precio_costo}
                                onChange={setP('precio_costo')}
                                placeholder="0.00"
                                required
                            />
                        </CampoInline>
                        <CampoInline label="Precio venta *">
                            <input
                                className={inputCls()}
                                type="number" step="0.01" min="0"
                                value={formP.precio_venta}
                                onChange={setP('precio_venta')}
                                placeholder="0.00"
                                required
                            />
                        </CampoInline>
                        <CampoInline label="Stock mínimo" hint="Alerta por correo al llegar aquí">
                            <input
                                className={inputCls()}
                                type="number" min="0"
                                value={formP.stock_minimo}
                                onChange={setP('stock_minimo')}
                                required
                            />
                        </CampoInline>
                    </div>
                </Seccion>

                {/* ── Sección variante (solo en edición) ── */}
                {producto && variante && (
                    <Seccion
                        titulo="Datos de la variante"
                        subtitulo="Solo afecta la fila que abriste"
                    >
                        <div className="grid grid-cols-2 gap-3">
                            <CampoInline label="Color *">
                                <input
                                    className={inputCls()}
                                    value={formV.color}
                                    onChange={setV('color')}
                                    placeholder="Ej: Blanco, Gris"
                                    required
                                />
                            </CampoInline>
                            <CampoInline label="Detalle" hint="Ej: Flexible, Extrafuerte, Interiores">
                                <input
                                    className={inputCls()}
                                    value={formV.detalle}
                                    onChange={setV('detalle')}
                                    placeholder="Flexible"
                                />
                            </CampoInline>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <CampoInline label="Peso (kg)" hint="Peso unitario del producto">
                                <input
                                    className={inputCls()}
                                    type="number" step="0.01" min="0"
                                    value={formV.kg}
                                    onChange={setV('kg')}
                                    placeholder="25.00"
                                />
                            </CampoInline>
                            <CampoInline label="Lote" hint="Número o código del lote">
                                <input
                                    className={inputCls()}
                                    value={formV.lote}
                                    onChange={setV('lote')}
                                    placeholder="Ej: L-2026-01"
                                />
                            </CampoInline>
                        </div>

                        <CampoInline label="Stock actual" hint="Se modifica desde Ingreso de mercadería">
                            <input
                                className={inputCls(true)}
                                value={`${variante.stock_actual} unidades`}
                                readOnly
                                disabled
                            />
                        </CampoInline>
                    </Seccion>
                )}

                {/* ── Acciones ── */}
                <div className="flex justify-end pt-2">
                    <button
                        type="submit"
                        disabled={enviando}
                        className="flex items-center gap-2 px-5 py-2.5 text-sm font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800 rounded-xl transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">
                        {enviando
                            ? <><span className="animate-spin">⟳</span> Guardando…</>
                            : producto ? 'Guardar cambios' : 'Registrar producto'
                        }
                    </button>
                </div>
            </form>
        </ModalSoloX>
    );
}