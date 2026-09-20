import { FaBoxOpen, FaCheck, FaDollarSign, FaExclamationTriangle } from 'react-icons/fa';
import type { KpiData } from '../../lib/types';
import { entero, moneda } from '../../lib/format';

export default function MetricsBand({ kpis }: { kpis: KpiData }) {
    const hayAlertas = kpis.alertas_stock_bajo > 0;
    return (
        <section className="metrics" aria-label="Indicadores principales">
            <div className="metric">
                <div>
                    <p className="metric__label">Productos registrados</p>
                    <p className="metric__value">{entero(kpis.total_productos)}</p>
                    <p className="metric__hint">{entero(kpis.unidades_totales)} unidades en stock</p>
                </div>
                <div className="metric__icon metric__icon--brand">
                    <FaBoxOpen />
                </div>
            </div>

            <div className="metric">
                <div>
                    <p className="metric__label">Valor del stock</p>
                    <p className="metric__value">{moneda(kpis.stock_valorizado)}</p>
                    <p className="metric__hint">Valorizado al precio de costo</p>
                </div>
                <div className="metric__icon metric__icon--ok">
                    <FaDollarSign />
                </div>
            </div>

            <div className={`metric${hayAlertas ? ' metric--alert' : ''}`}>
                <div>
                    <p className="metric__label">Productos por reponer</p>
                    <p className="metric__value">{kpis.alertas_stock_bajo}</p>
                    <p className="metric__hint">
                        {hayAlertas ? `${kpis.alertas_stock_bajo} de ${kpis.total_productos} en o bajo su mínimo` : 'Todos sobre su mínimo'}
                    </p>
                </div>
                <div className={`metric__icon ${hayAlertas ? 'metric__icon--warn' : 'metric__icon--ok'}`}>
                    {hayAlertas ? <FaExclamationTriangle /> : <FaCheck />}
                </div>
            </div>
        </section>
    );
}