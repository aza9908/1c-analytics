'use client';

import { SidebarTrigger } from '@/components/ui/sidebar';
import { Separator } from '@/components/ui/separator';
import { useData } from '@/lib/data-context';
import { DateRangePicker } from '@/components/dashboard/date-range-picker';
import { EtlStatusBanner } from '@/components/dashboard/etl-status-banner';
import { useTheme } from 'next-themes';
import { Sun, Moon } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function SiteHeader() {
  const { range, setRange, available } = useData();
  const { theme, setTheme } = useTheme();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b bg-background/80 backdrop-blur-md px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="h-5" />

      {/* Live status — слева, всегда виден */}
      <EtlStatusBanner />

      <div className="flex-1" />

      {available && (
        <DateRangePicker
          value={range}
          onChange={setRange}
          min={available.minDate}
          max={available.maxDate}
          monthPresets={available.months}
        />
      )}

      <Button
        size="icon"
        variant="ghost"
        onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
        aria-label="Toggle theme"
        className="h-8 w-8"
      >
        <Sun className="h-4 w-4 dark:hidden" />
        <Moon className="h-4 w-4 hidden dark:inline" />
      </Button>
    </header>
  );
}
