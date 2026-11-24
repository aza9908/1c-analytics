'use client';

import { useData } from '@/lib/data-context';
import { formatCurrency } from '@/lib/format';

interface StoreFilterTabsProps {
  selected: string;
  onSelect: (store: string) => void;
}

export function StoreFilterTabs({ selected, onSelect }: StoreFilterTabsProps) {
  const { data } = useData();
  if (!data) return null;

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      <button
        onClick={() => onSelect('all')}
        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
          selected === 'all'
            ? 'bg-foreground text-background'
            : 'text-muted-foreground hover:text-foreground hover:bg-muted'
        }`}
      >
        Все магазины
      </button>
      {data.stores.map(store => (
        <button
          key={store.store}
          onClick={() => onSelect(store.store)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 ${
            selected === store.store
              ? 'bg-foreground text-background'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted'
          }`}
        >
          <span>{store.store}</span>
          <span className={`text-[10px] tabular-nums ${
            selected === store.store ? 'text-background/60' : 'text-muted-foreground/60'
          }`}>
            {formatCurrency(store.totalRevenue)}
          </span>
        </button>
      ))}
    </div>
  );
}
