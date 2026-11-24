'use client';

import { useData } from '@/lib/data-context';
import { RouteLoader } from '@/components/dashboard/route-loader';

/**
 * Глобальный лоадер для смены диапазона/периода — пока DataProvider тянет
 * новые агрегаты с FastAPI, поверх контента висит overlay со спиннером.
 *
 * Отдельно от NavigationLoader (тот срабатывает только на переходы между
 * URL-маршрутами и не знает про in-flight fetch внутри страницы).
 */
export function DataLoaderOverlay() {
  const { loading } = useData();
  return <RouteLoader active={loading} label="Обновляем данные" />;
}
