'use client';

import { useEffect, useRef, useState } from 'react';
import { FaPrint, FaTimes, FaFileInvoice, FaDownload } from 'react-icons/fa';
import type { ResultadoVenta } from '@/types';
import Button from '@/components/ui/Button';

const EMPRESA = {
    nombre: 'INVERSIONES NATHAN S.R.L',
    ruc: '20610124616',
    direccion: 'CALLE SANTA CARMELA 337 URB. PALAO ET. 2',
    telefonos: '950 549 676',
    giro: 'Venta de pegamentos, porcelanatos, pisos, mayólicas nacionales e importados, sanitarios y grifería en general',
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
    'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve', 'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco',
    'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
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
    return `${enteroALetras(entero).toUpperCase()} CON ${String(cent).padStart(2, '0')}/100 SOLES`;
}

function codigoUnidad(u?: string) {
    if (!u || u === 'NIU') return 'UND';
    return u;
}

interface Props {
    venta: ResultadoVenta;
    onCerrar: () => void;
}

type ItemExtra = { unidad_medida?: string; codigo?: string };

export default function ComprobanteImprimible({ venta, onCerrar }: Props) {
    const esFactura = venta.tipo_comprobante === 'factura';
    const tituloDoc = esFactura ? 'Factura electrónica' : 'Boleta de venta electrónica';
    const numeroDoc = `${venta.serie || (esFactura ? 'F001' : 'B001')}-${String(venta.numero || 1).padStart(8, '0')}`;
    const fecha = venta.fecha
        ? new Date(venta.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const total = venta.total || 0;
    const opGravadas = total / (1 + IGV_TASA);
    const igv = total - opGravadas;
    const descuento = venta.descuento || 0;
    const metodo = (venta.metodo_pago || 'Efectivo').toUpperCase();
    const docCliente = venta.cliente_documento;

    const barraRef = useRef<HTMLDivElement>(null);
    const hojaRef = useRef<HTMLDivElement>(null);
    const [escala, setEscala] = useState(1);
    const [descargando, setDescargando] = useState(false);

    useEffect(() => {
        const calcularEscala = () => {
            if (!hojaRef.current) return;
            const hW = 794;
            const hH = 1123;
            const aBarra = barraRef.current?.offsetHeight ?? 64;
            const dispW = window.innerWidth - 32;
            const dispH = window.innerHeight - aBarra - 32;
            setEscala(Math.min(1, dispW / hW, dispH / hH));
        };

        calcularEscala();
        window.addEventListener('resize', calcularEscala);
        return () => window.removeEventListener('resize', calcularEscala);
    }, [venta]);

    const descargarPdf = async () => {
        const hoja = hojaRef.current;
        if (!hoja) return;
        setDescargando(true);
        try {
            const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
                import('html2canvas-pro'),
                import('jspdf'),
            ]);
            const canvas = await html2canvas(hoja, {
                scale: 2,
                backgroundColor: '#ffffff',
                useCORS: true,
                scrollX: 0,
                scrollY: 0,
                onclone: (doc) => {
                    const el = doc.getElementById('seccion-imprimible');
                    if (el) el.style.transform = 'none';
                },
            });
            const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
            pdf.addImage(canvas.toDataURL('image/jpeg', 0.95), 'JPEG', 0, 0, 210, 297);
            pdf.save(`${numeroDoc}.pdf`);
        } finally {
            setDescargando(false);
        }
    };

    const etiqueta = 'text-[8px] uppercase tracking-[0.12em] text-gray-400 font-medium';

    return (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-xs flex flex-col overflow-hidden">
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
                        padding: 12mm 14mm !important;
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
                className="no-imprimir bg-black border-b border-white/10 px-6 py-3.5 flex items-center justify-between text-white shadow-md shrink-0"
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-600/30 text-indigo-400 border border-indigo-500/30">
                        <FaFileInvoice className="text-lg" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-white">Vista previa de comprobante</h3>
                        <p className="text-[11px] text-slate-400 font-mono">{numeroDoc} · {venta.cliente_nombre || 'Cliente General'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5">
                    <Button onClick={onCerrar} icono={<FaTimes className="text-xs" />}>
                        Cerrar
                    </Button>
                    <Button onClick={descargarPdf} disabled={descargando} icono={<FaDownload className="text-xs" />}>
                        {descargando ? 'Generando…' : 'Descargar PDF'}
                    </Button>
                    <Button variante="primario" onClick={() => window.print()} icono={<FaPrint className="text-xs" />}>
                        Imprimir
                    </Button>
                </div>
            </div>

            <div className="flex-1 overflow-auto p-4 flex justify-center items-start bg-transparent">
                <div
                    style={{
                        width: 794 * escala,
                        height: 1123 * escala,
                        transition: 'all 0.15s ease-out',
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
                            height: '1123px',
                            fontFamily: 'Arial, Helvetica, sans-serif',
                        }}
                        className="bg-white text-gray-900 px-12 py-11 shadow-2xl flex flex-col text-[10px] leading-snug"
                    >
                        {/* ENCABEZADO */}
                        <div className="flex items-start justify-between gap-8">
                            <div className="max-w-[400px]">
                                {EMPRESA.logo && (
                                    <img src={EMPRESA.logo} alt="Logo" className="h-10 object-contain mb-2" />
                                )}
                                <h1 className="text-[16px] font-bold tracking-tight text-gray-900">{EMPRESA.nombre}</h1>
                                <p className="text-[9px] text-gray-500 mt-1.5">RUC {EMPRESA.ruc}</p>
                                <p className="text-[9px] text-gray-500">{EMPRESA.direccion}</p>
                                <p className="text-[9px] text-gray-500">Telf. {EMPRESA.telefonos}</p>
                            </div>

                            <div className="text-right shrink-0">
                                <p className={etiqueta}>{tituloDoc}</p>
                                <p className="text-[22px] font-semibold tracking-tight text-gray-900 mt-1">{numeroDoc}</p>
                                <p className="text-[9px] text-gray-500 mt-1">Emitido el {fecha}</p>
                            </div>
                        </div>

                        <p className="text-[8px] text-gray-400 mt-4 max-w-[520px]">{EMPRESA.giro}</p>

                        <div className="border-t border-gray-200 my-6" />

                        {/* CLIENTE */}
                        <div className="grid grid-cols-2 gap-x-10 gap-y-3">
                            <div>
                                <p className={etiqueta}>Cliente</p>
                                <p className="text-[11px] font-semibold uppercase mt-0.5">{venta.cliente_nombre || 'Cliente General'}</p>
                                {docCliente && (
                                    <p className="text-[9px] text-gray-500 mt-0.5">
                                        {docCliente.length === 11 ? 'RUC' : 'DNI'} {docCliente}
                                    </p>
                                )}
                                {venta.cliente_direccion && (
                                    <p className="text-[9px] text-gray-500 uppercase">{venta.cliente_direccion}</p>
                                )}
                            </div>
                            <div className="text-right">
                                <p className={etiqueta}>Pago</p>
                                <p className="text-[11px] font-semibold mt-0.5">Contado · {metodo}</p>
                                <p className="text-[9px] text-gray-500 mt-0.5">Moneda: Soles</p>
                            </div>
                        </div>

                        {/* ITEMS */}
                        <div className="flex-1 mt-7 min-h-0">
                            <table className="w-full border-collapse">
                                <thead>
                                    <tr className="border-b border-gray-300">
                                        <th className={`${etiqueta} py-2 text-left`}>Descripción</th>
                                        <th className={`${etiqueta} py-2 text-center w-14`}>UM</th>
                                        <th className={`${etiqueta} py-2 text-right w-16`}>Cant.</th>
                                        <th className={`${etiqueta} py-2 text-right w-24`}>P. unit.</th>
                                        <th className={`${etiqueta} py-2 text-right w-28`}>Importe</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {venta.items && venta.items.length > 0 ? (
                                        venta.items.map((it, idx) => {
                                            const extra = it as unknown as ItemExtra;
                                            const codigo = it.sku_producto || extra.codigo;
                                            return (
                                                <tr key={idx} className="border-b border-gray-100 align-top">
                                                    <td className="py-2.5 pr-3">
                                                        <p className="text-[10px] font-medium text-gray-900">{it.descripcion}</p>
                                                        {codigo && <p className="text-[8px] text-gray-400 mt-0.5">{codigo}</p>}
                                                    </td>
                                                    <td className="py-2.5 text-center text-gray-500">{codigoUnidad(extra.unidad_medida)}</td>
                                                    <td className="py-2.5 text-right tabular-nums">{num(it.cantidad)}</td>
                                                    <td className="py-2.5 text-right tabular-nums">{num(it.precio_venta)}</td>
                                                    <td className="py-2.5 text-right tabular-nums font-medium">{num(it.cantidad * it.precio_venta)}</td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={5} className="py-8 text-center italic text-gray-400">Sin ítems especificados</td>
                                        </tr>
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* TOTALES */}
                        <div className="flex items-end justify-between gap-8 pt-5 border-t border-gray-200">
                            <div className="max-w-[360px]">
                                <p className={etiqueta}>Son</p>
                                <p className="text-[9px] text-gray-700 mt-0.5">{totalEnLetras(total)}</p>
                            </div>

                            <div className="w-[240px] space-y-1.5">
                                <div className="flex justify-between text-gray-500">
                                    <span>Op. gravada</span>
                                    <span className="tabular-nums">S/ {num(opGravadas)}</span>
                                </div>
                                <div className="flex justify-between text-gray-500">
                                    <span>IGV 18%</span>
                                    <span className="tabular-nums">S/ {num(igv)}</span>
                                </div>
                                {descuento > 0 && (
                                    <div className="flex justify-between text-gray-500">
                                        <span>Descuento</span>
                                        <span className="tabular-nums">- S/ {num(descuento)}</span>
                                    </div>
                                )}
                                <div className="flex justify-between items-baseline border-t border-gray-900 pt-2 mt-2">
                                    <span className="text-[10px] font-semibold uppercase tracking-wider">Total</span>
                                    <span className="text-[16px] font-bold tabular-nums">S/ {num(total)}</span>
                                </div>
                            </div>
                        </div>

                        {/* PIE */}
                        <div className="mt-7 text-[8px] text-gray-400 space-y-1">
                            {venta.monto_pagado !== undefined && venta.monto_pagado !== null && (
                                <p>Monto entregado: S/ {num(venta.monto_pagado)} · Vuelto: S/ {num(venta.vuelto || 0)}</p>
                            )}
                            {venta.observaciones && (
                                <p><span className="font-semibold text-gray-500">Observaciones:</span> {venta.observaciones}</p>
                            )}
                            <div className="pt-1">
                                {EMPRESA.terminos.map((t, idx) => (
                                    <p key={idx}>{t}</p>
                                ))}
                            </div>
                            <p className="pt-2">
                                Documento no válido ante la SUNAT. Representación impresa de la {tituloDoc.toLowerCase()} generada en el sistema interno.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}