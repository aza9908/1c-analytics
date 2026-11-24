"use client";

import * as React from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { RouteLoader } from "@/components/dashboard/route-loader";

/**
 * Глобальный лоадер на переходы между страницами.
 *
 * Перехватывает клики по внутренним <a href="..."> (включая <Link>),
 * показывает RouteLoader пока pathname/searchParams не сменятся,
 * после чего скрывается.
 */
export function NavigationLoader() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, setPending] = React.useState(false);
  const safetyTimer = React.useRef<number | null>(null);

  // Сбрасываем при смене маршрута.
  React.useEffect(() => {
    setPending(false);
    if (safetyTimer.current) {
      window.clearTimeout(safetyTimer.current);
      safetyTimer.current = null;
    }
  }, [pathname, searchParams]);

  React.useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (e.defaultPrevented) return;
      if (e.button !== 0) return;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

      const target = e.target as HTMLElement | null;
      if (!target) return;
      const anchor = target.closest("a");
      if (!anchor) return;

      const href = anchor.getAttribute("href");
      if (!href) return;
      if (anchor.target && anchor.target !== "" && anchor.target !== "_self") return;
      if (anchor.hasAttribute("download")) return;
      if (
        href.startsWith("#") ||
        href.startsWith("mailto:") ||
        href.startsWith("tel:") ||
        href.startsWith("javascript:")
      ) {
        return;
      }

      let url: URL;
      try {
        url = new URL(href, window.location.href);
      } catch {
        return;
      }
      if (url.origin !== window.location.origin) return;

      // Тот же путь и query — навигации не будет.
      if (
        url.pathname === window.location.pathname &&
        url.search === window.location.search
      ) {
        return;
      }

      setPending(true);
      if (safetyTimer.current) window.clearTimeout(safetyTimer.current);
      safetyTimer.current = window.setTimeout(() => {
        setPending(false);
        safetyTimer.current = null;
      }, 8000);
    };

    const onPopState = () => {
      setPending(true);
      if (safetyTimer.current) window.clearTimeout(safetyTimer.current);
      safetyTimer.current = window.setTimeout(() => {
        setPending(false);
        safetyTimer.current = null;
      }, 8000);
    };

    document.addEventListener("click", onClick, true);
    window.addEventListener("popstate", onPopState);
    return () => {
      document.removeEventListener("click", onClick, true);
      window.removeEventListener("popstate", onPopState);
      if (safetyTimer.current) window.clearTimeout(safetyTimer.current);
    };
  }, []);

  return <RouteLoader active={pending} label="Загружаем страницу" />;
}
