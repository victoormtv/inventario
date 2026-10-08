export const SIMBOLO_MONEDA = 'S/';

export const entero = (n: number | null | undefined) => (n ?? 0).toLocaleString('es-PE');

export const moneda = (n: number | null | undefined) =>
    `${SIMBOLO_MONEDA}${(n ?? 0).toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function fechaLocal(utc: string | null | undefined): string {
    if (!utc) return '-';
    const d = new Date(utc.replace(' ', 'T') + 'Z');
    return d.toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const etiquetaVariante = (talla: string | null, color: string | null) =>
    [talla, color].filter(Boolean).join(' · ');

export const hoy = () => new Date().toISOString().slice(0, 10);