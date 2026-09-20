import Badge from './Badge';

/** Barra que muestra cuánto del stock mínimo se tiene. */
export default function StockLevel({ stock, minimo }: { stock: number; minimo: number }) {
    const agotado = stock <= 0;
    const pct = minimo > 0 ? Math.max(0, Math.min(100, (stock / minimo) * 100)) : 0;
    const faltan = Math.max(minimo - stock, 0);
    const critico = agotado || pct < 50;
    return (
        <div className="level">
            {agotado ? (
                <Badge tono="danger">Agotado</Badge>
            ) : (
                <div className="level__track" aria-hidden="true">
                    <div
                        className={`level__fill ${critico ? 'level__fill--danger' : 'level__fill--warn'}`}
                        style={{ width: `${pct}%` }}
                    />
                </div>
            )}
            <span className="level__text">{faltan > 0 ? `Faltan ${faltan}` : 'En el mínimo'}</span>
        </div>
    );
}