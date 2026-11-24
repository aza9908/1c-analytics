'use client';

import * as React from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { METRICS, type MetricDef } from '@/lib/metrics-glossary';
import { cn } from '@/lib/utils';

interface Props {
  /** Ключ в METRICS, либо явный MetricDef через `def` */
  metric?: keyof typeof METRICS;
  def?: MetricDef;
  /** Если передан children — служит как label, иначе берётся `metric.label` */
  children?: React.ReactNode;
  className?: string;
  iconClassName?: string;
}

/**
 * Заголовок с маленькой ⓘ-иконкой и тултипом-определением.
 * Используется в шапках таблиц и подписях KPI.
 */
export function MetricInfo({ metric, def, children, className, iconClassName }: Props) {
  const m = def ?? (metric ? METRICS[metric] : undefined);
  const label = children ?? m?.label ?? metric;

  if (!m) return <span className={className}>{label}</span>;

  return (
    <Tooltip>
      <TooltipTrigger
        className={cn(
          'inline-flex items-center gap-1 cursor-help select-none bg-transparent border-0 p-0 m-0 text-inherit font-inherit',
          className,
        )}
      >
        {label}
        <Info className={cn('size-3 text-muted-foreground/50', iconClassName)} />
      </TooltipTrigger>
      <TooltipContent side="top" className="text-xs max-w-[260px] space-y-1">
        <div className="font-medium">{m.label}{m.unit ? <span className="text-muted-foreground font-normal ml-1">({m.unit})</span> : null}</div>
        <div className="text-muted-foreground leading-snug">{m.desc}</div>
        {m.formula && (
          <div className="font-mono text-[10.5px] text-muted-foreground/80">{m.formula}</div>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
