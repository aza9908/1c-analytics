"use client";
import * as React from "react";
import { format, subDays, startOfMonth, endOfMonth, isAfter, isBefore } from "date-fns";
import { ru } from "date-fns/locale";
import { Calendar as CalendarIcon, ChevronDown } from "lucide-react";
import type { DateRange } from "react-day-picker";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface Preset {
  id: string;
  label: string;
  compute: (min: Date, max: Date) => DateRange;
}

export interface MonthPreset {
  month: string;    // "2026-05"
  from: string;     // "2026-05-01"
  label: string;    // "Май 2026"
}

const RELATIVE_PRESETS: Preset[] = [
  { id: "7d", label: "7д", compute: (_min, max) => ({ from: subDays(max, 6), to: max }) },
  { id: "30d", label: "30д", compute: (_min, max) => ({ from: subDays(max, 29), to: max }) },
  { id: "90d", label: "90д", compute: (_min, max) => ({ from: subDays(max, 89), to: max }) },
];

function ymd(d: Date): string {
  return format(d, "yyyy-MM-dd");
}

function isSameRange(a: DateRange | undefined, b: DateRange | undefined): boolean {
  if (!a || !b || !a.from || !a.to || !b.from || !b.to) return false;
  return ymd(a.from) === ymd(b.from) && ymd(a.to) === ymd(b.to);
}

function fmtRange(value: DateRange): string {
  if (!value.from || !value.to) {
    if (value.from) return `${format(value.from, "d MMM yyyy", { locale: ru })} – …`;
    return "Выбрать период";
  }
  const sameYear = value.from.getFullYear() === value.to.getFullYear();
  const sameMonth = sameYear && value.from.getMonth() === value.to.getMonth();
  if (sameMonth && format(value.from, "d") === format(value.to, "d")) {
    return format(value.from, "d MMMM yyyy", { locale: ru });
  }
  if (sameYear) {
    return `${format(value.from, "d MMM", { locale: ru })} – ${format(value.to, "d MMM yyyy", { locale: ru })}`;
  }
  return `${format(value.from, "d MMM yyyy", { locale: ru })} – ${format(value.to, "d MMM yyyy", { locale: ru })}`;
}

function reduceRange(prev: DateRange | undefined, clicked: Date | undefined): DateRange {
  if (!clicked) return { from: undefined, to: undefined };
  if (!prev?.from || (prev.from && prev.to)) {
    return { from: clicked, to: undefined };
  }
  if (isBefore(clicked, prev.from)) {
    return { from: clicked, to: prev.from };
  }
  return { from: prev.from, to: clicked };
}

