import { ReactNode } from 'react';
import { FaPlug, FaSync } from 'react-icons/fa';
import Button from './Button';

type Tono = 'ok' | 'danger' | 'brand';

const ICONO_ESTILO: Record<Tono, { background: string; color: string }> = {
    ok: { background: 'var(--ok-tint)', color: 'var(--ok)' },
    danger: { background: 'var(--danger-tint)', color: 'var(--danger)' },
    brand: { background: 'var(--brand-tint)', color: 'var(--brand)' },
};

export function EmptyState({
    icono,
    titulo,
    texto,
    accion,
    tono = 'brand',
}: {
    icono: ReactNode;
    titulo: string;
    texto?: string;
    accion?: ReactNode;
    tono?: Tono;
}) {
    return (
        <div className="state">
            <div className="state__icon" style={ICONO_ESTILO[tono]}>
                {icono}
            </div>
            <p className="state__title">{titulo}</p>
            {texto && <p className="state__text">{texto}</p>}
            {accion && <div style={{ marginTop: 10 }}>{accion}</div>}
        </div>
    );
}

export function ErrorState({ mensaje, onReintentar }: { mensaje: string; onReintentar?: () => void }) {
    return (
        <div className="state" role="alert">
            <div className="state__icon" style={ICONO_ESTILO.danger}>
                <FaPlug />
            </div>
            <p className="state__title">No se pudieron cargar los datos</p>
            <p className="state__text">{mensaje}</p>
            {onReintentar && (
                <div style={{ marginTop: 10 }}>
                    <Button variante="primario" onClick={onReintentar} icono={<FaSync style={{ fontSize: 12 }} />}>
                        Reintentar
                    </Button>
                </div>
            )}
        </div>
    );
}

export function Skeleton({ ancho = '100%', alto = 16, radio = 8 }: { ancho?: number | string; alto?: number; radio?: number }) {
    return <div className="skeleton" style={{ width: ancho, height: alto, borderRadius: radio }} />;
}

export function TablaSkeleton({ filas = 5 }: { filas?: number }) {
    return (
        <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: 18 }} aria-busy="true">
            {Array.from({ length: filas }, (_, i) => (
                <Skeleton key={i} alto={18} />
            ))}
        </div>
    );
}