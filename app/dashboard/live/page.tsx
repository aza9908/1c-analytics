'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import type { LiveDashboardData, HourlyByStore } from '@/lib/odata';
import { STORE_COLORS } from '@/lib/odata';
import { formatCurrency, formatCurrencyParts, formatNumber } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { DeltaBadge } from '@/components/delta-badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip,
  Cell, CartesianGrid, AreaChart, Area,
} from 'recharts';
import { DollarSign, ShoppingBag, Receipt, CreditCard, ChevronDown } from 'lucide-react';

const REFRESH_INTERVAL = 5 * 60 * 1000;

export default function LivePage() {
  const [data, setData] = useState<LiveDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [timeAgo, setTimeAgo] = useState('');
  const [selectedStore, setSelectedStore] = useState('all');

  const fetchData = useCallback(() => {
    fetch('/api/live')
      .then(res => res.json())
      .then((d: LiveDashboardData) => {
        if ('error' in d) throw new Error((d as any).error);
        setData(d);
        setLastUpdate(new Date());
        setError(null);
        setLoading(false);
      })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, REFRESH_INTERVAL);
    return () => clearInterval(interval);
  }, [fetchData]);

  useEffect(() => {
    const update = () => {
      if (!lastUpdate) return;
      const diff = Math.floor((Date.now() - lastUpdate.getTime()) / 1000);
      if (diff < 60) setTimeAgo('только что');
      else if (diff < 3600) setTimeAgo(`${Math.floor(diff / 60)} мин назад`);
      else setTimeAgo(`${Math.floor(diff / 3600)} ч назад`);
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [lastUpdate]);

  // Filtered data for selected store
  const filtered = useMemo(() => {
    if (!data || selectedStore === 'all') return data;
    const store = data.byStore.find(s => s.store === selectedStore);
    const storeHourly: HourlyByStore[] = data.hourly.map(h => ({
      hour: h.hour,
      total: h.stores[selectedStore] || 0,
      totalQty: 0, // approximated below
      totalCount: 0,
      stores: { [selectedStore]: h.stores[selectedStore] || 0 },
    }));
    const storeProducts = data.topProducts.filter(p => p.store === selectedStore);
    return {
      ...data,
      totalRevenue: store?.revenue ?? 0,
      totalQty: store?.qty ?? 0,
      totalReceipts: store?.count ?? 0,
      avgCheck: store?.avgCheck ?? 0,
      hourly: storeHourly,
      topProducts: storeProducts,
    } as LiveDashboardData;
  }, [data, selectedStore]);

  if (loading) return <div className="flex items-center justify-center h-64 text-muted-foreground">Подключение к 1С...</div>;
  if (error && !data) return <div className="flex items-center justify-center h-64 text-red-500">Ошибка: {error}</div>;
  if (!data || !filtered) return null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight">Live</h1>
            <LiveIndicator timeAgo={timeAgo} isToday={data.isToday} />
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {data.isToday ? 'Сегодня' : data.dateLabel} · данные из 1С в реальном времени
          </p>
        </div>
        <StoreFilter
          stores={data.storeNames}
          selected={selectedStore}
          onSelect={setSelectedStore}
        />
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard title="Выручка" value={filtered.totalRevenue} type="currency" icon={<DollarSign className="h-4 w-4" />}
          prevValue={selectedStore === 'all' ? data.prevDayRevenue : undefined} prevLabel="vs вчера" />
        <KpiCard title="Продано штук" value={filtered.totalQty} type="number" icon={<ShoppingBag className="h-4 w-4" />} />
        <KpiCard title="Чеков" value={filtered.totalReceipts} type="number" icon={<Receipt className="h-4 w-4" />} />
        <KpiCard title="Средний чек" value={filtered.avgCheck} type="currency" icon={<CreditCard className="h-4 w-4" />} />
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <HourlyChart data={filtered} isAllStores={selectedStore === 'all'} storeNames={data.storeNames} />
        {selectedStore === 'all' ? (
          <StoreChart data={data} />
        ) : (
          <StoreDetailCard store={data.byStore.find(s => s.store === selectedStore)} />
        )}
      </div>

      {/* Top Products */}
      <TopProductsTable data={filtered} showStore={selectedStore === 'all'} />
    </div>
  );
}

