'use client';

import { useMemo, useState, useEffect } from 'react';
import { useData, getProductsForStore } from '@/lib/data-context';
import { StoreFilterTabs } from '@/components/store-filter-tabs';
import { formatCurrency, formatNumber, formatPercent } from '@/lib/format';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MetricInfo } from '@/components/dashboard/metric-info';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Search, ArrowDownWideNarrow, ArrowUpWideNarrow } from 'lucide-react';
import { abcBadgeClass } from '@/lib/abc-colors';
import { TablePagination } from '@/components/dashboard/table-pagination';

type SortField = 'revenue' | 'profit' | 'markup' | 'soldQty';
type SortDir = 'asc' | 'desc';

export default function ProductsPage() {
  const { data, loading } = useData();
  const [selectedStore, setSelectedStore] = useState('all');
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<SortField>('revenue');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(50);
  const [filterAbc, setFilterAbc] = useState<string>('all');
  const [filterXyz, setFilterXyz] = useState<string>('all');

  const products = useMemo(() => {
    if (!data) return [];
    return getProductsForStore(data, selectedStore);
  }, [data, selectedStore]);

  const filtered = useMemo(() => {
    let result = products;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q));
    }
    if (filterAbc !== 'all') result = result.filter(p => p.abcClass === filterAbc);
    if (filterXyz !== 'all') result = result.filter(p => p.xyzClass === filterXyz);
    result = [...result].sort((a, b) => {
      const mul = sortDir === 'desc' ? -1 : 1;
      return mul * (a[sortField] - b[sortField]);
    });
    return result;
  }, [products, search, sortField, sortDir, filterAbc, filterXyz]);

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortField(field);
      setSortDir('desc');
    }
  };

  // Сбрасываем страницу при смене фильтров / поиска / сортировки
  useEffect(() => { setPage(0); }, [search, sortField, sortDir, filterAbc, filterXyz, selectedStore]);

  if (!data) return <div className="flex items-center justify-center h-64 text-muted-foreground">Нет данных</div>;

  const SortIcon = sortDir === 'desc' ? ArrowDownWideNarrow : ArrowUpWideNarrow;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Товары</h1>
        <p className="text-sm text-muted-foreground">{data.period} · {formatNumber(products.length)} товаров{selectedStore !== 'all' ? ` · ${selectedStore}` : ''}</p>
      </div>

      <div className="mb-4"><StoreFilterTabs selected={selectedStore} onSelect={setSelectedStore} /></div>

      {/* Search & Sort Controls */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск по названию..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(0); }}
            className="pl-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Сортировка:</span>
          {([
            { field: 'revenue' as SortField, label: 'Выручка' },
            { field: 'profit' as SortField, label: 'Прибыль' },
            { field: 'markup' as SortField, label: 'Наценка' },
            { field: 'soldQty' as SortField, label: 'Кол-во' },
          ]).map(({ field, label }) => (
            <button
              key={field}
              onClick={() => toggleSort(field)}
              className={`group/sort inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs transition-colors ${
                sortField === field
                  ? 'bg-foreground/10 text-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground hover:bg-black/5 dark:hover:bg-white/[0.06]'
              }`}
            >
              {label}
              {sortField === field && <SortIcon className="w-3.5 h-3.5" />}
            </button>
          ))}
        </div>
      </div>

      {/* ABC / XYZ Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">ABC:</span>
          {['all', 'A', 'B', 'C'].map(v => (
            <button
              key={v}
              onClick={() => { setFilterAbc(v); setPage(0); }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterAbc === v
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {v === 'all' ? 'Все' : v}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">XYZ:</span>
          {['all', 'X', 'Y', 'Z'].map(v => (
            <button
              key={v}
              onClick={() => { setFilterXyz(v); setPage(0); }}
              className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors ${
                filterXyz === v
                  ? 'bg-foreground text-background'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted'
              }`}
            >
              {v === 'all' ? 'Все' : v}
            </button>
          ))}
        </div>
        {(filterAbc !== 'all' || filterXyz !== 'all') && (
          <button
            onClick={() => { setFilterAbc('all'); setFilterXyz('all'); }}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Сбросить
          </button>
        )}
      </div>

      {/* Results count */}
      <p className="text-xs text-muted-foreground">
        {filtered.length !== products.length
          ? `Найдено: ${formatNumber(filtered.length)} из ${formatNumber(products.length)} товаров`
          : `${formatNumber(products.length)} товаров`
        }
      </p>

      {/* Products Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" style={{ tableLayout: 'fixed', minWidth: '1000px' }}>
              <thead>
                <tr className="border-b">
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground text-xs" style={{ width: '36px' }}>#</th>
                  <th className="px-3 py-3 text-left font-medium text-muted-foreground text-xs" style={{ width: selectedStore === 'all' ? '22%' : '30%' }}>Товар</th>
                  {selectedStore === 'all' && <th className="px-3 py-3 text-left font-medium text-muted-foreground text-xs" style={{ width: '8%' }}>Магазин</th>}
                  <th className="px-2 py-3 text-center font-medium text-muted-foreground text-xs" style={{ width: '44px' }}><MetricInfo metric="abcClass">ABC</MetricInfo></th>
                  <th className="px-2 py-3 text-center font-medium text-muted-foreground text-xs" style={{ width: '44px' }}><MetricInfo metric="xyzClass">XYZ</MetricInfo></th>
                  <th className="px-3 py-3 text-right font-medium text-muted-foreground text-xs" style={{ width: '7%' }}>Цена</th>
                  <th className="px-3 py-3 text-right font-medium text-muted-foreground text-xs" style={{ width: '6%' }}>
                    <button className="group/sort inline-flex items-center gap-1" onClick={() => toggleSort('soldQty')}>
                      Шт{sortField === 'soldQty' && <SortIcon className="w-3.5 h-3.5" />}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-right font-medium text-muted-foreground text-xs" style={{ width: '9%' }}>
                    <button className="group/sort inline-flex items-center gap-1" onClick={() => toggleSort('revenue')}>
                      Выручка{sortField === 'revenue' && <SortIcon className="w-3.5 h-3.5" />}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-right font-medium text-muted-foreground text-xs" style={{ width: '9%' }}><MetricInfo metric="cost">Себест.</MetricInfo></th>
                  <th className="px-3 py-3 text-right font-medium text-muted-foreground text-xs" style={{ width: '9%' }}>
                    <button className="group/sort inline-flex items-center gap-1" onClick={() => toggleSort('profit')}>
                      Прибыль{sortField === 'profit' && <SortIcon className="w-3.5 h-3.5" />}
                    </button>
                  </th>
                  <th className="px-3 py-3 text-right font-medium text-muted-foreground text-xs" style={{ width: '6%' }}><MetricInfo metric="rentability">Рент.</MetricInfo></th>
                  <th className="px-3 py-3 text-right font-medium text-muted-foreground text-xs" style={{ width: '7%' }}>
                    <button className="group/sort inline-flex items-center gap-1" onClick={() => toggleSort('markup')}>
                      Нац.{sortField === 'markup' && <SortIcon className="w-3.5 h-3.5" />}
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.slice(page * pageSize, (page + 1) * pageSize).map((p, i) => (
                  <tr key={`${p.name}-${p.store}-${page}-${i}`} className="border-b last:border-b-0 hover:bg-black/[0.03] dark:hover:bg-white/[0.04]">
                    <td className="px-3 py-2.5 text-muted-foreground/40 text-xs tabular-nums">{page * pageSize + i + 1}</td>
                    <td className="px-3 py-2.5 overflow-hidden">
                      <Tooltip>
                        <TooltipTrigger className="text-left text-xs font-medium truncate block cursor-default w-full">
                          {p.name}
                        </TooltipTrigger>
                        <TooltipContent side="top" className="text-xs max-w-[320px]">
                          <p className="font-medium leading-snug">{p.name}</p>
                          <p className="text-muted-foreground mt-1">{p.store} · {p.supplier || 'Без поставщика'}</p>
                          <p className="text-muted-foreground">ABC: {p.abcClass} · XYZ: {p.xyzClass} · Цена: {formatCurrency(p.price)}</p>
                        </TooltipContent>
                      </Tooltip>
                    </td>
                    {selectedStore === 'all' && (
                      <td className="px-3 py-2.5 overflow-hidden">
                        <span className="text-[10px] text-muted-foreground truncate block">{p.store}</span>
                      </td>
                    )}
                    <td className="px-2 py-2.5 text-center">
                      <Badge className={`text-[10px] ${abcBadgeClass(p.abcClass)}`}>{p.abcClass}</Badge>
                    </td>
                    <td className="px-2 py-2.5 text-center">
                      <Badge
                        variant={p.xyzClass === 'X' ? 'default' : 'outline'}
                        className="text-[10px]"
                      >{p.xyzClass}</Badge>
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{formatCurrency(p.price)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{formatNumber(p.soldQty)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs">{formatCurrency(p.revenue)}</td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{formatCurrency(p.cost)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums text-xs font-medium ${p.profit < 0 ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      {formatCurrency(p.profit)}
                    </td>
                    <td className="px-3 py-2.5 text-right tabular-nums text-xs text-muted-foreground">{formatPercent(p.rentability)}</td>
                    <td className={`px-3 py-2.5 text-right tabular-nums text-xs ${p.markup < 0 ? 'text-red-600 dark:text-red-400' : 'text-muted-foreground'}`}>
                      {formatPercent(p.markup)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <TablePagination
            page={page}
            setPage={setPage}
            total={filtered.length}
            pageSize={pageSize}
            setPageSize={setPageSize}
          />
          {filtered.length === 0 && (
            <div className="px-4 py-8 text-center text-sm text-muted-foreground">
              {search.trim() ? 'Товары не найдены' : 'Нет данных'}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
