export function formatNumber(num: number | undefined | null): string {
  if (num === undefined || num === null) return '—';
  return new Intl.NumberFormat('ru-RU').format(Math.round(num));
}

export function formatCurrency(num: number | undefined | null): string {
  if (num === undefined || num === null) return '—';
  if (num >= 1_000_000_000) return `${(num / 1_000_000_000).toFixed(1)} млрд ₸`;
  if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)} млн ₸`;
  if (num >= 1_000) return `${(num / 1_000).toFixed(0)} тыс ₸`;
  return `${num.toFixed(0)} ₸`;
}

export function formatCurrencyParts(num: number | undefined | null): { value: string; unit: string } {
  if (num === undefined || num === null) return { value: '—', unit: '' };
  if (num >= 1_000_000_000) return { value: (num / 1_000_000_000).toFixed(1), unit: 'млрд ₸' };
  if (num >= 1_000_000) return { value: (num / 1_000_000).toFixed(1), unit: 'млн ₸' };
  if (num >= 1_000) return { value: (num / 1_000).toFixed(0), unit: 'тыс ₸' };
  return { value: num.toFixed(0), unit: '₸' };
}

export function formatPercent(num: number, decimals: number = 1): string {
  return `${num.toFixed(decimals)}%`;
}
