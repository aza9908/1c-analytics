'use client';

import { createContext, useContext, useState, useEffect, useCallback, ReactNode, useMemo } from 'react';
import { format, subDays, addDays, startOfMonth, endOfMonth, differenceInCalendarDays } from 'date-fns';
import type { DateRange } from 'react-day-picker';
import type { FebReportData } from './parse-february';

export interface MonthPreset {
  month: string;
  from: string;
  label: string;
}

interface AvailableRange {
  minDate: Date;
  maxDate: Date;
  months: MonthPreset[];
}

interface DataContextType {
  data: FebReportData | null;
  compareData: FebReportData | null;
  loading: boolean;
  range: DateRange;
  setRange: (r: DateRange) => void;
  available: AvailableRange | null;
}

const FALLBACK_RANGE: AvailableRange = {
  minDate: new Date('2026-02-05'),
  maxDate: new Date(),
  months: [],
};

const DataContext = createContext<DataContextType>({
  data: null,
  compareData: null,
  loading: true,
  range: { from: undefined, to: undefined },
  setRange: () => {},
  available: null,
});

function ymd(d: Date | undefined): string {
  return d ? format(d, 'yyyy-MM-dd') : '';
}

export function DataProvider({ children }: { children: ReactNode }) {
  const [available, setAvailable] = useState<AvailableRange | null>(null);
  const [range, setRangeState] = useState<DateRange>({ from: undefined, to: undefined });
  const [data, setData] = useState<FebReportData | null>(null);
  const [compareData, setCompareData] = useState<FebReportData | null>(null);
  const [loading, setLoading] = useState(true);

  // 1) Подтягиваем min/max + список месяцев из API
  useEffect(() => {
    fetch('/api/available-range')
      .then(r => r.json())
      .then((d) => {
        const min = d.minDate ? new Date(d.minDate) : FALLBACK_RANGE.minDate;
        const max = d.maxDate ? new Date(d.maxDate) : FALLBACK_RANGE.maxDate;
        setAvailable({ minDate: min, maxDate: max, months: d.months || [] });
        // По умолчанию — последние 30 дней
        setRangeState({ from: subDays(max, 29), to: max });
      })
      .catch(() => {
        setAvailable(FALLBACK_RANGE);
        setRangeState({ from: subDays(FALLBACK_RANGE.maxDate, 29), to: FALLBACK_RANGE.maxDate });
      });
  }, []);

  // 2) При смене range — фетчим main + compare (тот же длиной период перед main)
  const fetchData = useCallback((r: DateRange) => {
    if (!r.from || !r.to) return;
    setLoading(true);
    const days = differenceInCalendarDays(r.to, r.from) + 1;
    const prevTo = subDays(r.from, 1);
    const prevFrom = subDays(prevTo, days - 1);

    const main = fetch(`/api/data?from=${ymd(r.from)}&to=${ymd(r.to)}`).then(x => x.json());
    const cmp = (available && prevFrom >= available.minDate)
      ? fetch(`/api/data?from=${ymd(prevFrom)}&to=${ymd(prevTo)}`).then(x => x.json())
      : Promise.resolve(null);

    Promise.all([main, cmp])
      .then(([m, c]) => {
        setData(m);
        setCompareData(c);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [available]);

  useEffect(() => {
    if (range.from && range.to) fetchData(range);
  }, [range, fetchData]);

  const setRange = useCallback((r: DateRange) => setRangeState(r), []);

  const value = useMemo(() => ({
    data, compareData, loading, range, setRange, available,
  }), [data, compareData, loading, range, setRange, available]);

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
}

export function useData() {
  return useContext(DataContext);
}

export function getProductsForStore(data: FebReportData, store: string) {
  if (store === 'all') return data.allProducts;
  return data.allProducts.filter(p => p.store === store);
}
