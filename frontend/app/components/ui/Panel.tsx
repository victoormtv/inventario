import { ReactNode } from 'react';

export function Panel({ children, etiqueta }: { children: ReactNode; etiqueta?: string }) {
    return (
        <section className="panel" aria-label={etiqueta}>
            {children}
        </section>
    );
}

export function PanelHead({ titulo, descripcion, accion }: { titulo: string; descripcion?: string; accion?: ReactNode }) {
    return (
        <div className="panel__head">
            <div>
                <h2 className="panel__title">{titulo}</h2>
                {descripcion && <p className="panel__desc">{descripcion}</p>}
            </div>
            {accion}
        </div>
    );
}

export function PageHeader({ titulo, descripcion, acciones }: { titulo: string; descripcion?: ReactNode; acciones?: ReactNode }) {
    return (
        <header className="page__head">
            <div>
                <h1 className="page__title">{titulo}</h1>
                {descripcion && <p className="page__meta">{descripcion}</p>}
            </div>
            {acciones && <div style={{ display: 'flex', gap: 10 }}>{acciones}</div>}
        </header>
    );
}