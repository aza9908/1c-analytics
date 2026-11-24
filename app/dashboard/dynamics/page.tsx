'use client';

import { useMemo } from 'react';
import { useData } from '@/lib/data-context';
import type { FebReportData, StoreReport } from '@/lib/parse-february';
import { formatCurrency, formatCurrencyParts, formatNumber, formatPercent } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DeltaBadge } from '@/components/delta-badge';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip,
  CartesianGrid, Legend, ReferenceLine,
} from 'recharts';
import { TrendingUp, TrendingDown, AlertTriangle, ArrowRight } from 'lucide-react';

const STORE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#f43f5e'];

export default function DynamicsPage() {
  const { data, compareData, loading } = useData();

  if (!data) return <div className="flex items-center justify-center h-64 text-muted-foreground">Нет данных</div>;
  if (!compareData) return (
    <div className="flex items-center justify-center h-64 text-muted-foreground">
      Сравнения нет — выберите период так, чтобы перед ним были данные
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Динамика</h1>
        <p className="text-sm text-muted-foreground">{compareData.period} → {data.period}</p>
      </div>

      {/* Overall KPI comparison */}
      <OverallComparison data={data} prev={compareData} />

      {/* Revenue & Profit by store */}
      <StoreGrowthChart data={data} prev={compareData} />

      {/* Store comparison table */}
      <StoreComparisonTable data={data} prev={compareData} />

      {/* Key insights */}
      <Insights data={data} prev={compareData} />
    </div>
  );
}

/* ============================================================
   OVERALL KPI CARDS — side by side
   ============================================================ */