export function DateRangePicker({
  value,
  onChange,
  min,
  max,
  monthPresets = [],
  className,
}: {
  value: DateRange;
  onChange: (range: DateRange) => void;
  min: Date;
  max: Date;
  monthPresets?: MonthPreset[];
  className?: string;
}) {
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<DateRange | undefined>(undefined);

  React.useEffect(() => {
    if (open) setDraft(value);
  }, [open, value]);

  const activeRelative = React.useMemo(
    () => RELATIVE_PRESETS.find(p => isSameRange(value, p.compute(min, max))),
    [value, min, max]
  );
  const activeMonth = React.useMemo(() => {
    return monthPresets.find(mp => {
      const from = new Date(mp.from);
      const to = endOfMonth(from);
      return isSameRange(value, { from, to });
    });
  }, [value, monthPresets]);

  const display = draft && open ? draft : value;
  const isCustom = !activeRelative && !activeMonth && !!value.from && !!value.to;

  return (
    <div className={cn("inline-flex flex-wrap items-center gap-1.5", className)}>
      {/* Relative presets */}
      <div className="inline-flex items-center gap-0.5 rounded-lg border bg-card p-0.5 shadow-sm">
        {RELATIVE_PRESETS.map(p => {
          const isActive = activeRelative?.id === p.id;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onChange(p.compute(min, max))}
              className={cn(
                "inline-flex h-7 items-center justify-center rounded-md px-2.5 text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60",
                isActive
                  ? "bg-foreground text-background shadow-sm"
                  : "text-muted-foreground hover:bg-accent hover:text-foreground"
              )}
            >
              {p.label}
            </button>
          );
        })}
      </div>

      {/* Month presets — авто-сгенерированные из БД */}
      {monthPresets.length > 0 && (
        <div className="inline-flex items-center gap-0.5 rounded-lg border bg-card p-0.5 shadow-sm">
          {monthPresets.map(mp => {
            const isActive = activeMonth?.month === mp.month;
            return (
              <button
                key={mp.month}
                type="button"
                onClick={() => {
                  const from = new Date(mp.from);
                  onChange({ from, to: endOfMonth(from) });
                }}
                className={cn(
                  "inline-flex h-7 items-center justify-center rounded-md px-2.5 text-[12px] font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60",
                  isActive
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                )}
              >
                {mp.label}
              </button>
            );
          })}
        </div>
      )}

      {/* Custom range trigger */}
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label="Выбрать произвольный период"
            className={cn(
              "group inline-flex h-9 items-center gap-2 rounded-lg border px-3 text-[12.5px] font-medium tabular-nums shadow-sm transition-all outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60",
              isCustom
                ? "border-sky-400/60 bg-sky-500/10 text-sky-700 dark:text-sky-300 hover:bg-sky-500/15"
                : "bg-card hover:border-foreground/30 hover:bg-accent",
              open && "ring-2 ring-sky-400/40"
            )}
          >
            <CalendarIcon
              className={cn(
                "size-4 shrink-0 transition-colors",
                isCustom ? "text-sky-500" : "text-muted-foreground group-hover:text-foreground"
              )}
            />
            <span className="whitespace-nowrap">{fmtRange(display)}</span>
            <ChevronDown
              className={cn(
                "size-3.5 shrink-0 text-muted-foreground transition-transform",
                open && "rotate-180"
              )}
            />
          </button>
        </PopoverTrigger>
        <PopoverContent align="end" sideOffset={6} className="w-auto max-w-[calc(100vw-1rem)] p-0">
          <Calendar
            mode="range"
            defaultMonth={(draft?.from ?? value.from) ?? max}
            selected={draft}
            onDayClick={(day) => {
              if (isAfter(day, max) || isBefore(day, min)) return;
              const next = reduceRange(draft, day);
              setDraft(next);
              if (next.from && next.to) {
                onChange(next);
                setTimeout(() => setOpen(false), 100);
              }
            }}
            numberOfMonths={2}
            disabled={{ before: min, after: max }}
            weekStartsOn={1}
            locale={ru}
            className="hidden md:block"
          />
          <Calendar
            mode="range"
            defaultMonth={(draft?.from ?? value.from) ?? max}
            selected={draft}
            onDayClick={(day) => {
              if (isAfter(day, max) || isBefore(day, min)) return;
              const next = reduceRange(draft, day);
              setDraft(next);
              if (next.from && next.to) {
                onChange(next);
                setTimeout(() => setOpen(false), 100);
              }
            }}
            numberOfMonths={1}
            disabled={{ before: min, after: max }}
            weekStartsOn={1}
            locale={ru}
            className="md:hidden"
          />
          <div className="flex items-center justify-between gap-2 border-t bg-muted/40 px-3 py-2">
            <div className="text-[11px] text-muted-foreground tabular-nums">
              {draft?.from
                ? draft.to
                  ? `${format(draft.from, "d MMM yyyy", { locale: ru })} – ${format(draft.to, "d MMM yyyy", { locale: ru })}`
                  : `${format(draft.from, "d MMM yyyy", { locale: ru })} – выберите конец`
                : "Кликните на дату начала"}
            </div>
            <button
              type="button"
              onClick={() => { setDraft(value); setOpen(false); }}
              className="inline-flex h-6 items-center rounded px-2 text-[11px] text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
            >
              Отмена
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </div>
  );
}
