'use client';
import { useState } from 'react';
import { FaBoxOpen } from 'react-icons/fa';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import type { Contacto, Paginado, ProductoDetalle, ProductoResumen, ResultadoIngreso } from '../lib/types';
import Button from '../components/ui/Button';
import ConfirmarModal from '../components/ui/ConfirmarModal';
import { Callout, Field } from '../components/ui/Form';
import Modal from '../components/Modal';
import { useToast } from '../components/ui/Toast';

interface FormIngreso {
    sku: string;
    id_variante: string;
    id_proveedor: string;
    cantidad: string;
    precio_unitario: string;
    referencia: string;
}

const FORM_VACIO: FormIngreso = { sku: '', id_variante: '', id_proveedor: '', cantidad: '', precio_unitario: '', referencia: '' };

export default function IngresoMercaderiaModal({ onCerrar, onGuardado }: { onCerrar: () => void; onGuardado: () => void }) {
    const toast = useToast();
    const [form, setForm] = useState<FormIngreso>(FORM_VACIO);
    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [confirmando, setConfirmando] = useState(false);

    const { data: productos } = useApi<Paginado<ProductoResumen>>('/api/productos?limit=200');
    const { data: proveedores } = useApi<Paginado<Contacto>>('/api/contactos?tipo=proveedor&limit=200');
    const { data: detalle } = useApi<ProductoDetalle>(form.sku ? `/api/productos/${form.sku}` : null);

    const set = (k: keyof FormIngreso) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
        setForm((f) => ({ ...f, [k]: e.target.value, ...(k === 'sku' ? { id_variante: '' } : {}) }));

    const productoElegido = productos?.items.find((p) => p.sku === form.sku);
    const varianteElegida = detalle?.variantes.find((v) => v.id === Number(form.id_variante));
    const proveedorElegido = proveedores?.items.find((c) => c.id === Number(form.id_proveedor));

    const precioAnterior = productoElegido?.precio_costo ?? null;
    const precioNuevo = Number(form.precio_unitario);
    const cambiaPrecio = precioAnterior !== null && precioNuevo > 0 && precioAnterior !== precioNuevo;

    const pedirConfirmacion = (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (!form.id_variante) return setError('Elige la variante que ingresa.');
        if (!form.id_proveedor) return setError('Elige el proveedor.');
        setConfirmando(true);
    };

    const confirmar = async () => {
        setEnviando(true);
        setError(null);
        try {
            await api<ResultadoIngreso>('/api/mercaderia/ingreso', {
                method: 'POST',
                json: {
                    id_variante: Number(form.id_variante),
                    id_proveedor: Number(form.id_proveedor),
                    cantidad: parseInt(form.cantidad),
                    precio_unitario: parseFloat(form.precio_unitario),
                    referencia: form.referencia.trim(),
                },
            });
            toast('Ingreso registrado');
            setConfirmando(false);
            onGuardado();
        } catch (err) {
            setConfirmando(false);
            setError((err as Error).message);
        } finally {
            setEnviando(false);
        }
    };

    return (
        <>
            <Modal abierto onCerrar={onCerrar} titulo="Ingreso de mercadería" subtitulo="Registra la entrada de stock de un proveedor">
                <form className="form" onSubmit={pedirConfirmacion}>
                    {error && <Callout tono="danger">{error}</Callout>}

                    <Field label="Producto *">
                        <select className="select" value={form.sku} onChange={set('sku')} required>
                            <option value="">Selecciona un producto</option>
                            {productos?.items.map((p) => (
                                <option key={p.sku} value={p.sku}>
                                    {p.sku} — {p.nombre}
                                </option>
                            ))}
                        </select>
                    </Field>

                    {form.sku && (
                        <Field label="Variante *">
                            <select className="select" value={form.id_variante} onChange={set('id_variante')} required>
                                <option value="">Selecciona una variante</option>
                                {detalle?.variantes.map((v) => (
                                    <option key={v.id} value={v.id}>
                                        {v.talla} / {v.color} (stock: {v.stock_actual})
                                    </option>
                                ))}
                            </select>
                        </Field>
                    )}

                    <Field label="Proveedor *">
                        <select className="select" value={form.id_proveedor} onChange={set('id_proveedor')} required>
                            <option value="">Selecciona un proveedor</option>
                            {proveedores?.items.map((c) => (
                                <option key={c.id} value={c.id}>
                                    {c.nombre}
                                </option>
                            ))}
                        </select>
                    </Field>

                    <div className="field-row">
                        <Field label="Cantidad *">
                            <input className="input" type="number" min="1" value={form.cantidad} onChange={set('cantidad')} required />
                        </Field>
                        <Field label="Precio unitario *">
                            <input className="input" type="number" step="0.01" min="0" value={form.precio_unitario} onChange={set('precio_unitario')} required />
                        </Field>
                    </div>

                    {cambiaPrecio && (
                        <Callout tono="warn">
                            El precio de costo actual es S/ {precioAnterior}. Se actualizará a S/ {form.precio_unitario} para todo el stock existente de este producto.
                        </Callout>
                    )}

                    <Field label="Referencia" hint="N° de guía, factura, etc.">
                        <input className="input" value={form.referencia} onChange={set('referencia')} />
                    </Field>

                    <div className="form__actions">
                        <Button onClick={onCerrar}>Cancelar</Button>
                        <Button type="submit" variante="primario" icono={<FaBoxOpen style={{ fontSize: 11 }} />}>
                            Registrar ingreso
                        </Button>
                    </div>
                </form>
            </Modal>

            <ConfirmarModal
                abierto={confirmando}
                titulo="Confirmar ingreso de mercadería"
                texto={`¿Confirmas el ingreso de ${form.cantidad} unidades de "${productoElegido?.nombre ?? ''}"${varianteElegida ? ` (${varianteElegida.talla} / ${varianteElegida.color})` : ''
                    } desde ${proveedorElegido?.nombre ?? ''} a S/ ${form.precio_unitario} por unidad?${cambiaPrecio ? ` El precio de costo cambiará de S/ ${precioAnterior} a S/ ${form.precio_unitario}.` : ''
                    }`}
                textoConfirmar="Sí, registrar"
                cargando={enviando}
                onConfirmar={confirmar}
                onCancelar={() => setConfirmando(false)}
            />
        </>
    );
}