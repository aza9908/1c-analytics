'use client';

import * as React from 'react';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  page: number;             // zero-based
  setPage: (p: number) => void;
  total: number;            // total rows
  pageSize: number;
  setPageSize?: (n: number) => void;
  pageSizeOptions?: number[];
  className?: string;
}

export function TablePagination({
  page,
  setPage,
  total,
  pageSize,
  setPageSize,
  pageSizeOptions = [25, 50, 100, 200],
  className,
}: Props) {
  const pageCount = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : page * pageSize + 1;
  const to = Math.min(total, (page + 1) * pageSize);

  return (
    <div className={cn('flex items-center justify-between gap-3 border-t px-4 py-2.5 text-xs', className)}>
      <div className="text-muted-foreground tabular-nums">
        {from.toLocaleString('ru-RU')}–{to.toLocaleString('ru-RU')} из {total.toLocaleString('ru-RU')}
      </div>

      <div className="flex items-center gap-3">
        {setPageSize && (
          <label className="flex items-center gap-1.5 text-muted-foreground">
            На странице
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(0);
              }}
              className="h-7 rounded-md border bg-background px-1.5 text-xs outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60"
            >
              {pageSizeOptions.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </label>
        )}

        <div className="flex items-center gap-0.5">
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(0)}
            aria-label="Первая страница"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background hover:bg-accent disabled:opacity-30 disabled:hover:bg-background"
          >
            <ChevronsLeft className="size-3.5" />
          </button>
          <button
            type="button"
            disabled={page === 0}
            onClick={() => setPage(page - 1)}
            aria-label="Назад"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background hover:bg-accent disabled:opacity-30 disabled:hover:bg-background"
          >
            <ChevronLeft className="size-3.5" />
          </button>

          <span className="inline-flex items-center px-2 tabular-nums text-muted-foreground">
            {page + 1} / {pageCount}
          </span>

          <button
            type="button"
            disabled={page >= pageCount - 1}
            onClick={() => setPage(page + 1)}
            aria-label="Вперёд"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background hover:bg-accent disabled:opacity-30 disabled:hover:bg-background"
          >
            <ChevronRight className="size-3.5" />
          </button>
          <button
            type="button"
            disabled={page >= pageCount - 1}
            onClick={() => setPage(pageCount - 1)}
            aria-label="Последняя страница"
            className="inline-flex h-7 w-7 items-center justify-center rounded-md border bg-background hover:bg-accent disabled:opacity-30 disabled:hover:bg-background"
          >
            <ChevronsRight className="size-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
