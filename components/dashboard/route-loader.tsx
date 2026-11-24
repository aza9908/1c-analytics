"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

const PHRASES = [
  "Запрашиваем данные",
  "Считаем метрики",
  "Группируем воронку",
  "Полируем графики",
  "Почти готово",
];

/**
 * Полноэкранный лоадер с круговым спиннером и градиентным шрифтом.
 * Активируется на время `useTransition`, когда меняются URL-параметры
 * (дата, воронка, бакет и т.д.) и сервер пересчитывает страницу.
 */
export function RouteLoader({ active, label }: { active: boolean; label?: string }) {
  // Постепенное «кажущееся» прогрессирование 0 → 92%, чтобы не выглядело статично.
  const [progress, setProgress] = React.useState(0);
  const [phraseIdx, setPhraseIdx] = React.useState(0);

  React.useEffect(() => {
    if (!active) {
      setProgress(0);
      setPhraseIdx(0);
      return;
    }
    setProgress(8);
    const id = window.setInterval(() => {
      setProgress((p) => {
        if (p >= 92) return p;
        const remaining = 92 - p;
        return p + Math.max(0.6, remaining * 0.08);
      });
    }, 110);
    const phraseId = window.setInterval(() => {
      setPhraseIdx((i) => (i + 1) % PHRASES.length);
    }, 1400);
    return () => {
      window.clearInterval(id);
      window.clearInterval(phraseId);
    };
  }, [active]);

  return (
    <div
      aria-hidden={!active}
      className={cn(
        "pointer-events-none fixed inset-0 z-[60] flex items-center justify-center transition-opacity duration-300",
        active ? "opacity-100" : "opacity-0"
      )}
    >
      {/* Backdrop */}
      <div
        className={cn(
          "absolute inset-0 backdrop-blur-[3px] transition-colors duration-300",
          active ? "bg-background/55" : "bg-transparent"
        )}
      />

      {/* Card */}
      <div
        className={cn(
          "relative flex flex-col items-center gap-5 rounded-2xl border bg-card/85 px-9 py-8 shadow-2xl shadow-black/20 transition-all duration-300",
          "min-w-[280px] backdrop-blur-md",
          active ? "scale-100 translate-y-0" : "scale-95 translate-y-1"
        )}
      >
        {/* Spinner */}
        <div className="relative size-20">
          {/* Внешний пульс-кружок */}
          <div className="absolute inset-0 rounded-full bg-sky-500/10 animate-[loader-pulse_1.8s_ease-out_infinite]" />
          {/* Тонкая статичная окружность */}
          <div className="absolute inset-1 rounded-full border border-border/60" />
          {/* Дуга-градиент (быстрая) */}
          <div
            className="absolute inset-0 rounded-full animate-[loader-spin_1.1s_linear_infinite]"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, transparent 220deg, #0070f3 320deg, #38bdf8 360deg)",
              mask: "radial-gradient(circle, transparent 60%, black 62%)",
              WebkitMask: "radial-gradient(circle, transparent 60%, black 62%)",
            }}
          />
          {/* Контр-вращение медленное */}
          <div
            className="absolute inset-2.5 rounded-full animate-[loader-spin-rev_2.6s_linear_infinite]"
            style={{
              background:
                "conic-gradient(from 0deg, transparent 0deg, transparent 280deg, rgba(56,189,248,0.7) 340deg, rgba(56,189,248,0) 360deg)",
              mask: "radial-gradient(circle, transparent 58%, black 60%)",
              WebkitMask: "radial-gradient(circle, transparent 58%, black 60%)",
            }}
          />
          {/* Центральная точка */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="size-2 rounded-full bg-sky-400 shadow-[0_0_14px_2px_rgba(56,189,248,0.6)] animate-[loader-pulse-dot_1.2s_ease-in-out_infinite]" />
          </div>
        </div>

        {/* Заголовок с градиентным шрифтом */}
        <div className="flex flex-col items-center gap-1.5">
          <div className="relative">
            <span
              className="bg-clip-text text-[20px] font-semibold tracking-tight text-transparent"
              style={{
                backgroundImage:
                  "linear-gradient(110deg, #0a0a0a 0%, #0a0a0a 35%, #0070f3 50%, #0a0a0a 65%, #0a0a0a 100%)",
                backgroundSize: "220% 100%",
                animation: "loader-shimmer 2.2s linear infinite",
                WebkitBackgroundClip: "text",
              }}
            >
              {label ?? "Обновляем данные"}
            </span>
            {/* Тёмная тема — отдельный градиент */}
            <span
              className="absolute inset-0 hidden bg-clip-text text-[20px] font-semibold tracking-tight text-transparent dark:block"
              style={{
                backgroundImage:
                  "linear-gradient(110deg, #fafafa 0%, #fafafa 35%, #38bdf8 50%, #fafafa 65%, #fafafa 100%)",
                backgroundSize: "220% 100%",
                animation: "loader-shimmer 2.2s linear infinite",
                WebkitBackgroundClip: "text",
              }}
            >
              {label ?? "Обновляем данные"}
            </span>
          </div>

          {/* Циклическая подпись + точки */}
          <div className="flex h-5 items-center gap-1 text-[12.5px] text-muted-foreground">
            <span
              key={phraseIdx}
              className="animate-[loader-fade_0.4s_ease-out] tabular-nums"
            >
              {PHRASES[phraseIdx]}
            </span>
            <span className="inline-flex w-3 justify-start">
              <span className="size-1 translate-y-[1px] rounded-full bg-current animate-[loader-dot_1.2s_ease-in-out_infinite]" />
              <span
                className="size-1 translate-y-[1px] rounded-full bg-current animate-[loader-dot_1.2s_ease-in-out_infinite]"
                style={{ animationDelay: "0.18s", marginLeft: 2 }}
              />
              <span
                className="size-1 translate-y-[1px] rounded-full bg-current animate-[loader-dot_1.2s_ease-in-out_infinite]"
                style={{ animationDelay: "0.36s", marginLeft: 2 }}
              />
            </span>
          </div>
        </div>

        {/* Прогресс-бар */}
        <div className="relative h-[3px] w-full overflow-hidden rounded-full bg-border/70">
          <div
            className="absolute inset-y-0 left-0 rounded-full transition-[width] duration-150 ease-out"
            style={{
              width: `${progress}%`,
              background:
                "linear-gradient(90deg, #38bdf8 0%, #0070f3 60%, #6366f1 100%)",
              boxShadow: "0 0 12px rgba(56,189,248,0.55)",
            }}
          />
          {/* Световой блик, бегущий по бару */}
          <div
            className="absolute inset-y-0 w-1/3 animate-[loader-sweep_1.6s_linear_infinite]"
            style={{
              background:
                "linear-gradient(90deg, transparent 0%, rgba(255,255,255,0.55) 50%, transparent 100%)",
            }}
          />
        </div>

        {/* Процент */}
        <div className="font-mono text-[11px] tabular-nums text-muted-foreground">
          {Math.round(progress)}%
        </div>
      </div>
    </div>
  );
}