/* ============================================================ */

function LiveIndicator({ timeAgo, isToday }: { timeAgo: string; isToday: boolean }) {
  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <span className="relative flex h-2.5 w-2.5">
        {isToday && <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />}
        <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${isToday ? 'bg-emerald-500' : 'bg-amber-500'}`} />
      </span>
      <span>{isToday ? 'Live' : 'Архив'}</span>
      {timeAgo && <>
        <span className="text-muted-foreground/40">·</span>
        <span>{timeAgo}</span>
      </>}
    </div>
  );
}

function StoreFilter({ stores, selected, onSelect }: { stores: string[]; selected: string; onSelect: (s: string) => void }) {
  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={() => onSelect('all')}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          selected === 'all' ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        Все магазины
      </button>
      {stores.map(store => (
        <button
          key={store}
          onClick={() => onSelect(store)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
            selected === store ? 'bg-foreground text-background' : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <div className="w-1.5 h-1.5 rounded-full" style={{ background: STORE_COLORS[store] || '#6b7280' }} />
          {store}
        </button>
      ))}
    </div>
  );
}

function KpiCard({ title, value, type, icon, prevValue, prevLabel }: {
  title: string; value: number; type: 'currency' | 'number'; icon: React.ReactNode;
  prevValue?: number | null; prevLabel?: string;
}) {
  const parts = type === 'currency' ? formatCurrencyParts(value) : null;
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
          <span className="text-muted-foreground/50">{icon}</span>
        </div>
        {parts ? (
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-semibold tabular-nums">{parts.value}</span>
            <span className="text-xs text-muted-foreground">{parts.unit}</span>
          </div>
        ) : (
          <span className="text-xl font-semibold tabular-nums">{formatNumber(value)}</span>
        )}
        {prevValue != null && (
          <div className="flex items-center gap-2 mt-1">
            <DeltaBadge value={value} prev={prevValue} />
            {prevLabel && <span className="text-[10px] text-muted-foreground">{prevLabel}</span>}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/* ============================================================
   HOURLY CHART — with per-store tooltip
   ============================================================ */
function HourlyChart({ data, isAllStores, storeNames }: {
  data: LiveDashboardData; isAllStores: boolean; storeNames: string[];
}) {
  const chartData = data.hourly.map(h => ({
    hour: `${h.hour}:00`,
    revenue: h.total,
    stores: h.stores,
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Выручка по часам</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, left: 0, right: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="revenueGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#10b981" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" vertical={false} />
              <XAxis dataKey="hour" fontSize={11} stroke="var(--color-muted-foreground)" />
              <YAxis fontSize={11} tickFormatter={(v) => formatCurrency(v)} stroke="var(--color-muted-foreground)" width={70} />
              <RTooltip
                content={({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const d = payload[0].payload;
                  const storeEntries = Object.entries(d.stores as Record<string, number>)
                    .sort((a, b) => b[1] - a[1]);
                  return (
                    <div className="bg-popover border rounded-lg px-3 py-2 text-xs shadow-lg min-w-[160px]">
                      <p className="font-medium mb-1.5">{label}</p>
                      <p className="mb-1">Итого: <span className="font-medium">{formatCurrency(d.revenue)}</span></p>
                      {isAllStores && storeEntries.length > 0 && (
                        <div className="border-t pt-1.5 mt-1.5 space-y-1">
                          {storeEntries.map(([name, rev]) => (
                            <div key={name} className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-1.5">
                                <div className="w-1.5 h-1.5 rounded-full" style={{ background: STORE_COLORS[name] || '#6b7280' }} />
                                <span className="text-muted-foreground">{name}</span>
                              </div>
                              <span className="tabular-nums font-medium">{formatCurrency(rev)}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                }}
              />
              <Area
                type="monotone"
                dataKey="revenue"
                stroke="#10b981"
                strokeWidth={2}
                fill="url(#revenueGrad)"
                dot={false}
                activeDot={{ r: 4, fill: '#10b981', stroke: 'var(--color-card)', strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================================================
   STORE BAR CHART — when "All stores"
   ============================================================ */
function StoreChart({ data }: { data: LiveDashboardData }) {
  const chartData = data.byStore.map(s => ({
    name: s.store, revenue: s.revenue, count: s.count, avgCheck: s.avgCheck, color: s.color,
  }));
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Выручка по магазинам</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 10 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" horizontal={false} />
              <XAxis type="number" fontSize={11} tickFormatter={(v) => formatCurrency(v)} stroke="var(--color-muted-foreground)" />
              <YAxis type="category" dataKey="name" fontSize={12} width={80} stroke="var(--color-muted-foreground)" />
              <RTooltip content={({ active, payload }) => {
                if (!active || !payload?.[0]) return null;
                const d = payload[0].payload;
                return (
                  <div className="bg-popover border rounded-lg px-3 py-2 text-xs shadow-lg">
                    <p className="font-medium mb-1">{d.name}</p>
                    <p>Выручка: {formatCurrency(d.revenue)}</p>
                    <p>Чеков: {d.count}</p>
                    <p>Ср. чек: {formatCurrency(d.avgCheck)}</p>
                  </div>
                );
              }} />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={22}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================================================
   STORE DETAIL CARD — when single store selected
   ============================================================ */
function StoreDetailCard({ store }: { store?: LiveDashboardData['byStore'][0] }) {
  if (!store) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full" style={{ background: store.color }} />
          <CardTitle className="text-sm">{store.store}</CardTitle>
          <span className="text-[10px] text-muted-foreground">{store.city}</span>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-2 gap-6 mt-2">
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Выручка</p>
            <p className="text-lg font-semibold tabular-nums mt-1">{formatCurrency(store.revenue)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Чеков</p>
            <p className="text-lg font-semibold tabular-nums mt-1">{formatNumber(store.count)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Средний чек</p>
            <p className="text-lg font-semibold tabular-nums mt-1">{formatCurrency(store.avgCheck)}</p>
          </div>
          <div>
            <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Продано штук</p>
            <p className="text-lg font-semibold tabular-nums mt-1">{formatNumber(store.qty)}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

/* ============================================================
   TOP PRODUCTS TABLE
   ============================================================ */
function TopProductsTable({ data, showStore }: { data: LiveDashboardData; showStore: boolean }) {
  if (data.topProducts.length === 0) return null;
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Топ товаров</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground text-xs w-[5%]">#</th>
                <th className="px-4 py-2 text-left font-medium text-muted-foreground text-xs">Товар</th>
                {showStore && <th className="px-4 py-2 text-left font-medium text-muted-foreground text-xs w-[18%]">Магазин</th>}
                <th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs w-[10%]">Шт</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs w-[15%]">Выручка</th>
              </tr>
            </thead>
            <tbody>
              {data.topProducts.map((p, i) => (
                <tr key={i} className="border-b last:border-b-0 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                  <td className="px-4 py-2.5 text-muted-foreground/40 text-xs tabular-nums">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <Tooltip>
                      <TooltipTrigger className="text-xs font-medium truncate block cursor-default text-left max-w-[300px]">
                        {p.name}
                      </TooltipTrigger>
                      <TooltipContent className="text-xs max-w-[280px]">{p.name}</TooltipContent>
                    </Tooltip>
                  </td>
                  {showStore && (
                    <td className="px-4 py-2.5">
                      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ background: STORE_COLORS[p.store] || '#6b7280' }} />
                        {p.store}
                      </div>
                    </td>
                  )}
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs">{formatNumber(p.qty)}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(p.revenue)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
