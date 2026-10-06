'use client';
import { useState } from 'react';
import { FaCheck, FaEye, FaEyeSlash, FaWarehouse, FaShieldAlt, FaBoxOpen } from 'react-icons/fa';
import { api } from '../lib/api';
import { guardarSesion } from '../lib/session';
import Button from '../components/ui/Button';
import { Callout } from '../components/ui/Form';

const BENEFICIOS = [
    'Avisos en tiempo real sobre productos por reponer.',
    'Kardex detallado con historial de entradas, salidas y ajustes.',
    'Control de variantes por talla, medida, peso y color.',
    'Integración con módulos de ventas e historial de comprobantes.',
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
            guardarSesion({ token: r.token, usuario: r.usuario });
        } catch (err) {
            setError((err as Error).message);
            setEnviando(false);
        }
    };

    return (
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
            <div className="w-full max-w-5xl bg-white rounded-3xl border border-slate-200 shadow-xl overflow-hidden grid grid-cols-1 lg:grid-cols-12 min-h-[620px]">

                {/* ── Lateral izquierdo: Branding e Ilustración ── */}
                <aside className="lg:col-span-6 bg-slate-900 text-white p-8 sm:p-12 flex flex-col justify-between relative overflow-hidden">
                    {/* Efecto de luz ambiental en el fondo */}
                    <div className="absolute -top-24 -left-24 w-72 h-72 bg-indigo-600/30 rounded-full blur-3xl pointer-events-none" />
                    <div className="absolute -bottom-24 -right-24 w-72 h-72 bg-emerald-600/20 rounded-full blur-3xl pointer-events-none" />

                    <div className="relative z-10 space-y-6">
                        {/* Logo */}
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white text-lg font-bold shadow-md shadow-indigo-500/30">
                                <FaWarehouse />
                            </div>
                            <span className="text-xl font-black tracking-tight text-white">Nathan Inventario</span>
                        </div>

                        {/* Mensajes principales */}
                        <div className="pt-4 space-y-2">
                            <h2 className="text-2xl sm:text-3xl font-extrabold text-white leading-tight">
                                Tu stock y ventas, <br />
                                <span className="text-indigo-400">siempre bajo control.</span>
                            </h2>
                            <p className="text-slate-400 text-sm leading-relaxed">
                                Controla productos, variantes, precios y movimientos en un solo lugar sin depender de hojas de cálculo propensas a errores.
                            </p>
                        </div>

                        {/* Lista de beneficios */}
                        <ul className="space-y-3 pt-2">
                            {BENEFICIOS.map((b) => (
                                <li key={b} className="flex items-start gap-3 text-xs text-slate-300 font-medium">
                                    <span className="w-5 h-5 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center shrink-0 mt-0.5 border border-emerald-500/20">
                                        <FaCheck className="text-[10px]" />
                                    </span>
                                    <span>{b}</span>
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Widget decorativo tipo Vista Previa */}
                    <div className="relative z-10 pt-8 mt-auto">
                        <div className="bg-slate-800/80 backdrop-blur-md rounded-2xl p-4 border border-slate-700/60 space-y-3 shadow-lg">
                            <div className="flex items-center justify-between text-xs font-semibold text-slate-400">
                                <span className="flex items-center gap-1.5 text-slate-300">
                                    <FaBoxOpen className="text-amber-400" /> Alertas de repositorio
                                </span>
                                <span className="bg-amber-500/20 text-amber-300 px-2 py-0.5 rounded-md text-[10px] font-bold border border-amber-500/30">
                                    2 urgentes
                                </span>
                            </div>
                            <div className="space-y-2">
                                <div>
                                    <div className="flex justify-between text-xs text-slate-300 mb-1 font-medium">
                                        <span>Pegamento extra fuerte</span>
                                        <span className="text-amber-400 font-mono font-bold">3 u.</span>
                                    </div>
                                    <div className="w-full bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
                                        <div className="bg-amber-500 h-full rounded-full" style={{ width: '30%' }} />
                                    </div>
                                </div>
                                <div>
                                    <div className="flex justify-between text-xs text-slate-300 mb-1 font-medium">
                                        <span>Fragua porcelanato</span>
                                        <span className="text-rose-400 font-mono font-bold">1 u.</span>
                                    </div>
                                    <div className="w-full bg-slate-700/60 rounded-full h-1.5 overflow-hidden">
                                        <div className="bg-rose-500 h-full rounded-full" style={{ width: '12%' }} />
                                    </div>
                                </div>
                            </div>
                        </div>

                        <p className="text-[11px] text-slate-500 mt-4 flex items-center gap-1.5">
                            <FaShieldAlt className="text-indigo-400" /> Acceso seguro restringido a personal autorizado.
                        </p>
                    </div>
                </aside>

                {/* ── Formulario de inicio de sesión ── */}
                <div className="lg:col-span-6 p-8 sm:p-12 flex flex-col justify-center bg-white">
                    <div className="max-w-sm mx-auto w-full space-y-6">

                        {/* Header móvil del logo */}
                        <div className="flex items-center gap-2 lg:hidden mb-2">
                            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white text-sm font-bold">
                                <FaWarehouse />
                            </div>
                            <span className="text-lg font-black text-slate-900">Nathan Inventario</span>
                        </div>

                        <div>
                            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest mb-1">Acceso al sistema</p>
                            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">Bienvenido de nuevo</h1>
                            <p className="text-slate-500 text-sm mt-1">
                                Ingresa tus credenciales para administrar el inventario.
                            </p>
                        </div>

                        {error && (
                            <Callout tono="danger">
                                {error}
                            </Callout>
                        )}

                        <form onSubmit={entrar} className="space-y-4">
                            {/* Campo Usuario */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-slate-700" htmlFor="usuario">
                                    Usuario
                                </label>
                                <input
                                    id="usuario"
                                    type="text"
                                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition placeholder:text-slate-300"
                                    value={usuario}
                                    onChange={(e) => setUsuario(e.target.value)}
                                    placeholder="Ej. admin"
                                    autoComplete="username"
                                    autoFocus
                                    required
                                />
                            </div>

                            {/* Campo Contraseña */}
                            <div className="space-y-1.5">
                                <label className="block text-xs font-semibold text-slate-700" htmlFor="password">
                                    Contraseña
                                </label>
                                <div className="relative">
                                    <input
                                        id="password"
                                        type={verClave ? 'text' : 'password'}
                                        className="w-full bg-slate-50 border border-slate-200 rounded-xl pl-3.5 pr-10 py-2.5 text-sm text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 transition placeholder:text-slate-300"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1 cursor-pointer"
                                        onClick={() => setVerClave((v) => !v)}
                                        aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                                    >
                                        {verClave ? <FaEyeSlash className="text-sm" /> : <FaEye className="text-sm" />}
                                    </button>
                                </div>
                            </div>

                            {/* Botón Ingresar */}
                            <div className="pt-2">
                                <Button type="submit" variante="primario" bloque cargando={enviando}>
                                    Iniciar sesión
                                </Button>
                            </div>
                        </form>

                        <p className="text-center text-xs text-slate-400">
                            ¿Olvidaste tu contraseña? Contacta con el administrador principal para restablecer tu cuenta.
                        </p>
                    </div>
                </div>

            </div>
        </div>
    );
}