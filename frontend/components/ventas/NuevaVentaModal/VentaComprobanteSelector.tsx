'use client';

import { FaFileInvoice, FaReceipt } from 'react-icons/fa';
import type { Contacto } from '@/types';
import { Callout } from '@/components/ui/Form';

interface Props {
    tipoComprobante: 'boleta' | 'factura';
    onTipoComprobanteChange: (tipo: 'boleta' | 'factura') => void;
    cliente: Contacto | null;
    clienteValidoParaFactura: boolean;
}

export function VentaComprobanteSelector({
    tipoComprobante,
    onTipoComprobanteChange,
    cliente,
    clienteValidoParaFactura,
}: Props) {
    return (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100">
                <h3 className="font-bold text-slate-900 text-sm">Tipo de comprobante</h3>
                <p className="text-xs text-slate-400 mt-0.5">Selecciona el documento a emitir</p>
            </div>
            <div className="p-5 space-y-3">
                <div className="flex gap-3">
                    <button
                        type="button"
                        className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            tipoComprobante === 'boleta'
                                ? 'bg-blue-50 text-blue-700 border-blue-300 shadow-xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                        onClick={() => onTipoComprobanteChange('boleta')}
                    >
                        <FaReceipt className={tipoComprobante === 'boleta' ? 'text-blue-600' : 'text-slate-400'} />
                        Boleta de Venta (B001)
                    </button>
                    <button
                        type="button"
                        className={`flex-1 sm:flex-initial flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                            tipoComprobante === 'factura'
                                ? 'bg-emerald-50 text-emerald-700 border-emerald-300 shadow-xs'
                                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
                        }`}
                        onClick={() => onTipoComprobanteChange('factura')}
                    >
                        <FaFileInvoice className={tipoComprobante === 'factura' ? 'text-emerald-600' : 'text-slate-400'} />
                        Factura Electrónica (F001)
                    </button>
                </div>
                {tipoComprobante === 'factura' && !clienteValidoParaFactura && cliente && (
                    <Callout tono="warn">Este cliente no tiene RUC de 11 dígitos registrado. No se puede emitir factura.</Callout>
                )}
            </div>
        </div>
    );
}
