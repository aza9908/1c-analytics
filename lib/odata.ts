/**
 * Live dashboard types + store colors.
 *
 * Раньше этот файл сам ходил в 1C OData из браузера. Теперь данные приходят
 * из FastAPI (`/live/dashboard`), через Next.js route-handler `/api/live`.
 * Здесь оставлены только публичные типы и палитра, которыми пользуется UI.
 */

/** Палитра дашбордов — та же, что используется по индексу на других страницах. */
export const STORE_PALETTE = [
  '#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#f43f5e', '#06b6d4', '#ec4899',
];

/**
 * Фиксированные цвета точек: `{ '<имя склада>': '#hex' }`.
 *
 * Пусто по умолчанию — состав точек зависит от базы 1С. Заполните, если хотите
 * закрепить цвет за конкретным магазином; иначе UI берёт цвет из
 * `STORE_PALETTE` или подставляет серый.
 */
export const STORE_COLORS: Record<string, string> = {};

export interface Receipt {
  date: string;
  store: string;
  storeGuid: string;
  amount: number;
  items: { productGuid: string; qty: number; sum: number }[];
}

export interface HourlyByStore {
  hour: number;
  total: number;
  totalQty: number;
  totalCount: number;
  stores: Record<string, number>;
}

export interface StoreLiveSummary {
  store: string;
  city: string;
  color: string;
  revenue: number;
  qty: number;
  count: number;
  avgCheck: number;
}

export interface LiveDashboardData {
  fetchedAt: string;
  dateLabel: string;
  isToday: boolean;
  totalRevenue: number;
  totalQty: number;
  totalReceipts: number;
  avgCheck: number;
  hourly: HourlyByStore[];
  byStore: StoreLiveSummary[];
  topProducts: { name: string; store: string; qty: number; revenue: number }[];
  prevDayRevenue: number | null;
  storeNames: string[];
}
