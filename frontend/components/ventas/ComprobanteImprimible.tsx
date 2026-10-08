'use client';

import { useEffect, useRef, useState } from 'react';
import { FaPrint, FaTimes, FaCheckCircle, FaFileInvoice } from 'react-icons/fa';
import type { ResultadoVenta } from '@/types';
import Button from '@/components/ui/Button';

// ====== DATOS CONFIGURABLES DE TU EMPRESA ======
const EMPRESA = {
    nombre: 'C & K DECORACIONES S.R.L.',
    ruc: '20562897471',
    direccion: 'JR. STA. INES 106 URB. PALAO (ALTURA 1A ENTRADA DE PALAO), SAN MARTÍN DE PORRES, LIMA - LIMA',
    telefonos: '981338515 - 992823638 - 995372042',
    email: 'ventas@ckdecoraciones.com',
    giro: 'VENTA DE PORCELANATOS, PISOS, MAYÓLICAS NACIONALES E IMPORTADOS, SANITARIOS Y GRIFERÍA EN GENERAL',
    logo: '' as string,
    terminos: [
        'No se aceptan cambios ni devoluciones después de emitida la mercadería.',
        'Verifique la mercadería y cantidad al momento de la entrega.',
        '¡Gracias por su preferencia!',
    ],
};

const IGV_TASA = 0.18;

const num = (n: number) => (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const UNIDADES = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve', 'diez', 'once', 'doce', 'trece', 'catorce', 'quince',
    'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticinco',
    'veintiséis', 'veintisiete', 'veintinueve'];
const DECENAS = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
const CENTENAS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function menorDeMil(n: number): string {
    if (n === 0) return '';
    if (n === 100) return 'cien';
    const c = Math.floor(n / 100);
    const r = n % 100;
    const partes: string[] = [];
    if (c) partes.push(CENTENAS[c]);
    if (r) {
        if (r < 30) partes.push(UNIDADES[r]);
        else {
            const d = Math.floor(r / 10);
            const u = r % 10;
            partes.push(u ? `${DECENAS[d]} y ${UNIDADES[u]}` : DECENAS[d]);
        }
    }
    return partes.join(' ');
}

function enteroALetras(n: number): string {
    if (n === 0) return 'cero';
    const millones = Math.floor(n / 1_000_000);
    const miles = Math.floor((n % 1_000_000) / 1000);
    const resto = n % 1000;
    const partes: string[] = [];
    if (millones) partes.push(millones === 1 ? 'un millón' : `${enteroALetras(millones)} millones`);
    if (miles) partes.push(miles === 1 ? 'mil' : `${menorDeMil(miles).replace(/uno$/, 'un')} mil`);
    if (resto) partes.push(menorDeMil(resto));
    return partes.join(' ');
}

function totalEnLetras(total: number): string {
    const entero = Math.floor(total + 1e-9);
    const cent = Math.round((total - entero) * 100);
    const texto = enteroALetras(entero);
    return `${texto.charAt(0).toUpperCase()}${texto.slice(1)} CON ${String(cent).padStart(2, '0')}/100 SOLES`;
}

function codigoUnidad(u?: string) {
    if (!u || u === 'NIU') return 'UND';
    return u;
}

interface Props {
    venta: ResultadoVenta;
    onCerrar: () => void;
}

