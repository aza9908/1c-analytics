'use client';

import * as React from 'react';
import { fmtRelative, fmtTime } from '@/lib/time';
import { CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';

interface Entity {
  entity: string;
  label: string;
  health: 'OK' | 'STALE' | 'FAILED';
  lastRunAt: string | null;
  lastRunStatus: string | null;
  rowsAdded: number;
  minutesSince: number | null;
}

interface EtlStatus {
  overall: 'ok' | 'stale' | 'failed';
  lastDataAt: string | null;
  entities: Entity[];
}

const REFRESH_INTERVAL_MS = 60 * 1000; // раз в минуту

export function EtlStatusBanner() {
  const [status, setStatus] = React.useState<EtlStatus | null>(null);
  const [tick, setTick] = React.useState(0);

  const load = React.useCallback(() => {
    fetch('/api/etl-status')
      .then((r) => r.json())
      .then((d) => {
        if (d && d.overall) setStatus(d);
      })
      .catch(() => {});
  }, []);

  React.useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_INTERVAL_MS);
    const tickId = setInterval(() => setTick((t) => t + 1), 15 * 1000);
    return () => {
      clearInterval(id);
      clearInterval(tickId);
    };
  }, [load]);

  if (!status) return null;

  const okCount = status.entities.filter((e) => e.health === 'OK').length;
  const staleCount = status.entities.filter((e) => e.health === 'STALE').length;
  const failedCount = status.entities.filter((e) => e.health === 'FAILED').length;

  let icon: React.ReactNode;
  let tint: string;
  let label: string;
  if (status.overall === 'failed') {
    icon = <XCircle className="size-3.5" />;
    tint = 'text-red-600 dark:text-red-400 bg-red-500/10 border-red-500/30';
    label = `Загрузка с ошибкой · ${failedCount} из ${status.entities.length}`;
  } else if (status.overall === 'stale') {
    icon = <AlertTriangle className="size-3.5" />;
    tint = 'text-amber-600 dark:text-amber-400 bg-amber-500/10 border-amber-500/30';
    label = `Просрочены: ${staleCount} · OK: ${okCount}`;
  } else {
    icon = <CheckCircle2 className="size-3.5" />;
    tint = 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/30';
    label = `Все собралось · ${okCount} из ${status.entities.length}`;
  }

  const ago = fmtRelative(status.lastDataAt);
  const at = status.lastDataAt ? fmtTime(status.lastDataAt) : '';

  return (
    <Link
      href="/dashboard/data"
      className={cn(
        'inline-flex h-8 items-center gap-2 rounded-md border px-2.5 text-[11.5px] font-medium transition-colors hover:brightness-110',
        tint
      )}
      title="Перейти в раздел Данные"
      // Re-render trigger so `ago` updates without state churn
      data-tick={tick}
    >
      <span className="relative flex h-2 w-2 shrink-0">
        <span
          className={cn(
            'absolute inline-flex h-full w-full rounded-full opacity-75',
            status.overall === 'failed'
              ? 'animate-ping bg-red-400'
              : status.overall === 'stale'
                ? 'bg-amber-400'
                : 'bg-emerald-400'
          )}
        />
        <span
          className={cn(
            'relative inline-flex h-2 w-2 rounded-full',
            status.overall === 'failed'
              ? 'bg-red-500'
              : status.overall === 'stale'
                ? 'bg-amber-500'
                : 'bg-emerald-500'
          )}
        />
      </span>
      {icon}
      <span className="whitespace-nowrap">{label}</span>
      <span className="text-muted-foreground/80 hidden sm:inline">· обновлено {ago}{at && ` в ${at} (Алматы)`}</span>
    </Link>
  );
}
