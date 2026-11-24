'use client';

import { useState, useMemo } from 'react';
import { useData, getProductsForStore } from '@/lib/data-context';
import type { FebProduct, FebReportData, StoreReport } from '@/lib/parse-february';
import { StoreFilterTabs } from '@/components/store-filter-tabs';
import { formatCurrency, formatCurrencyParts, formatNumber, formatPercent } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip, Cell,
} from 'recharts';
import {
  TrendingUp, AlertTriangle, Package, DollarSign, ShoppingBag, Percent,
} from 'lucide-react';
import { DeltaBadge } from '@/components/delta-badge';
import { MetricInfo } from '@/components/dashboard/metric-info';

const STORE_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#f43f5e'];

export default function OverviewPage() {
  const { data, compareData, loading } = useData();
  const [selectedStore, setSelectedStore] = useState('all');

  if (!data) return <div className="flex items-center justify-center h-64 text-muted-foreground">Нет данных</div>;

  const isAll = selectedStore === 'all';

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Обзор</h1>
        <p className="text-sm text-muted-foreground">{data.period} · {data.stores.length} магазинов</p>
      </div>

      <StoreFilterTabs selected={selectedStore} onSelect={setSelectedStore} />

      {isAll ? (
        <AllStoresView data={data} compareData={compareData} />
      ) : (
        <SingleStoreView data={data} compareData={compareData} storeName={selectedStore} />
      )}
    </div>
  );
}

/* ============================================================
   ALL STORES VIEW — сводка по сети
   ============================================================ */
function AllStoresView({ data, compareData }: { data: FebReportData; compareData: FebReportData | null }) {
  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Выручка" value={data.totalRevenue} prevValue={compareData?.totalRevenue} type="currency" icon={<DollarSign className="h-4 w-4" />} />
        <KpiCard title="Прибыль" value={data.totalProfit} prevValue={compareData?.totalProfit} type="currency" icon={<TrendingUp className="h-4 w-4" />} subtitle={`Рент. ${formatPercent(data.avgRentability)}`} />
        <KpiCard title="Наценка" value={data.avgMarkup} prevValue={compareData?.avgMarkup} type="percent" icon={<Percent className="h-4 w-4" />} deltaAbs />
        <KpiCard title="Продано штук" value={data.totalQty} prevValue={compareData?.totalQty} type="number" icon={<ShoppingBag className="h-4 w-4" />} />
        <KpiCard title="SKU с продажами" value={data.totalSoldSku} prevValue={compareData?.totalSoldSku} type="number" icon={<Package className="h-4 w-4" />} subtitle={`Без продаж: ${formatNumber(data.totalDeadSku)}`} />
        <KpiCard title="Излишки" value={data.totalSurplus} prevValue={compareData?.totalSurplus} type="currency" icon={<AlertTriangle className="h-4 w-4" />} alert invertDelta />
      </div>

      {/* Alerts */}
      <AllStoresAlerts data={data} />

      {/* Store Ranking + Top Products */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <StoreRankingChart data={data} />
        <TopProductsByProfit products={data.allProducts} title="Топ-10 по прибыли (вся сеть)" />
      </div>

      {/* Store Scoreboard */}
      <StoreScoreboard data={data} compareData={compareData} />
    </div>
  );
}

/* ============================================================
   SINGLE STORE VIEW — детальный обзор одного магазина
   ============================================================ */