export default function ComprobanteImprimible({ venta, onCerrar }: Props) {
    const esFactura = venta.tipo_comprobante === 'factura';
    const tituloDoc = esFactura ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA';
    const numeroDoc = `${venta.serie || (esFactura ? 'F001' : 'B001')}-${String(venta.numero || 1).padStart(8, '0')}`;
    const fecha = venta.fecha ? new Date(venta.fecha).toLocaleDateString('es-PE', { dateStyle: 'medium' }) : new Date().toLocaleDateString('es-PE');

    const total = venta.total || 0;
    const opGravadas = total / (1 + IGV_TASA);
    const igv = total - opGravadas;
    const metodo = (venta.metodo_pago || 'Efectivo').toUpperCase();
    const docCliente = venta.cliente_documento;

    const barraRef = useRef<HTMLDivElement>(null);
    const hojaRef = useRef<HTMLDivElement>(null);
    const [escala, setEscala] = useState(1);
    const [, setAltoBarra] = useState(64);

    useEffect(() => {
        const calcularEscala = () => {
            const hoja = hojaRef.current;
            if (!hoja) return;
            const hW = 794;
            const hH = 1123;
            const aBarra = barraRef.current?.offsetHeight ?? 64;
            setAltoBarra(aBarra);

            const dispW = window.innerWidth - 32;
            const dispH = window.innerHeight - aBarra - 32;
            setEscala(Math.min(1, dispW / hW, dispH / hH));
        };

        calcularEscala();
        window.addEventListener('resize', calcularEscala);
        return () => window.removeEventListener('resize', calcularEscala);
    }, [venta]);

    return (
        <div className="fixed inset-0 z-50 bg-slate-900/80 backdrop-blur-xs flex flex-col overflow-hidden">
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 0;
                    }
                    body {
                        background: #ffffff !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        -webkit-print-color-adjust: exact !important;
                        print-color-adjust: exact !important;
                    }
                    body * {
                        visibility: hidden !important;
                    }
                    #seccion-imprimible, #seccion-imprimible * {
                        visibility: visible !important;
                    }
                    #seccion-imprimible {
                        position: absolute !important;
                        left: 0 !important;
                        top: 0 !important;
                        width: 210mm !important;
                        height: 297mm !important;
                        margin: 0 !important;
                        padding: 12mm 15mm !important;
                        box-shadow: none !important;
                        transform: none !important;
                        background: white !important;
                    }
                    .no-imprimir {
                        display: none !important;
                    }
                }
            `}</style>

            <div
                ref={barraRef}
                className="no-imprimir bg-slate-900 border-b border-slate-800 px-6 py-3.5 flex items-center justify-between text-white shadow-md shrink-0"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-lg bg-indigo-600/30 text-indigo-400 border border-indigo-500/30">
                        <FaFileInvoice className="text-lg" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-slate-100">Vista Previa de Comprobante</h3>
                        <p className="text-[11px] text-slate-400 font-mono">{numeroDoc} · {venta.cliente_nombre || 'Cliente General'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5">
                    <Button onClick={onCerrar} icono={<FaTimes className="text-xs" />}>
                        Cerrar
                    </Button>
                    <Button variante="primario" onClick={() => window.print()} icono={<FaPrint className="text-xs" />}>
                        Imprimir Comprobante
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 flex justify-center items-start bg-slate-800/60">
                <div
                    style={{
                        width: 794 * escala,
                        height: 1123 * escala,
                        transition: 'all 0.15s ease-out'
                    }}
                    className="relative shrink-0"
                >
                    <div
                        id="seccion-imprimible"
                        ref={hojaRef}
                        style={{
                            transform: `scale(${escala})`,
                            transformOrigin: 'top left',
                            width: '794px',
                            minHeight: '1123px',
                        }}
                        className="bg-white text-slate-900 font-sans p-10 rounded-xl shadow-2xl border border-slate-200 flex flex-col justify-between text-xs leading-relaxed"
                    >
                        <div className="space-y-6">
                            <div className="flex items-start justify-between gap-6 pb-6 border-b border-slate-300">
                                <div className="space-y-1.5 max-w-[480px]">
                                    {EMPRESA.logo && (
                                        <img src={EMPRESA.logo} alt="Logo" className="h-12 object-contain mb-2" />
                                    )}
                                    <h1 className="text-base font-black text-slate-900 tracking-tight leading-tight uppercase">
                                        {EMPRESA.nombre}
                                    </h1>
                                    <p className="text-[10px] text-slate-600 font-medium leading-normal">
                                        {EMPRESA.direccion}
                                    </p>
                                    <div className="text-[10px] text-slate-500 font-medium pt-0.5 flex flex-wrap gap-x-3">
                                        <span><strong>Telf:</strong> {EMPRESA.telefonos}</span>
                                        <span><strong>Email:</strong> {EMPRESA.email}</span>
                                    </div>
                                    <p className="text-[9px] text-slate-400 font-semibold tracking-wider uppercase pt-1 border-t border-slate-100">
                                        {EMPRESA.giro}
                                    </p>
                                </div>

                                <div className="w-[240px] border-2 border-slate-900 rounded-xl overflow-hidden text-center bg-slate-50 shrink-0">
                                    <div className="py-2.5 px-3 bg-white border-b border-slate-300">
                                        <p className="text-xs font-black tracking-widest text-slate-900">R.U.C. N° {EMPRESA.ruc}</p>
                                    </div>
                                    <div className="py-2 px-3 bg-slate-900 text-white">
                                        <p className="text-xs font-black tracking-wider uppercase">{tituloDoc}</p>
                                    </div>
                                    <div className="py-2.5 px-3 bg-white border-t border-slate-300">
                                        <p className="text-sm font-black font-mono text-slate-900">{numeroDoc}</p>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 grid grid-cols-12 gap-x-4 gap-y-2 text-xs">
                                <div className="col-span-8 space-y-1">
                                    <div className="flex gap-2">
                                        <span className="font-bold text-slate-500 w-24 shrink-0">Señor(es):</span>
                                        <span className="font-bold text-slate-900 uppercase">{venta.cliente_nombre || 'Cliente General'}</span>
                                    </div>
                                    {docCliente && (
                                        <div className="flex gap-2">
                                            <span className="font-bold text-slate-500 w-24 shrink-0">
                                                {docCliente.length === 11 ? 'R.U.C.:' : 'D.N.I.:'}
                                            </span>
                                            <span className="font-semibold font-mono text-slate-800">{docCliente}</span>
                                        </div>
                                    )}
                                    {venta.cliente_direccion && (
                                        <div className="flex gap-2">
                                            <span className="font-bold text-slate-500 w-24 shrink-0">Dirección:</span>
                                            <span className="font-medium text-slate-700">{venta.cliente_direccion}</span>
                                        </div>
                                    )}
                                </div>

                                <div className="col-span-4 space-y-1 border-l border-slate-200 pl-4">
                                    <div className="flex justify-between">
                                        <span className="font-bold text-slate-500">Fecha Emisión:</span>
                                        <span className="font-semibold text-slate-800 font-mono">{fecha}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-bold text-slate-500">Moneda:</span>
                                        <span className="font-semibold text-slate-800">SOLES (S/)</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-bold text-slate-500">Forma de Pago:</span>
                                        <span className="font-semibold text-slate-800">Contado</span>
                                    </div>
                                </div>
                            </div>

                            <div className="border border-slate-200 rounded-xl overflow-hidden">
                                <table className="w-full text-xs">
                                    <thead className="bg-slate-900 text-white font-bold text-[11px] uppercase">
                                        <tr>
                                            <th className="py-2.5 px-3 text-center w-12">Item</th>
                                            <th className="py-2.5 px-3 text-center w-16">Cant.</th>
                                            <th className="py-2.5 px-3 text-center w-20">Unidad</th>
                                            <th className="py-2.5 px-4 text-left">Descripción / Producto</th>
                                            <th className="py-2.5 px-3 text-right w-24">P. Unit</th>
                                            <th className="py-2.5 px-3 text-right w-28">Importe</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200 bg-white">
                                        {venta.items && venta.items.length > 0 ? (
                                            venta.items.map((it, idx) => (
                                                <tr key={idx} className="hover:bg-slate-50/50">
                                                    <td className="py-2.5 px-3 text-center font-mono text-slate-400">{idx + 1}</td>
                                                    <td className="py-2.5 px-3 text-center font-bold text-slate-800">{it.cantidad}</td>
                                                    <td className="py-2.5 px-3 text-center text-slate-500 font-medium">
                                                        {codigoUnidad((it as { unidad_medida?: string }).unidad_medida)}
                                                    </td>
                                                    <td className="py-2.5 px-4 text-slate-800 font-semibold">{it.descripcion}</td>
                                                    <td className="py-2.5 px-3 text-right font-mono text-slate-600">S/ {num(it.precio_venta)}</td>
                                                    <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">
                                                        S/ {num(it.cantidad * it.precio_venta)}
                                                    </td>
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td colSpan={6} className="py-8 text-center text-slate-400 italic">
                                                    Sin ítems especificados
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="grid grid-cols-12 gap-6 items-start pt-2">
                                <div className="col-span-7 space-y-3">
                                    <div className="bg-slate-100/80 border border-slate-200 rounded-lg p-3">
                                        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Son:</p>
                                        <p className="text-xs font-black text-slate-900 mt-0.5">{totalEnLetras(total)}</p>
                                    </div>

                                    <div className="bg-slate-50 border border-slate-200 rounded-lg p-3 space-y-1 text-[11px]">
                                        <p className="font-bold text-slate-700 flex items-center gap-1.5">
                                            <FaCheckCircle className="text-emerald-600 text-xs" /> Medio de Pago: <span className="font-extrabold text-slate-900">{metodo}</span>
                                        </p>
                                        {venta.monto_pagado !== undefined && venta.monto_pagado !== null && (
                                            <p className="text-slate-600">
                                                Monto Entregado: <strong>S/ {num(venta.monto_pagado)}</strong> · Vuelto: <strong>S/ {num(venta.vuelto || 0)}</strong>
                                            </p>
                                        )}
                                        {venta.usuario && (
                                            <p className="text-slate-500 pt-1 border-t border-slate-200">
                                                Atendido por: <strong>{venta.usuario}</strong>
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="col-span-5 bg-slate-50 border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-200 text-xs">
                                    {!!venta.descuento && (
                                        <div className="flex justify-between px-4 py-2 text-slate-600">
                                            <span>Descuento Total:</span>
                                            <span className="font-mono font-semibold text-rose-600">- S/ {num(venta.descuento)}</span>
                                        </div>
                                    )}
                                    <div className="flex justify-between px-4 py-2 text-slate-600">
                                        <span>Op. Gravada:</span>
                                        <span className="font-mono font-semibold text-slate-800">S/ {num(opGravadas)}</span>
                                    </div>
                                    <div className="flex justify-between px-4 py-2 text-slate-600">
                                        <span>I.G.V. (18%):</span>
                                        <span className="font-mono font-semibold text-slate-800">S/ {num(igv)}</span>
                                    </div>
                                    <div className="flex justify-between px-4 py-3 bg-slate-900 text-white font-black text-sm">
                                        <span>IMPORTE TOTAL:</span>
                                        <span className="font-mono text-base">S/ {num(total)}</span>
                                    </div>
                                </div>
                            </div>

                            {venta.observaciones && (
                                <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs">
                                    <strong>Observaciones:</strong> {venta.observaciones}
                                </div>
                            )}
                        </div>

                        <div className="pt-6 border-t border-slate-200 space-y-2 mt-8">
                            <div className="text-[10px] text-slate-500 text-center space-y-0.5">
                                {EMPRESA.terminos.map((t, idx) => (
                                    <p key={idx}>• {t}</p>
                                ))}
                            </div>
                            <div className="text-[9px] text-slate-400 text-center font-mono pt-2 border-t border-slate-100">
                                Representación impresa de la {tituloDoc}. Consulte la validez de este comprobante en el sistema interno.
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
