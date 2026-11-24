'use client';

import { useMemo, useState } from 'react';
import { useData, getProductsForStore } from '@/lib/data-context';
import { StoreFilterTabs } from '@/components/store-filter-tabs';
import { formatCurrency, formatCurrencyParts, formatNumber, formatPercent } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricInfo } from '@/components/dashboard/metric-info';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip,
  Cell, CartesianGrid,
} from 'recharts';
import { TrendingUp, TrendingDown, Percent, DollarSign } from 'lucide-react';
import { abcBadgeClass } from '@/lib/abc-colors';
import { DeltaBadge } from '@/components/delta-badge';

const ABC_COLORS = { A: '#10b981', B: '#f59e0b', C: '#ef4444' };

export default function ProfitabilityPage() {
  const { data, compareData, loading } = useData();
  const [selectedStore, setSelectedStore] = useState('all');

  const products = useMemo(() => {
    if (!data) return [];
    return getProductsForStore(data, selectedStore);
  }, [data, selectedStore]);

  const prevProducts = useMemo(() => {
    if (!compareData) return [];
    return getProductsForStore(compareData, selectedStore);
  }, [compareData, selectedStore]);

  const summary = useMemo(() => {
    if (!products.length) return null;
    const totalProfit = products.reduce((s, p) => s + p.profit, 0);
    const totalRevenue = products.reduce((s, p) => s + p.revenue, 0);
    const totalCost = products.reduce((s, p) => s + p.cost, 0);
    const avgRent = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const avgMarkup = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
    return { totalProfit, totalRevenue, totalCost, avgRent, avgMarkup };
  }, [products]);

  const prevSummary = useMemo(() => {
    if (!prevProducts.length) return null;
    const totalProfit = prevProducts.reduce((s, p) => s + p.profit, 0);
    const totalRevenue = prevProducts.reduce((s, p) => s + p.revenue, 0);
    const totalCost = prevProducts.reduce((s, p) => s + p.cost, 0);
    const avgRent = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
    const avgMarkup = totalCost > 0 ? (totalProfit / totalCost) * 100 : 0;
    return { totalProfit, totalRevenue, totalCost, avgRent, avgMarkup };
  }, [prevProducts]);

  // ABC by PROFIT (not revenue)
  const abcByProfit = useMemo(() => {
    const sorted = [...products].sort((a, b) => b.profit - a.profit);
    const totalProfit = sorted.reduce((s, p) => s + Math.max(0, p.profit), 0);
    let cumulative = 0;

    const groups = { A: { items: [] as typeof products, profit: 0, revenue: 0, count: 0 }, B: { items: [] as typeof products, profit: 0, revenue: 0, count: 0 }, C: { items: [] as typeof products, profit: 0, revenue: 0, count: 0 } };

    for (const p of sorted) {
      if (p.profit <= 0) {
        groups.C.items.push(p);
        groups.C.profit += p.profit;
        groups.C.revenue += p.revenue;
        groups.C.count++;
        continue;
      }
      cumulative += p.profit;
      const pct = (cumulative / totalProfit) * 100;
      if (pct <= 80) {
        groups.A.items.push(p);
        groups.A.profit += p.profit;
        groups.A.revenue += p.revenue;
        groups.A.count++;
      } else if (pct <= 95) {
        groups.B.items.push(p);
        groups.B.profit += p.profit;
        groups.B.revenue += p.revenue;
        groups.B.count++;
      } else {
        groups.C.items.push(p);
        groups.C.profit += p.profit;
        groups.C.revenue += p.revenue;
        groups.C.count++;
      }
    }
    return groups;
  }, [products]);

  const waterfallData = useMemo(() => {
    if (!summary) return [];
    return [
      { name: 'Выручка', value: summary.totalRevenue, color: '#3b82f6' },
      { name: 'Себестоимость', value: summary.totalCost, color: '#ef4444' },
      { name: 'Прибыль', value: summary.totalProfit, color: '#10b981' },
    ];
  }, [summary]);

  const histogramData = useMemo(() => {
    const buckets = [
      { range: '< 0%', min: -Infinity, max: 0, count: 0 },
      { range: '0–10%', min: 0, max: 10, count: 0 },
      { range: '10–20%', min: 10, max: 20, count: 0 },
      { range: '20–30%', min: 20, max: 30, count: 0 },
      { range: '30–40%', min: 30, max: 40, count: 0 },
      { range: '40–50%', min: 40, max: 50, count: 0 },
      { range: '50%+', min: 50, max: Infinity, count: 0 },
    ];
    for (const p of products) {
      for (const b of buckets) {
        if (p.markup >= b.min && p.markup < b.max) { b.count++; break; }
      }
    }
    return buckets.map(b => ({ name: b.range, count: b.count }));
  }, [products]);

  const topByProfit = useMemo(() => [...products].sort((a, b) => b.profit - a.profit).slice(0, 15), [products]);
  const lossProducts = useMemo(() => products.filter(p => p.profit < 0).sort((a, b) => a.profit - b.profit), [products]);

  if (!data || !summary) return <div className="flex items-center justify-center h-64 text-muted-foreground">Нет данных</div>;

  const profitParts = formatCurrencyParts(summary.totalProfit);
  const totalProfitAbs = abcByProfit.A.profit + abcByProfit.B.profit + abcByProfit.C.profit;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Прибыльность</h1>
        <p className="text-sm text-muted-foreground">{data.period} · {formatNumber(products.length)} товаров</p>
      </div>

      <StoreFilterTabs selected={selectedStore} onSelect={setSelectedStore} />

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Прибыль</span>
              <DollarSign className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-semibold tabular-nums">{profitParts.value}</span>
              <span className="text-xs text-muted-foreground">{profitParts.unit}</span>
            </div>
            <DeltaBadge value={summary.totalProfit} prev={prevSummary?.totalProfit} />
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Рентабельность</span>
              <TrendingUp className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <span className="text-xl font-semibold tabular-nums">{formatPercent(summary.avgRent)}</span>
            <div className="flex items-center gap-2 mt-1">
              <DeltaBadge value={summary.avgRent} prev={prevSummary?.avgRent} abs />
              <span className="text-[10px] text-muted-foreground">прибыль / выручка</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Наценка</span>
              <Percent className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <span className="text-xl font-semibold tabular-nums">{formatPercent(summary.avgMarkup)}</span>
            <div className="flex items-center gap-2 mt-1">
              <DeltaBadge value={summary.avgMarkup} prev={prevSummary?.avgMarkup} abs />
              <span className="text-[10px] text-muted-foreground">прибыль / себестоимость</span>
            </div>
          </CardContent>
        </Card>
        <Card className={lossProducts.length > 0 ? 'border-red-500/30' : ''}>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Убыточных</span>
              <TrendingDown className="h-4 w-4 text-red-500" />
            </div>
            <span className="text-xl font-semibold tabular-nums text-red-600 dark:text-red-400">{lossProducts.length}</span>
            <div className="flex items-center gap-2 mt-1">
              <DeltaBadge value={lossProducts.length} prev={prevProducts.filter(p => p.profit < 0).length} invert />
              <span className="text-[10px] text-muted-foreground">убыток: {formatCurrency(lossProducts.reduce((s, p) => s + p.profit, 0))}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Revenue vs Cost vs Profit */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Выручка → Себестоимость → Прибыль</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={waterfallData} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} stroke="var(--color-muted-foreground)" />
                  <YAxis fontSize={11} stroke="var(--color-muted-foreground)" tickFormatter={(v) => formatCurrency(v)} width={80} />
                  <RTooltip content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-popover border rounded-lg px-3 py-2 text-xs shadow-lg">
                        <p className="font-medium">{d.name}: {formatCurrency(d.value)}</p>
                      </div>
                    );
                  }} />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]} barSize={50}>
                    {waterfallData.map((entry, i) => (
                      <Cell key={i} fill={entry.color} fillOpacity={0.8} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Margin Distribution */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Распределение по наценке</CardTitle>
            <p className="text-[11px] text-muted-foreground">Сколько товаров в каждом диапазоне наценки</p>
          </CardHeader>
          <CardContent>
            <div className="h-[240px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histogramData} margin={{ top: 10, right: 10, bottom: 5, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
                  <XAxis dataKey="name" fontSize={11} stroke="var(--color-muted-foreground)" />
                  <YAxis fontSize={11} stroke="var(--color-muted-foreground)" />
                  <RTooltip content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-popover border rounded-lg px-3 py-2 text-xs shadow-lg">
                        <p className="font-medium">Наценка {d.name}</p>
                        <p>{formatNumber(d.count)} товаров</p>
                      </div>
                    );
                  }} />
                  <Bar dataKey="count" radius={[4, 4, 0, 0]} barSize={30}>
                    {histogramData.map((entry, i) => (
                      <Cell key={i} fill={i === 0 ? '#ef4444' : '#8b5cf6'} fillOpacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ABC by Profit */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">ABC по прибыли</CardTitle>
          <p className="text-[11px] text-muted-foreground">Какие товары генерируют 80% прибыли (не выручки)</p>
        </CardHeader>
        <CardContent>
          {/* Progress bar */}
          <div className="flex h-3 rounded-full overflow-hidden mb-4">
            {(['A', 'B', 'C'] as const).map(cls => {
              const pct = totalProfitAbs > 0 ? (Math.max(0, abcByProfit[cls].profit) / totalProfitAbs) * 100 : 0;
              return <div key={cls} style={{ width: `${Math.max(pct, 1)}%`, background: ABC_COLORS[cls] }} className="h-full" />;
            })}
          </div>

          <div className="grid grid-cols-3 gap-4">
            {(['A', 'B', 'C'] as const).map(cls => {
              const g = abcByProfit[cls];
              const pctProfit = totalProfitAbs > 0 ? (Math.max(0, g.profit) / totalProfitAbs) * 100 : 0;
              return (
                <div key={cls} className="rounded-xl border p-4" style={{ borderColor: `${ABC_COLORS[cls]}40` }}>
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: ABC_COLORS[cls] }} />
                    <span className="text-sm font-semibold">Группа {cls}</span>
                  </div>
                  <div className="space-y-2">
                    <div>
                      <p className="text-[10px] text-muted-foreground">Товаров</p>
                      <p className="text-lg font-semibold tabular-nums">{g.count}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Прибыль</p>
                      <p className="text-sm font-medium tabular-nums">{formatCurrency(g.profit)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Доля в прибыли</p>
                      <p className="text-sm font-medium tabular-nums">{formatPercent(pctProfit)}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-muted-foreground">Выручка группы</p>
                      <p className="text-sm tabular-nums text-muted-foreground">{formatCurrency(g.revenue)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Top 15 by profit */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm">Топ-15 по прибыли</CardTitle>
            <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0 text-[10px]">генераторы</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">Товары, которые приносят больше всего денег. Масштабировать.</p>
        </CardHeader>
        <CardContent className="p-0">
          <ProductTable products={topByProfit} selectedStore={selectedStore} profitColor="text-emerald-600 dark:text-emerald-400" />
        </CardContent>
      </Card>

      {/* Loss-makers */}
      <Card className={lossProducts.length > 0 ? 'border-red-500/20' : ''}>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm">Убыточные товары</CardTitle>
            <Badge variant="destructive" className="text-[10px]">{lossProducts.length}</Badge>
          </div>
          <p className="text-[11px] text-muted-foreground">Продаются ниже себестоимости. Поднять цену или убрать из ассортимента.</p>
        </CardHeader>
        <CardContent className="p-0">
          {lossProducts.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Убыточных товаров нет</div>
          ) : (
            <ProductTable products={lossProducts.slice(0, 30)} selectedStore={selectedStore} profitColor="text-red-600 dark:text-red-400" />
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function ProductTable({ products, selectedStore, profitColor }: {
  products: { name: string; store: string; revenue: number; cost: number; profit: number; rentability: number; markup: number; soldQty: number; abcClass: string }[];
  selectedStore: string;
  profitColor: string;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Товар</th>
            {selectedStore === 'all' && <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Магазин</th>}
            <th className="px-4 py-3 text-center font-medium text-muted-foreground text-xs"><MetricInfo metric="abcClass">ABC</MetricInfo></th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="revenue">Выручка</MetricInfo></th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="cost">Себест.</MetricInfo></th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="profit">Прибыль</MetricInfo></th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="rentability">Рент.</MetricInfo></th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="markup">Наценка</MetricInfo></th>
            <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="soldQty">Шт</MetricInfo></th>
          </tr>
        </thead>
        <tbody>
          {products.map((p, i) => (
            <tr key={i} className="border-b last:border-b-0 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
              <td className="px-4 py-2.5 max-w-0">
                <div className="flex items-start gap-2">
                  <span className="text-muted-foreground/40 text-xs tabular-nums w-4 shrink-0 mt-0.5">{i + 1}</span>
                  <Tooltip>
                    <TooltipTrigger className="text-left text-xs font-medium truncate block cursor-default">
                      {p.name}
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs max-w-[280px]">
                      <p className="font-medium">{p.name}</p>
                      <p className="text-muted-foreground mt-1">{p.store}</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
              </td>
              {selectedStore === 'all' && (
                <td className="px-4 py-2.5">
                  <span className="text-[10px] text-muted-foreground">{p.store}</span>
                </td>
              )}
              <td className="px-4 py-2.5 text-center">
                <Badge className={`text-[10px] ${abcBadgeClass(p.abcClass)}`}>{p.abcClass}</Badge>
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-xs">{formatCurrency(p.revenue)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{formatCurrency(p.cost)}</td>
              <td className={`px-4 py-2.5 text-right tabular-nums text-xs font-medium ${profitColor}`}>
                {formatCurrency(p.profit)}
              </td>
              <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{formatPercent(p.rentability)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{formatPercent(p.markup)}</td>
              <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{formatNumber(p.soldQty)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
