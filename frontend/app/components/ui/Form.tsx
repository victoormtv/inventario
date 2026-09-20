import { ReactNode } from 'react';

/** Etiqueta + control + ayuda/error. El <label> envuelve al control, así queda asociado sin ids. */
export function Field({ label, hint, error, children }: { label: string; hint?: string; error?: string | null; children: ReactNode }) {
    return (
        <label className="field">
            <span className="field__label">{label}</span>
            {children}
            {error ? <span className="field__error">{error}</span> : hint ? <span className="field__hint">{hint}</span> : null}
        </label>
    );
}

export function Callout({ tono = 'info', children }: { tono?: 'info' | 'warn' | 'danger' | 'ok'; children: ReactNode }) {
    return (
        <div className={`callout callout--${tono}`} role={tono === 'danger' ? 'alert' : undefined}>
            <div>{children}</div>
        </div>
    );
}