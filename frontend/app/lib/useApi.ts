'use client';
import { useEffect, useState } from 'react';
import { api } from './api';

interface Estado<T> {
    path: string | null;
    tick: number;
    data: T | null;
    error: string | null;
    actualizado: Date | null;
}

/**
 * Carga datos de la API.
 *  - `path` null = no cargar todavía.
 *  - `conservar`: mantiene los datos anteriores mientras llegan los nuevos
 *    (útil en listas con filtros para que la tabla no parpadee).
 * `loading` se deriva de lo pedido vs. lo recibido, así el efecto solo
 * actualiza el estado cuando la respuesta llega.
 */
export function useApi<T>(path: string | null, conservar = true) {
    const [tick, setTick] = useState(0);
    const [estado, setEstado] = useState<Estado<T>>({ path: null, tick: -1, data: null, error: null, actualizado: null });

    useEffect(() => {
        if (path === null) return;
        const control = new AbortController();
        api<T>(path, { signal: control.signal })
            .then((data) => setEstado({ path, tick, data, error: null, actualizado: new Date() }))
            .catch((err: Error) => {
                if (err.name === 'AbortError') return;
                setEstado((prev) => ({ ...prev, path, tick, error: err.message }));
            });
        return () => control.abort();
    }, [path, tick]);

    const alDia = path !== null && estado.path === path && estado.tick === tick;
    return {
        data: conservar || estado.path === path ? estado.data : null,
        error: alDia ? estado.error : null,
        loading: path !== null && !alDia,
        actualizado: estado.actualizado,
        refetch: () => setTick((t) => t + 1),
    };
}