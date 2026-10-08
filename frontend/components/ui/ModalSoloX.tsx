'use client';
import { useEffect } from 'react';
import { FaTimes } from 'react-icons/fa';

interface Props {
    titulo: string;
    subtitulo?: string;
    onCerrar: () => void;
    bloqueado?: boolean;
    ancho?: number;
    children: React.ReactNode;
}

export default function ModalSoloX({ titulo, subtitulo, onCerrar, bloqueado = false, ancho = 640, children }: Props) {
    useEffect(() => {
        const previo = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = previo; };
    }, []);

    return (
        <div
            role="dialog"
            aria-modal="true"
            aria-label={titulo}
            style={{
                position: 'fixed', inset: 0, zIndex: 1000,
                background: 'rgba(15, 23, 42, 0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16,
            }}
        >
            <div
                style={{
                    background: 'var(--surface, #fff)', borderRadius: 16, width: '100%', maxWidth: ancho,
                    maxHeight: '92vh', overflowY: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,.28)',
                }}
            >
                <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16,
                    padding: '20px 24px', borderBottom: '1px solid var(--line-soft)',
                }}>
                    <div>
                        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>{titulo}</h2>
                        {subtitulo && (
                            <p style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--ink-2)' }}>{subtitulo}</p>
                        )}
                    </div>
                    <button type="button" className="icon-btn" onClick={onCerrar} disabled={bloqueado}
                        title="Cerrar" aria-label="Cerrar">
                        <FaTimes style={{ fontSize: 14 }} />
                    </button>
                </div>

                <div style={{ padding: 24 }}>{children}</div>
            </div>
        </div>
    );
}