function OverallComparison({ data, prev }: { data: FebReportData; prev: FebReportData }) {
  const metrics = [
    { label: 'Выручка', curr: data.totalRevenue, prev: prev.totalRevenue, type: 'currency' as const },
    { label: 'Прибыль', curr: data.totalProfit, prev: prev.totalProfit, type: 'currency' as const },
    { label: 'Рентабельность', curr: data.avgRentability, prev: prev.avgRentability, type: 'percent' as const, abs: true },
    { label: 'Наценка', curr: data.avgMarkup, prev: prev.avgMarkup, type: 'percent' as const, abs: true },
    { label: 'SKU продано', curr: data.totalSoldSku, prev: prev.totalSoldSku, type: 'number' as const },
    { label: 'Излишки', curr: data.totalSurplus, prev: prev.totalSurplus, type: 'currency' as const, invert: true },
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
      {metrics.map(m => {
        const fmt = (v: number) =>
          m.type === 'currency' ? formatCurrency(v)
          : m.type === 'percent' ? formatPercent(v)
          : formatNumber(v);
        const prevParts = m.type === 'currency' ? formatCurrencyParts(m.prev) : null;
        const currParts = m.type === 'currency' ? formatCurrencyParts(m.curr) : null;

        return (
          <Card key={m.label}>
            <CardContent className="p-4">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{m.label}</span>
              <div className="flex items-center gap-1.5 mt-2 mb-1">
                <span className="text-xs text-muted-foreground tabular-nums">{fmt(m.prev)}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground/50 shrink-0" />
                {currParts ? (
                  <span className="text-base font-semibold tabular-nums">{currParts.value} <span className="text-xs text-muted-foreground font-normal">{currParts.unit}</span></span>
                ) : (
                  <span className="text-base font-semibold tabular-nums">{fmt(m.curr)}</span>
                )}
              </div>
              <DeltaBadge value={m.curr} prev={m.prev} abs={m.abs} invert={m.invert} />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

/* ============================================================
   STORE GROWTH BAR CHART — grouped bars Feb vs March
   ============================================================ */
function StoreGrowthChart({ data, prev }: { data: FebReportData; prev: FebReportData }) {
  const chartData = data.stores.map(s => {
    const ps = prev.stores.find(ps => ps.store === s.store);
    return {
      name: s.store,
      prevRevenue: ps?.totalRevenue ?? 0,
      currRevenue: s.totalRevenue,
      prevProfit: ps?.totalProfit ?? 0,
      currProfit: s.totalProfit,
    };
  });

  return (
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Выручка по магазинам</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 15, left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis fontSize={11} tickFormatter={(v) => formatCurrency(v)} stroke="var(--color-muted-foreground)" width={80} />
                <RTooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  const growth = d.prevRevenue > 0 ? ((d.currRevenue - d.prevRevenue) / d.prevRevenue * 100).toFixed(0) : '—';
                  const rentCurr = d.currRevenue > 0 ? (d.currProfit / d.currRevenue) * 100 : 0;
                  const rentPrev = d.prevRevenue > 0 ? (d.prevProfit / d.prevRevenue) * 100 : 0;
                  return (
                    <div className="bg-popover border rounded-lg px-3 py-2 text-xs shadow-lg space-y-0.5">
                      <p className="font-medium pb-0.5 border-b mb-1">{d.name}</p>
                      <p className="text-muted-foreground">{prev.period}: <span className="tabular-nums">{formatCurrency(d.prevRevenue)}</span> · рент. <span className="tabular-nums">{formatPercent(rentPrev)}</span></p>
                      <p>{data.period}: <span className="tabular-nums font-medium">{formatCurrency(d.currRevenue)}</span> · рент. <span className="tabular-nums font-medium">{formatPercent(rentCurr)}</span></p>
                      <p className="font-medium mt-1">Рост: {growth}%</p>
                    </div>
                  );
                }} />
                <Bar dataKey="prevRevenue" name={prev.period} fill="#94a3b8" fillOpacity={0.4} radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="currRevenue" name={data.period} fill="#3b82f6" fillOpacity={0.8} radius={[4, 4, 0, 0]} barSize={20} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Прибыль по магазинам</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={chartData} margin={{ top: 15, left: 0, right: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                <XAxis dataKey="name" fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis fontSize={11} tickFormatter={(v) => formatCurrency(v)} stroke="var(--color-muted-foreground)" width={80} />
                <RTooltip content={({ active, payload }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  const growth = d.prevProfit > 0 ? ((d.currProfit - d.prevProfit) / d.prevProfit * 100).toFixed(0) : '—';
                  const rentCurr = d.currRevenue > 0 ? (d.currProfit / d.currRevenue) * 100 : 0;
                  const rentPrev = d.prevRevenue > 0 ? (d.prevProfit / d.prevRevenue) * 100 : 0;
                  return (
                    <div className="bg-popover border rounded-lg px-3 py-2 text-xs shadow-lg space-y-0.5">
                      <p className="font-medium pb-0.5 border-b mb-1">{d.name}</p>
                      <p className="text-muted-foreground">{prev.period}: <span className="tabular-nums">{formatCurrency(d.prevProfit)}</span> · рент. <span className="tabular-nums">{formatPercent(rentPrev)}</span></p>
                      <p>{data.period}: <span className="tabular-nums font-medium">{formatCurrency(d.currProfit)}</span> · рент. <span className="tabular-nums font-medium">{formatPercent(rentCurr)}</span></p>
                      <p className="font-medium mt-1">Рост: {growth}%</p>
                    </div>
                  );
                }} />
                <Bar dataKey="prevProfit" name={prev.period} fill="#94a3b8" fillOpacity={0.4} radius={[4, 4, 0, 0]} barSize={20} />
                <Bar dataKey="currProfit" name={data.period} fill="#10b981" fillOpacity={0.8} radius={[4, 4, 0, 0]} barSize={20} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ============================================================
   STORE COMPARISON TABLE — all metrics side by side
   ============================================================ */
function StoreComparisonTable({ data, prev }: { data: FebReportData; prev: FebReportData }) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Сравнение магазинов: {prev.period} → {data.period}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Магазин</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs" colSpan={2}>Выручка</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs" colSpan={2}>Прибыль</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs" colSpan={2}>Рент.</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs" colSpan={2}>Наценка</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs">Убыт.</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs">Излишки</th>
              </tr>
              <tr className="border-b bg-muted/30">
                <th className="px-4 py-1.5 text-left text-[10px] text-muted-foreground"></th>
                <th className="px-4 py-1.5 text-right text-[10px] text-muted-foreground">Фев</th>
                <th className="px-4 py-1.5 text-right text-[10px] text-muted-foreground">Мар</th>
                <th className="px-4 py-1.5 text-right text-[10px] text-muted-foreground">Фев</th>
                <th className="px-4 py-1.5 text-right text-[10px] text-muted-foreground">Мар</th>
                <th className="px-4 py-1.5 text-right text-[10px] text-muted-foreground">Фев</th>
                <th className="px-4 py-1.5 text-right text-[10px] text-muted-foreground">Мар</th>
                <th className="px-4 py-1.5 text-right text-[10px] text-muted-foreground">Фев</th>
                <th className="px-4 py-1.5 text-right text-[10px] text-muted-foreground">Мар</th>
                <th className="px-4 py-1.5 text-right text-[10px] text-muted-foreground">Δ</th>
                <th className="px-4 py-1.5 text-right text-[10px] text-muted-foreground">Δ</th>
              </tr>
            </thead>
            <tbody>
              {data.stores.map((s, i) => {
                const ps = prev.stores.find(ps => ps.store === s.store);
                return (
                  <tr key={s.store} className="border-b last:border-b-0 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: STORE_COLORS[i] }} />
                        <span className="font-medium">{s.store}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">{formatCurrency(ps?.totalRevenue ?? 0)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="tabular-nums text-xs">{formatCurrency(s.totalRevenue)}</div>
                      <DeltaBadge value={s.totalRevenue} prev={ps?.totalRevenue} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">{formatCurrency(ps?.totalProfit ?? 0)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="tabular-nums text-xs">{formatCurrency(s.totalProfit)}</div>
                      <DeltaBadge value={s.totalProfit} prev={ps?.totalProfit} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">{formatPercent(ps?.avgRentability ?? 0)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="tabular-nums text-xs">{formatPercent(s.avgRentability)}</div>
                      <DeltaBadge value={s.avgRentability} prev={ps?.avgRentability} abs />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">{formatPercent(ps?.avgMarkup ?? 0)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="tabular-nums text-xs">{formatPercent(s.avgMarkup)}</div>
                      <DeltaBadge value={s.avgMarkup} prev={ps?.avgMarkup} abs />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="tabular-nums text-xs">{s.lossProducts.length}</div>
                      <DeltaBadge value={s.lossProducts.length} prev={ps?.lossProducts.length} invert />
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="tabular-nums text-xs">{formatCurrency(s.surplusTotal)}</div>
                      <DeltaBadge value={s.surplusTotal} prev={ps?.surplusTotal} invert />
                    </td>
                  </tr>
                );
              })}
              {/* Totals row */}
              <tr className="border-t-2 font-medium bg-muted/30">
                <td className="px-4 py-3">Итого</td>
                <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">{formatCurrency(prev.totalRevenue)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="tabular-nums text-xs">{formatCurrency(data.totalRevenue)}</div>
                  <DeltaBadge value={data.totalRevenue} prev={prev.totalRevenue} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">{formatCurrency(prev.totalProfit)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="tabular-nums text-xs">{formatCurrency(data.totalProfit)}</div>
                  <DeltaBadge value={data.totalProfit} prev={prev.totalProfit} />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">{formatPercent(prev.avgRentability)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="tabular-nums text-xs">{formatPercent(data.avgRentability)}</div>
                  <DeltaBadge value={data.avgRentability} prev={prev.avgRentability} abs />
                </td>
                <td className="px-4 py-3 text-right tabular-nums text-xs text-muted-foreground">{formatPercent(prev.avgMarkup)}</td>
                <td className="px-4 py-3 text-right">
                  <div className="tabular-nums text-xs">{formatPercent(data.avgMarkup)}</div>
                  <DeltaBadge value={data.avgMarkup} prev={prev.avgMarkup} abs />
                </td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right">
                  <div className="tabular-nums text-xs">{formatCurrency(data.totalSurplus)}</div>
                  <DeltaBadge value={data.totalSurplus} prev={prev.totalSurplus} invert />
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================================================
   INSIGHTS — automated observations
   ============================================================ */
function Insights({ data, prev }: { data: FebReportData; prev: FebReportData }) {
  const insights: { type: 'positive' | 'negative' | 'neutral'; text: string }[] = [];

  // Revenue growth
  const revGrowth = ((data.totalRevenue - prev.totalRevenue) / prev.totalRevenue) * 100;
  insights.push({
    type: revGrowth > 0 ? 'positive' : 'negative',
    text: `Выручка сети ${revGrowth > 0 ? 'выросла' : 'упала'} на ${Math.abs(revGrowth).toFixed(0)}% (${formatCurrency(prev.totalRevenue)} → ${formatCurrency(data.totalRevenue)})`,
  });

  // Profit growth
  const profitGrowth = ((data.totalProfit - prev.totalProfit) / prev.totalProfit) * 100;
  insights.push({
    type: profitGrowth > 0 ? 'positive' : 'negative',
    text: `Прибыль ${profitGrowth > 0 ? 'выросла' : 'упала'} на ${Math.abs(profitGrowth).toFixed(0)}% (${formatCurrency(prev.totalProfit)} → ${formatCurrency(data.totalProfit)})`,
  });

  // Rentability change
  const rentDiff = data.avgRentability - prev.avgRentability;
  if (Math.abs(rentDiff) >= 0.5) {
    insights.push({
      type: rentDiff > 0 ? 'positive' : 'negative',
      text: `Рентабельность ${rentDiff > 0 ? 'выросла' : 'снизилась'} на ${Math.abs(rentDiff).toFixed(1)} п.п. (${formatPercent(prev.avgRentability)} → ${formatPercent(data.avgRentability)})`,
    });
  }

  // Best/worst store growth
  const storeGrowths = data.stores.map(s => {
    const ps = prev.stores.find(ps => ps.store === s.store);
    const growth = ps && ps.totalRevenue > 0 ? ((s.totalRevenue - ps.totalRevenue) / ps.totalRevenue) * 100 : 0;
    return { store: s.store, growth, currRev: s.totalRevenue, prevRev: ps?.totalRevenue ?? 0 };
  }).sort((a, b) => b.growth - a.growth);

  if (storeGrowths.length > 0) {
    const best = storeGrowths[0];
    const worst = storeGrowths[storeGrowths.length - 1];
    insights.push({
      type: 'positive',
      text: `Лидер роста — ${best.store} (+${best.growth.toFixed(0)}% выручки)`,
    });
    if (worst.growth < best.growth) {
      insights.push({
        type: worst.growth < 0 ? 'negative' : 'neutral',
        text: `Минимальный рост — ${worst.store} (${worst.growth > 0 ? '+' : ''}${worst.growth.toFixed(0)}% выручки)`,
      });
    }
  }

  // Surplus change
  const surplusDiff = data.totalSurplus - prev.totalSurplus;
  if (Math.abs(surplusDiff) > 1_000_000) {
    insights.push({
      type: surplusDiff > 0 ? 'negative' : 'positive',
      text: `Излишки ${surplusDiff > 0 ? 'выросли' : 'снизились'} на ${formatCurrency(Math.abs(surplusDiff))} (${formatCurrency(prev.totalSurplus)} → ${formatCurrency(data.totalSurplus)})`,
    });
  }

  // Rentability outliers per store
  for (const s of data.stores) {
    const ps = prev.stores.find(ps => ps.store === s.store);
    if (!ps) continue;
    const rd = s.avgRentability - ps.avgRentability;
    if (rd < -3) {
      insights.push({
        type: 'negative',
        text: `${s.store}: рентабельность упала на ${Math.abs(rd).toFixed(1)} п.п. (${formatPercent(ps.avgRentability)} → ${formatPercent(s.avgRentability)})`,
      });
    }
  }

  const icons = {
    positive: <TrendingUp className="h-4 w-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />,
    negative: <TrendingDown className="h-4 w-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />,
    neutral: <AlertTriangle className="h-4 w-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />,
  };
  const bgColors = {
    positive: 'border-emerald-500/20 bg-emerald-500/5',
    negative: 'border-red-500/20 bg-red-500/5',
    neutral: 'border-amber-500/20 bg-amber-500/5',
  };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Ключевые наблюдения</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {insights.map((ins, i) => (
            <div key={i} className={`flex items-start gap-2.5 rounded-xl px-4 py-3 border ${bgColors[ins.type]}`}>
              {icons[ins.type]}
              <p className="text-xs leading-relaxed">{ins.text}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
