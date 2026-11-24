/**
 * Типы дашборд-агрегата (legacy название — раньше парсилось из Excel,
 * сейчас приходит из FastAPI `/api/data?from=&to=`).
 *
 * Имя файла сохранено для обратной совместимости импортов
 * (`from '@/lib/parse-february'`). Реальная сборка данных — в
 * `api/routers/data.py`, формат описан там.
 */
import type { MonthKey } from './months';

export type { MonthKey };

export interface FebProduct {
  name: string;
  supplier: string;
  abcClass: 'A' | 'B' | 'C' | 'D';
  abcDeals: string;
  xyzClass: 'X' | 'Y' | 'Z' | 'ZZ';
  price: number;
  soldQty: number;
  revenue: number;
  cost: number;
  profit: number;
  rentability: number;
  markup: number;
  daysInStock: number | null;
  speed: number | null;
  daysSupply: number | null;
  freeStock: number | null;
  surplusSum: number | null;
  store: string;
}

export interface GroupStats {
  count: number;
  revenue: number;
  profit: number;
  pctRevenue: number;
  pctSku: number;
}

export interface StoreReport {
  store: string;
  city: string;
  products: FebProduct[];
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalQty: number;
  avgRentability: number;
  avgMarkup: number;
  /** Средний чек за период. Приходит из FastAPI. */
  avgCheck?: number;
  /** Медианный чек за период. */
  medianCheck?: number;
  /** Количество чеков за период. */
  receiptCount?: number;
  soldSkuCount: number;
  deadSkuCount: number;
  surplusTotal: number;
  lossProducts: {
    name: string;
    profit?: number;
    loss?: number;
    revenue?: number;
    cost?: number;
    markup?: number;
  }[];
  abc: { A: GroupStats; B: GroupStats; C: GroupStats };
  xyz: { X: number; Y: number; Z: number };
}

export interface FebReportData {
  period: string;
  /** YYYY-MM-DD. Приходит из FastAPI вместе с period. */
  from?: string;
  to?: string;
  stores: StoreReport[];
  allProducts: FebProduct[];
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalQty: number;
  avgRentability: number;
  avgMarkup: number;
  totalSurplus: number;
  totalDeadSku: number;
  totalSoldSku: number;
}
