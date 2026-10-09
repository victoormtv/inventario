'use client';

import { useEffect, useRef, useState } from 'react';
import { FaPrint, FaTimes, FaFileInvoice, FaEnvelope } from 'react-icons/fa';
import type { ResultadoVenta } from '@/types';
import Button from '@/components/ui/Button';
import EnviarCorreoModal from './EnviarCorreoModal';

const EMPRESA = {
    nombre: 'INVERSIONES NATHAN S.R.L',
    ruc: '20610124616',
    direccion: 'CALLE SANTA CARMELA 337 URB. PALAO ET. 2',
    telefonos: '950  549 676',
    giro: 'VENTA DE PEGAMENTOS, PORCELANATOS, PISOS, MAYÓLICAS NACIONALES E IMPORTADOS, SANITARIOS Y GRIFERÍA EN GENERALL',
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
    const tituloDoc = esFactura ? 'FACTURA ELECTRÓNICA' : 'BOLETA DE VENTA ELECTRÓNICA';
    const numeroDoc = `${venta.serie || (esFactura ? 'F001' : 'B001')}-${String(venta.numero || 1).padStart(8, '0')}`;
    const fecha = venta.fecha
        ? new Date(venta.fecha).toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' })
        : new Date().toLocaleDateString('es-PE', { day: '2-digit', month: '2-digit', year: 'numeric' });

    const total = venta.total || 0;
    const opGravadas = total / (1 + IGV_TASA);
    const igv = total - opGravadas;
    const metodo = (venta.metodo_pago || 'Efectivo').toUpperCase();
    const docCliente = venta.cliente_documento;

    const barraRef = useRef<HTMLDivElement>(null);
    const hojaRef = useRef<HTMLDivElement>(null);
    const [escala, setEscala] = useState(1);
    const [, setAltoBarra] = useState(64);
    const [mostrarCorreo, setMostrarCorreo] = useState(false);

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

    const filasTotales: { label: string; valor: number; negativo?: boolean }[] = [
        { label: 'OP. GRAVADAS', valor: opGravadas },
        { label: 'OP. INAFECTAS', valor: 0 },
        { label: 'OP. EXONERADAS', valor: 0 },
        { label: 'OP. GRATUITAS', valor: 0 },
        { label: 'OTROS CARGOS', valor: 0 },
        { label: 'OTROS TRIBUTOS', valor: 0 },
        { label: 'DESCUENTO', valor: venta.descuento || 0 },
        { label: 'IGV 18%', valor: igv },
    ];

    const colBorde = 'border-r border-black';

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
                        padding: 10mm 12mm !important;
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
                        <h3 className="text-sm font-bold text-white">Vista Previa de Comprobante</h3>
                        <p className="text-[11px] text-slate-400 font-mono">{numeroDoc} · {venta.cliente_nombre || 'Cliente General'}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2.5">
                    <Button onClick={onCerrar} icono={<FaTimes className="text-xs" />}>
                        Cerrar
                    </Button>
                    <Button onClick={() => setMostrarCorreo(true)} icono={<FaEnvelope className="text-xs" />}>
                        Enviar correo
                    </Button>
                    <Button variante="primario" onClick={() => window.print()} icono={<FaPrint className="text-xs" />}>
                        Imprimir Comprobante
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
                        className="bg-white text-black p-8 shadow-2xl flex flex-col text-[10px] leading-snug"
                    >
                        {/* ENCABEZADO */}
                        <div className="flex items-stretch justify-between gap-6">
                            <div className="flex-1 space-y-1">
                                {EMPRESA.logo && (
                                    <img src={EMPRESA.logo} alt="Logo" className="h-12 object-contain mb-1" />
                                )}
                                <h1 className="text-[15px] font-black uppercase leading-tight">{EMPRESA.nombre}</h1>
                                <p className="text-[9px]">{EMPRESA.direccion}</p>
                                <p className="text-[9px]">
                                    <strong>Telf:</strong> {EMPRESA.telefonos}
                                </p>
                                <p className="text-[8px] uppercase pt-1">{EMPRESA.giro}</p>
                            </div>

                            <div className="w-[260px] border border-black flex flex-col items-center justify-center text-center py-4 px-3 gap-3 shrink-0">
                                <p className="text-[15px] font-bold">R.U.C. N° {EMPRESA.ruc}</p>
                                <p className="text-[15px] font-bold uppercase">{tituloDoc}</p>
                                <p className="text-[16px] font-bold text-red-600">N° {numeroDoc}</p>
                            </div>
                        </div>

                        {/* DATOS CLIENTE */}
                        <div className="border border-black mt-3 grid grid-cols-12 p-2 gap-x-4 gap-y-0.5">
                            <div className="col-span-7 space-y-0.5">
                                <div className="flex">
                                    <span className="font-bold w-24 shrink-0">SR. (ES)</span>
                                    <span className="uppercase">: {venta.cliente_nombre || 'Cliente General'}</span>
                                </div>
                                {docCliente && (
                                    <div className="flex">
                                        <span className="font-bold w-24 shrink-0">
                                            {docCliente.length === 11 ? 'R.U.C.' : 'D.N.I.'}
                                        </span>
                                        <span>: {docCliente}</span>
                                    </div>
                                )}
                                {venta.cliente_direccion && (
                                    <div className="flex">
                                        <span className="font-bold w-24 shrink-0">DIRECCIÓN</span>
                                        <span className="uppercase">: {venta.cliente_direccion}</span>
                                    </div>
                                )}
                            </div>
                            <div className="col-span-5 space-y-0.5">
                                <div className="flex">
                                    <span className="font-bold w-28 shrink-0">FECHA EMISIÓN</span>
                                    <span>: {fecha}</span>
                                </div>
                                <div className="flex">
                                    <span className="font-bold w-28 shrink-0">CONDICIÓN DE PAGO</span>
                                    <span>: CONTADO {metodo}</span>
                                </div>
                                <div className="flex">
                                    <span className="font-bold w-28 shrink-0">MONEDA</span>
                                    <span>: SOLES</span>
                                </div>
                            </div>
                        </div>

                        {/* TABLA ITEMS */}
                        <div className="flex-1 flex flex-col mt-3 min-h-0">
                            <table className="w-full h-full border border-black border-collapse text-[10px]">
                                <thead>
                                    <tr className="border-b border-black font-bold">
                                        <th className={`py-2 px-1 text-center w-20 ${colBorde}`}>CÓDIGO</th>
                                        <th className={`py-2 px-1 text-center w-16 ${colBorde}`}>CANTIDAD</th>
                                        <th className={`py-2 px-1 text-center ${colBorde}`}>DESCRIPCIÓN</th>
                                        <th className={`py-2 px-1 text-center w-12 ${colBorde}`}>UM</th>
                                        <th className={`py-2 px-1 text-center w-20 ${colBorde}`}>VALOR UNITARIO</th>
                                        <th className={`py-2 px-1 text-center w-20 ${colBorde}`}>PRECIO UNITARIO</th>
                                        <th className="py-2 px-1 text-center w-24">VALOR VENTA TOTAL</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {venta.items && venta.items.length > 0 ? (
                                        venta.items.map((it, idx) => {
                                            const extra = it as unknown as ItemExtra;
                                            const valorUnit = it.precio_venta / (1 + IGV_TASA);
                                            const valorTotal = (it.cantidad * it.precio_venta) / (1 + IGV_TASA);
                                            return (
                                                <tr key={idx} className="align-top">
                                                    <td className={`py-1 px-1 text-left ${colBorde}`}>{extra.codigo || String(idx + 1).padStart(3, '0')}</td>
                                                    <td className={`py-1 px-1 text-right ${colBorde}`}>{num(it.cantidad)}</td>
                                                    <td className={`py-1 px-1 text-left ${colBorde}`}>{it.descripcion}</td>
                                                    <td className={`py-1 px-1 text-center ${colBorde}`}>{codigoUnidad(extra.unidad_medida)}</td>
                                                    <td className={`py-1 px-1 text-right ${colBorde}`}>{num(valorUnit)}</td>
                                                    <td className={`py-1 px-1 text-right ${colBorde}`}>{num(it.precio_venta)}</td>
                                                    <td className="py-1 px-1 text-right">{num(valorTotal)}</td>
                                                </tr>
                                            );
                                        })
                                    ) : (
                                        <tr>
                                            <td colSpan={7} className="py-6 text-center italic">Sin ítems especificados</td>
                                        </tr>
                                    )}
                                    {/* fila de relleno: estira las columnas hasta el final */}
                                    <tr style={{ height: '100%' }}>
                                        <td className={colBorde} />
                                        <td className={colBorde} />
                                        <td className={colBorde} />
                                        <td className={colBorde} />
                                        <td className={colBorde} />
                                        <td className={colBorde} />
                                        <td />
                                    </tr>
                                </tbody>
                            </table>
                        </div>

                        {/* TOTALES */}
                        <div className="flex border-x border-b border-black">
                            <div className="flex-1 flex flex-col justify-end">
                                <div className="border-t border-black p-1.5 mt-auto">
                                    <span className="font-bold">SON: </span>
                                    {totalEnLetras(total)}
                                </div>
                            </div>
                            <div className="w-[270px] border-l border-black text-[10px]">
                                {filasTotales.map((f) => (
                                    <div key={f.label} className="flex border-b border-black last:border-b-0">
                                        <span className="flex-1 text-right pr-2 py-0.5">{f.label}</span>
                                        <span className="w-8 border-l border-black pl-1 py-0.5">S/</span>
                                        <span className="w-20 text-right pr-1 py-0.5">{num(f.valor)}</span>
                                    </div>
                                ))}
                                <div className="flex border-t border-black font-bold">
                                    <span className="flex-1 text-right pr-2 py-0.5">TOTAL</span>
                                    <span className="w-8 border-l border-black pl-1 py-0.5">S/</span>
                                    <span className="w-20 text-right pr-1 py-0.5">{num(total)}</span>
                                </div>
                            </div>
                        </div>

                        {/* PIE */}
                        <div className="mt-2 space-y-1 text-[9px]">
                            {venta.monto_pagado !== undefined && venta.monto_pagado !== null && (
                                <p>
                                    Monto Entregado: S/ {num(venta.monto_pagado)} · Vuelto: S/ {num(venta.vuelto || 0)}
                                </p>
                            )}
                            {venta.observaciones && (
                                <p>
                                    <strong>Observaciones:</strong> {venta.observaciones}
                                </p>
                            )}
                            <div className="pt-1">
                                {EMPRESA.terminos.map((t, idx) => (
                                    <p key={idx}>{t}</p>
                                ))}
                            </div>
                            <p className="pt-1 text-[8px]">
                                Documento no valido ante la SUNAT, esto es una representación impresa de la {tituloDoc} generada en el sistema interno.
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {mostrarCorreo && (
                <EnviarCorreoModal venta={venta} onCerrar={() => setMostrarCorreo(false)} />
            )}
        </div>
    );
}