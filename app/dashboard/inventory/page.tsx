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
import { Package, AlertTriangle, Clock, Archive } from 'lucide-react';
import { abcBadgeClass } from '@/lib/abc-colors';
import { DeltaBadge } from '@/components/delta-badge';

const STORE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#f43f5e'];

export default function InventoryPage() {
  const { data, compareData, loading } = useData();
  const [selectedStore, setSelectedStore] = useState('all');

  const products = useMemo(() => {
    if (!data) return [];
    return getProductsForStore(data, selectedStore);
  }, [data, selectedStore]);

  const kpis = useMemo(() => {
    if (!data) return null;
    const stores = selectedStore === 'all' ? data.stores : data.stores.filter(s => s.store === selectedStore);
    const deadSku = stores.reduce((s, st) => s + st.deadSkuCount, 0);
    const surplusValue = stores.reduce((s, st) => s + st.surplusTotal, 0);
    const withStock = products.filter(p => p.freeStock !== null && p.freeStock > 0).length;
    const daysSupplyArr = products.filter(p => p.daysSupply !== null).map(p => p.daysSupply!);
    const avgDaysSupply = daysSupplyArr.length > 0 ? daysSupplyArr.reduce((s, d) => s + d, 0) / daysSupplyArr.length : 0;
    return { deadSku, surplusValue, avgDaysSupply, withStock };
  }, [data, products, selectedStore]);

  const prevKpis = useMemo(() => {
    if (!compareData) return null;
    const prevProducts = getProductsForStore(compareData, selectedStore);
    const stores = selectedStore === 'all' ? compareData.stores : compareData.stores.filter(s => s.store === selectedStore);
    const deadSku = stores.reduce((s, st) => s + st.deadSkuCount, 0);
    const surplusValue = stores.reduce((s, st) => s + st.surplusTotal, 0);
    const withStock = prevProducts.filter(p => p.freeStock !== null && p.freeStock > 0).length;
    const daysSupplyArr = prevProducts.filter(p => p.daysSupply !== null).map(p => p.daysSupply!);
    const avgDaysSupply = daysSupplyArr.length > 0 ? daysSupplyArr.reduce((s, d) => s + d, 0) / daysSupplyArr.length : 0;
    return { deadSku, surplusValue, avgDaysSupply, withStock };
  }, [compareData, selectedStore]);

  const filteredStores = useMemo(() => {
    if (!data) return [];
    return selectedStore === 'all' ? data.stores : data.stores.filter(s => s.store === selectedStore);
  }, [data, selectedStore]);

  const deadByStore = useMemo(() => {
    return filteredStores.map((s, i) => ({
      name: s.store,
      deadCount: s.deadSkuCount,
      totalSku: s.soldSkuCount + s.deadSkuCount,
      pct: s.soldSkuCount + s.deadSkuCount > 0 ? (s.deadSkuCount / (s.soldSkuCount + s.deadSkuCount)) * 100 : 0,
      color: STORE_COLORS[i % STORE_COLORS.length],
    }));
  }, [filteredStores]);

  const surplusByStore = useMemo(() => {
    return filteredStores
      .filter(s => s.surplusTotal > 0)
      .sort((a, b) => b.surplusTotal - a.surplusTotal)
      .map((s, i) => ({
        name: s.store,
        surplus: s.surplusTotal,
        color: STORE_COLORS[i % STORE_COLORS.length],
      }));
  }, [filteredStores]);

  const surplusProducts = useMemo(() => {
    return [...products]
      .filter(p => p.surplusSum !== null && p.surplusSum > 0)
      .sort((a, b) => (b.surplusSum ?? 0) - (a.surplusSum ?? 0))
      .slice(0, 20);
  }, [products]);

  if (!data || !kpis) return <div className="flex items-center justify-center h-64 text-muted-foreground">Нет данных</div>;

  const surplusParts = formatCurrencyParts(kpis.surplusValue);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Запасы и складской анализ</h1>
        <p className="text-sm text-muted-foreground">{data.period}{selectedStore !== 'all' ? ` · ${selectedStore}` : ''}</p>
      </div>

      <div className="mb-4"><StoreFilterTabs selected={selectedStore} onSelect={setSelectedStore} /></div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Без продаж</span>
              <AlertTriangle className="h-4 w-4 text-amber-500" />
            </div>
            <span className="text-xl font-semibold tabular-nums">{formatNumber(kpis.deadSku)}</span>
            <div className="flex items-center gap-2 mt-1">
              <DeltaBadge value={kpis.deadSku} prev={prevKpis?.deadSku} invert />
              <span className="text-[10px] text-muted-foreground">Без продаж за период</span>
            </div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Излишки</span>
              <Archive className="h-4 w-4 text-amber-500" />
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-semibold tabular-nums">{surplusParts.value}</span>
              <span className="text-xs text-muted-foreground">{surplusParts.unit}</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <DeltaBadge value={kpis.surplusValue} prev={prevKpis?.surplusValue} invert />
              <span className="text-[10px] text-muted-foreground">Замороженный капитал</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Ср. дни запаса</span>
              <Clock className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <span className="text-xl font-semibold tabular-nums">{kpis.avgDaysSupply.toFixed(0)}</span>
            <div className="flex items-center gap-2 mt-1">
              <DeltaBadge value={kpis.avgDaysSupply} prev={prevKpis?.avgDaysSupply} invert />
              <span className="text-[10px] text-muted-foreground">дней</span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Товары с запасом</span>
              <Package className="h-4 w-4 text-muted-foreground/50" />
            </div>
            <span className="text-xl font-semibold tabular-nums">{formatNumber(kpis.withStock)}</span>
            <div className="flex items-center gap-2 mt-1">
              <DeltaBadge value={kpis.withStock} prev={prevKpis?.withStock} />
              <span className="text-[10px] text-muted-foreground">из {formatNumber(products.length)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {/* Dead Stock by Store */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Мёртвый сток по магазинам</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Магазин</th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="deadSkuCount">Без продаж</MetricInfo></th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="soldSkuCount">Всего SKU</MetricInfo></th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs">% мёртвого</th>
                  </tr>
                </thead>
                <tbody>
                  {deadByStore.map((s, i) => (
                    <tr key={s.name} className="border-b last:border-b-0 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                      <td className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: s.color }} />
                          <span className="text-xs font-medium">{s.name}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs text-amber-600 dark:text-amber-400">{formatNumber(s.deadCount)}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{formatNumber(s.totalSku)}</td>
                      <td className="px-4 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${Math.min(s.pct, 100)}%` }} />
                          </div>
                          <span className="text-xs tabular-nums text-muted-foreground w-10 text-right">{formatPercent(s.pct, 0)}</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        {/* Surplus by Store - Horizontal Bar */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Излишки по магазинам</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-[250px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={surplusByStore} layout="vertical" margin={{ left: 0, right: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                  <XAxis type="number" fontSize={11} stroke="var(--color-muted-foreground)" tickFormatter={(v) => formatCurrency(v)} />
                  <YAxis type="category" dataKey="name" fontSize={12} width={80} stroke="var(--color-muted-foreground)" />
                  <RTooltip
                    content={({ active, payload }) => {
                      if (!active || !payload?.[0]) return null;
                      const d = payload[0].payload;
                      return (
                        <div className="bg-popover border rounded-lg px-3 py-2 text-xs shadow-lg">
                          <p className="font-medium">{d.name}</p>
                          <p>Излишки: {formatCurrency(d.surplus)}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="surplus" radius={[0, 4, 4, 0]} barSize={20}>
                    {surplusByStore.map((entry, i) => (
                      <Cell key={i} fill={entry.color} fillOpacity={0.7} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Surplus Products */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2">
            <CardTitle className="text-sm">Товары с наибольшими излишками</CardTitle>
            <Badge variant="outline" className="text-[10px]">Топ-20</Badge>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {surplusProducts.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Нет товаров с излишками</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Товар</th>
                    {selectedStore === 'all' && <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Магазин</th>}
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="surplus">Излишки</MetricInfo></th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="freeStock">Свободный ост.</MetricInfo></th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="daysSupply">Дни запаса</MetricInfo></th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="speed">Скорость</MetricInfo></th>
                    <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="revenue">Выручка</MetricInfo></th>
                    <th className="px-4 py-3 text-center font-medium text-muted-foreground text-xs"><MetricInfo metric="abcClass">ABC</MetricInfo></th>
                  </tr>
                </thead>
                <tbody>
                  {surplusProducts.map((p, i) => (
                    <tr key={i} className="border-b last:border-b-0 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                      <td className="px-4 py-2.5 max-w-0">
                        <div className="flex items-start gap-2">
                          <span className="text-muted-foreground/40 text-xs tabular-nums w-4 shrink-0 mt-0.5">{i + 1}</span>
                          <Tooltip>
                            <TooltipTrigger className="text-left text-xs font-medium truncate block cursor-default">
                              {p.name}
                            </TooltipTrigger>
                            <TooltipContent side="top" className="text-xs max-w-[280px]">
                              <p className="font-medium leading-snug">{p.name}</p>
                              <p className="text-muted-foreground mt-1">{p.store} · Излишки: {formatCurrency(p.surplusSum ?? 0)}</p>
                            </TooltipContent>
                          </Tooltip>
                        </div>
                      </td>
                      {selectedStore === 'all' && (
                        <td className="px-4 py-2.5">
                          <Badge variant="outline" className="text-[10px]">{p.store}</Badge>
                        </td>
                      )}
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs font-medium text-amber-600 dark:text-amber-400">
                        {formatCurrency(p.surplusSum ?? 0)}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                        {p.freeStock !== null ? formatNumber(p.freeStock) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                        {p.daysSupply !== null ? `${p.daysSupply.toFixed(0)} д` : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                        {p.speed !== null ? p.speed.toFixed(1) : '—'}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums text-xs">{formatCurrency(p.revenue)}</td>
                      <td className="px-4 py-2.5 text-center">
                        <Badge className={`text-[10px] ${abcBadgeClass(p.abcClass)}`}>{p.abcClass}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
