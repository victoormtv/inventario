'use client';

import { useState } from 'react';
import {
    FaUserPlus, FaSearch, FaUserTie, FaTruck, FaPhone, FaEnvelope,
    FaMapMarkerAlt, FaIdCard, FaEdit, FaTrash, FaBuilding, FaSync, FaFilter,
} from 'react-icons/fa';
import { api } from '../lib/api';
import { useApi } from '../lib/useApi';
import type { Contacto, Paginado } from '../lib/types';
import ConfirmarModal from '../components/ui/ConfirmarModal';
import Pagination from '../components/ui/Pagination';
import { EmptyState, ErrorState } from '../components/ui/States';
import { useToast } from '../components/ui/Toast';
import ContactoModal from '../components/contactos/ContactoModal';

function ContactoCard({ c, onEditar, onEliminar }: { c: Contacto; onEditar: () => void; onEliminar: () => void }) {
    const esCliente = c.tipo === 'cliente';
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-5 flex flex-col gap-3 hover:shadow-md transition-shadow">
            <div className="flex items-start justify-between gap-2">
                <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-semibold ${esCliente ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-emerald-50 text-emerald-700 border-emerald-200'}`}>
                    {esCliente ? <FaUserTie style={{ fontSize: 10 }} /> : <FaTruck style={{ fontSize: 10 }} />}
                    {c.tipo}
                </span>
                <div className="flex gap-1">
                    <button onClick={onEditar}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 transition-all cursor-pointer" title="Editar">
                        <FaEdit style={{ fontSize: 12 }} />
                    </button>
                    <button onClick={onEliminar}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-all cursor-pointer" title="Eliminar">
                        <FaTrash style={{ fontSize: 12 }} />
                    </button>
                </div>
            </div>

            <div>
                <p className="font-bold text-slate-800 text-sm leading-tight">{c.nombre}</p>
                {c.documento && (
                    <div className="flex items-center gap-1.5 mt-1 text-xs text-slate-400 font-mono">
                        {c.documento.length === 11 ? <FaBuilding style={{ fontSize: 10 }} /> : <FaIdCard style={{ fontSize: 10 }} />}
                        {c.documento.length === 8 ? 'DNI: ' : c.documento.length === 11 ? 'RUC: ' : ''}{c.documento}
                    </div>
                )}
            </div>

            {(c.telefono || c.email || c.direccion) && (
                <div className="space-y-1.5 pt-2 border-t border-slate-50">
                    {c.telefono && (
                        <a href={`tel:${c.telefono}`} className="flex items-center gap-2 text-xs text-slate-500 hover:text-indigo-600 transition-colors">
                            <FaPhone style={{ fontSize: 10 }} className="shrink-0 text-slate-300" /> {c.telefono}
                        </a>
                    )}
                    {c.email && (
                        <a href={`mailto:${c.email}`} className="flex items-center gap-2 text-xs text-slate-500 hover:text-indigo-600 transition-colors">
                            <FaEnvelope style={{ fontSize: 10 }} className="shrink-0 text-slate-300" />
                            <span className="truncate">{c.email}</span>
                        </a>
                    )}
                    {c.direccion && (
                        <div className="flex items-start gap-2 text-xs text-slate-500">
                            <FaMapMarkerAlt style={{ fontSize: 10 }} className="shrink-0 text-slate-300 mt-0.5" />
                            <span className="line-clamp-2">{c.direccion}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

export default function ContactosPage() {
    const toast = useToast();
    const [q, setQ] = useState('');
    const [tipoFiltro, setTipoFiltro] = useState('');
    const [page, setPage] = useState(1);
    const LIMIT = 12;

    const params = new URLSearchParams({ page: String(page), limit: String(LIMIT) });
    if (q) params.set('q', q);
    if (tipoFiltro) params.set('tipo', tipoFiltro);

    const lista = useApi<Paginado<Contacto>>(`/api/contactos?${params}`);
    const [modalContacto, setModalContacto] = useState<'nuevo' | Contacto | null>(null);
    const [confirmarEliminar, setConfirmarEliminar] = useState<Contacto | null>(null);
    const [eliminando, setEliminando] = useState(false);

    const refetch = () => lista.refetch();
    const cambiarFiltro = (fn: () => void) => { fn(); setPage(1); };

    const eliminar = async () => {
        if (!confirmarEliminar) return;
        setEliminando(true);
        try {
            await api(`/api/contactos/${confirmarEliminar.id}`, { method: 'DELETE' });
            toast('Contacto eliminado');
            setConfirmarEliminar(null);
            refetch();
        } catch (err) { toast((err as Error).message, 'error'); }
        finally { setEliminando(false); }
    };

    const clientes = lista.data?.items.filter(c => c.tipo === 'cliente').length ?? 0;
    const proveedores = lista.data?.items.filter(c => c.tipo === 'proveedor').length ?? 0;

    return (
        <div className="min-h-screen bg-slate-50">
            <div className="max-w-7xl mx-auto px-4 py-8 space-y-8">

                <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
                    <div>
                        <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-1">Módulo de Contactos</p>
                        <h1 className="text-3xl font-black text-slate-900 leading-tight">Clientes y proveedores</h1>
                        <p className="text-slate-500 text-sm mt-1.5 max-w-lg">
                            Busca por DNI o RUC para autocompletar datos desde RENIEC y SUNAT.
                        </p>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={refetch} disabled={lista.loading}
                            className="flex items-center gap-2 px-3.5 py-2.5 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all cursor-pointer disabled:opacity-50 shadow-xs">
                            <FaSync className={`text-slate-400 ${lista.loading ? 'animate-spin' : ''}`} />
                            Actualizar
                        </button>
                        <button onClick={() => setModalContacto('nuevo')}
                            className="flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl transition-all cursor-pointer shadow-md shadow-indigo-600/20">
                            <FaUserPlus /> Nuevo contacto
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-5">
                    <div className="flex flex-col sm:flex-row gap-4 items-end">
                        <div className="flex-1 space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                <FaSearch className="text-indigo-400" /> Buscar
                            </label>
                            <div className="relative">
                                <FaSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-300 text-xs" />
                                <input
                                    type="text"
                                    value={q}
                                    onChange={e => cambiarFiltro(() => setQ(e.target.value))}
                                    placeholder="Nombre, DNI/RUC, teléfono…"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-9 pr-3.5 py-2.5 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition placeholder:text-slate-300"
                                />
                            </div>
                        </div>
                        <div className="space-y-1.5">
                            <label className="flex items-center gap-1.5 text-xs font-semibold text-slate-500">
                                <FaFilter className="text-indigo-400" /> Tipo
                            </label>
                            <div className="flex gap-2">
                                {[
                                    { key: '', label: 'Todos' },
                                    { key: 'cliente', label: 'Clientes' },
                                    { key: 'proveedor', label: 'Proveedores' },
                                ].map(f => (
                                    <button key={f.key}
                                        onClick={() => cambiarFiltro(() => setTipoFiltro(f.key))}
                                        className={`px-3.5 py-2.5 text-xs font-semibold rounded-xl border transition-all cursor-pointer ${tipoFiltro === f.key
                                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-md shadow-indigo-600/20'
                                            : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300 hover:bg-slate-50'}`}>
                                        {f.label}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                    <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                        <div>
                            <h2 className="font-bold text-slate-900 text-sm">Directorio</h2>
                            <p className="text-xs text-slate-400 mt-0.5">
                                {lista.data ? `${lista.data.total} en total` : 'Cargando…'}
                            </p>
                        </div>
                        {lista.data && lista.data.total > 0 && (
                            <div className="flex gap-2">
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-indigo-50 text-indigo-700 border border-indigo-200 text-xs font-semibold">
                                    <FaUserTie style={{ fontSize: 10 }} /> {clientes} clientes
                                </span>
                                <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold">
                                    <FaTruck style={{ fontSize: 10 }} /> {proveedores} proveedores
                                </span>
                            </div>
                        )}
                    </div>

                    <div className="p-6">
                        {lista.error ? (
                            <ErrorState mensaje={lista.error} onReintentar={refetch} />
                        ) : !lista.data ? (
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                {Array.from({ length: 8 }).map((_, i) => (
                                    <div key={i} className="h-40 bg-slate-100 rounded-2xl animate-pulse" />
                                ))}
                            </div>
                        ) : lista.data.items.length === 0 ? (
                            <EmptyState icono={<FaUserTie />} titulo="Sin contactos"
                                texto={q || tipoFiltro ? 'Ningún contacto coincide con los filtros.' : 'Registra tu primer cliente o proveedor con el botón de arriba.'}
                                accion={q || tipoFiltro
                                    ? <button onClick={() => { setQ(''); setTipoFiltro(''); setPage(1); }}
                                        className="mt-3 px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 transition-all cursor-pointer">
                                        Limpiar filtros
                                    </button>
                                    : undefined}
                            />
                        ) : (
                            <>
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                                    {lista.data.items.map(c => (
                                        <ContactoCard
                                            key={c.id}
                                            c={c}
                                            onEditar={() => setModalContacto(c)}
                                            onEliminar={() => setConfirmarEliminar(c)}
                                        />
                                    ))}
                                </div>
                                <div className="mt-4">
                                    <Pagination page={page} limit={LIMIT} total={lista.data.total} onPage={setPage} />
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {modalContacto && (
                <ContactoModal
                    contacto={modalContacto === 'nuevo' ? null : modalContacto}
                    onCerrar={() => setModalContacto(null)}
                    onGuardado={() => { setModalContacto(null); refetch(); }}
                />
            )}

            <ConfirmarModal
                abierto={!!confirmarEliminar}
                titulo="Eliminar contacto"
                texto={`¿Eliminar a "${confirmarEliminar?.nombre}"? Esta acción no se puede deshacer.`}
                textoConfirmar="Sí, eliminar"
                cargando={eliminando}
                onConfirmar={eliminar}
                onCancelar={() => setConfirmarEliminar(null)}
            />
        </div>
    );
}