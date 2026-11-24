'use client';

import React, { useMemo, useState, useId } from 'react';
import { useData, getProductsForStore } from '@/lib/data-context';
import { StoreFilterTabs } from '@/components/store-filter-tabs';
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
  AreaChart, Area, XAxis, YAxis, ResponsiveContainer, Tooltip as RTooltip,
  CartesianGrid, ReferenceLine,
} from 'recharts';
import { Info } from 'lucide-react';
import { abcBadgeClass } from '@/lib/abc-colors';
import { TablePagination } from '@/components/dashboard/table-pagination';

const ABC_LABELS = ['A', 'B', 'C'] as const;
const XYZ_LABELS = ['X', 'Y', 'Z'] as const;

const MATRIX: Record<string, { action: string; emoji: string; color: string; priority: 'high' | 'medium' | 'low' }> = {
  AX: { action: 'Авто-пополнение. Всегда в наличии.', emoji: '🟢', color: 'bg-emerald-500/20 border-emerald-500/30', priority: 'high' },
  AY: { action: 'Сезонный буфер. Следить за остатками.', emoji: '🟢', color: 'bg-emerald-500/10 border-emerald-500/20', priority: 'high' },
  AZ: { action: 'Большая выручка, но спрос скачет. Анализировать причину.', emoji: '🟡', color: 'bg-amber-500/15 border-amber-500/25', priority: 'high' },
  BX: { action: 'Стабильная середина. Стандартное пополнение.', emoji: '🟡', color: 'bg-amber-500/15 border-amber-500/25', priority: 'medium' },
  BY: { action: 'Мониторить. Может перейти в A или C.', emoji: '🟡', color: 'bg-amber-500/10 border-amber-500/20', priority: 'medium' },
  BZ: { action: 'Нестабильный спрос. Пересмотреть закупку.', emoji: '🟡', color: 'bg-amber-500/10 border-amber-500/15', priority: 'medium' },
  CX: { action: 'Мало выручки, но стабильный спрос. Минимум на полке.', emoji: '⚪', color: 'bg-muted/50 border-border', priority: 'low' },
  CY: { action: 'Мало денег + сезонность. Сократить.', emoji: '🔴', color: 'bg-red-500/10 border-red-500/20', priority: 'low' },
  CZ: { action: 'Не продаётся и непредсказуем. Вывести из ассортимента.', emoji: '🔴', color: 'bg-red-500/20 border-red-500/30', priority: 'low' },
};

