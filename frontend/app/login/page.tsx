'use client';
import { useEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { FaEye, FaEyeSlash, FaExclamationCircle, FaSpinner, FaWarehouse } from 'react-icons/fa';
import { api } from '@/lib/api';
import { guardarSesion } from '@/lib/session';

const inputCls =
    'w-full bg-white border border-slate-200 rounded-2xl px-5 py-4 text-base text-slate-900 font-medium focus:outline-none focus:ring-4 focus:ring-indigo-500/10 focus:border-indigo-500 hover:border-slate-300 transition placeholder:text-slate-300';

export default function LoginPage() {
    const [usuario, setUsuario] = useState('');
    const [password, setPassword] = useState('');
    const [verClave, setVerClave] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [enviando, setEnviando] = useState(false);

    const raiz = useRef<HTMLDivElement>(null);
    const errorRef = useRef<HTMLDivElement>(null);

    // Animación de entrada
    useEffect(() => {
        const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        const ctx = gsap.context(() => {
            if (reducir) {
                gsap.set('.anim', { opacity: 1 });
                return;
            }

            gsap.fromTo(
                '.anim',
                { y: 28, opacity: 0 },
                { y: 0, opacity: 1, duration: 0.8, ease: 'power3.out', stagger: 0.09, delay: 0.1, clearProps: 'transform' }
            );

            gsap.fromTo(
                '.logo',
                { scale: 0.6, rotate: -12, opacity: 0 },
                { scale: 1, rotate: 0, opacity: 1, duration: 0.9, ease: 'back.out(1.8)' }
            );

            // Fondo: dos manchas suaves que flotan
            gsap.to('.blob-a', { x: 40, y: 30, duration: 9, ease: 'sine.inOut', repeat: -1, yoyo: true });
            gsap.to('.blob-b', { x: -50, y: -25, duration: 11, ease: 'sine.inOut', repeat: -1, yoyo: true });
        }, raiz);

        return () => ctx.revert();
    }, []);

    // Entrada del error + sacudida
    useEffect(() => {
        if (!error || !errorRef.current) return;
        gsap.fromTo(errorRef.current, { opacity: 0, y: -8 }, { opacity: 1, y: 0, duration: 0.35, ease: 'power2.out' });
        gsap.fromTo('.card-login', { x: 0 }, { x: 0, keyframes: { x: [-10, 10, -7, 7, -3, 3, 0] }, duration: 0.5, ease: 'power1.out' });
    }, [error]);

    const entrar = async (e: React.FormEvent) => {
        e.preventDefault();
        setEnviando(true);
        setError(null);
        try {
            const r = await api<{ token: string; usuario: string }>('/api/auth/login', {
                method: 'POST',
                json: { usuario, password },
            });
            // Salida suave antes de redirigir
            gsap.to('.card-login', {
                opacity: 0,
                y: -16,
                duration: 0.35,
                ease: 'power2.in',
                onComplete: () => guardarSesion({ token: r.token, usuario: r.usuario }),
            });
        } catch (err) {
            setError((err as Error).message);
            setEnviando(false);
        }
    };

    return (
        <div ref={raiz} className="relative min-h-screen bg-slate-50 flex items-center justify-center p-6 overflow-hidden">
            <style jsx global>{`
                input:-webkit-autofill,
                input:-webkit-autofill:hover,
                input:-webkit-autofill:focus,
                input:-webkit-autofill:active {
                    -webkit-box-shadow: 0 0 0 1000px var(--color-white) inset !important;
                    box-shadow: 0 0 0 1000px var(--color-white) inset !important;
                    -webkit-text-fill-color: var(--color-slate-900) !important;
                    caret-color: var(--color-slate-900);
                    border-radius: 1rem;
                    transition: background-color 9999s ease-in-out 0s;
                }
            `}</style>

            {/* Fondo minimalista */}
            <div className="blob-a pointer-events-none absolute -top-40 -left-40 w-[520px] h-[520px] rounded-full bg-indigo-200/40 blur-3xl" />
            <div className="blob-b pointer-events-none absolute -bottom-40 -right-40 w-[520px] h-[520px] rounded-full bg-sky-200/40 blur-3xl" />

            <main className="card-login relative w-full max-w-md">
                <div className="space-y-10">

                    {/* Marca */}
                    <div className="flex flex-col items-center text-center space-y-5">
                        <div className="logo w-16 h-16 rounded-2xl bg-indigo-600 text-white flex items-center justify-center text-2xl shadow-xl shadow-indigo-600/25">
                            <FaWarehouse />
                        </div>
                        <div className="anim opacity-0 space-y-2">
                            <p className="text-xs font-semibold text-indigo-600 uppercase tracking-widest">Nathan Inventario</p>
                            <h1 className="text-4xl font-black text-slate-900 tracking-tight">Bienvenido</h1>
                            <p className="text-slate-500 text-base">Ingresa tus credenciales para continuar.</p>
                        </div>
                    </div>

                    {error && (
                        <div
                            ref={errorRef}
                            className="p-4 bg-red-50 text-red-700 text-sm rounded-2xl border border-red-100 flex items-start gap-3">
                            <FaExclamationCircle className="shrink-0 text-red-500 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <form onSubmit={entrar} className="space-y-5">
                        <div className="anim opacity-0 space-y-2">
                            <label className="block text-sm font-semibold text-slate-600" htmlFor="usuario">
                                Usuario
                            </label>
                            <input
                                id="usuario"
                                type="text"
                                className={inputCls}
                                value={usuario}
                                onChange={(e) => setUsuario(e.target.value)}
                                placeholder="Ej. admin"
                                autoComplete="username"
                                autoFocus
                                required
                            />
                        </div>

                        <div className="anim opacity-0 space-y-2">
                            <label className="block text-sm font-semibold text-slate-600" htmlFor="password">
                                Contraseña
                            </label>
                            <div className="relative">
                                <input
                                    id="password"
                                    type={verClave ? 'text' : 'password'}
                                    className={`${inputCls} pr-14`}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    placeholder="••••••••"
                                    autoComplete="current-password"
                                    required
                                />
                                <button
                                    type="button"
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition p-1.5 cursor-pointer"
                                    onClick={() => setVerClave((v) => !v)}
                                    aria-label={verClave ? 'Ocultar contraseña' : 'Mostrar contraseña'}>
                                    {verClave ? <FaEyeSlash /> : <FaEye />}
                                </button>
                            </div>
                        </div>

                        <div className="anim opacity-0 pt-2">
                            <button
                                type="submit"
                                disabled={enviando}
                                className="w-full flex items-center justify-center gap-2.5 px-5 py-4 text-base font-bold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.99] rounded-2xl transition-all cursor-pointer shadow-lg shadow-indigo-600/25 disabled:opacity-60 disabled:cursor-not-allowed">
                                {enviando ? (
                                    <>
                                        <FaSpinner className="animate-spin" />
                                        Ingresando…
                                    </>
                                ) : (
                                    'Iniciar sesión'
                                )}
                            </button>
                        </div>
                    </form>

                    <p className="anim opacity-0 text-center text-sm text-slate-400">
                        ¿Olvidaste tu contraseña? Contacta con el administrador.
                    </p>
                </div>
            </main>
        </div>
    );
}