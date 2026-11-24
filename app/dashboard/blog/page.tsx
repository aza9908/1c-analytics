import Link from "next/link";
import { ARTICLES } from "@/lib/articles";
import { ACCENT } from "@/lib/article-style";
import {
  Compass,
  TrendingUp,
  AlertTriangle,
  Database,
  CloudLightning,
  ListChecks,
  Sparkles,
  ArrowUpRight,
} from "lucide-react";

const ICON = {
  Compass,
  TrendingUp,
  AlertTriangle,
  Database,
  CloudLightning,
  ListChecks,
  Sparkles,
} as const;

export const metadata = {
  title: "Исследования — 1С analytics",
  description: "Аналитические материалы по витринам mart.*",
};

function EmptyState() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Исследования</h1>
        <p className="text-sm text-muted-foreground">Материалов пока нет</p>
      </div>
      <section className="rounded-xl border border-dashed bg-card/30 p-10 text-center">
        <p className="text-sm text-muted-foreground">
          Положите markdown в <code className="font-mono">content/articles/&lt;slug&gt;.md</code> и
          опишите его в <code className="font-mono">ARTICLES</code> (<code className="font-mono">lib/articles.ts</code>).
        </p>
      </section>
    </div>
  );
}

export default function BlogIndex() {
  if (ARTICLES.length === 0) return <EmptyState />;

  const [hero, ...rest] = ARTICLES;
  const heroAccent = ACCENT[hero.accent];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">Исследования</h1>
        <p className="text-sm text-muted-foreground">
          {ARTICLES.length} материалов
        </p>
      </div>

      {/* HERO */}
      <section className="relative overflow-hidden rounded-xl border bg-card">
        <div
          className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${heroAccent.gradient}`}
        />
        <div className="relative grid gap-8 p-8 lg:grid-cols-[1.15fr_1fr] lg:p-10">
          <div className="flex flex-col justify-center">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-2 rounded-md border bg-background/60 px-2 py-1 text-[11px] uppercase tracking-[0.16em] text-muted-foreground backdrop-blur">
                <Sparkles className="size-3" />
                {hero.category}
              </span>
              <span
                className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] font-semibold tracking-wide ${heroAccent.iconBg} ${heroAccent.text}`}
              >
                <span className="text-[14px] leading-none">{hero.sticker.emoji}</span>
                <span className="font-mono uppercase tracking-[0.14em]">
                  {hero.sticker.label}
                </span>
              </span>
            </div>
            <Link href={`/dashboard/blog/${hero.slug}`} className="group block">
              <h2 className="text-left font-sans text-3xl font-semibold leading-[1.05] tracking-tight md:text-[44px]">
                {hero.title}
              </h2>
              <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground md:text-[16px]">
                {hero.deck}
              </p>
              <div className="mt-7 flex flex-wrap gap-2">
                {hero.insights.map((ins, i) => (
                  <div
                    key={i}
                    className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] ${heroAccent.chip}`}
                  >
                    <span className={`size-1.5 rounded-full ${heroAccent.dot}`} />
                    <span className="font-mono font-semibold">{ins.metric}</span>
                    <span className="text-muted-foreground">— {ins.label}</span>
                  </div>
                ))}
              </div>
              <div className="mt-7 inline-flex items-center gap-1.5 text-[13px] font-medium text-foreground transition-colors group-hover:text-sky-300">
                Читать материал
                <ArrowUpRight className="size-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </div>
            </Link>
          </div>
          <div className="hidden lg:flex items-center justify-center">
            <div className={`flex h-full w-full max-h-[280px] items-center justify-center rounded-lg border ${heroAccent.iconBg}`}>
              <span className="text-[88px] leading-none">{hero.sticker.emoji}</span>
            </div>
          </div>
        </div>
      </section>

      {/* META BAR */}
      <section className="rounded-md border bg-card/30 px-4 py-3">
        <div className="flex flex-wrap items-center justify-between gap-x-8 gap-y-2 text-[12px] text-muted-foreground">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-1">
            <span><span className="font-mono font-semibold text-foreground">{ARTICLES.length}</span> статей</span>
          </div>
          <span className="text-[11px] uppercase tracking-wider">источник: mart.receipts, mart.inventory · 1C OData</span>
        </div>
      </section>

      {/* GRID */}
      <section>
        <div className="mb-4 flex items-baseline justify-between">
          <h2 className="text-base font-semibold tracking-tight">Все материалы</h2>
          <span className="text-[12px] text-muted-foreground">от обзора к плану действий</span>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {rest.map((a) => {
            const acc = ACCENT[a.accent];
            const Icon = ICON[a.icon as keyof typeof ICON];
            return (
              <Link
                key={a.slug}
                href={`/dashboard/blog/${a.slug}`}
                className="group relative flex flex-col overflow-hidden rounded-xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-black/20"
              >
                <div className="relative aspect-[16/8] overflow-hidden border-b">
                  <div
                    className={`pointer-events-none absolute inset-0 bg-gradient-to-tr ${acc.gradient}`}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-[56px] leading-none opacity-70">
                      {a.sticker.emoji}
                    </span>
                  </div>
                  <div
                    className={`absolute left-3 top-3 z-10 inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-semibold tracking-wide ${acc.iconBg} ${acc.text} backdrop-blur`}
                  >
                    <span className="font-mono uppercase tracking-[0.14em]">
                      {a.sticker.label}
                    </span>
                  </div>
                  <div className="absolute right-3 top-3 z-10 rounded-md border bg-background/85 px-2 py-1 font-mono text-[10.5px] uppercase tracking-wider text-muted-foreground backdrop-blur">
                    № {a.num} · {a.readingTime}
                  </div>
                </div>
                <div className="flex flex-1 flex-col gap-3 p-4">
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex size-9 shrink-0 items-center justify-center rounded-md ${acc.iconBg}`}
                    >
                      {Icon && <Icon className="size-[18px]" />}
                    </div>
                    <h3 className="text-left text-[15px] font-semibold leading-tight tracking-tight">
                      {a.title}
                    </h3>
                  </div>
                  <p className="text-[13px] leading-relaxed text-muted-foreground">
                    {a.deck}
                  </p>
                  <div className="mt-auto flex flex-col gap-1.5 border-t pt-3">
                    {a.insights.map((ins, i) => (
                      <div key={i} className="flex items-baseline gap-2 text-[12px]">
                        <span className={`size-1 shrink-0 rounded-full ${acc.dot}`} />
                        <span className={`font-mono font-semibold ${acc.text}`}>
                          {ins.metric}
                        </span>
                        <span className="truncate text-muted-foreground">
                          — {ins.label}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
