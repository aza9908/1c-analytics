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
import { ArrowDownWideNarrow, ArrowUpWideNarrow } from 'lucide-react';

interface SupplierGroup {
  supplier: string;
  skuCount: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalQty: number;
  avgMarkup: number;
  avgRentability: number;
}

type SortField = 'totalRevenue' | 'totalProfit' | 'skuCount' | 'avgMarkup';

const BAR_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#6366f1'];

export default function CategoriesPage() {
  const { data, loading } = useData();
  const [selectedStore, setSelectedStore] = useState('all');
  const [sortField, setSortField] = useState<SortField>('totalRevenue');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');

  const products = useMemo(() => {
    if (!data) return [];
    return getProductsForStore(data, selectedStore);
  }, [data, selectedStore]);

  const suppliers = useMemo(() => {
    const map = new Map<string, SupplierGroup>();
    for (const p of products) {
      const key = p.supplier.trim() || 'Без поставщика';
      let group = map.get(key);
      if (!group) {
        group = { supplier: key, skuCount: 0, totalRevenue: 0, totalCost: 0, totalProfit: 0, totalQty: 0, avgMarkup: 0, avgRentability: 0 };
        map.set(key, group);
      }
      group.skuCount++;
      group.totalRevenue += p.revenue;
      group.totalCost += p.cost;
      group.totalProfit += p.profit;
      group.totalQty += p.soldQty;
    }
    // Calculate averages
    for (const g of map.values()) {
      g.avgRentability = g.totalRevenue > 0 ? (g.totalProfit / g.totalRevenue) * 100 : 0;
      g.avgMarkup = g.totalCost > 0 ? (g.totalProfit / g.totalCost) * 100 : 0;
    }
    return [...map.values()];
  }, [products]);

  const sorted = useMemo(() => {
    return [...suppliers].sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1;
      return mul * (a[sortField] - b[sortField]);
    });
  }, [suppliers, sortField, sortDir]);

  const top10Chart = useMemo(() => {
    return [...suppliers]
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10)
      .map((s, i) => ({
        name: s.supplier.length > 20 ? s.supplier.slice(0, 18) + '...' : s.supplier,
        fullName: s.supplier,
        revenue: s.totalRevenue,
        color: BAR_COLORS[i % BAR_COLORS.length],
      }));
  }, [suppliers]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  if (!data) return <div className="flex items-center justify-center h-64 text-muted-foreground">Нет данных</div>;

  const SortIcon = sortDir === 'desc' ? ArrowDownWideNarrow : ArrowUpWideNarrow;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">По поставщикам</h1>
        <p className="text-sm text-muted-foreground">{data.period} · {formatNumber(suppliers.length)} поставщиков{selectedStore !== 'all' ? ` · ${selectedStore}` : ''}</p>
      </div>

      <div className="mb-4"><StoreFilterTabs selected={selectedStore} onSelect={setSelectedStore} /></div>

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Поставщиков</span>
            <p className="text-xl font-semibold tabular-nums mt-1">{formatNumber(suppliers.length)}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Топ-1 по выручке</span>
            <p className="text-sm font-medium mt-1 truncate">{top10Chart[0]?.fullName || '—'}</p>
            <p className="text-xs text-muted-foreground tabular-nums">{top10Chart[0] ? formatCurrency(top10Chart[0].revenue) : '—'}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Ср. наценка</span>
            <p className="text-xl font-semibold tabular-nums mt-1">
              {formatPercent(suppliers.length > 0 ? suppliers.reduce((s, g) => s + g.avgMarkup, 0) / suppliers.length : 0)}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Без поставщика</span>
            <p className="text-xl font-semibold tabular-nums mt-1">
              {formatNumber(suppliers.find(s => s.supplier === 'Без поставщика')?.skuCount ?? 0)}
            </p>
            <p className="text-[10px] text-muted-foreground">товаров</p>
          </CardContent>
        </Card>
      </div>

      {/* Top 10 Bar Chart */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Топ-10 поставщиков по выручке</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={top10Chart} layout="vertical" margin={{ left: 10, right: 20 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
                <XAxis type="number" fontSize={11} stroke="var(--color-muted-foreground)" tickFormatter={(v) => formatCurrency(v)} />
                <YAxis type="category" dataKey="name" fontSize={11} width={130} stroke="var(--color-muted-foreground)" />
                <RTooltip
                  content={({ active, payload }) => {
                    if (!active || !payload?.[0]) return null;
                    const d = payload[0].payload;
                    return (
                      <div className="bg-popover border rounded-lg px-3 py-2 text-xs shadow-lg max-w-[280px]">
                        <p className="font-medium">{d.fullName}</p>
                        <p>Выручка: {formatCurrency(d.revenue)}</p>
                      </div>
                    );
                  }}
                />
                <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={18}>
                  {top10Chart.map((entry, i) => (
                    <Cell key={i} fill={entry.color} fillOpacity={0.8} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Suppliers Table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Все поставщики</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs w-8">#</th>
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Поставщик</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs">
                    <button className="group/sort inline-flex items-center gap-1" onClick={() => toggleSort('skuCount')}>
                      SKU
                      {sortField === 'skuCount' && <SortIcon className="w-3.5 h-3.5" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs">
                    <button className="group/sort inline-flex items-center gap-1" onClick={() => toggleSort('totalRevenue')}>
                      Выручка
                      {sortField === 'totalRevenue' && <SortIcon className="w-3.5 h-3.5" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs">Доля</th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="cost">Себестоимость</MetricInfo></th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs">
                    <button className="group/sort inline-flex items-center gap-1" onClick={() => toggleSort('totalProfit')}>
                      Прибыль
                      {sortField === 'totalProfit' && <SortIcon className="w-3.5 h-3.5" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="rentability">Рент.</MetricInfo></th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs">
                    <button className="group/sort inline-flex items-center gap-1" onClick={() => toggleSort('avgMarkup')}>
                      Наценка
                      {sortField === 'avgMarkup' && <SortIcon className="w-3.5 h-3.5" />}
                    </button>
                  </th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="soldQty">Шт</MetricInfo></th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((s, i) => (
                  <tr key={s.supplier} className="border-b last:border-b-0 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                    <td className="px-4 py-2.5 text-muted-foreground/40 text-xs tabular-nums">{i + 1}</td>
                    <td className="px-4 py-2.5 max-w-0">
                      <Tooltip>
                        <TooltipTrigger className="text-left text-xs font-medium truncate block cursor-default">
                          {s.supplier}
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-[280px]">
                          <p className="font-medium">{s.supplier}</p>
                          <p className="text-muted-foreground mt-1">{formatNumber(s.skuCount)} SKU · {formatNumber(s.totalQty)} шт продано</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{formatNumber(s.skuCount)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs">{formatCurrency(s.totalRevenue)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                      {products.length > 0 ? formatPercent((s.totalRevenue / products.reduce((sum, p) => sum + p.revenue, 0)) * 100) : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{formatCurrency(s.totalCost)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums text-xs font-medium ${s.totalProfit < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {formatCurrency(s.totalProfit)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{formatPercent(s.avgRentability)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums text-xs ${s.avgMarkup < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                      {formatPercent(s.avgMarkup)}
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{formatNumber(s.totalQty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sorted.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">Нет данных</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
