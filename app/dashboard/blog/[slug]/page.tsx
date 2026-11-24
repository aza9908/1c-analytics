import Link from "next/link";
import { notFound } from "next/navigation";
import { ArticleMarkdown, extractChapters } from "@/components/blog/markdown";
import { ArticleTOC } from "@/components/blog/article-toc";
import {
  ARTICLES,
  getAllSlugs,
  getArticle,
} from "@/lib/articles";
import { getArticleMarkdown } from "@/lib/articles-server";
import { ACCENT } from "@/lib/article-style";
import {
  Compass,
  TrendingUp,
  AlertTriangle,
  Database,
  CloudLightning,
  ListChecks,
  Sparkles,
  ArrowLeft,
  ArrowRight,
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

export function generateStaticParams() {
  return getAllSlugs().map((slug) => ({ slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const a = getArticle(slug);
  if (!a) return { title: "Статья не найдена" };
  return {
    title: `${a.title} — 1С analytics`,
    description: a.deck,
  };
}

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getArticle(slug);
  const md = getArticleMarkdown(slug);
  if (!article || md == null) notFound();

  const acc = ACCENT[article.accent];
  const Icon = ICON[article.icon as keyof typeof ICON];

  const idx = ARTICLES.findIndex((a) => a.slug === slug);
  const prev = idx > 0 ? ARTICLES[idx - 1] : undefined;
  const next = idx < ARTICLES.length - 1 ? ARTICLES[idx + 1] : undefined;

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <header className="relative overflow-hidden rounded-xl border bg-card">
        <div className={`pointer-events-none absolute inset-0 bg-gradient-to-br ${acc.gradient}`} />
        <div className="relative p-8 lg:p-10">
          <Link
            href="/dashboard/blog"
            className="mb-6 inline-flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3.5" />
            К списку материалов
          </Link>

          <div className="mb-5 flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11.5px] font-semibold tracking-wide ${acc.iconBg} ${acc.text}`}
            >
              <span className="text-[14px] leading-none">{article.sticker.emoji}</span>
              <span className="font-mono uppercase tracking-[0.14em]">
                {article.sticker.label}
              </span>
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border bg-background/60 px-2 py-1 font-mono text-[11px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
              № {article.num}
            </span>
            <span className="inline-flex items-center gap-1.5 rounded-md border bg-background/60 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur">
              {article.readingTime} чтения
            </span>
            {article.tags.map((t) => (
              <span
                key={t}
                className="inline-flex items-center gap-1.5 rounded-md border bg-background/40 px-2 py-1 text-[11px] uppercase tracking-[0.14em] text-muted-foreground backdrop-blur"
              >
                <span className={`size-1 rounded-full ${acc.dot}`} />
                {t}
              </span>
            ))}
          </div>

          <div className="mb-4 flex items-center gap-3">
            <div className={`flex size-9 shrink-0 items-center justify-center rounded-md ${acc.iconBg}`}>
              {Icon && <Icon className="size-[18px]" />}
            </div>
            <span className="text-[10.5px] uppercase tracking-[0.2em] text-muted-foreground">
              {article.category}
            </span>
          </div>
          <h1 className="text-left text-[30px] font-semibold leading-[1.05] tracking-tight md:text-[40px]">
            {article.title}
          </h1>
          <p className="mt-5 max-w-[680px] text-left text-[15px] leading-relaxed text-muted-foreground md:text-[16px]">
            {article.deck}
          </p>
          <div className="mt-7 grid max-w-[820px] gap-2.5 sm:grid-cols-3">
            {article.insights.map((ins, i) => (
              <div key={i} className="rounded-lg border bg-card/60 p-3 backdrop-blur">
                <div className={`font-mono text-[18px] font-semibold leading-none ${acc.text}`}>
                  {ins.metric}
                </div>
                <div className="mt-1.5 text-[12px] leading-snug text-muted-foreground">
                  {ins.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </header>

      {/* BODY — wide content + sticky TOC at far right edge */}
      <div className="grid gap-10 xl:grid-cols-[minmax(0,1fr)_240px]">
        <article className="min-w-0 text-left blog-article">
          <ArticleMarkdown source={md} accent={article.accent} />
        </article>
        <ArticleTOC chapters={extractChapters(md)} accent={article.accent} />
      </div>

      {/* PREV / NEXT */}
      <nav className="rounded-lg border bg-card/30">
        <div className="grid gap-3 p-6 sm:grid-cols-2">
          {prev ? (
            <Link
              href={`/dashboard/blog/${prev.slug}`}
              className="group flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-foreground/20"
            >
              <ArrowLeft className="mt-0.5 size-4 text-muted-foreground transition-transform group-hover:-translate-x-0.5" />
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
                  Предыдущая · № {prev.num}
                </div>
                <div className="mt-0.5 text-[14px] font-medium">{prev.title}</div>
              </div>
            </Link>
          ) : (
            <div />
          )}
          {next ? (
            <Link
              href={`/dashboard/blog/${next.slug}`}
              className="group flex items-start justify-end gap-3 rounded-lg border bg-card p-4 text-right transition-colors hover:border-foreground/20"
            >
              <div>
                <div className="text-[10.5px] uppercase tracking-[0.18em] text-muted-foreground">
                  Следующая · № {next.num}
                </div>
                <div className="mt-0.5 text-[14px] font-medium">{next.title}</div>
              </div>
              <ArrowRight className="mt-0.5 size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
            </Link>
          ) : (
            <div />
          )}
        </div>
      </nav>

      {/* RELATED */}
      <section className="rounded-lg border">
        <div className="p-6">
          <div className="mb-5 flex items-baseline justify-between">
            <h2 className="text-[16px] font-semibold tracking-tight">Все материалы серии</h2>
            <Link
              href="/dashboard/blog"
              className="text-[12px] text-muted-foreground hover:text-foreground"
            >
              ← к индексу
            </Link>
          </div>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {ARTICLES.filter((a) => a.slug !== article.slug).map((a) => {
              const ra = ACCENT[a.accent];
              return (
                <Link
                  key={a.slug}
                  href={`/dashboard/blog/${a.slug}`}
                  className="group flex items-start gap-3 rounded-lg border bg-card p-3 transition-colors hover:border-foreground/20"
                >
                  <div
                    className={`flex size-9 shrink-0 items-center justify-center rounded-md ${ra.iconBg}`}
                  >
                    <span className="text-[16px] leading-none">{a.sticker.emoji}</span>
                  </div>
                  <div className="min-w-0">
                    <div className="mb-1 flex items-center gap-1.5">
                      <span
                        className={`font-mono text-[10.5px] font-semibold uppercase tracking-[0.14em] ${ra.text}`}
                      >
                        {a.sticker.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        · № {a.num}
                      </span>
                    </div>
                    <div className="text-[13.5px] font-medium leading-snug">{a.title}</div>
                    <div className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted-foreground">
                      {a.deck}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>
    </div>
  );
}
