'use client';
import { useState } from 'react';
import { FaCheck, FaEye, FaEyeSlash, FaWarehouse } from 'react-icons/fa';
import { api } from '../lib/api';
import { guardarSesion } from '../lib/session';
import Button from '../components/ui/Button';
import { Callout } from '../components/ui/Form';

const BENEFICIOS = [
    'Avisos por correo cuando un producto llega a su mínimo',
    'Kardex con cada entrada, salida y ajuste',
    'Reportes en Excel y PDF, e importación masiva',
];

export default function LoginPage() {
    const [usuario, setUsuario] = useState('');
    const [password, setPassword] = useState('');
    const [verClave, setVerClave] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);

    const entrar = async (e: React.FormEvent) => {
        e.preventDefault();
        setEnviando(true);
        setError(null);
        try {
            const r = await api<{ token: string; usuario: string }>('/api/auth/login', {
                method: 'POST',
                json: { usuario, password },
            });
            guardarSesion({ token: r.token, usuario: r.usuario }); // AppShell redirige al dashboard
        } catch (err) {
            setError((err as Error).message);
            setEnviando(false);
        }
    };

    return (
        <div className="login">
            <aside className="login__brand">
                <div className="login__logo">
                    <div className="sidebar__logo">
                        <FaWarehouse />
                    </div>
                    Nathan Inventario
                </div>

                <div>
                    <h2 className="login__tagline">Tu stock, siempre al día.</h2>
                    <p className="login__tagline-sub">Productos, variantes y movimientos en un solo lugar, sin hojas de cálculo sueltas.</p>
                    <ul className="login__features">
                        {BENEFICIOS.map((b) => (
                            <li key={b}>
                                <span className="login__check">
                                    <FaCheck />
                                </span>
                                {b}
                            </li>
                        ))}
                    </ul>
                </div>

                {/* Ilustración decorativa (datos de ejemplo) */}
                <div className="login__preview" aria-hidden="true">
                    <div className="login__preview-head">
                        <span>Productos por reponer</span>
                        <span className="login__preview-pill">2</span>
                    </div>
                    <div className="login__preview-row">
                        <span>Polo básico algodón</span>
                        <span className="login__preview-bar">
                            <i style={{ width: '30%', background: '#e2703a' }} />
                        </span>
                        <span className="login__preview-num" style={{ color: '#ffb48a' }}>
                            3
                        </span>
                    </div>
                    <div className="login__preview-row">
                        <span>Zapatilla urbana</span>
                        <span className="login__preview-bar">
                            <i style={{ width: '12%', background: '#f0605d' }} />
                        </span>
                        <span className="login__preview-num" style={{ color: '#ff9d9b' }}>
                            1
                        </span>
                    </div>
                </div>

                <span className="login__legal">Acceso solo para administradores</span>
            </aside>

            <div className="login__form-side">
                <form className="login__card form" onSubmit={entrar}>
                    <div className="login__mobile-brand">
                        <div className="sidebar__logo">
                            <FaWarehouse />
                        </div>
                        Nathan Inventario
                    </div>

                    <div>
                        <h1 className="login__title">Bienvenido de nuevo</h1>
                        <p className="login__sub">Ingresa con tu usuario de administrador.</p>
                    </div>

                    {error && <Callout tono="danger">{error}</Callout>}

                    <div className="field">
                        <label className="field__label" htmlFor="usuario">
                            Usuario
                        </label>
                        <input
                            id="usuario"
                            className="input"
                            value={usuario}
                            onChange={(e) => setUsuario(e.target.value)}
                            autoComplete="username"
                            autoFocus
                            required
                        />
                    </div>

                    <div className="field">
                        <label className="field__label" htmlFor="password">
                            Contraseña
                        </label>
                        <div className="input-wrap">
                            <input
                                id="password"
                                className="input"
                                type={verClave ? 'text' : 'password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                autoComplete="current-password"
                                required
                            />
                            <button
                                type="button"
                                className="input-wrap__toggle"
                                onClick={() => setVerClave((v) => !v)}
                                aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                            >
                                {verClave ? <FaEyeSlash /> : <FaEye />}
                            </button>
                        </div>
                    </div>

                    <Button type="submit" variante="primario" bloque cargando={enviando}>
                        Entrar
                    </Button>

                    <p className="login__foot">¿Olvidaste tu clave? Otro administrador puede cambiarla.</p>
                </form>
            </div>
        </div>
    );
}