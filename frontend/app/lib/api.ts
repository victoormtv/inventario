import { cerrarSesion, leerSesion } from './session';

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';

export class ApiError extends Error {
    status: number;
    constructor(status: number, mensaje: string) {
        super(mensaje);
        this.status = status;
    }
}

function mensajeDe(detail: unknown, status: number): string {
    if (typeof detail === 'string') return detail;
    if (Array.isArray(detail)) return 'Hay datos no válidos. Revisa el formulario e inténtalo de nuevo.';
    if (status === 413) return 'El archivo es demasiado grande.';
    return `Algo salió mal (error ${status}).`;
}

async function pedir(path: string, init: RequestInit = {}): Promise<Response> {
    const sesion = leerSesion();
    const headers = new Headers(init.headers);
    if (sesion) headers.set('Authorization', `Bearer ${sesion.token}`);

    let res: Response;
    try {
        res = await fetch(`${API_URL}${path}`, { ...init, headers });
    } catch (e) {
        if ((e as Error).name === 'AbortError') throw e;
        throw new ApiError(0, 'No se pudo conectar con el servidor. Revisa que el backend esté encendido.');
    }

    if (!res.ok) {
        let detail: unknown = null;
        try {
            detail = (await res.json()).detail;
        } catch {
            /* respuesta sin JSON */
        }
        if (res.status === 401 && sesion) cerrarSesion(); // sesión vencida: vuelve al login
        throw new ApiError(res.status, mensajeDe(detail, res.status));
    }
    return res;
}

type Opciones = Omit<RequestInit, 'body'> & { json?: unknown };

export async function api<T>(path: string, { json, ...init }: Opciones = {}): Promise<T> {
    const headers = new Headers(init.headers);
    let body: string | undefined;
    if (json !== undefined) {
        headers.set('Content-Type', 'application/json');
        body = JSON.stringify(json);
    }
    const res = await pedir(path, { ...init, headers, body });
    return (await res.json()) as T;
}

export async function subir<T>(path: string, archivo: File): Promise<T> {
    const form = new FormData();
    form.append('archivo', archivo);
    const res = await pedir(path, { method: 'POST', body: form });
    return (await res.json()) as T;
}

/** Descarga un archivo protegido (necesita el token, por eso no es un simple enlace). */
export async function descargar(path: string, nombre: string) {
    const res = await pedir(path);
    const url = URL.createObjectURL(await res.blob());
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre;
    document.body.appendChild(enlace);
    enlace.click();
    enlace.remove();
    URL.revokeObjectURL(url);
}