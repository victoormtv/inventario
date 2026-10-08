'use client';
import { ReactNode, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { useSesion } from '@/lib/session';
import ThemeToggle from '@/components/ThemeToggle';
import Sidebar from './Sidebar';

/** Decide qué se ve según haya sesión: login sin menú, o app con menú. */
export default function AppShell({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const router = useRouter();
    const { listo, sesion } = useSesion();
    const enLogin = pathname === '/login';

    useEffect(() => {
        if (!listo) return;
        if (!sesion && !enLogin) router.replace('/login');
        if (sesion && enLogin) router.replace('/');
    }, [listo, sesion, enLogin, router]);

    if (!listo) return <div className="boot" aria-busy="true" />;

    if (enLogin) {
        if (sesion) return null;
        return (
            <>
                <ThemeToggle className="fixed top-5 right-5 z-50" />
                {children}
            </>
        );
    }

    if (!sesion) return null; // mientras redirige al login

    return (
        <div className="app">
            <Sidebar usuario={sesion.usuario} />
            <main className="main">{children}</main>
        </div>
    );
}