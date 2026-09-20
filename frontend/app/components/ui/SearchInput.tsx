'use client';
import { useEffect, useRef, useState } from 'react';
import { FaSearch } from 'react-icons/fa';

interface Props {
    valor?: string;
    onCambio: (valor: string) => void;
    placeholder?: string;
}

/** Buscador con pausa (300 ms) para no consultar la API en cada tecla. */
export default function SearchInput({ valor = '', onCambio, placeholder = 'Buscar…' }: Props) {
    const [texto, setTexto] = useState(valor);
    const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(
        () => () => {
            if (temporizador.current) clearTimeout(temporizador.current);
        },
        [],
    );

    return (
        <div className="search">
            <FaSearch className="search__icon" />
            <input
                className="input"
                type="search"
                value={texto}
                placeholder={placeholder}
                aria-label={placeholder}
                onChange={(e) => {
                    const v = e.target.value;
                    setTexto(v);
                    if (temporizador.current) clearTimeout(temporizador.current);
                    temporizador.current = setTimeout(() => onCambio(v), 300);
                }}
            />
        </div>
    );
}