function SingleStoreView({ data, compareData, storeName }: { data: FebReportData; compareData: FebReportData | null; storeName: string }) {
  const store = data.stores.find(s => s.store === storeName);
  if (!store) return <div className="text-muted-foreground">Магазин не найден</div>;
  const prevStore = compareData?.stores.find(s => s.store === storeName) ?? null;

  const products = store.products;
  const storeIdx = data.stores.indexOf(store);
  const storeColor = STORE_COLORS[storeIdx] || '#6b7280';

  // Compare to chain average
  const rentDiff = store.avgRentability - data.avgRentability;
  const markupDiff = store.avgMarkup - data.avgMarkup;
  const revenueShare = (store.totalRevenue / data.totalRevenue) * 100;
  const profitShare = (store.totalProfit / data.totalProfit) * 100;
  const deadPct = ((store.deadSkuCount / (store.deadSkuCount + store.soldSkuCount)) * 100);

  return (
    <div className="space-y-6">
      {/* Store header */}
      <div className="flex items-center gap-3">
        <div className="w-3 h-3 rounded-full" style={{ background: storeColor }} />
        <div>
          <h2 className="text-base font-semibold">{store.store}</h2>
          <p className="text-xs text-muted-foreground">{store.city} · {revenueShare.toFixed(1)}% выручки сети</p>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard title="Выручка" value={store.totalRevenue} prevValue={prevStore?.totalRevenue} type="currency" icon={<DollarSign className="h-4 w-4" />} subtitle={`${revenueShare.toFixed(1)}% от сети`} />
        <KpiCard title="Прибыль" value={store.totalProfit} prevValue={prevStore?.totalProfit} type="currency" icon={<TrendingUp className="h-4 w-4" />} subtitle={`${profitShare.toFixed(1)}% от сети`} />
        <KpiCard
          title="Рентабельность"
          value={store.avgRentability}
          prevValue={prevStore?.avgRentability}
          type="percent"
          icon={<Percent className="h-4 w-4" />}
          subtitle={`${rentDiff >= 0 ? '+' : ''}${rentDiff.toFixed(1)}% vs сеть`}
          highlight={rentDiff >= 0 ? 'green' : 'red'}
          deltaAbs
        />
        <KpiCard
          title="Наценка"
          value={store.avgMarkup}
          prevValue={prevStore?.avgMarkup}
          type="percent"
          icon={<Percent className="h-4 w-4" />}
          subtitle={`${markupDiff >= 0 ? '+' : ''}${markupDiff.toFixed(1)}% vs сеть`}
          highlight={markupDiff >= 0 ? 'green' : 'red'}
          deltaAbs
        />
        <KpiCard title="Продано штук" value={store.totalQty} prevValue={prevStore?.totalQty} type="number" icon={<ShoppingBag className="h-4 w-4" />} subtitle={`${store.soldSkuCount} позиций`} />
        <KpiCard title="Без продаж" value={store.deadSkuCount} prevValue={prevStore?.deadSkuCount} type="number" icon={<Package className="h-4 w-4" />} subtitle={`${deadPct.toFixed(0)}% ассортимента`} alert invertDelta />
      </div>

      {/* Store-specific alerts */}
      <StoreAlerts store={store} chainAvgRent={data.avgRentability} />

      {/* ABC + Top Products */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <ABCSummaryCard store={store} />
        <TopProductsByProfit products={products} title={`Топ-10 по прибыли — ${store.store}`} />
      </div>

      {/* XYZ + Loss makers */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <XYZSummaryCard store={store} />
        {store.lossProducts.length > 0 && (
          <LossMakersCard store={store} />
        )}
      </div>
    </div>
  );
}

/* ============================================================
   SHARED COMPONENTS
   ============================================================ */

function KpiCard({ title, value, prevValue, type, icon, subtitle, alert, highlight, deltaAbs, invertDelta }: {
  title: string; value: number; type: 'currency' | 'percent' | 'number';
  prevValue?: number; icon?: React.ReactNode; subtitle?: string; alert?: boolean;
  highlight?: 'green' | 'red'; deltaAbs?: boolean; invertDelta?: boolean;
}) {
  const parts = type === 'currency' ? formatCurrencyParts(value) : null;
  const subtitleColor = highlight === 'green'
    ? 'text-emerald-600 dark:text-emerald-400'
    : highlight === 'red'
      ? 'text-red-600 dark:text-red-400'
      : 'text-muted-foreground';

  // Delta calculation
  let deltaEl: React.ReactNode = null;
  if (prevValue != null && prevValue !== 0) {
    const diff = value - prevValue;
    const pct = deltaAbs ? diff : (diff / prevValue) * 100;
    const isPositive = diff > 0;
    const isGood = invertDelta ? !isPositive : isPositive;
    const arrow = isPositive ? '▲' : '▼';
    const formatted = deltaAbs
      ? `${isPositive ? '+' : ''}${pct.toFixed(1)}п.п.`
      : `${isPositive ? '+' : ''}${pct.toFixed(1)}%`;
    deltaEl = (
      <span className={`text-[10px] font-medium tabular-nums ${isGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
        {arrow} {formatted}
      </span>
    );
  }

  return (
    <Card className={alert ? 'border-amber-500/30' : ''}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">{title}</span>
          <span className={alert ? 'text-amber-500' : 'text-muted-foreground/50'}>{icon}</span>
        </div>
        {type === 'currency' && parts ? (
          <div className="flex items-baseline gap-1">
            <span className="text-xl font-semibold tabular-nums">{parts.value}</span>
            <span className="text-xs text-muted-foreground">{parts.unit}</span>
          </div>
        ) : type === 'percent' ? (
          <span className="text-xl font-semibold tabular-nums">{formatPercent(value)}</span>
        ) : (
          <span className="text-xl font-semibold tabular-nums">{formatNumber(value)}</span>
        )}
        <div className="flex items-center gap-2 mt-1">
          {deltaEl}
          {subtitle && <span className={`text-[10px] ${subtitleColor}`}>{subtitle}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function AllStoresAlerts({ data }: { data: FebReportData }) {
  const storesWithSales = data.stores.filter(s => s.totalRevenue > 0);
  const totalLoss = data.stores.reduce((s, st) => s + st.lossProducts.length, 0);
  const totalLossSum = data.stores.reduce(
    (acc, st) =>
      acc +
      st.lossProducts.reduce((a, p: { profit?: number; loss?: number }) => {
        const v = typeof p.loss === 'number' ? p.loss : Math.abs(p.profit ?? 0);
        return a + v;
      }, 0),
    0
  );
  const denom = data.totalDeadSku + data.totalSoldSku;
  const deadPct = denom > 0 ? Math.round((data.totalDeadSku / denom) * 100) : 0;

  const sortedByRent = [...storesWithSales].sort((a, b) => b.avgRentability - a.avgRentability);
  const best = sortedByRent[0];
  const worst = sortedByRent[sortedByRent.length - 1];

  const alerts: { type: 'error' | 'warning' | 'info' | 'success'; title: string; desc: string }[] = [];

  // 1. Убытки
  if (totalLoss > 0) {
    alerts.push({
      type: 'error',
      title: `${formatNumber(totalLoss)} убыточных позиций на ${formatCurrency(totalLossSum)}`,
      desc: 'Продаются ниже себестоимости. См. список на вкладке «Прибыльность».',
    });
  } else if (data.totalProfit > 0) {
    alerts.push({
      type: 'success',
      title: `Все позиции в плюсе`,
      desc: `Чистая прибыль за период: ${formatCurrency(data.totalProfit)} · рентабельность ${formatPercent(data.avgRentability)}.`,
    });
  }

  // 2. Мёртвый ассортимент
  if (deadPct > 30) {
    alerts.push({
      type: 'warning',
      title: `${deadPct}% ассортимента без продаж`,
      desc: `${formatNumber(data.totalDeadSku)} SKU на складах не продавались за этот период. Возможен возврат поставщикам или акция.`,
    });
  } else if (data.totalDeadSku > 0) {
    alerts.push({
      type: 'info',
      title: `${formatNumber(data.totalDeadSku)} SKU без продаж (${deadPct}%)`,
      desc: 'В норме для длинного ассортимента; внимание если растёт.',
    });
  }

  // 3. Излишки (если cost подключён)
  if (data.totalSurplus > 0) {
    alerts.push({
      type: 'info',
      title: `Замороженный капитал: ${formatCurrency(data.totalSurplus)}`,
      desc: 'Стоимость текущих остатков по средней ССБ. Рассмотрите перемещение между точками.',
    });
  }

  // 4. Рейтинг по рентабельности — лидер + аутсайдер
  if (best && worst && best.store !== worst.store) {
    const diff = best.avgRentability - worst.avgRentability;
    if (diff > 2) {
      alerts.push({
        type: 'info',
        title: `${worst.store} — ниже всех по рентабельности (${formatPercent(worst.avgRentability)})`,
        desc: `Лидер: ${best.store} ${formatPercent(best.avgRentability)} · разрыв ${formatPercent(diff)} п.п.`,
      });
    }
  }

  if (alerts.length === 0) return null;
  return <AlertGrid alerts={alerts} />;
}

function StoreAlerts({ store, chainAvgRent }: { store: StoreReport; chainAvgRent: number }) {
  const alerts: { type: 'error' | 'warning' | 'info'; title: string; desc: string }[] = [];

  if (store.lossProducts.length > 0) {
    const worst = store.lossProducts[0];
    alerts.push({
      type: 'error',
      title: `${store.lossProducts.length} убыточных товаров`,
      desc: `Макс. убыток: ${worst.name.substring(0, 35)} (${formatCurrency(worst.profit)})`,
    });
  }

  if (store.avgRentability < chainAvgRent) {
    alerts.push({
      type: 'warning',
      title: `Рентабельность ниже среднего по сети`,
      desc: `${formatPercent(store.avgRentability)} vs ${formatPercent(chainAvgRent)} (среднее)`,
    });
  }

  const deadPct = (store.deadSkuCount / (store.deadSkuCount + store.soldSkuCount)) * 100;
  if (deadPct > 50) {
    alerts.push({
      type: 'warning',
      title: `${deadPct.toFixed(0)}% SKU без продаж`,
      desc: `${formatNumber(store.deadSkuCount)} позиций класса D`,
    });
  }

  if (store.surplusTotal > 1000000) {
    alerts.push({
      type: 'info',
      title: `Излишки: ${formatCurrency(store.surplusTotal)}`,
      desc: 'Рассмотрите перемещение в другие точки.',
    });
  }

  if (alerts.length === 0) return null;
  return <AlertGrid alerts={alerts} />;
}

function AlertGrid({ alerts }: { alerts: { type: 'error' | 'warning' | 'info' | 'success'; title: string; desc: string }[] }) {
  const colors = {
    error: 'border-red-500/30 bg-red-500/5',
    warning: 'border-amber-500/30 bg-amber-500/5',
    info: 'border-blue-500/30 bg-blue-500/5',
    success: 'border-emerald-500/30 bg-emerald-500/5',
  };
  const textColors = {
    error: 'text-red-600 dark:text-red-400',
    warning: 'text-amber-600 dark:text-amber-400',
    info: 'text-blue-600 dark:text-blue-400',
    success: 'text-emerald-600 dark:text-emerald-400',
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {alerts.map((a, i) => (
        <div key={i} className={`rounded-xl px-4 py-3 border ${colors[a.type]}`}>
          <p className={`text-xs font-medium ${textColors[a.type]}`}>{a.title}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{a.desc}</p>
        </div>
      ))}
    </div>
  );
}

function ABCSummaryCard({ store }: { store: StoreReport }) {
  const ABC_COLORS = { A: '#10b981', B: '#f59e0b', C: '#ef4444' };
  const total = store.abc.A.revenue + store.abc.B.revenue + store.abc.C.revenue;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">ABC-структура</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Revenue bar */}
        <div className="flex h-4 rounded-full overflow-hidden mb-4">
          {(['A', 'B', 'C'] as const).map(cls => (
            <div
              key={cls}
              style={{ width: `${(store.abc[cls].revenue / total) * 100}%`, background: ABC_COLORS[cls] }}
              className="h-full"
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {(['A', 'B', 'C'] as const).map(cls => (
            <div key={cls} className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ background: ABC_COLORS[cls] }} />
                <span className="text-xs font-medium">Группа {cls}</span>
              </div>
              <p className="text-lg font-semibold tabular-nums">{store.abc[cls].count}</p>
              <p className="text-[10px] text-muted-foreground">товаров</p>
              <p className="text-xs tabular-nums mt-1">{formatCurrency(store.abc[cls].revenue)}</p>
              <p className="text-[10px] text-muted-foreground">{formatPercent(store.abc[cls].pctRevenue)} выручки</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function XYZSummaryCard({ store }: { store: StoreReport }) {
  const total = store.xyz.X + store.xyz.Y + store.xyz.Z;
  const XYZ_COLORS = { X: '#3b82f6', Y: '#f59e0b', Z: '#ef4444' };
  const XYZ_LABELS = { X: 'Стабильный', Y: 'Сезонный', Z: 'Случайный' };

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">XYZ-структура спроса</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Bar */}
        <div className="flex h-4 rounded-full overflow-hidden mb-4">
          {(['X', 'Y', 'Z'] as const).map(cls => (
            <div
              key={cls}
              style={{ width: `${(store.xyz[cls] / total) * 100}%`, background: XYZ_COLORS[cls] }}
              className="h-full"
            />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-4">
          {(['X', 'Y', 'Z'] as const).map(cls => (
            <div key={cls} className="text-center">
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <div className="w-2 h-2 rounded-full" style={{ background: XYZ_COLORS[cls] }} />
                <span className="text-xs font-medium">{cls} — {XYZ_LABELS[cls]}</span>
              </div>
              <p className="text-lg font-semibold tabular-nums">{store.xyz[cls]}</p>
              <p className="text-[10px] text-muted-foreground">
                {total > 0 ? formatPercent((store.xyz[cls] / total) * 100) : '0%'} товаров
              </p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function LossMakersCard({ store }: { store: StoreReport }) {
  const top5 = store.lossProducts.slice(0, 5);
  return (
    <Card className="border-red-500/20">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm text-red-600 dark:text-red-400">
          Убыточные товары ({store.lossProducts.length})
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <table className="w-full text-sm">
          <tbody>
            {top5.map((p, i) => (
              <tr key={i} className="border-b last:border-b-0">
                <td className="px-4 py-2 max-w-0">
                  <Tooltip>
                    <TooltipTrigger className="text-xs font-medium truncate block cursor-default text-left">
                      {p.name}
                    </TooltipTrigger>
                    <TooltipContent className="text-xs max-w-[280px]">{p.name}</TooltipContent>
                  </Tooltip>
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-xs text-red-600 dark:text-red-400 font-medium">
                  {formatCurrency(p.loss ?? Math.abs(p.profit ?? 0))}
                </td>
                <td className="px-4 py-2 text-right tabular-nums text-xs text-muted-foreground">
                  {formatPercent(p.markup ?? 0)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  );
}

function StoreRankingChart({ data }: { data: FebReportData }) {
  const chartData = data.stores.map((s, i) => ({
    name: s.store,
    revenue: s.totalRevenue,
    profit: s.totalProfit,
    color: STORE_COLORS[i],
  }));

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Выручка по магазинам</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} layout="vertical" margin={{ left: 0, right: 10 }}>
              <XAxis type="number" fontSize={11} tickFormatter={(v) => formatCurrency(v)} stroke="var(--color-muted-foreground)" />
              <YAxis type="category" dataKey="name" fontSize={12} width={80} stroke="var(--color-muted-foreground)" />
              <RTooltip
                content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  const rent = d.revenue > 0 ? (d.profit / d.revenue) * 100 : 0;
                  return (
                    <div className="bg-popover border rounded-lg px-3 py-2 text-xs shadow-lg space-y-0.5">
                      <p className="font-medium pb-0.5 border-b mb-1">{d.name}</p>
                      <p>Выручка: <span className="tabular-nums font-medium">{formatCurrency(d.revenue)}</span></p>
                      <p>Прибыль: <span className="tabular-nums font-medium">{formatCurrency(d.profit)}</span></p>
                      <p>Рентабельность: <span className="tabular-nums font-medium">{formatPercent(rent)}</span></p>
                    </div>
                  );
                }}
              />
              <Bar dataKey="revenue" radius={[0, 4, 4, 0]} barSize={18}>
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

function TopProductsByProfit({ products, title }: { products: FebProduct[]; title: string }) {
  const top10 = useMemo(() =>
    [...products].sort((a, b) => b.profit - a.profit).slice(0, 10),
    [products]
  );

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm table-fixed">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-2 text-left font-medium text-muted-foreground text-xs w-[50%]">Товар</th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs w-[16%]"><MetricInfo metric="profit">Прибыль</MetricInfo></th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs w-[12%]"><MetricInfo metric="rentability">Рент.</MetricInfo></th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs w-[12%]"><MetricInfo metric="markup">Наценка</MetricInfo></th>
                <th className="px-4 py-2 text-right font-medium text-muted-foreground text-xs w-[10%]"><MetricInfo metric="soldQty">Шт</MetricInfo></th>
              </tr>
            </thead>
            <tbody>
              {top10.map((p, i) => (
                <tr key={i} className="border-b last:border-b-0 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                  <td className="px-4 py-2.5 overflow-hidden">
                    <div className="flex items-start gap-2">
                      <span className="text-muted-foreground/40 text-xs tabular-nums w-4 shrink-0 mt-0.5">{i + 1}</span>
                      <div className="min-w-0 flex-1">
                        <Tooltip>
                          <TooltipTrigger className="text-left font-medium truncate block cursor-default text-xs w-full">
                            {p.name}
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-[280px]">
                            <p className="font-medium">{p.name}</p>
                            <p className="text-muted-foreground mt-1">{p.store}</p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs font-medium text-emerald-600 dark:text-emerald-400">
                    {formatCurrency(p.profit)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    {formatPercent(p.rentability)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    {formatPercent(p.markup)}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">
                    {formatNumber(p.soldQty)}
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

function StoreScoreboard({ data, compareData }: { data: FebReportData; compareData: FebReportData | null }) {
  const chainAvgRent = data.avgRentability;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-sm">Scoreboard магазинов</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Магазин</th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="revenue">Выручка</MetricInfo></th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="profit">Прибыль</MetricInfo></th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="rentability">Рент.</MetricInfo></th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="avgCheck">Ср. чек</MetricInfo></th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="medianCheck">Мед. чек</MetricInfo></th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="soldSkuCount">SKU</MetricInfo></th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="deadSkuCount">Без продаж</MetricInfo></th>
                <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs">Убыточных</th>
              </tr>
            </thead>
            <tbody>
              {data.stores.map((s, i) => {
                const prev = compareData?.stores.find(ps => ps.store === s.store);

                const avgCheck: number = s.avgCheck ?? 0;

                const medianCheck: number = s.medianCheck ?? 0;

                const prevAvgCheck: number | undefined = prev?.avgCheck;

                const prevMedianCheck: number | undefined = prev?.medianCheck;
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
                  <td className="px-4 py-3 text-right">
                    <div className="tabular-nums">{formatCurrency(s.totalProfit)}</div>
                    <DeltaBadge value={s.totalProfit} prev={prev?.totalProfit} />
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={s.avgRentability >= chainAvgRent ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}>
                      {formatPercent(s.avgRentability)}
                    </span>
                    {prev && <div><DeltaBadge value={s.avgRentability} prev={prev.avgRentability} abs /></div>}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <div>{formatCurrency(avgCheck)}</div>
                    {prevAvgCheck !== undefined && <DeltaBadge value={avgCheck} prev={prevAvgCheck} />}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <div>{formatCurrency(medianCheck)}</div>
                    {prevMedianCheck !== undefined && <DeltaBadge value={medianCheck} prev={prevMedianCheck} />}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(s.soldSkuCount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-amber-600 dark:text-amber-400">{formatNumber(s.deadSkuCount)}</td>
                  <td className="px-4 py-3 text-right tabular-nums text-red-600 dark:text-red-400">{s.lossProducts.length}</td>
                </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}
