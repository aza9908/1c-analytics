export const ABC_COLORS = { A: '#10b981', B: '#f59e0b', C: '#ef4444' } as const;

export const ABC_BADGE_CLASSES = {
  A: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-0',
  B: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-0',
  C: 'bg-red-500/15 text-red-600 dark:text-red-400 border-0',
} as const;

export function abcBadgeClass(cls: string): string {
  return ABC_BADGE_CLASSES[cls as keyof typeof ABC_BADGE_CLASSES] || 'bg-muted text-muted-foreground';
}
