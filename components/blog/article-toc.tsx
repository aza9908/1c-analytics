"use client";

import { useEffect, useState } from "react";
import type { ArticleChapter } from "./markdown";
import type { Article } from "@/lib/articles";
import { ACCENT } from "@/lib/article-style";
import { cn } from "@/lib/utils";

// Sticky right-rail оглавление статьи с интерактивным scrollspy.
// - h2 — основной уровень (жирнее, с маркером слева)
// - h3 — подпункты (меньше, отступ)
// - активный заголовок подсвечивается accent-цветом статьи
// - клик плавно скроллит к нужной секции

export function ArticleTOC({
  chapters,
  accent,
}: {
  chapters: ArticleChapter[];
  accent: Article["accent"];
}) {
  const acc = ACCENT[accent];
  const [active, setActive] = useState<string | null>(
    chapters[0]?.id ?? null
  );

  useEffect(() => {
    if (chapters.length === 0) return;

    const headings = chapters
      .map((c) => document.getElementById(c.id))
      .filter((el): el is HTMLElement => el !== null);

    if (headings.length === 0) return;

    // IntersectionObserver: подсвечиваем верхний видимый заголовок.
    // rootMargin сдвигает «зону видимости» так, что подсветка переключается
    // ровно когда заголовок подходит к 96px сверху (под Topbar).
    const observer = new IntersectionObserver(
      (entries) => {
        // Берём все entries и решаем, какой заголовок «активен»:
        // самый нижний из тех, у кого top <= 100px от верха окна.
        const visibleAbove = entries
          .filter((e) => e.boundingClientRect.top < 120)
          .sort(
            (a, b) =>
              b.boundingClientRect.top - a.boundingClientRect.top
          );
        if (visibleAbove[0]) {
          setActive(visibleAbove[0].target.id);
          return;
        }
        // Иначе — первая видимая секция
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort(
            (a, b) =>
              a.boundingClientRect.top - b.boundingClientRect.top
          );
        if (visible[0]) setActive(visible[0].target.id);
      },
      {
        // Узкая полоса в верхней части viewport — заголовок «активен»,
        // когда он пересекает её.
        rootMargin: "-96px 0px -70% 0px",
        threshold: [0, 1],
      }
    );

    headings.forEach((h) => observer.observe(h));

    return () => observer.disconnect();
  }, [chapters]);

  // Дополнительно следим за hash при клике — чтобы активный пункт
  // переключился сразу, не дожидаясь пересечения.
  useEffect(() => {
    const onHash = () => {
      const id = window.location.hash.slice(1);
      if (id) setActive(id);
    };
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (chapters.length === 0) return null;

  return (
    <aside className="hidden xl:block">
      <div className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto pr-2">
        <div className="mb-3 flex items-center gap-2 text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
          <span className={cn("size-1.5 rounded-full", acc.dot)} />
          Содержание
        </div>
        <nav className="border-l border-border/60">
          {chapters.map((c) => {
            const isActive = active === c.id;
            return (
              <a
                key={c.id}
                href={`#${c.id}`}
                onClick={(e) => {
                  // Плавный скролл вместо мгновенного перехода
                  const el = document.getElementById(c.id);
                  if (el) {
                    e.preventDefault();
                    setActive(c.id);
                    el.scrollIntoView({ behavior: "smooth", block: "start" });
                    // Обновляем URL, чтобы можно было поделиться ссылкой
                    history.replaceState(null, "", `#${c.id}`);
                  }
                }}
                className={cn(
                  "group relative flex border-l-2 py-1.5 pl-3 text-[13px] leading-snug transition-colors",
                  c.level === 3 && "pl-6 text-[12px]",
                  isActive
                    ? cn("font-medium text-foreground", acc.text)
                    : "border-transparent text-muted-foreground hover:text-foreground"
                )}
                style={
                  isActive
                    ? {
                        borderLeftColor: cssVarForAccent(accent),
                        marginLeft: "-1px",
                      }
                    : undefined
                }
              >
                <span className="line-clamp-2">{c.text}</span>
              </a>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}

// Tailwind не умеет резолвить классы вроде `border-l-sky-400` динамически
// в момент рендера через переменную, поэтому держим карту HEX-цветов здесь.
function cssVarForAccent(accent: Article["accent"]): string {
  switch (accent) {
    case "amber":   return "#f5a623";
    case "rose":    return "#f43f5e";
    case "violet":  return "#7928ca";
    case "sky":     return "#0070f3";
    case "emerald": return "#00875a";
    case "fuchsia": return "#e00087";
    case "orange":  return "#f5a623";
    case "indigo":  return "#5b6dff";
    case "cyan":    return "#29bc9b";
    default:        return "#0070f3";
  }
}
