'use client';

import { FaUser, FaUserTie } from 'react-icons/fa';
import type { Contacto } from '@/types';
import { useApi } from '@/hooks/useApi';
import ClienteSelector from '../ClienteSelector';
import type { UsuarioVendedor } from './types';

interface Props {
    cliente: Contacto | null;
    onClienteChange: (c: Contacto | null) => void;
    vendedorId: string;
    onVendedorIdChange: (v: string) => void;
}

const etiquetaVendedor = (u: UsuarioVendedor) => (u.nombre ? `${u.nombre} (@${u.usuario})` : u.usuario);

export function VentaDatosForm({ cliente, onClienteChange, vendedorId, onVendedorIdChange }: Props) {
    const { data: usuarios } = useApi<UsuarioVendedor[]>('/api/usuarios');
    const lista = usuarios || [];

    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                    <h3 className="font-bold text-slate-900 text-sm">Datos de la venta</h3>
                    <p className="text-xs text-slate-400 mt-0.5">Cliente y vendedor asignado</p>
                </div>
            </div>
            <div className="p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <FaUser className="text-indigo-500" /> Cliente *
                    </label>
                    <ClienteSelector clienteElegido={cliente} onElegir={onClienteChange} />
                </div>
                <div className="space-y-1.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-slate-500 uppercase tracking-wider">
                        <FaUserTie className="text-indigo-500" /> Vendedor asignado *
                    </label>
                    <select
                        value={vendedorId}
                        onChange={(e) => onVendedorIdChange(e.target.value)}
                        className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 cursor-pointer"
                    >
                        <option value="">Seleccionar vendedor...</option>
                        {lista.map((u) => (
                            <option key={u.id} value={String(u.id)}>
                                {etiquetaVendedor(u)}
                            </option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
}