/** Compact delta indicator: ▲ +93.5% or ▼ -2.1п.п. */
export function DeltaBadge({ value, prev, abs, invert }: {
  value: number; prev?: number | null; abs?: boolean; invert?: boolean;
}) {
  if (prev == null || prev === 0) return null;
  const diff = value - prev;
  if (Math.abs(diff) < 0.01) return null;
  const pct = abs ? diff : (diff / prev) * 100;
  const isPos = diff > 0;
  const isGood = invert ? !isPos : isPos;
  const arrow = isPos ? '▲' : '▼';
  const text = abs
    ? `${isPos ? '+' : ''}${pct.toFixed(1)}п.п.`
    : `${isPos ? '+' : ''}${pct.toFixed(0)}%`;
  return (
    <span className={`text-[9px] tabular-nums font-medium ${isGood ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
      {arrow} {text}
    </span>
  );
}
