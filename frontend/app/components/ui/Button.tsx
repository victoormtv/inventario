import { ButtonHTMLAttributes, ReactNode } from 'react';
import { FaSync } from 'react-icons/fa';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
    variante?: 'secundario' | 'primario' | 'peligro' | 'fantasma';
    pequeno?: boolean;
    bloque?: boolean;
    cargando?: boolean;
    icono?: ReactNode;
}

const CLASE = {
    secundario: '',
    primario: 'btn--primary',
    peligro: 'btn--danger',
    fantasma: 'btn--ghost',
};

export default function Button({
    variante = 'secundario',
    pequeno,
    bloque,
    cargando,
    icono,
    className = '',
    children,
    disabled,
    type = 'button',
    ...rest
}: Props) {
    const clases = ['btn', CLASE[variante], pequeno && 'btn--sm', bloque && 'btn--block', className].filter(Boolean).join(' ');
    return (
        <button type={type} className={clases} disabled={disabled || cargando} {...rest}>
            {cargando ? <FaSync className="spin" style={{ fontSize: 12 }} /> : icono}
            {children}
        </button>
    );
}