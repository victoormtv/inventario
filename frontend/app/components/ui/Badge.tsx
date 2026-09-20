import { ReactNode } from 'react';

type Tono = 'warn' | 'danger' | 'ok' | 'neutral' | 'brand';

export default function Badge({ tono = 'neutral', children }: { tono?: Tono; children: ReactNode }) {
    return <span className={`badge badge--${tono}`}>{children}</span>;
}