'use client';
import Link from 'next/link';
import { FaSync } from 'react-icons/fa';
import { useApi } from './lib/useApi';
import type { KpiData, Movimiento, Paginado } from './lib/types';
import AlertasTable from './components/dashboard/AlertasTable';
import MetricsBand from './components/dashboard/MetricsBand';
import KardexTable from './components/kardex/KardexTable';
import Button from './components/ui/Button';
import { PageHeader, Panel, PanelHead } from './components/ui/Panel';
import { ErrorState, Skeleton, TablaSkeleton } from './components/ui/States';

export default function DashboardPage() {
  const kpis = useApi<KpiData>('/api/dashboard/kpis');
  const movimientos = useApi<Paginado<Movimiento>>('/api/kardex?limit=6');

  const recargar = () => {
    kpis.refetch();
    movimientos.refetch();
  };

  if (!kpis.data) {
    if (kpis.error) {
      return (
        <div className="page">
          <Panel>
            <ErrorState mensaje={kpis.error} onReintentar={recargar} />
          </Panel>
        </div>
      );
    }
    return (
      <div className="page" aria-busy="true">
        <Skeleton ancho={260} alto={34} />
        <div style={{ height: 32 }} />
        <Skeleton alto={118} radio={16} />
        <div style={{ height: 24 }} />
        <Skeleton alto={280} radio={16} />
      </div>
    );
  }

  const hora = kpis.actualizado?.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });

  return (
    <div className="page stack">
      <PageHeader
        titulo="Resumen del inventario"
        descripcion={kpis.error ? 'No se pudo actualizar. Mostrando los últimos datos.' : hora ? `Actualizado a las ${hora}` : undefined}
        acciones={
          <Button onClick={recargar} disabled={kpis.loading} icono={<FaSync className={kpis.loading ? 'spin' : undefined} style={{ fontSize: 12 }} />}>
            {kpis.loading ? 'Actualizando…' : 'Actualizar'}
          </Button>
        }
      />

      <MetricsBand kpis={kpis.data} />
      <AlertasTable alertas={kpis.data.detalle_alertas} />

      <Panel etiqueta="Últimos movimientos">
        <PanelHead
          titulo="Últimos movimientos"
          descripcion="Lo más reciente del kardex"
          accion={
            <Link href="/kardex" className="btn btn--sm">
              Ver kardex
            </Link>
          }
        />
        {movimientos.data ? <KardexTable items={movimientos.data.items} compacto /> : movimientos.error ? <ErrorState mensaje={movimientos.error} onReintentar={movimientos.refetch} /> : <TablaSkeleton filas={4} />}
      </Panel>
    </div>
  );
}