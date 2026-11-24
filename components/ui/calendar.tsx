"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker, type DayPickerProps } from "react-day-picker";
import "react-day-picker/style.css";

import { cn } from "@/lib/utils";

export type CalendarProps = DayPickerProps;

export function Calendar({ className, showOutsideDays = false, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-4", className)}
      classNames={{
        months: "relative flex gap-8",
        month: "flex flex-col gap-4",
        month_caption: "flex h-8 items-center justify-center px-10",
        caption_label: "text-[13px] font-semibold tracking-tight",
        nav: "absolute inset-x-0 top-4 flex items-center justify-between px-1",
        button_previous:
          "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors",
        button_next:
          "inline-flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-30 disabled:hover:bg-transparent transition-colors",
        month_grid: "w-full border-collapse",
        weekdays: "flex",
        weekday: "text-muted-foreground/70 w-9 text-[10px] font-medium uppercase tracking-wider",
        week: "mt-1 flex w-full",
        day: "size-9 flex-1 text-center text-[13px] p-0 relative",
        day_button:
          "size-9 inline-flex items-center justify-center rounded-md font-normal text-foreground hover:bg-accent transition-colors aria-selected:opacity-100 outline-none focus-visible:ring-2 focus-visible:ring-sky-400/60",
        selected:
          "[&>button]:bg-sky-500 [&>button]:text-white [&>button]:font-medium [&>button]:hover:bg-sky-500/90",
        today:
          "[&>button]:ring-1 [&>button]:ring-inset [&>button]:ring-sky-400/40 [&>button]:font-semibold",
        outside: "text-muted-foreground/40",
        disabled: "text-muted-foreground/30 [&>button]:cursor-not-allowed [&>button]:hover:bg-transparent",
        hidden: "invisible",
        range_start:
          "bg-sky-100 dark:bg-sky-500/20 rounded-l-md [&>button]:bg-sky-500 [&>button]:text-white [&>button]:hover:bg-sky-500",
        range_end:
          "bg-sky-100 dark:bg-sky-500/20 rounded-r-md [&>button]:bg-sky-500 [&>button]:text-white [&>button]:hover:bg-sky-500",
        range_middle:
          "bg-sky-100 dark:bg-sky-500/20 [&>button]:!bg-transparent [&>button]:!text-foreground [&>button]:!font-normal [&>button]:hover:!bg-sky-200/60 dark:[&>button]:hover:!bg-sky-500/30",
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === "left" ? ChevronLeft : ChevronRight;
          return <Icon className="size-4" />;
        },
      }}
      {...props}
    />
  );
}
