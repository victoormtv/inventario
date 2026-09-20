import Link from 'next/link';
import { FaCheck, FaExclamationTriangle } from 'react-icons/fa';
import type { AlertaStock } from '../../lib/types';
import Badge from '../ui/Badge';
import { Panel, PanelHead } from '../ui/Panel';
import { EmptyState } from '../ui/States';
import StockLevel from '../ui/StockLevel';

export default function AlertasTable({ alertas }: { alertas: AlertaStock[] }) {
    // Los más críticos primero (menor proporción de stock frente a su mínimo)
    const ordenadas = [...alertas].sort((a, b) => {
        const ra = a.stock_minimo > 0 ? a.stock_total / a.stock_minimo : 0;
        const rb = b.stock_minimo > 0 ? b.stock_total / b.stock_minimo : 0;
        return ra - rb;
    });

    return (
        <Panel etiqueta="Productos por reponer">
            <PanelHead
                titulo="Productos por reponer"
                descripcion="Del más urgente al menos urgente"
                accion={
                    ordenadas.length > 0 && (
                        <Badge tono="warn">
                            <FaExclamationTriangle style={{ fontSize: 11 }} />
                            {ordenadas.length} {ordenadas.length === 1 ? 'producto' : 'productos'}
                        </Badge>
                    )
                }
            />
            {ordenadas.length === 0 ? (
                <EmptyState tono="ok" icono={<FaCheck />} titulo="Todo en orden" texto="Ningún producto está por debajo de su stock mínimo." />
            ) : (
                <div className="table-wrap">
                    <table className="table">
                        <thead>
                            <tr>
                                <th>Producto</th>
                                <th className="cell-num">Stock actual</th>
                                <th className="cell-num">Mínimo</th>
                                <th>Nivel</th>
                                <th />
                            </tr>
                        </thead>
                        <tbody>
                            {ordenadas.map((p) => (
                                <tr key={p.sku}>
                                    <td>
                                        <div className="prod__name">{p.nombre}</div>
                                        <div className="prod__sku">{p.sku}</div>
                                    </td>
                                    <td className="cell-num">
                                        <span className="stock-now">{p.stock_total}</span>
                                    </td>
                                    <td className="cell-num stock-min">{p.stock_minimo}</td>
                                    <td>
                                        <StockLevel stock={p.stock_total} minimo={p.stock_minimo} />
                                    </td>
                                    <td className="cell-num">
                                        <Link href="/kardex" className="btn btn--sm">
                                            Registrar entrada
                                        </Link>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </Panel>
    );
}