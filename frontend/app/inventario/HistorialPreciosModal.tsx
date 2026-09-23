'use client';
import { FaArrowDown, FaArrowUp, FaMinus } from 'react-icons/fa';
import { useApi } from '../lib/useApi';
import { moneda } from '../lib/format';
import type { HistorialPrecio } from '../lib/types';
import Modal from '../components/Modal';
import { TablaSkeleton } from '../components/ui/States';

export default function HistorialPreciosModal({ sku, nombre, onCerrar }: { sku: string; nombre: string; onCerrar: () => void }) {
    const { data, loading } = useApi<HistorialPrecio[]>(`/api/mercaderia/historial-precios/${sku}`);

    return (
        <Modal abierto onCerrar={onCerrar} titulo="Historial de precios" subtitulo={`${nombre} · ${sku}`} ancho>
            {loading ? (
                <TablaSkeleton filas={4} />
            ) : !data?.length ? (
                <p style={{ color: 'var(--ink-2)', fontSize: 14 }}>Este producto todavía no tiene ingresos con precio registrado.</p>
            ) : (
                <div className="table-wrap">
                    <table className="table table--compact">
                        <thead>
                            <tr>
                                <th>Fecha</th>
                                <th>Proveedor</th>
                                <th className="cell-num">Cantidad</th>
                                <th className="cell-num">Antes</th>
                                <th className="cell-num">Después</th>
                                <th className="cell-num">Variación</th>
                            </tr>
                        </thead>
                        <tbody>
                            {data.map((h) => (
                                <tr key={h.id}>
                                    <td>{new Date(h.fecha).toLocaleDateString('es-PE')}</td>
                                    <td>{h.proveedor ?? '—'}</td>
                                    <td className="cell-num">{h.cantidad}</td>
                                    <td className="cell-num muted">{h.precio_anterior !== null ? moneda(h.precio_anterior) : '—'}</td>
                                    <td className="cell-num" style={{ fontWeight: 600 }}>{moneda(h.precio_nuevo)}</td>
                                    <td className="cell-num">
                                        {h.variacion_pct === null ? (
                                            <span className="muted">—</span>
                                        ) : h.variacion_pct > 0 ? (
                                            <span style={{ color: 'var(--danger, #dc2626)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <FaArrowUp style={{ fontSize: 10 }} /> {h.variacion_pct}%
                                            </span>
                                        ) : h.variacion_pct < 0 ? (
                                            <span style={{ color: 'var(--ok, #16a34a)', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <FaArrowDown style={{ fontSize: 10 }} /> {h.variacion_pct}%
                                            </span>
                                        ) : (
                                            <span className="muted" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                                                <FaMinus style={{ fontSize: 10 }} /> 0%
                                            </span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Modal>
    );
}