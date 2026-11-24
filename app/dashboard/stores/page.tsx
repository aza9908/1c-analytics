'use client';

import { useData } from '@/lib/data-context';
import { abcBadgeClass } from '@/lib/abc-colors';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricInfo } from '@/components/dashboard/metric-info';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, Cell, LabelList, Legend,
} from 'recharts';

const STORE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#f43f5e'];

import { DeltaBadge } from '@/components/delta-badge';

export default function StoresPage() {
  const { data, compareData, loading } = useData();

  if (!data) return <div className="flex items-center justify-center h-64 text-muted-foreground">Нет данных</div>;

  const revenueVsProfit = data.stores.map((s, i) => ({
    name: s.store,
    revenue: s.totalRevenue,
    profit: s.totalProfit,
    cost: s.totalCost,
    color: STORE_COLORS[i],
  }));

  const deviationData = data.stores.map((s, i) => ({
    name: s.store,
    deviation: +(s.avgRentability - data.avgRentability).toFixed(1),
    rentability: s.avgRentability,
    color: STORE_COLORS[i],
  }));

  // Efficiency: revenue per SKU
  const efficiencyData = data.stores.map((s, i) => ({
    name: s.store,
    revenuePerSku: Math.round(s.totalRevenue / s.soldSkuCount),
    profitPerSku: Math.round(s.totalProfit / s.soldSkuCount),
    color: STORE_COLORS[i],
  })).sort((a, b) => b.revenuePerSku - a.revenuePerSku);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Сравнение магазинов</h1>
        <p className="text-sm text-muted-foreground">{data.period} · {data.stores.length} магазинов</p>
      </div>

      {/* Top row: Revenue vs Profit + Rentability deviation */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Revenue & Profit comparison */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Выручка и прибыль</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueVsProfit} margin={{ top: 15, left: 0, right: 10, bottom: 5 }}>
                  <XAxis dataKey="name" fontSize={11} stroke="var(--color-muted-foreground)" />
                  <YAxis fontSize={11} tickFormatter={(v) => formatCurrency(v)} stroke="var(--color-muted-foreground)" width={80} />
                  <RTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.length) return null;
                      const d = payload[0].payload;
                      const rent = d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0;
                      const markup = d.cost > 0 ? (d.profit / d.cost) * 100 : 0;
                      return (
                        <div className="bg-popover border rounded-lg px-3 py-2 text-xs shadow-lg space-y-0.5">
                          <p className="font-medium pb-0.5 border-b mb-1">{d.name}</p>
                          <p>Выручка: <span className="tabular-nums font-medium">{formatCurrency(d.revenue)}</span></p>
                          <p>Себестоимость: <span className="tabular-nums">{formatCurrency(d.cost)}</span></p>
                          <p>Прибыль: <span className="tabular-nums font-medium">{formatCurrency(d.profit)}</span></p>
                          <p>Рентабельность: <span className="tabular-nums font-medium">{formatPercent(rent)}</span></p>
                          <p className="text-muted-foreground">Наценка: <span className="tabular-nums">{formatPercent(markup)}</span></p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="revenue" name="Выручка" fill="#3b82f6" fillOpacity={0.7} radius={[4, 4, 0, 0]} barSize={28} />
                  <Bar dataKey="profit" name="Прибыль" fill="#10b981" fillOpacity={0.8} radius={[4, 4, 0, 0]} barSize={28} />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Rentability deviation */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Рентабельность vs среднее по сети ({formatPercent(data.avgRentability)})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[280px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={deviationData} layout="vertical" margin={{ left: 0, right: 50 }}>
                  <XAxis type="number" fontSize={11} stroke="var(--color-muted-foreground)" tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}%`} />
                  <YAxis type="category" dataKey="name" fontSize={12} width={80} stroke="var(--color-muted-foreground)" />
                  <RTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-popover border rounded-lg px-3 py-2 text-xs shadow-lg">
                          <p className="font-medium">{d.name}</p>
                          <p>Рентабельность: {formatPercent(d.rentability)}</p>
                          <p>Отклонение: {d.deviation > 0 ? '+' : ''}{d.deviation}%</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="deviation" radius={[0, 4, 4, 0]} barSize={22}>
                    {deviationData.map((entry, i) => (
                      <Cell key={i} fill={entry.deviation >= 0 ? '#10b981' : '#ef4444'} fillOpacity={0.8} />
                    ))}
                    <LabelList dataKey="deviation" position="right" fontSize={11} formatter={(v: unknown) => { const n = Number(v); return `${n > 0 ? '+' : ''}${n}%`; }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Efficiency: Revenue per SKU */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Эффективность ассортимента (выручка и прибыль на 1 SKU)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={efficiencyData} margin={{ top: 15, left: 0, right: 10, bottom: 5 }}>
                <XAxis dataKey="name" fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis fontSize={11} tickFormatter={(v) => formatCurrency(v)} stroke="var(--color-muted-foreground)" width={80} />
                <RTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.length) return null;
                    const d = payload[0].payload;
                    const rent = d.revenuePerSku > 0 ? (d.profitPerSku / d.revenuePerSku) * 100 : 0;
                    return (
                      <div className="bg-popover border rounded-lg px-3 py-2 text-xs shadow-lg space-y-0.5">
                        <p className="font-medium pb-0.5 border-b mb-1">{d.name}</p>
                        <p>Выручка / SKU: <span className="tabular-nums font-medium">{formatCurrency(d.revenuePerSku)}</span></p>
                        <p>Прибыль / SKU: <span className="tabular-nums font-medium">{formatCurrency(d.profitPerSku)}</span></p>
                        <p>Рентабельность: <span className="tabular-nums font-medium">{formatPercent(rent)}</span></p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="revenuePerSku" name="Выручка / SKU" fill="#6366f1" fillOpacity={0.7} radius={[4, 4, 0, 0]} barSize={28} />
                <Bar dataKey="profitPerSku" name="Прибыль / SKU" fill="#10b981" fillOpacity={0.8} radius={[4, 4, 0, 0]} barSize={28} />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Store Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {data.stores.map((store, si) => {
          const prev = compareData?.stores.find(ps => ps.store === store.store);
          return (
          <Card key={store.store}>
            <CardHeader className="pb-2">
              <div className="flex items-center gap-2">
                <div className="w-2.5 h-2.5 rounded-full" style={{ background: STORE_COLORS[si] }} />
                <CardTitle className="text-sm">{store.store}</CardTitle>
                <span className="text-[10px] text-muted-foreground">{store.city}</span>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-x-6 gap-y-3">
                <MetricRow label="Выручка" value={formatCurrency(store.totalRevenue)} delta={<DeltaBadge value={store.totalRevenue} prev={prev?.totalRevenue} />} />
                <MetricRow label="Прибыль" value={formatCurrency(store.totalProfit)} delta={<DeltaBadge value={store.totalProfit} prev={prev?.totalProfit} />} />
                <MetricRow label="Себестоимость" value={formatCurrency(store.totalCost)} />
                <MetricRow label="Продано шт" value={formatNumber(store.totalQty)} delta={<DeltaBadge value={store.totalQty} prev={prev?.totalQty} />} />
                <MetricRow label="Рентабельность" value={formatPercent(store.avgRentability)} highlight={store.avgRentability >= data.avgRentability ? 'green' : 'red'} delta={<DeltaBadge value={store.avgRentability} prev={prev?.avgRentability} abs />} />
                <MetricRow label="Наценка" value={formatPercent(store.avgMarkup)} highlight={store.avgMarkup >= data.avgMarkup ? 'green' : 'red'} delta={<DeltaBadge value={store.avgMarkup} prev={prev?.avgMarkup} abs />} />
                <MetricRow label="SKU с продажами" value={formatNumber(store.soldSkuCount)} />
                <MetricRow label="Без продаж (D)" value={formatNumber(store.deadSkuCount)} highlight="amber" />
                <MetricRow label="Убыточных" value={String(store.lossProducts.length)} highlight={store.lossProducts.length > 0 ? 'red' : undefined} delta={<DeltaBadge value={store.lossProducts.length} prev={prev?.lossProducts.length} invert />} />
                <MetricRow label="Излишки" value={formatCurrency(store.surplusTotal)} delta={<DeltaBadge value={store.surplusTotal} prev={prev?.surplusTotal} invert />} />
              </div>

              <div className="mt-4 pt-3 border-t">
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-2">ABC-структура</p>
                <div className="flex gap-2">
                  {(['A', 'B', 'C'] as const).map(cls => (
                    <Tooltip key={cls}>
                      <TooltipTrigger className="flex-1 text-center cursor-default">
                        <Badge className={`text-[10px] mb-1 ${abcBadgeClass(cls)}`}>{cls}</Badge>
                        <p className="text-xs tabular-nums font-medium">{store.abc[cls].count}</p>
                        <p className="text-[10px] text-muted-foreground tabular-nums">{formatPercent(store.abc[cls].pctRevenue, 0)} выр.</p>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="text-xs">
                        <p>Класс {cls}: {store.abc[cls].count} SKU</p>
                        <p>Выручка: {formatCurrency(store.abc[cls].revenue)}</p>
                        <p>Прибыль: {formatCurrency(store.abc[cls].profit)}</p>
                      </TooltipContent>
                    </Tooltip>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
          );
        })}
      </div>

      {/* Full comparison table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Сводная таблица</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Магазин</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="revenue">Выручка</MetricInfo></th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="cost">Себест.</MetricInfo></th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="profit">Прибыль</MetricInfo></th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="rentability">Рент.</MetricInfo></th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="markup">Наценка</MetricInfo></th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="qty">Шт</MetricInfo></th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="soldSkuCount">SKU</MetricInfo></th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="deadSkuCount">Dead</MetricInfo></th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs">Убыточных</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="surplus">Излишки</MetricInfo></th>
                </tr>
              </thead>
              <tbody>
                {data.stores.map((s, i) => {
                  const prev = compareData?.stores.find(ps => ps.store === s.store);
                  return (
                  <tr key={s.store} className="border-b last:border-b-0 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ background: STORE_COLORS[i] }} />
                        <span className="font-medium">{s.store}</span>
                        <span className="text-[10px] text-muted-foreground">{s.city}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="tabular-nums">{formatCurrency(s.totalRevenue)}</div>
                      <DeltaBadge value={s.totalRevenue} prev={prev?.totalRevenue} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatCurrency(s.totalCost)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="tabular-nums font-medium">{formatCurrency(s.totalProfit)}</div>
                      <DeltaBadge value={s.totalProfit} prev={prev?.totalProfit} />
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={s.avgRentability >= data.avgRentability ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                        {formatPercent(s.avgRentability)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      <span className={s.avgMarkup >= data.avgMarkup ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                        {formatPercent(s.avgMarkup)}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(s.totalQty)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{formatNumber(s.soldSkuCount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">{formatNumber(s.deadSkuCount)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-red-600 dark:text-red-400">{s.lossProducts.length}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatCurrency(s.surplusTotal)}</td>
                  </tr>
                  );
                })}
                <tr className="border-t-2 font-medium bg-muted/30">
                  <td className="px-4 py-3">Итого</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(data.totalRevenue)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatCurrency(data.totalCost)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCurrency(data.totalProfit)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPercent(data.avgRentability)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatPercent(data.avgMarkup)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(data.totalQty)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(data.totalSoldSku)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">{formatNumber(data.totalDeadSku)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-600 dark:text-red-400">{data.stores.reduce((s, st) => s + st.lossProducts.length, 0)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">{formatCurrency(data.totalSurplus)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricRow({ label, value, highlight, delta }: { label: string; value: string; highlight?: 'green' | 'red' | 'amber'; delta?: React.ReactNode }) {
  const color = highlight === 'green' ? 'text-emerald-600 dark:text-emerald-400'
    : highlight === 'red' ? 'text-red-600 dark:text-red-400'
    : highlight === 'amber' ? 'text-amber-600 dark:text-amber-400'
    : '';
  return (
    <div>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <div className="flex items-center gap-1.5">
        <span className={`text-sm font-medium tabular-nums ${color}`}>{value}</span>
        {delta}
      </div>
    </div>
  );
}
