'use client';

import { useState } from 'react';
import { FaEnvelope } from 'react-icons/fa';
import type { ResultadoVenta } from '@/types';
import { api, ApiError } from '@/lib/api';
import { useToast } from '@/components/ui/Toast';

interface Props {
    venta: ResultadoVenta;
    onCerrar: () => void;
}

export default function EnviarCorreoModal({ venta, onCerrar }: Props) {
    const toast = useToast();
    const [correo, setCorreo] = useState(venta.cliente_email || '');
    const [enviando, setEnviando] = useState(false);

    const etiqueta = `${venta.serie || (venta.tipo_comprobante === 'factura' ? 'F001' : 'B001')}-${String(venta.numero ?? venta.id).padStart(8, '0')}`;

    const enviar = async () => {
        if (!correo.trim() || enviando) return;
        setEnviando(true);
        try {
            await api(`/api/ventas/${venta.id}/enviar-correo`, {
                method: 'POST',
                json: { email: correo.trim() },
            });
            toast('Comprobante enviado');
            onCerrar();
        } catch (e) {
            toast(e instanceof ApiError ? e.message : 'No se pudo enviar el correo', 'error');
        } finally {
            setEnviando(false);
        }
    };

    return (
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 p-4"
            onClick={onCerrar}
        >
            <div
                className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                        <FaEnvelope />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900 text-sm">Enviar comprobante por correo</h3>
                        <p className="text-xs text-slate-400 font-mono">{etiqueta}</p>
                    </div>
                </div>
                <input
                    type="email"
                    autoFocus
                    value={correo}
                    onChange={(e) => setCorreo(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && enviar()}
                    placeholder="correo@ejemplo.com"
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
                />
                <div className="flex justify-end gap-2">
                    <button
                        onClick={onCerrar}
                        className="px-4 py-2 text-xs font-semibold text-slate-600 bg-white border border-slate-200 rounded-xl hover:bg-slate-50 cursor-pointer"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={enviar}
                        disabled={enviando || !correo.trim()}
                        className="px-4 py-2 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl cursor-pointer disabled:opacity-50"
                    >
                        {enviando ? 'Enviando…' : 'Enviar'}
                    </button>
                </div>
            </div>
        </div>
    );
}