'use client';

import { useState } from 'react';
import {
    FaUserPlus,
    FaSearch,
    FaUserTie,
    FaTruck,
    FaPhone,
    FaEnvelope,
    FaMapMarkerAlt,
    FaIdCard,
    FaEdit,
    FaTrash,
    FaSpinner,
    FaExclamationCircle,
} from 'react-icons/fa';
import Modal from '../components/Modal';
import Pagination from '../components/ui/Pagination';
import { useApi } from '../lib/useApi';
import { api, ApiError } from '../lib/api';
import type { Contacto, Paginado } from '../lib/types';

export default function ContactosPage() {
    const [q, setQ] = useState('');
    const [tipoFiltro, setTipoFiltro] = useState<string>('');
    const [page, setPage] = useState(1);

    // Estado del modal de crear / editar
    const [modalAbierto, setModalAbierto] = useState(false);
    const [contactoEditar, setContactoEditar] = useState<Contacto | null>(null);

    // Campos del formulario
    const [tipo, setTipo] = useState<'cliente' | 'proveedor'>('cliente');
    const [nombre, setNombre] = useState('');
    const [documento, setDocumento] = useState('');
    const [telefono, setTelefono] = useState('');
    const [email, setEmail] = useState('');
    const [direccion, setDireccion] = useState('');

    const [guardando, setGuardando] = useState(false);
    const [errorForm, setErrorForm] = useState<string | null>(null);

    // API hook
    const url = `/api/contactos?q=${encodeURIComponent(q)}&tipo=${encodeURIComponent(tipoFiltro)}&page=${page}&limit=12`;
    const { data, loading, error, refetch } = useApi<Paginado<Contacto>>(url);

    const abrirCrear = () => {
        setContactoEditar(null);
        setTipo('cliente');
        setNombre('');
        setDocumento('');
        setTelefono('');
        setEmail('');
        setDireccion('');
        setErrorForm(null);
        setModalAbierto(true);
    };

    const abrirEditar = (c: Contacto) => {
        setContactoEditar(c);
        setTipo(c.tipo);
        setNombre(c.nombre);
        setDocumento(c.documento || '');
        setTelefono(c.telefono || '');
        setEmail(c.email || '');
        setDireccion(c.direccion || '');
        setErrorForm(null);
        setModalAbierto(true);
    };

    const handleGuardar = async (e: React.FormEvent) => {
        e.preventDefault();
        setErrorForm(null);
        setGuardando(true);
        try {
            const body = { tipo, nombre, documento, telefono, email, direccion };
            if (contactoEditar) {
                await api(`/api/contactos/${contactoEditar.id}`, { method: 'PUT', json: body });
            } else {
                await api('/api/contactos', { method: 'POST', json: body });
            }
            setModalAbierto(false);
            refetch();
        } catch (err) {
            setErrorForm(err instanceof ApiError ? err.message : 'Error al guardar el contacto.');
        } finally {
            setGuardando(false);
        }
    };

    const handleEliminar = async (c: Contacto) => {
        if (!confirm(`¿Estás seguro de eliminar a "${c.nombre}"?`)) return;
        try {
            await api(`/api/contactos/${c.id}`, { method: 'DELETE' });
            refetch();
        } catch (err) {
            alert(err instanceof ApiError ? err.message : 'Error al eliminar el contacto.');
        }
    };

    return (
        <div className="space-y-8 max-w-6xl mx-auto pb-12">
            {/* Encabezado */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Directorio de Contactos</h1>
                    <p className="text-gray-500 text-sm mt-1">
                        Gestión centralizada de Clientes y Proveedores para tu negocio.
                    </p>
                </div>
                <button
                    onClick={abrirCrear}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold py-3 px-5 rounded-2xl flex items-center justify-center gap-2 shadow-md shadow-emerald-600/20 transition cursor-pointer shrink-0">
                    <FaUserPlus className="text-lg" />
                    <span>Nuevo Contacto</span>
                </button>
            </div>

            {/* Barra de Búsqueda y Filtros */}
            <div className="bg-white p-4 rounded-2xl border border-gray-100 shadow-sm flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="relative w-full md:w-96">
                    <FaSearch className="absolute left-4 top-3.5 text-gray-400 text-sm" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, DNI/RUC, teléfono..."
                        value={q}
                        onChange={(e) => {
                            setQ(e.target.value);
                            setPage(1);
                        }}
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-4 py-2.5 text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition"
                    />
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto overflow-x-auto pb-1 md:pb-0">
                    {[
                        { key: '', label: 'Todos' },
                        { key: 'cliente', label: 'Clientes' },
                        { key: 'proveedor', label: 'Proveedores' },
                    ].map((f) => (
                        <button
                            key={f.key}
                            onClick={() => {
                                setTipoFiltro(f.key);
                                setPage(1);
                            }}
                            className={`px-4 py-2 text-xs font-semibold rounded-xl border transition-all cursor-pointer whitespace-nowrap ${tipoFiltro === f.key
                                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                                : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                                }`}>
                            {f.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Grid de Tarjetas de Contacto */}
            {loading ? (
                <div className="flex items-center justify-center py-20 text-gray-400 gap-3">
                    <FaSpinner className="animate-spin text-2xl" />
                    <span>Cargando contactos...</span>
                </div>
            ) : error ? (
                <div className="p-4 bg-red-50 text-red-700 rounded-2xl flex items-center gap-2">
                    <FaExclamationCircle />
                    <span>{error}</span>
                </div>
            ) : !data?.items.length ? (
                <div className="bg-white rounded-3xl p-12 text-center border border-gray-100 text-gray-400 space-y-3">
                    <FaUserTie className="text-5xl mx-auto text-gray-300" />
                    <p className="text-base font-semibold text-gray-600">No se encontraron contactos</p>
                    <p className="text-xs text-gray-400">Prueba ajustando los filtros de búsqueda o agrega un nuevo contacto.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {data.items.map((c) => (
                        <div
                            key={c.id}
                            className="bg-white p-6 rounded-3xl border border-gray-100 shadow-sm hover:shadow-md transition flex flex-col justify-between space-y-4">
                            <div>
                                <div className="flex items-start justify-between gap-3 mb-3">
                                    <span
                                        className={`px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider flex items-center gap-1.5 ${c.tipo === 'cliente'
                                            ? 'bg-blue-50 text-blue-700 border border-blue-100'
                                            : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                            }`}>
                                        {c.tipo === 'cliente' ? <FaUserTie /> : <FaTruck />}
                                        {c.tipo}
                                    </span>

                                    <div className="flex items-center gap-1">
                                        <button
                                            onClick={() => abrirEditar(c)}
                                            className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-xl transition cursor-pointer"
                                            title="Editar">
                                            <FaEdit />
                                        </button>
                                        <button
                                            onClick={() => handleEliminar(c)}
                                            className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-xl transition cursor-pointer"
                                            title="Eliminar">
                                            <FaTrash />
                                        </button>
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-gray-900 leading-snug">{c.nombre}</h3>

                                {c.documento && (
                                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-1 font-mono">
                                        <FaIdCard className="text-gray-400 shrink-0" />
                                        <span>{c.documento}</span>
                                    </div>
                                )}
                            </div>

                            <div className="space-y-2 border-t border-gray-100 pt-3 text-xs text-gray-600">
                                {c.telefono && (
                                    <div className="flex items-center gap-2.5">
                                        <FaPhone className="text-emerald-500 shrink-0 text-xs" />
                                        <a href={`tel:${c.telefono}`} className="hover:underline font-medium">
                                            {c.telefono}
                                        </a>
                                    </div>
                                )}

                                {c.email && (
                                    <div className="flex items-center gap-2.5">
                                        <FaEnvelope className="text-blue-500 shrink-0 text-xs" />
                                        <a href={`mailto:${c.email}`} className="hover:underline truncate font-medium">
                                            {c.email}
                                        </a>
                                    </div>
                                )}

                                {c.direccion && (
                                    <div className="flex items-center gap-2.5">
                                        <FaMapMarkerAlt className="text-rose-500 shrink-0 text-xs" />
                                        <span className="truncate">{c.direccion}</span>
                                    </div>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Paginación */}
            {data && data.total > 12 && (
                <div className="flex justify-center pt-4">
                    <Pagination page={page} total={data.total} limit={12} onPage={setPage} />
                </div>
            )}

            {/* Modal para Crear / Editar Contacto */}
            <Modal
                abierto={modalAbierto}
                onCerrar={() => setModalAbierto(false)}
                titulo={contactoEditar ? 'Editar Contacto' : 'Nuevo Contacto'}
                subtitulo="Registra la información del cliente o proveedor">
                <form onSubmit={handleGuardar} className="space-y-4 pt-2">
                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Tipo de Contacto</label>
                        <div className="grid grid-cols-2 gap-3">
                            <button
                                type="button"
                                onClick={() => setTipo('cliente')}
                                className={`py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition cursor-pointer ${tipo === 'cliente'
                                    ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                    }`}>
                                <FaUserTie />
                                <span>Cliente</span>
                            </button>
                            <button
                                type="button"
                                onClick={() => setTipo('proveedor')}
                                className={`py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 border transition cursor-pointer ${tipo === 'proveedor'
                                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                                    : 'bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100'
                                    }`}>
                                <FaTruck />
                                <span>Proveedor</span>
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">
                            Nombre / Razón Social <span className="text-red-500">*</span>
                        </label>
                        <input
                            type="text"
                            placeholder="Ej: Juan Pérez o Distribuidora SAC"
                            value={nombre}
                            onChange={(e) => setNombre(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">DNI / RUC</label>
                            <input
                                type="text"
                                placeholder="Ej: 10456789123"
                                value={documento}
                                onChange={(e) => setDocumento(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-bold text-gray-700 mb-1">Teléfono</label>
                            <input
                                type="text"
                                placeholder="Ej: +51 987 654 321"
                                value={telefono}
                                onChange={(e) => setTelefono(e.target.value)}
                                className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Correo Electrónico</label>
                        <input
                            type="email"
                            placeholder="contacto@empresa.com"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                    </div>

                    <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1">Dirección</label>
                        <input
                            type="text"
                            placeholder="Av. Principal 123, Lima"
                            value={direccion}
                            onChange={(e) => setDireccion(e.target.value)}
                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-800 focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500"
                        />
                    </div>

                    {errorForm && (
                        <div className="p-3 bg-red-50 text-red-700 text-xs rounded-xl flex items-center gap-2">
                            <FaExclamationCircle />
                            <span>{errorForm}</span>
                        </div>
                    )}

                    <div className="flex justify-end gap-3 pt-3">
                        <button
                            type="button"
                            onClick={() => setModalAbierto(false)}
                            className="px-4 py-2.5 text-xs font-semibold text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl transition cursor-pointer">
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={guardando}
                            className="px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition shadow-md shadow-emerald-600/20 flex items-center gap-2 cursor-pointer disabled:opacity-50">
                            {guardando && <FaSpinner className="animate-spin" />}
                            <span>{contactoEditar ? 'Guardar Cambios' : 'Crear Contacto'}</span>
                        </button>
                    </div>
                </form>
            </Modal>
        </div>
    );
}
