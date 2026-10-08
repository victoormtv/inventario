'use client';

import { useSyncExternalStore } from 'react';
import { useTheme } from 'next-themes';
import { FaDesktop, FaMoon, FaSun } from 'react-icons/fa';

const OPCIONES = [
    { id: 'light', label: 'Claro', icon: <FaSun /> },
    { id: 'system', label: 'Sistema', icon: <FaDesktop /> },
    { id: 'dark', label: 'Oscuro', icon: <FaMoon /> },
];

const sinSuscripcion = () => () => { };
const useMontado = () =>
    useSyncExternalStore(sinSuscripcion, () => true, () => false);

interface Props {
    className?: string;
    variante?: 'normal' | 'sidebar';
}

export default function ThemeToggle({ className = '', variante = 'normal' }: Props) {
    const { theme, setTheme } = useTheme();
    const montado = useMontado();

    const sidebar = variante === 'sidebar';

    const contenedor = sidebar
        ? 'flex w-full p-1 bg-[rgb(255_255_255/0.08)] border border-[rgb(255_255_255/0.1)] rounded-xl'
        : 'inline-flex p-1 bg-slate-100 border border-slate-200 rounded-xl';

    const activoCls = sidebar
        ? 'bg-indigo-600 text-[#fff] shadow-sm'
        : 'bg-white text-indigo-600 shadow-sm';

    const inactivoCls = sidebar
        ? 'text-slate-400 hover:text-[#fff]'
        : 'text-slate-400 hover:text-slate-600';

    return (
        <div
            role="radiogroup"
            aria-label="Tema de la interfaz"
            className={`${contenedor} ${className}`}>
            {OPCIONES.map((o) => {
                const activa = montado && theme === o.id;
                return (
                    <button
                        key={o.id}
                        type="button"
                        role="radio"
                        aria-checked={activa}
                        title={o.label}
                        onClick={() => setTheme(o.id)}
                        className={`${sidebar ? 'flex-1 h-8' : 'w-8 h-8'} flex items-center justify-center text-xs rounded-lg transition-all cursor-pointer ${activa ? activoCls : inactivoCls}`}>
                        {o.icon}
                    </button>
                );
            })}
        </div>
    );
}