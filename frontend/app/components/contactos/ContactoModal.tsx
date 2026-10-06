'use client';

import { useState } from 'react';
import {
    FaSearch, FaUserTie, FaTruck, FaIdCard, FaBuilding, FaCheckCircle,
} from 'react-icons/fa';
import { api, ApiError } from '../../lib/api';
import type { Contacto } from '../../lib/types';
import Modal from '../Modal';
import { useToast } from '../ui/Toast';

interface ResultadoDocumento {
    tipo: 'dni' | 'ruc';
    numero: string;
    nombre: string;
    direccion: string;
    estado?: string;
    condicion?: string;
}

interface FormContacto {
    tipo: 'cliente' | 'proveedor';
    nombre: string;
    documento: string;
    telefono: string;
    email: string;
    direccion: string;
}

const FORM_VACIO: FormContacto = {
    tipo: 'cliente', nombre: '', documento: '', telefono: '', email: '', direccion: '',
};

const inputCls = 'w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition placeholder:text-slate-300';

// ── Buscador DNI/RUC ─────────────────────────────────────────────────
function BuscadorDocumento({ onAutocompletar }: { onAutocompletar: (r: ResultadoDocumento) => void }) {
    const [numero, setNumero] = useState('');
    const [buscando, setBuscando] = useState(false);
    const [resultado, setResultado] = useState<ResultadoDocumento | null>(null);
    const [error, setError] = useState<string | null>(null);

    const buscar = async () => {
        const n = numero.trim();
        if (!n) return;
        setBuscando(true);
        setResultado(null);
        setError(null);
        try {
            const data = await api<ResultadoDocumento>(`/api/consultar-documento?numero=${n}`);
            setResultado(data);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Error al consultar.');
        } finally {
            setBuscando(false);
        }
    };

    return (
        <div className="rounded-xl border border-indigo-100 bg-indigo-50 p-4 space-y-3">
            <p className="text-xs font-bold text-indigo-700">Buscar en RENIEC / SUNAT</p>
            <div className="flex gap-2">
                <input
                    className={inputCls + ' flex-1'}
                    placeholder="DNI (8 dígitos) o RUC (11 dígitos)"
                    value={numero}
                    onChange={e => { setNumero(e.target.value); setResultado(null); setError(null); }}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); buscar(); } }}
                    maxLength={11}
                />
                <button
                    type="button"
                    onClick={buscar}
                    disabled={buscando || numero.trim().length < 8}
                    className="flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap">
                    {buscando ? <span className="animate-spin">⟳</span> : <FaSearch style={{ fontSize: 11 }} />}
                    Consultar
                </button>
            </div>

            {error && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-100 rounded-xl text-xs text-red-700">
                    <span className="shrink-0 mt-0.5">⚠</span> {error}
                </div>
            )}

            {resultado && (
                <div className="flex items-start justify-between gap-3 p-3.5 bg-white border border-indigo-200 rounded-xl">
                    <div className="space-y-1">
                        <div className="flex items-center gap-2">
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold">
                                {resultado.tipo === 'dni' ? <FaIdCard /> : <FaBuilding />}
                                {resultado.tipo === 'dni' ? 'RENIEC' : 'SUNAT'} · {resultado.numero}
                            </span>
                            {resultado.estado && (
                                <span className={`px-2 py-0.5 rounded-md text-xs font-semibold border ${resultado.estado === 'ACTIVO' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-amber-50 text-amber-700 border-amber-200'}`}>
                                    {resultado.estado}
                                </span>
                            )}
                        </div>
                        <p className="text-sm font-bold text-slate-800">{resultado.nombre}</p>
                        {resultado.direccion && <p className="text-xs text-slate-500">{resultado.direccion}</p>}
                        {resultado.condicion && <p className="text-xs text-slate-400">Condición: {resultado.condicion}</p>}
                    </div>
                    <button
                        type="button"
                        onClick={() => onAutocompletar(resultado)}
                        className="shrink-0 flex items-center gap-1.5 px-3.5 py-2 text-xs font-bold text-indigo-700 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-xl transition-all cursor-pointer">
                        <FaCheckCircle style={{ fontSize: 11 }} /> Usar datos
                    </button>
                </div>
            )}
        </div>
    );
}

// ── Campo ─────────────────────────────────────────────────────────────
function Campo({ label, children }: { label: string; children: React.ReactNode }) {
    return (
        <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-slate-600">{label}</label>
            {children}
        </div>
    );
}

// ── Modal ─────────────────────────────────────────────────────────────
interface Props {
    contacto: Contacto | null;
    onGuardado: () => void;
    onCerrar: () => void;
}

