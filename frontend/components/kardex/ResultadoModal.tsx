'use client';

import type { ResultadoMovimiento } from '@/types';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import { Callout } from '@/components/ui/Form';
import ModalSoloX from '@/components/ui/ModalSoloX';
import { TEXTO, TONO } from './constantes';

export default function ResultadoModal({ r, onCerrar }: { r: ResultadoMovimiento; onCerrar: () => void }) {
    const bajoCruce = r.total_antes > r.stock_minimo && r.total_despues <= r.stock_minimo;
    const agotado = r.total_despues <= 0;
    return (
        <ModalSoloX onCerrar={onCerrar} titulo="Movimiento registrado">
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    <Badge tono={TONO[r.tipo]}>{TEXTO[r.tipo]}</Badge>
                    <span style={{ fontWeight: 700, fontSize: 15 }}>{r.nombre}</span>
                    <span style={{ color: 'var(--ink-3)', fontSize: 13 }}>{r.sku}</span>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10 }}>
                    {[
                        { label: 'Cantidad', valor: r.cantidad, color: 'var(--ink)' },
                        { label: 'Stock anterior', valor: r.stock_anterior, color: 'var(--ink-2)' },
                        { label: 'Stock resultante', valor: r.stock_resultante, color: r.stock_resultante <= r.stock_minimo ? 'var(--danger)' : 'var(--ok)' },
                    ].map(({ label, valor, color }) => (
                        <div key={label} className="chip">
                            <strong style={{ color }}>{valor}</strong>
                            {label}
                        </div>
                    ))}
                </div>

                {agotado && <Callout tono="danger">Este producto quedó sin stock. Se enviará un aviso por correo.</Callout>}
                {!agotado && bajoCruce && <Callout tono="warn">El stock cruzó el mínimo ({r.stock_minimo} u.). Se enviará un aviso por correo.</Callout>}
                {!agotado && !bajoCruce && r.stock_resultante <= r.stock_minimo && (
                    <Callout tono="warn">El stock sigue por debajo del mínimo ({r.stock_minimo} u.).</Callout>
                )}

                <div className="form__actions">
                    <Button variante="primario" onClick={onCerrar}>Aceptar</Button>
                </div>
            </div>
        </ModalSoloX>
    );
}
