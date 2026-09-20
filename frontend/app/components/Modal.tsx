'use client';
import { ReactNode, useEffect, useRef } from 'react';
import { FaTimes } from 'react-icons/fa';

interface Props {
    abierto: boolean;
    onCerrar: () => void;
    titulo: string;
    subtitulo?: string;
    ancho?: boolean;
    children: ReactNode;
}

export default function Modal({ abierto, onCerrar, titulo, subtitulo, ancho, children }: Props) {
    const ref = useRef<HTMLDialogElement>(null);

    useEffect(() => {
        const dialogo = ref.current;
        if (!dialogo) return;
        if (abierto && !dialogo.open) dialogo.showModal();
        if (!abierto && dialogo.open) dialogo.close();
    }, [abierto]);

    return (
        <dialog
            ref={ref}
            className={`modal${ancho ? ' modal--ancho' : ''}`}
            onClose={onCerrar}
            onClick={(e) => {
                if (e.target === ref.current) onCerrar();
            }}
            aria-label={titulo}
        >
            {abierto && (
                <>
                    <div className="modal__head">
                        <div>
                            <h2 className="modal__title">{titulo}</h2>
                            {subtitulo && <p className="modal__sub">{subtitulo}</p>}
                        </div>
                        <button className="icon-btn" onClick={onCerrar} aria-label="Cerrar">
                            <FaTimes />
                        </button>
                    </div>
                    <div className="modal__body">{children}</div>
                </>
            )}
        </dialog>
    );
}