import { FaArrowRight, FaExchangeAlt } from 'react-icons/fa';
import type { Movimiento } from '../../lib/types';
import { entero, etiquetaVariante, fechaLocal } from '../../lib/format';
import Badge from '../ui/Badge';
import { EmptyState } from '../ui/States';

const TONO = { ENTRADA: 'ok', SALIDA: 'danger', AJUSTE: 'brand' } as const;
const TEXTO = { ENTRADA: 'Entrada', SALIDA: 'Salida', AJUSTE: 'Ajuste' } as const;

function Cantidad({ m }: { m: Movimiento }) {
    if (m.tipo === 'ENTRADA') return <span className="mov-qty mov-qty--in">+{entero(m.cantidad)}</span>;
    if (m.tipo === 'SALIDA') return <span className="mov-qty mov-qty--out">−{entero(m.cantidad)}</span>;
    const subio = (m.stock_resultante ?? 0) >= (m.stock_anterior ?? 0);
    return (
        <span className="mov-qty mov-qty--adj">
            {subio ? '+' : '−'}
            {entero(m.cantidad)}
        </span>
    );
}

/** `compacto` oculta las columnas de detalle (se usa en el dashboard). */
export default function KardexTable({ items, compacto }: { items: Movimiento[]; compacto?: boolean }) {
    if (items.length === 0) {
        return <EmptyState icono={<FaExchangeAlt />} titulo="Sin movimientos" texto="Cuando registres entradas, salidas o ajustes aparecerán aquí." />;
    }
    return (
        <div className="table-wrap">
            <table className={`table${compacto ? ' table--compact' : ''}`}>
                <thead>
                    <tr>
                        <th>Fecha</th>
                        <th>Producto</th>
                        <th>Tipo</th>
                        <th className="cell-num">Cantidad</th>
                        <th>Stock</th>
                        {!compacto && <th>Referencia</th>}
                        {!compacto && <th>Usuario</th>}
                    </tr>
                </thead>
                <tbody>
                    {items.map((m) => (
                        <tr key={m.id}>
                            <td className="muted" style={{ whiteSpace: 'nowrap' }}>
                                {fechaLocal(m.fecha)}
                            </td>
                            <td>
                                <div className="prod__name">{m.nombre ?? m.sku}</div>
                                <div className="prod__sku">
                                    {m.sku}
                                    {m.talla || m.color ? ` · ${etiquetaVariante(m.talla, m.color)}` : ''}
                                </div>
                            </td>
                            <td>
                                <Badge tono={TONO[m.tipo]}>{TEXTO[m.tipo]}</Badge>
                            </td>
                            <td className="cell-num">
                                <Cantidad m={m} />
                            </td>
                            <td>
                                {m.stock_anterior !== null && m.stock_resultante !== null ? (
                                    <span className="flow">
                                        {entero(m.stock_anterior)} <FaArrowRight style={{ fontSize: 10 }} /> <strong>{entero(m.stock_resultante)}</strong>
                                    </span>
                                ) : (
                                    <span className="muted">—</span>
                                )}
                            </td>
                            {!compacto && <td style={{ maxWidth: 240 }}>{m.referencia || <span className="muted">—</span>}</td>}
                            {!compacto && <td className="muted">{m.usuario ?? '—'}</td>}
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}