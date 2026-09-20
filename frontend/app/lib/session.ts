'use client';
import { useMemo, useSyncExternalStore } from 'react';

const CLAVE = 'inventario.sesion';

export interface Sesion {
    token: string;
    usuario: string;
}

const oyentes = new Set<() => void>();

function avisar() {
    oyentes.forEach((fn) => fn());
}

function suscribir(fn: () => void) {
    oyentes.add(fn);
    window.addEventListener('storage', fn); // sincroniza entre pestañas
    return () => {
        oyentes.delete(fn);
        window.removeEventListener('storage', fn);
    };
}

function leerRaw(): string | null {
    try {
        return localStorage.getItem(CLAVE);
    } catch {
        return null;
    }
}

function parsear(raw: string | null): Sesion | null {
    if (!raw) return null;
    try {
        const s = JSON.parse(raw) as Sesion;
        return s.token && s.usuario ? s : null;
    } catch {
        return null;
    }
}

export function leerSesion(): Sesion | null {
    return parsear(leerRaw());
}

export function guardarSesion(s: Sesion) {
    localStorage.setItem(CLAVE, JSON.stringify(s));
    avisar();
}

export function cerrarSesion() {
    localStorage.removeItem(CLAVE);
    avisar();
}

/**
 * `listo` es false mientras el navegador aún no leyó el almacenamiento
 * (evita mostrar un parpadeo de "sin sesión" al cargar la página).
 */
export function useSesion(): { listo: boolean; sesion: Sesion | null } {
    const raw = useSyncExternalStore<string | null | undefined>(suscribir, leerRaw, () => undefined);
    const sesion = useMemo(() => (raw === undefined ? null : parsear(raw)), [raw]);
    return { listo: raw !== undefined, sesion };
}