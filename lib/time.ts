/**
 * Все человекочитаемые времена в дашборде — по Asia/Almaty (UTC+5).
 * Используем date-fns-tz, чтобы НЕ зависеть от TZ браузера пользователя.
 */
import { formatInTimeZone } from 'date-fns-tz';
import { ru } from 'date-fns/locale';
import { formatDistanceToNow as _formatDistanceToNow } from 'date-fns';

export const APP_TZ = 'Asia/Almaty';

/** "12 мая 2026, 14:58:46" */
export function fmtFull(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  return formatInTimeZone(new Date(dateStr), APP_TZ, 'd MMM yyyy, HH:mm:ss', { locale: ru });
}

/** "12.05 14:58:46" — компактный */
export function fmtCompact(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  return formatInTimeZone(new Date(dateStr), APP_TZ, 'dd.MM HH:mm:ss', { locale: ru });
}

/** "12.05.26 14:58" */
export function fmtShort(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  return formatInTimeZone(new Date(dateStr), APP_TZ, 'dd.MM.yy HH:mm', { locale: ru });
}

/** "12 мая" */
export function fmtDate(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  return formatInTimeZone(new Date(dateStr), APP_TZ, 'd MMM yyyy', { locale: ru });
}

/** "14:58" */
export function fmtTime(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  return formatInTimeZone(new Date(dateStr), APP_TZ, 'HH:mm', { locale: ru });
}

/** "5 минут назад" — относительное, TZ-агностично */
export function fmtRelative(dateStr: string | Date | null | undefined): string {
  if (!dateStr) return '—';
  return _formatDistanceToNow(new Date(dateStr), { addSuffix: true, locale: ru });
}
