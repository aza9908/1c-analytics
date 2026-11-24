'use client';

import * as React from 'react';
import { fmtFull, fmtCompact, fmtRelative } from '@/lib/time';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Database,
  RefreshCw,
  ChevronDown,
  ChevronRight,
  Clock,
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface EtlEntity {
  entity: string;
  label: string;
  schedule: string;
  lastRunAt: string | null;
  lastRunStatus: string | null;
  watermark: string | null;
  rowsAdded: number;
  rowsUpdated: number;
  minutesSince: number | null;
  health: 'OK' | 'STALE' | 'FAILED';
}

interface Run {
  startedAt: string | null;
  finishedAt: string | null;
  status: string;
  rowsFetched: number;
  rowsInserted: number;
  rowsUpdated: number;
  pagesFetched: number;
  durationMs: number;
  error: string | null;
}

interface Status {
  overall: 'ok' | 'stale' | 'failed';
  lastDataAt: string | null;
  entities: EtlEntity[];
  recentRuns: Record<string, Run[]>;
}

const REFRESH_MS = 30 * 1000;

export default function DataPage() {
  const [status, setStatus] = React.useState<Status | null>(null);
  const [expanded, setExpanded] = React.useState<string | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const load = React.useCallback(() => {
    setRefreshing(true);
    fetch('/api/etl-status')
      .then((r) => r.json())
      .then((d) => {
        if (d && d.overall) setStatus(d);
      })
      .finally(() => setRefreshing(false));
  }, []);

  React.useEffect(() => {
    load();
    const id = setInterval(load, REFRESH_MS);
    return () => clearInterval(id);
  }, [load]);

  if (!status) {
    return <div className="text-muted-foreground">Запрашиваем статус ETL…</div>;
  }

  const okCount = status.entities.filter((e) => e.health === 'OK').length;
  const staleCount = status.entities.filter((e) => e.health === 'STALE').length;
  const failedCount = status.entities.filter((e) => e.health === 'FAILED').length;

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Данные · ETL</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Cron-loader'ы по 1C OData. Аналог Airflow DAG-ов. Время — Asia/Almaty (UTC+5).
          </p>
        </div>
        <button
          onClick={load}
          className="inline-flex h-8 items-center gap-1.5 rounded-md border bg-card px-2.5 text-xs hover:bg-accent transition-colors"
        >
          <RefreshCw className={cn('size-3.5', refreshing && 'animate-spin')} />
          Обновить
        </button>
      </div>

      {/* Сводка */}
      <div className="grid grid-cols-3 lg:grid-cols-3 xl:grid-cols-3 gap-3">
        <SummaryCard
          icon={<CheckCircle2 className="size-4" />}
          label="OK"
          value={okCount}
          tint="emerald"
        />
        <SummaryCard
          icon={<AlertTriangle className="size-4" />}
          label="Просрочены"
          value={staleCount}
          tint="amber"
        />
        <SummaryCard
          icon={<XCircle className="size-4" />}
          label="С ошибкой"
          value={failedCount}
          tint="red"
        />
      </div>

      {/* DAGs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Loader-ы (DAGs)</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground text-xs w-[2%]"></th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground text-xs">DAG</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground text-xs">Расписание</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground text-xs">Статус</th>
                  <th className="px-4 py-2 text-left font-medium text-muted-foreground text-xs">Последний прогон</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs">Строк</th>
                  <th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs">Watermark</th>
                </tr>
              </thead>
              <tbody>
                {status.entities.map((e) => {
                  const isExpanded = expanded === e.entity;
                  const runs = status.recentRuns[e.entity] || [];
                  return (
                    <React.Fragment key={e.entity}>
                      <tr
                        className="border-b last:border-b-0 hover:bg-black/[0.03] dark:hover:bg-white/[0.04] cursor-pointer"
                        onClick={() => setExpanded(isExpanded ? null : e.entity)}
                      >
                        <td className="px-4 py-3 text-muted-foreground/50">
                          {isExpanded ? (
                            <ChevronDown className="size-3.5" />
                          ) : (
                            <ChevronRight className="size-3.5" />
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Database className="size-3.5 text-muted-foreground" />
                            <div>
                              <div className="font-medium text-xs">{e.label}</div>
                              <div className="text-[10px] text-muted-foreground font-mono">{e.entity}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground tabular-nums">{e.schedule}</td>
                        <td className="px-4 py-3">
                          <HealthBadge health={e.health} />
                        </td>
                        <td className="px-4 py-3 text-xs">
                          {e.lastRunAt ? (
                            <div className="flex flex-col">
                              <span className="tabular-nums">{fmtFull(e.lastRunAt)}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {fmtRelative(e.lastRunAt)}
                              </span>
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-right tabular-nums text-xs">
                          {e.rowsAdded.toLocaleString('ru-RU')}
                        </td>
                        <td className="px-4 py-3 text-right text-[11px] text-muted-foreground tabular-nums">
                          {e.watermark ? fmtCompact(e.watermark) : '—'}
                        </td>
                      </tr>

                      {isExpanded && (
                        <tr className="border-b last:border-b-0 bg-muted/30">
                          <td colSpan={7} className="px-4 py-3">
                            <div className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider mb-2">
                              Последние прогоны
                            </div>
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="border-b border-border/50">
                                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground">Старт</th>
                                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground">Статус</th>
                                  <th className="px-2 py-1.5 text-right text-[10px] font-medium text-muted-foreground">Длительность</th>
                                  <th className="px-2 py-1.5 text-right text-[10px] font-medium text-muted-foreground">Получено</th>
                                  <th className="px-2 py-1.5 text-right text-[10px] font-medium text-muted-foreground">Вставлено</th>
                                  <th className="px-2 py-1.5 text-right text-[10px] font-medium text-muted-foreground">Страниц</th>
                                  <th className="px-2 py-1.5 text-left text-[10px] font-medium text-muted-foreground">Ошибка</th>
                                </tr>
                              </thead>
                              <tbody>
                                {runs.length === 0 ? (
                                  <tr>
                                    <td colSpan={7} className="px-2 py-2 text-center text-muted-foreground">
                                      нет прогонов
                                    </td>
                                  </tr>
                                ) : (
                                  runs.map((r, i) => (
                                    <tr key={i} className="border-b border-border/20 last:border-b-0">
                                      <td className="px-2 py-1.5 tabular-nums">
                                        {fmtCompact(r.startedAt)}
                                      </td>
                                      <td className="px-2 py-1.5">
                                        <RunStatusPill status={r.status} />
                                      </td>
                                      <td className="px-2 py-1.5 text-right tabular-nums">
                                        {r.durationMs > 0 ? `${(r.durationMs / 1000).toFixed(1)}с` : '—'}
                                      </td>
                                      <td className="px-2 py-1.5 text-right tabular-nums">
                                        {r.rowsFetched.toLocaleString('ru-RU')}
                                      </td>
                                      <td className="px-2 py-1.5 text-right tabular-nums">
                                        {r.rowsInserted.toLocaleString('ru-RU')}
                                      </td>
                                      <td className="px-2 py-1.5 text-right tabular-nums text-muted-foreground">
                                        {r.pagesFetched}
                                      </td>
                                      <td className="px-2 py-1.5 text-red-500 text-[10px]">
                                        {r.error ? r.error.slice(0, 80) : ''}
                                      </td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2">
            <Clock className="size-3.5 text-muted-foreground" /> Как это работает
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            Cron вызывает <code className="font-mono text-[11px] bg-muted px-1 rounded">scripts/run_loader.sh &lt;entity&gt;</code>.
            Loader тянет 1C OData (httpx + tenacity), пишет в <code className="font-mono text-[11px] bg-muted px-1 rounded">raw.*</code>,
            проектирует в <code className="font-mono text-[11px] bg-muted px-1 rounded">mart.*</code>,
            обновляет <code className="font-mono text-[11px] bg-muted px-1 rounded">etl.sync_state</code> и пишет лог-запись
            в <code className="font-mono text-[11px] bg-muted px-1 rounded">etl.sync_runs</code>.
          </p>
          <p>
            После <code>receipts</code> и <code>cost_balance</code> автоматически рефрешатся materialized views
            (<code>mart.sales_*_by_*</code>) с пересчитанной маржой.
          </p>
          <p>
            Health-статус: <span className="text-emerald-500">OK</span> — последний прогон в пределах SLA,
            <span className="text-amber-500"> STALE</span> — пропущен слот (≥90 мин для hourly или ≥26 ч для daily),
            <span className="text-red-500"> FAILED</span> — последний прогон упал с ошибкой.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

function SummaryCard({
  icon, label, value, tint,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tint: 'emerald' | 'amber' | 'red';
}) {
  const tintCls = {
    emerald: 'text-emerald-600 dark:text-emerald-400',
    amber: 'text-amber-600 dark:text-amber-400',
    red: 'text-red-600 dark:text-red-400',
  }[tint];
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">
            {label}
          </span>
          <span className={tintCls}>{icon}</span>
        </div>
        <span className={cn('text-2xl font-semibold tabular-nums', tintCls)}>{value}</span>
      </CardContent>
    </Card>
  );
}

function HealthBadge({ health }: { health: 'OK' | 'STALE' | 'FAILED' }) {
  const cfg = {
    OK: { tint: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400', label: 'OK' },
    STALE: { tint: 'border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400', label: 'Просрочен' },
    FAILED: { tint: 'border-red-500/30 bg-red-500/10 text-red-600 dark:text-red-400', label: 'Ошибка' },
  }[health];
  return (
    <span className={cn('inline-flex h-5 items-center rounded-md border px-2 text-[10px] font-medium', cfg.tint)}>
      {cfg.label}
    </span>
  );
}

function RunStatusPill({ status }: { status: string }) {
  const isSuccess = status === 'success';
  const isFailed = status === 'failed';
  const isRunning = status === 'running';
  return (
    <span
      className={cn(
        'inline-flex h-4 items-center rounded px-1.5 text-[9.5px] font-medium',
        isSuccess && 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
        isFailed && 'bg-red-500/10 text-red-600 dark:text-red-400',
        isRunning && 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
        !isSuccess && !isFailed && !isRunning && 'bg-muted text-muted-foreground'
      )}
    >
      {isSuccess ? 'success' : isFailed ? 'failed' : status}
    </span>
  );
}