export default function ContactoModal({ contacto, onGuardado, onCerrar }: Props) {
    const toast = useToast();
    const [form, setForm] = useState<FormContacto>(
        contacto
            ? { tipo: contacto.tipo, nombre: contacto.nombre, documento: contacto.documento ?? '', telefono: contacto.telefono ?? '', email: contacto.email ?? '', direccion: contacto.direccion ?? '' }
            : FORM_VACIO
    );
    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);

    const set = (k: keyof FormContacto) => (e: React.ChangeEvent<HTMLInputElement>) =>
        setForm(f => ({ ...f, [k]: e.target.value }));

    const autocompletar = (r: ResultadoDocumento) => {
        setForm(f => ({
            ...f,
            nombre: r.nombre,
            documento: r.numero,
            direccion: r.direccion || f.direccion,
            tipo: r.tipo === 'ruc' ? 'proveedor' : f.tipo,
        }));
    };

    const guardar = async (e: React.FormEvent) => {
        e.preventDefault();
        setEnviando(true);
        setError(null);
        const body = {
            tipo: form.tipo, nombre: form.nombre.trim(), documento: form.documento.trim(),
            telefono: form.telefono.trim(), email: form.email.trim(), direccion: form.direccion.trim(),
        };
        try {
            if (contacto) {
                await api(`/api/contactos/${contacto.id}`, { method: 'PUT', json: body });
                toast('Contacto actualizado');
            } else {
                await api('/api/contactos', { method: 'POST', json: body });
                toast('Contacto registrado');
            }
            onGuardado();
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Error al guardar el contacto.');
        } finally {
            setEnviando(false);
        }
    };

    return (
        <Modal
            abierto
            onCerrar={onCerrar}
            titulo={contacto ? 'Editar contacto' : 'Nuevo contacto'}
            subtitulo={contacto ? (contacto.documento || contacto.tipo) : 'Los campos marcados con * son obligatorios'}>
            <form onSubmit={guardar} className="space-y-4">
                {error && (
                    <div className="flex items-start gap-2 p-3.5 bg-red-50 border border-red-100 rounded-xl text-sm text-red-700">
                        <span className="shrink-0 mt-0.5">⚠</span> {error}
                    </div>
                )}

                {!contacto && <BuscadorDocumento onAutocompletar={autocompletar} />}

                <Campo label="Tipo de contacto *">
                    <div className="grid grid-cols-2 gap-2">
                        {(['cliente', 'proveedor'] as const).map(t => (
                            <button
                                key={t}
                                type="button"
                                onClick={() => setForm(f => ({ ...f, tipo: t }))}
                                className={`flex items-center justify-center gap-2 py-2.5 text-xs font-bold rounded-xl border transition-all cursor-pointer ${form.tipo === t
                                    ? t === 'cliente'
                                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                                        : 'bg-emerald-600 text-white border-emerald-600 shadow-md shadow-emerald-600/20'
                                    : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'}`}>
                                {t === 'cliente' ? <FaUserTie /> : <FaTruck />}
                                {t === 'cliente' ? 'Cliente' : 'Proveedor'}
                            </button>
                        ))}
                    </div>
                </Campo>

                <Campo label="Nombre / Razón social *">
                    <input className={inputCls} value={form.nombre} onChange={set('nombre')}
                        placeholder="Ej: Juan Pérez o Distribuidora SAC" required autoFocus={!!contacto} />
                </Campo>

                <div className="grid grid-cols-2 gap-3">
                    <Campo label="DNI / RUC">
                        <input className={inputCls} value={form.documento} onChange={set('documento')} placeholder="10456789123" />
                    </Campo>
                    <Campo label="Teléfono">
                        <input className={inputCls} value={form.telefono} onChange={set('telefono')} placeholder="+51 987 654 321" />
                    </Campo>
                </div>

                <Campo label="Correo electrónico">
                    <input className={inputCls} type="email" value={form.email} onChange={set('email')} placeholder="contacto@empresa.com" />
                </Campo>

                <Campo label="Dirección">
                    <input className={inputCls} value={form.direccion} onChange={set('direccion')} placeholder="Av. Principal 123, Lima" />
                </Campo>

                <div className="flex justify-end gap-2 pt-1">
                    <button type="button" onClick={onCerrar}
                        className="px-4 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all cursor-pointer">
                        Cancelar
                    </button>
                    <button type="submit" disabled={enviando}
                        className="flex items-center gap-2 px-5 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all shadow-md shadow-indigo-600/20 disabled:opacity-50 cursor-pointer">
                        {enviando ? <><span className="animate-spin">⟳</span> Guardando…</> : contacto ? 'Guardar cambios' : 'Crear contacto'}
                    </button>
                </div>
            </form>
        </Modal>
    );
}