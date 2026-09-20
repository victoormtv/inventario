'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { FaChartPie, FaBoxOpen, FaExchangeAlt, FaFileAlt, FaWarehouse, FaSignOutAlt } from 'react-icons/fa';
import { useApi } from '../lib/useApi';
import { cerrarSesion } from '../lib/session';
import type { EstadoAlertas } from '../lib/types';

const links = [
    { href: '/', label: 'Dashboard', icon: FaChartPie },
    { href: '/inventario', label: 'Inventario', icon: FaBoxOpen, conAlertas: true },
    { href: '/kardex', label: 'Kardex', icon: FaExchangeAlt },
    { href: '/reportes', label: 'Reportes', icon: FaFileAlt },
];

export default function Sidebar({ usuario }: { usuario: string }) {
    const pathname = usePathname();
    // El parámetro "ruta" no lo usa la API: solo cambia la URL para refrescar el contador al navegar.
    const alertas = useApi<EstadoAlertas>(`/api/alertas?ruta=${encodeURIComponent(pathname)}`);
    const pendientes = alertas.data?.total ?? 0;

    const activo = (href: string) => (href === '/' ? pathname === '/' : pathname.startsWith(href));

    return (
        <aside className="sidebar">
            <div className="sidebar__brand">
                <div className="sidebar__logo">
                    <FaWarehouse />
                </div>
                <div className="sidebar__text">
                    <div className="sidebar__name">ERP Inventario</div>
                    <div className="sidebar__sub">Control de stock</div>
                </div>
            </div>

            <nav className="sidebar__nav" aria-label="Navegación principal">
                {links.map(({ href, label, icon: Icon, conAlertas }) => (
                    <Link key={href} href={href} className="nav-link" aria-current={activo(href) ? 'page' : undefined} title={label}>
                        <Icon className="nav-link__icon" />
                        <span className="nav-link__label">{label}</span>
                        {conAlertas && pendientes > 0 && (
                            <span className="nav-badge" title={`${pendientes} productos por reponer`}>
                                {pendientes}
                            </span>
                        )}
                    </Link>
                ))}
            </nav>

            <div className="sidebar__user">
                <div className="sidebar__avatar" aria-hidden="true">
                    {usuario.charAt(0).toUpperCase()}
                </div>
                <div className="sidebar__who">
                    <strong>{usuario}</strong>
                    <button className="sidebar__logout" onClick={cerrarSesion} title="Cerrar sesión">
                        <span className="sidebar__logout-text">Cerrar sesión</span>
                    </button>
                </div>
                <button className="icon-btn" onClick={cerrarSesion} aria-label="Cerrar sesión" style={{ color: 'var(--side-dim)', display: 'none' }}>
                    <FaSignOutAlt />
                </button>
            </div>
        </aside>
    );
}