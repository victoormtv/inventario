'use client';
import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';
import { FaCheckCircle, FaExclamationCircle, FaExclamationTriangle } from 'react-icons/fa';

type Tipo = 'ok' | 'error' | 'aviso';
interface Aviso {
    id: number;
    tipo: Tipo;
    mensaje: string;
}

const Contexto = createContext<(mensaje: string, tipo?: Tipo) => void>(() => { });

export const useToast = () => useContext(Contexto);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [avisos, setAvisos] = useState<Aviso[]>([]);
    const contador = useRef(0);

    const avisar = useCallback((mensaje: string, tipo: Tipo = 'ok') => {
        const id = ++contador.current;
        setAvisos((prev) => [...prev, { id, tipo, mensaje }]);
        setTimeout(() => setAvisos((prev) => prev.filter((a) => a.id !== id)), tipo === 'ok' ? 3500 : 6000);
    }, []);

    return (
        <Contexto.Provider value={avisar}>
            {children}
            <div className="toasts" aria-live="polite">
                {avisos.map((a) => (
                    <div key={a.id} className={`toast toast--${a.tipo}`} role={a.tipo === 'error' ? 'alert' : 'status'}>
                        <span className="toast__icon">
                            {a.tipo === 'ok' ? <FaCheckCircle /> : a.tipo === 'error' ? <FaExclamationCircle /> : <FaExclamationTriangle />}
                        </span>
                        <span>{a.mensaje}</span>
                    </div>
                ))}
            </div>
        </Contexto.Provider>
    );
}