export default function AbcXyzPage() {
  const { data, loading } = useData();
  const [selectedStore, setSelectedStore] = useState('all');
  const [activeCell, setActiveCell] = useState<string | null>(null);
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const gradientId = useId();

  const products = useMemo(() => {
    if (!data) return [];
    return getProductsForStore(data, selectedStore);
  }, [data, selectedStore]);

  const matrix = useMemo(() => {
    const cells: Record<string, { count: number; revenue: number; profit: number }> = {};
    for (const abc of ABC_LABELS) {
      for (const xyz of XYZ_LABELS) {
        cells[`${abc}${xyz}`] = { count: 0, revenue: 0, profit: 0 };
      }
    }
    for (const p of products) {
      const key = `${p.abcClass}${p.xyzClass}`;
      if (cells[key]) {
        cells[key].count++;
        cells[key].revenue += p.revenue;
        cells[key].profit += p.profit;
      }
    }
    return cells;
  }, [products]);

  const paretoData = useMemo(() => {
    const sorted = [...products].sort((a, b) => b.revenue - a.revenue);
    const totalRev = sorted.reduce((s, p) => s + p.revenue, 0);
    let cumulative = 0;
    return sorted.map((p, i) => {
      cumulative += p.revenue;
      return { idx: i + 1, name: p.name, revenue: p.revenue, pct: totalRev > 0 ? (cumulative / totalRev) * 100 : 0 };
    });
  }, [products]);

  const filteredProducts = useMemo(() => {
    if (!activeCell) return [...products].sort((a, b) => b.revenue - a.revenue);
    return products
      .filter(p => `${p.abcClass}${p.xyzClass}` === activeCell)
      .sort((a, b) => b.revenue - a.revenue);
  }, [products, activeCell]);

  // Сбрасываем страницу при смене фильтра
  React.useEffect(() => { setPage(0); }, [activeCell, selectedStore]);

  const pageRows = useMemo(
    () => filteredProducts.slice(page * pageSize, (page + 1) * pageSize),
    [filteredProducts, page, pageSize]
  );

  if (!data) return <div className="flex items-center justify-center h-64 text-muted-foreground">Нет данных</div>;

  const a80idx = paretoData.findIndex(d => d.pct >= 80);
  const b95idx = paretoData.findIndex(d => d.pct >= 95);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">ABC / XYZ Анализ</h1>
        <p className="text-sm text-muted-foreground">{data.period} · {formatNumber(products.length)} товаров</p>
      </div>

      <StoreFilterTabs selected={selectedStore} onSelect={(s) => { setSelectedStore(s); setActiveCell(null); }} />

      {/* Explainer banner */}
      <div className="rounded-xl border bg-muted/30 px-5 py-4">
        <div className="flex items-start gap-3">
          <Info className="h-4 w-4 text-blue-500 shrink-0 mt-0.5" />
          <div className="space-y-2 text-xs text-muted-foreground leading-relaxed">
            <div>
              <span className="font-medium text-foreground">ABC</span> — классификация по <span className="font-medium text-foreground">выручке</span>.{' '}
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">A</span> = топ-товары (80% выручки),{' '}
              <span className="text-amber-600 dark:text-amber-400 font-medium">B</span> = середина (15%),{' '}
              <span className="text-red-600 dark:text-red-400 font-medium">C</span> = хвост (5%).
            </div>
            <div>
              <span className="font-medium text-foreground">XYZ</span> — классификация по <span className="font-medium text-foreground">стабильности спроса</span>.{' '}
              <span className="font-medium">X</span> = стабильный (покупают регулярно),{' '}
              <span className="font-medium">Y</span> = сезонный (волнами),{' '}
              <span className="font-medium">Z</span> = случайный (непредсказуемо).
            </div>
            <div>
              Вместе они образуют <span className="font-medium text-foreground">матрицу 9 ячеек</span> — нажмите на ячейку, чтобы увидеть товары.
            </div>
          </div>
        </div>
      </div>

      {/* Matrix */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">Матрица ABC / XYZ</CardTitle>
            {activeCell && (
              <button onClick={() => setActiveCell(null)} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                Сбросить фильтр
              </button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {/* Column headers */}
          <div className="grid grid-cols-[60px_1fr_1fr_1fr] gap-2 mb-2">
            <div />
            <div className="text-center text-xs font-medium text-muted-foreground">X — Стабильный</div>
            <div className="text-center text-xs font-medium text-muted-foreground">Y — Сезонный</div>
            <div className="text-center text-xs font-medium text-muted-foreground">Z — Случайный</div>
          </div>

          {/* Matrix rows */}
          {ABC_LABELS.map(abc => {
            const abcLabel = abc === 'A' ? 'A — 80% выр.' : abc === 'B' ? 'B — 15% выр.' : 'C — 5% выр.';
            return (
              <div key={abc} className="grid grid-cols-[60px_1fr_1fr_1fr] gap-2 mb-2">
                <div className="flex items-center justify-center">
                  <span className="text-xs font-medium text-muted-foreground writing-mode-vertical [writing-mode:vertical-lr] rotate-180 whitespace-nowrap">
                    {abcLabel}
                  </span>
                </div>
                {XYZ_LABELS.map(xyz => {
                  const key = `${abc}${xyz}`;
                  const cell = matrix[key];
                  const meta = MATRIX[key];
                  const isActive = activeCell === key;

                  return (
                    <button
                      key={xyz}
                      onClick={() => setActiveCell(isActive ? null : key)}
                      className={`rounded-xl p-3 border text-left transition-all ${meta.color} ${
                        isActive ? 'ring-2 ring-foreground/30 scale-[1.02]' : 'hover:scale-[1.01]'
                      } ${cell.count === 0 ? 'opacity-40' : ''}`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-bold">{key}</span>
                        <span className="text-[10px] tabular-nums text-muted-foreground">{cell.count} SKU</span>
                      </div>
                      <p className="text-xs tabular-nums font-medium mb-1">{formatCurrency(cell.revenue)}</p>
                      <p className="text-[10px] text-muted-foreground leading-snug">{meta.action}</p>
                    </button>
                  );
                })}
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Pareto Curve */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Кривая Парето</CardTitle>
          <p className="text-[11px] text-muted-foreground">Кумулятивная доля товаров в общей выручке</p>
        </CardHeader>
        <CardContent>
          <div className="h-[250px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={paretoData} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#10b981" stopOpacity={0.15} />
                    <stop offset="100%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="idx" fontSize={11} stroke="var(--color-muted-foreground)" />
                <YAxis fontSize={11} tickFormatter={(v) => `${v}%`} domain={[0, 100]} width={42} stroke="var(--color-muted-foreground)" />
                <ReferenceLine y={80} stroke="#f59e0b" strokeDasharray="4 4" />
                <ReferenceLine y={95} stroke="#ef4444" strokeDasharray="4 4" />
                <RTooltip content={({ active, payload }) => {
                  if (!active || !payload?.[0]) return null;
                  const d = payload[0].payload;
                  return (
                    <div className="bg-popover border rounded-lg px-3 py-2 text-xs shadow-lg max-w-[250px]">
                      <p className="font-medium truncate">{d.name}</p>
                      <p>Позиция #{d.idx} из {products.length}</p>
                      <p>Кумулятивно: {d.pct.toFixed(1)}%</p>
                    </div>
                  );
                }} />
                <Area type="monotone" dataKey="pct" stroke="#10b981" fill={`url(#${gradientId})`} strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="mt-3 space-y-1 text-[11px] text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 bg-emerald-500 shrink-0" />
              <span>Кумулятивная выручка от лучших к худшим</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 border-t border-dashed border-amber-500 shrink-0" />
              <span><span className="text-amber-500 font-medium">80%</span> — граница A/B ({a80idx >= 0 ? a80idx + 1 : '?'} товаров)</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-0.5 border-t border-dashed border-red-500 shrink-0" />
              <span><span className="text-red-500 font-medium">95%</span> — граница B/C ({b95idx >= 0 ? b95idx + 1 : '?'} товаров)</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Products table */}
      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm">
              {activeCell ? `Товары группы ${activeCell}` : 'Все товары'}
              <span className="ml-2 text-muted-foreground font-normal text-xs">({formatNumber(filteredProducts.length)})</span>
            </CardTitle>
            {activeCell && (
              <div className="flex items-center gap-2">
                <Badge className={`${MATRIX[activeCell].color} border text-[10px]`}>{activeCell}</Badge>
                <span className="text-[10px] text-muted-foreground">{MATRIX[activeCell].action}</span>
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Товар</th>
                  {selectedStore === 'all' && <th className="px-4 py-3 text-left font-medium text-muted-foreground text-xs">Магазин</th>}
                  <th className="px-4 py-3 text-center font-medium text-muted-foreground text-xs"><MetricInfo metric="abcClass">Класс</MetricInfo></th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="revenue">Выручка</MetricInfo></th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="profit">Прибыль</MetricInfo></th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="rentability">Рент.</MetricInfo></th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="markup">Наценка</MetricInfo></th>
                  <th className="px-4 py-3 text-right font-medium text-muted-foreground text-xs"><MetricInfo metric="soldQty">Шт</MetricInfo></th>
                </tr>
              </thead>
              <tbody>
                {pageRows.map((p, i) => (
                  <tr key={`${p.name}-${p.store}-${i}`} className="border-b last:border-b-0 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                    <td className="px-4 py-2.5 max-w-0">
                      <div className="flex items-start gap-2">
                        <span className="text-muted-foreground/40 text-xs tabular-nums w-6 shrink-0 mt-0.5">{page * pageSize + i + 1}</span>
                        <Tooltip>
                          <TooltipTrigger className="text-left text-xs font-medium truncate block cursor-default">
                            {p.name}
                          </TooltipTrigger>
                          <TooltipContent side="top" className="text-xs max-w-[280px]">
                            <p className="font-medium">{p.name}</p>
                            <p className="text-muted-foreground mt-1">{p.store} · {p.abcClass}{p.xyzClass}</p>
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
                      <Badge className={`text-[10px] font-mono ${abcBadgeClass(p.abcClass)}`}>{p.abcClass}{p.xyzClass}</Badge>
                    </td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs">{formatCurrency(p.revenue)}</td>
                    <td className={`px-4 py-2.5 text-right tabular-nums text-xs ${p.profit < 0 ? 'text-red-600 dark:text-red-400' : ''}`}>
                      {formatCurrency(p.profit)}
                    </td>
                    <td className={`px-4 py-2.5 text-right tabular-nums text-xs ${p.rentability < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>{formatPercent(p.rentability)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{formatPercent(p.markup)}</td>
                    <td className="px-4 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{formatNumber(p.soldQty)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={page}
            setPage={setPage}
            total={filteredProducts.length}
            pageSize={pageSize}
            setPageSize={setPageSize}
          />
        </CardContent>
      </Card>
    </div>
  );
}
