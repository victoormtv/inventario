'use client';

import { useState } from 'react';
import {
    FaBuilding,
    FaEnvelope,
    FaIdCard,
    FaPhone,
    FaPlus,
    FaSave,
    FaSearch,
    FaTimes,
    FaUserTie,
} from 'react-icons/fa';
import { api, ApiError } from '@/lib/api';
import { useApi } from '@/hooks/useApi';
import type { Contacto, Paginado, ResultadoDocumento } from '@/types';
import Button from '@/components/ui/Button';
import { Callout } from '@/components/ui/Form';

interface Props {
    clienteElegido: Contacto | null;
    onElegir: (c: Contacto | null) => void;
}

const CONTACTO_VACIO = {
    nombre: '',
    documento: '',
    telefono: '',
    email: '',
    direccion: '',
};

export default function ClienteSelector({ clienteElegido, onElegir }: Props) {
    const [q, setQ] = useState('');
    const [buscandoDoc, setBuscandoDoc] = useState(false);
    const [resultadoDoc, setResultadoDoc] = useState<ResultadoDocumento | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [creando, setCreando] = useState(false);
    const [formAbierto, setFormAbierto] = useState(false);
    const [form, setForm] = useState(CONTACTO_VACIO);

    const { data } = useApi<Paginado<Contacto>>(
        q.trim() ? `/api/contactos?q=${encodeURIComponent(q.trim())}&limit=6` : null
    );

    const actualizarForm = (campo: keyof typeof CONTACTO_VACIO, valor: string) =>
        setForm((f) => ({ ...f, [campo]: valor }));

    const buscarDocumento = async () => {
        const n = q.trim();
        if (n.length < 8) return;
        setBuscandoDoc(true);
        setResultadoDoc(null);
        setError(null);
        try {
            const r = await api<ResultadoDocumento>(`/api/consultar-documento?numero=${n}`);
            setResultadoDoc(r);
            setForm({
                nombre: r.nombre,
                documento: r.numero,
                telefono: '',
                email: '',
                direccion: r.direccion || '',
            });
            setFormAbierto(true);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'No se encontró el documento.');
        } finally {
            setBuscandoDoc(false);
        }
    };

    const abrirFormManual = () => {
        setResultadoDoc(null);
        setForm({ ...CONTACTO_VACIO, documento: /^\d{8,11}$/.test(q.trim()) ? q.trim() : '' });
        setFormAbierto(true);
        setError(null);
    };

    const crearYUsar = async () => {
        if (!form.nombre.trim()) return setError('Ingresa el nombre del cliente.');
        setCreando(true);
        setError(null);
        try {
            const nuevo = await api<{ id: number }>('/api/contactos', {
                method: 'POST',
                json: {
                    tipo: 'cliente',
                    nombre: form.nombre.trim(),
                    documento: form.documento.trim(),
                    telefono: form.telefono.trim(),
                    email: form.email.trim(),
                    direccion: form.direccion.trim(),
                },
            });
            onElegir({ id: nuevo.id, tipo: 'cliente', ...form });
            setQ('');
            setResultadoDoc(null);
            setFormAbierto(false);
            setForm(CONTACTO_VACIO);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'No se pudo crear el cliente.');
        } finally {
            setCreando(false);
        }
    };

    const seleccionarClienteGeneral = async () => {
        try {
            const list = await api<Paginado<Contacto>>('/api/contactos?q=Cliente%20General&limit=1');
            if (list.items && list.items.length > 0) {
                onElegir(list.items[0]);
            } else {
                onElegir({
                    id: 1,
                    tipo: 'cliente',
                    nombre: 'Cliente General',
                    documento: '00000000',
                    telefono: '',
                    email: '',
                    direccion: '',
                });
            }
        } catch {
            onElegir({
                id: 1,
                tipo: 'cliente',
                nombre: 'Cliente General',
                documento: '00000000',
                telefono: '',
                email: '',
                direccion: '',
            });
        }
    };

    if (clienteElegido) {
        const esEmpresa = clienteElegido.documento?.length === 11;
        return (
            <div className="flex items-center justify-between gap-3 p-3 bg-white border border-indigo-200 rounded-xl shadow-2xs transition-all">
                <div className="flex items-center gap-3 overflow-hidden">
                    <div className="w-9 h-9 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center shrink-0 text-sm font-bold border border-indigo-100">
                        {esEmpresa ? <FaBuilding /> : <FaIdCard />}
                    </div>
                    <div className="min-w-0">
                        <div className="text-xs font-bold text-slate-800 truncate">
                            {clienteElegido.nombre}
                        </div>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500 mt-0.5">
                            {clienteElegido.documento && (
                                <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-slate-700 font-semibold">
                                    {clienteElegido.documento}
                                </span>
                            )}
                            {clienteElegido.telefono && (
                                <span className="inline-flex items-center gap-1 text-slate-500">
                                    <FaPhone className="text-[9px] text-slate-400" /> {clienteElegido.telefono}
                                </span>
                            )}
                            {clienteElegido.email && (
                                <span className="inline-flex items-center gap-1 text-slate-500 truncate">
                                    <FaEnvelope className="text-[9px] text-slate-400" /> {clienteElegido.email}
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <button
                    type="button"
                    onClick={() => onElegir(null)}
                    className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-all cursor-pointer shrink-0"
                    title="Cambiar cliente"
                    aria-label="Cambiar cliente"
                >
                    <FaTimes className="text-xs" />
                </button>
            </div>
        );
    }

    const mostrarSugerencias = !formAbierto && data?.items && data.items.length > 0;

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative flex-1 min-w-[220px]">
                    <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 text-xs" />
                    <input
                        className="w-full bg-white border border-slate-200 rounded-xl pl-9 pr-3.5 py-2 text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition placeholder:text-slate-400"
                        placeholder="Busca por nombre, DNI o RUC…"
                        value={q}
                        onChange={(e) => {
                            setQ(e.target.value);
                            setResultadoDoc(null);
                            setError(null);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && /^\d{8,11}$/.test(q.trim())) {
                                e.preventDefault();
                                buscarDocumento();
                            }
                        }}
                        autoComplete="off"
                    />

                    {mostrarSugerencias && (
                        <div className="absolute top-[calc(100%+4px)] left-0 right-0 z-30 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto divide-y divide-slate-100">
                            {data!.items.map((c) => (
                                <button
                                    key={c.id}
                                    type="button"
                                    onClick={() => {
                                        onElegir(c);
                                        setQ('');
                                    }}
                                    onMouseDown={(e) => e.preventDefault()}
                                    className="w-full text-left px-3.5 py-2.5 flex items-center gap-2.5 hover:bg-slate-50 transition cursor-pointer text-xs"
                                >
                                    <FaUserTie className="text-indigo-500 text-xs shrink-0" />
                                    <span className="font-semibold text-slate-800 truncate">{c.nombre}</span>
                                    {c.documento && (
                                        <span className="text-[10px] text-slate-400 font-mono">
                                            ({c.documento})
                                        </span>
                                    )}
                                    {c.telefono && (
                                        <span className="text-[10px] text-slate-400 truncate">
                                            · {c.telefono}
                                        </span>
                                    )}
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/^\d{8,11}$/.test(q.trim()) && (
                    <Button
                        type="button"
                        onClick={buscarDocumento}
                        cargando={buscandoDoc}
                        icono={!buscandoDoc ? <FaSearch style={{ fontSize: 10 }} /> : undefined}
                    >
                        SUNAT/RENIEC
                    </Button>
                )}

                <Button
                    type="button"
                    onClick={abrirFormManual}
                    icono={<FaPlus style={{ fontSize: 10 }} />}
                >
                    Nuevo cliente
                </Button>

                <Button
                    type="button"
                    onClick={seleccionarClienteGeneral}
                    icono={<FaUserTie style={{ fontSize: 10 }} />}
                >
                    Cliente General
                </Button>
            </div>

            {error && <Callout tono="danger">{error}</Callout>}

            {formAbierto && (
                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    {resultadoDoc && (
                        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                            {resultadoDoc.tipo === 'dni' ? <FaIdCard /> : <FaBuilding />}
                            <span>
                                Encontrado en {resultadoDoc.tipo === 'dni' ? 'RENIEC' : 'SUNAT'} · {resultadoDoc.numero}
                            </span>
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
                        <label className="space-y-1 text-xs font-medium text-slate-600">
                            <span>Nombre / Razón social *</span>
                            <input
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                value={form.nombre}
                                onChange={(e) => actualizarForm('nombre', e.target.value)}
                            />
                        </label>

                        <label className="space-y-1 text-xs font-medium text-slate-600">
                            <span>DNI / RUC</span>
                            <input
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                value={form.documento}
                                onChange={(e) => actualizarForm('documento', e.target.value)}
                            />
                        </label>

                        <label className="space-y-1 text-xs font-medium text-slate-600">
                            <span>Celular</span>
                            <input
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                value={form.telefono}
                                onChange={(e) => actualizarForm('telefono', e.target.value)}
                                placeholder="999 999 999"
                            />
                        </label>

                        <label className="space-y-1 text-xs font-medium text-slate-600">
                            <span>Correo</span>
                            <input
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                type="email"
                                value={form.email}
                                onChange={(e) => actualizarForm('email', e.target.value)}
                                placeholder="cliente@correo.com"
                            />
                        </label>

                        <label className="space-y-1 text-xs font-medium text-slate-600 sm:col-span-2 md:col-span-4">
                            <span>Dirección</span>
                            <input
                                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs text-slate-800 font-medium focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                value={form.direccion}
                                onChange={(e) => actualizarForm('direccion', e.target.value)}
                            />
                        </label>
                    </div>

                    <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-200/60">
                        <Button
                            type="button"
                            onClick={() => {
                                setFormAbierto(false);
                                setResultadoDoc(null);
                            }}
                        >
                            Cancelar
                        </Button>
                        <Button
                            type="button"
                            variante="primario"
                            onClick={crearYUsar}
                            cargando={creando}
                            icono={<FaSave style={{ fontSize: 10 }} />}
                        >
                            Guardar y usar cliente
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
