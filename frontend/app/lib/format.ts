// Cambia aquí el símbolo si trabajas en soles ('S/') u otra moneda.
export const SIMBOLO_MONEDA = 'S/';

export const entero = (n: number) => n.toLocaleString('es-PE');

export const moneda = (n: number) =>
    `${SIMBOLO_MONEDA}${n.toLocaleString('es-PE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

/** El backend guarda las fechas en UTC ("2026-09-19 22:30:00"); aquí se muestran en hora local. */
export function fechaLocal(utc: string): string {
    const d = new Date(utc.replace(' ', 'T') + 'Z');
    return d.toLocaleString('es-PE', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
}

export const etiquetaVariante = (talla: string | null, color: string | null) =>
    [talla, color].filter(Boolean).join(' · ');

export const hoy = () => new Date().toISOString().slice(0, 10);