import Link from "next/link";
import type { ReactNode } from "react";
import {
  Lightbulb,
  Info,
  AlertTriangle,
  AlertOctagon,
  CheckCircle2,
  StickyNote,
} from "lucide-react";
import type { Article } from "@/lib/articles";

// ---------------------------------------------------------------------------
// Notion-style callouts
// ---------------------------------------------------------------------------

type CalloutType = "tip" | "info" | "warning" | "danger" | "success" | "note";

const CALLOUT_STYLE: Record<
  CalloutType,
  {
    icon: typeof Info;
    bg: string;
    border: string;
    iconColor: string;
    titleColor: string;
    label: string;
  }
> = {
  tip: {
    icon: Lightbulb,
    bg: "bg-amber-400/[0.08]",
    border: "border-amber-400/40",
    iconColor: "text-amber-400",
    titleColor: "text-amber-300",
    label: "Подсказка",
  },
  info: {
    icon: Info,
    bg: "bg-sky-400/[0.07]",
    border: "border-sky-400/40",
    iconColor: "text-sky-400",
    titleColor: "text-sky-300",
    label: "Контекст",
  },
  warning: {
    icon: AlertTriangle,
    bg: "bg-orange-400/[0.08]",
    border: "border-orange-400/40",
    iconColor: "text-orange-400",
    titleColor: "text-orange-300",
    label: "Внимание",
  },
  danger: {
    icon: AlertOctagon,
    bg: "bg-rose-400/[0.08]",
    border: "border-rose-400/40",
    iconColor: "text-rose-400",
    titleColor: "text-rose-300",
    label: "Критично",
  },
  success: {
    icon: CheckCircle2,
    bg: "bg-emerald-400/[0.08]",
    border: "border-emerald-400/40",
    iconColor: "text-emerald-400",
    titleColor: "text-emerald-300",
    label: "Сильная сторона",
  },
  note: {
    icon: StickyNote,
    bg: "bg-violet-400/[0.07]",
    border: "border-violet-400/40",
    iconColor: "text-violet-400",
    titleColor: "text-violet-300",
    label: "Заметка",
  },
};

// ---------------------------------------------------------------------------
// Geist inline stickers — палитра по тонам
// ---------------------------------------------------------------------------

type StickerTone = "neutral" | "danger" | "success" | "warning" | "info" | "accent";

const STICKER_CLASS: Record<StickerTone, { wrap: string; dot: string }> = {
  neutral: {
    wrap: "mx-0.5 inline-flex items-center gap-1 rounded-md border border-foreground/15 bg-foreground/[0.04] px-1.5 py-0.5 align-middle text-[0.82em] font-medium text-foreground/85",
    dot: "size-1 rounded-full bg-foreground/40",
  },
  danger: {
    wrap: "mx-0.5 inline-flex items-center gap-1 rounded-md border border-rose-400/45 bg-rose-400/[0.09] px-1.5 py-0.5 align-middle text-[0.82em] font-medium text-rose-300",
    dot: "size-1 rounded-full bg-rose-400",
  },
  success: {
    wrap: "mx-0.5 inline-flex items-center gap-1 rounded-md border border-emerald-400/45 bg-emerald-400/[0.09] px-1.5 py-0.5 align-middle text-[0.82em] font-medium text-emerald-300",
    dot: "size-1 rounded-full bg-emerald-400",
  },
  warning: {
    wrap: "mx-0.5 inline-flex items-center gap-1 rounded-md border border-amber-400/45 bg-amber-400/[0.09] px-1.5 py-0.5 align-middle text-[0.82em] font-medium text-amber-300",
    dot: "size-1 rounded-full bg-amber-400",
  },
  info: {
    wrap: "mx-0.5 inline-flex items-center gap-1 rounded-md border border-sky-400/45 bg-sky-400/[0.09] px-1.5 py-0.5 align-middle text-[0.82em] font-medium text-sky-300",
    dot: "size-1 rounded-full bg-sky-400",
  },
  accent: {
    wrap: "mx-0.5 inline-flex items-center gap-1 rounded-md border border-violet-400/45 bg-violet-400/[0.09] px-1.5 py-0.5 align-middle text-[0.82em] font-medium text-violet-300",
    dot: "size-1 rounded-full bg-violet-400",
  },
};

function detectCalloutType(s: string): CalloutType | null {
  const t = s.trim().toLowerCase();
  if (t === "tip" || t === "подсказка") return "tip";
  if (t === "info" || t === "контекст") return "info";
  if (t === "warning" || t === "внимание") return "warning";
  if (t === "danger" || t === "критично") return "danger";
  if (t === "success" || t === "успех") return "success";
  if (t === "note" || t === "заметка") return "note";
  return null;
}

// ---------------------------------------------------------------------------
// Slug-helper для якорей навигатора глав. Транслит кириллицы → латиница,
// чтобы id не зависели от темы / окружения.
// ---------------------------------------------------------------------------

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z",
  и: "i", й: "i", к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r",
  с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

function transliterate(s: string): string {
  return s
    .toLowerCase()
    .split("")
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("");
}

export function headingSlug(text: string): string {
  // снимаем разметку (**, *, `, [..](..))
  const plain = text
    .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
    .replace(/[*`]/g, "");
  return (
    transliterate(plain)
      .replace(/[^a-z0-9а-я]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 80) || "section"
  );
}

export type ArticleChapter = {
  level: 2 | 3;
  text: string;
  id: string;
};

// Дублируем парсер заголовков отдельной публичной функцией, чтобы можно было
// вытащить оглавление до рендера и передать в правый sticky-навигатор. Не
// дёргаем сам `parse()`: он private и возвращает токены с inline-маркапом.
export function extractChapters(source: string): ArticleChapter[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n");
  const out: ArticleChapter[] = [];
  const seen = new Map<string, number>();
  for (const line of lines) {
    const m = line.match(/^(#{2,3})\s+(.+?)\s*$/);
    if (!m) continue;
    const level = (m[1].length === 2 ? 2 : 3) as 2 | 3;
    const text = m[2];
    let id = headingSlug(text);
    const dup = seen.get(id) ?? 0;
    if (dup > 0) id = `${id}-${dup}`;
    seen.set(id.replace(/-\d+$/, ""), dup + 1);
    out.push({ level, text, id });
  }
  return out;
}

// ---------------------------------------------------------------------------
// Минимальный markdown-рендерер под наши статьи. Без внешних зависимостей,
// чтобы исключить ESM/transpile-проблемы при сборке на Vercel.
//
// Поддерживается: заголовки h1/h2/h3, параграфы, blockquote, images,
// маркированные/нумерованные списки, GFM-таблицы (с right-align ":---"),
// горизонтальная линия "---", инлайн **bold**, *italic*, `code`, [link](url).
// ---------------------------------------------------------------------------

type Token =
  | { type: "h1"; text: string }
  | { type: "h2"; text: string }
  | { type: "h3"; text: string }
  | { type: "p"; text: string }
  | { type: "quote"; lines: string[] }
  | {
      type: "callout";
      kind: CalloutType;
      title: string;
      lines: string[];
    }
  | { type: "img"; alt: string; src: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] }
  | { type: "table"; head: string[]; aligns: ("left" | "right" | "center")[]; rows: string[][] }
  | { type: "hr" };

const IMG_RE = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;
const TABLE_ALIGN_RE = /^\s*:?-{2,}:?\s*$/;

function parse(md: string): Token[] {
  const lines = md.replace(/\r\n?/g, "\n").split("\n");
  const out: Token[] = [];
  let i = 0;

  const isBlank = (s: string) => /^\s*$/.test(s);

  while (i < lines.length) {
    const line = lines[i];

    // blank — пропускаем
    if (isBlank(line)) {
      i++;
      continue;
    }

    // hr
    if (/^-{3,}\s*$/.test(line)) {
      out.push({ type: "hr" });
      i++;
      continue;
    }

    // headings
    const h = line.match(/^(#{1,3})\s+(.+?)\s*$/);
    if (h) {
      const level = h[1].length;
      const text = h[2];
      out.push({ type: level === 1 ? "h1" : level === 2 ? "h2" : "h3", text });
      i++;
      continue;
    }

    // image-only (на отдельной строке)
    const img = line.match(IMG_RE);
    if (img) {
      out.push({ type: "img", alt: img[1], src: img[2] });
      i++;
      continue;
    }

    // blockquote / callout
    if (/^\s*>/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) {
        buf.push(lines[i].replace(/^\s*>\s?/, ""));
        i++;
      }
      // Notion / GFM-style callout: первая строка вида `[!tip] Заголовок`
      const m = (buf[0] ?? "").match(/^\s*\[!([a-zа-я]+)\]\s*(.*)$/i);
      if (m) {
        const kind = detectCalloutType(m[1]);
        if (kind) {
          const title = m[2].trim();
          out.push({ type: "callout", kind, title, lines: buf.slice(1) });
          continue;
        }
      }
      out.push({ type: "quote", lines: buf });
      continue;
    }

    // tables (GFM)
    if (/^\s*\|/.test(line) && i + 1 < lines.length && /^\s*\|/.test(lines[i + 1])) {
      const headerCells = splitRow(line);
      const sep = splitRow(lines[i + 1]);
      if (sep.every((c) => TABLE_ALIGN_RE.test(c))) {
        const aligns = sep.map<"left" | "right" | "center">((c) => {
          const t = c.trim();
          const left = t.startsWith(":");
          const right = t.endsWith(":");
          if (left && right) return "center";
          if (right) return "right";
          return "left";
        });
        i += 2;
        const rows: string[][] = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) {
          rows.push(splitRow(lines[i]));
          i++;
        }
        out.push({ type: "table", head: headerCells, aligns, rows });
        continue;
      }
    }

    // bullet list
    if (/^\s*[-*]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*[-*]\s+/, "");
        i++;
        // следующая строка с большим отступом → продолжение того же пункта
        while (i < lines.length && /^ {2,}\S/.test(lines[i])) {
          item += " " + lines[i].trim();
          i++;
        }
        items.push(item);
      }
      out.push({ type: "ul", items });
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        let item = lines[i].replace(/^\s*\d+\.\s+/, "");
        i++;
        while (i < lines.length && /^ {2,}\S/.test(lines[i])) {
          item += " " + lines[i].trim();
          i++;
        }
        items.push(item);
      }
      out.push({ type: "ol", items });
      continue;
    }

    // обычный параграф — собрать до пустой строки или блочного маркера
    const buf: string[] = [line];
    i++;
    while (
      i < lines.length &&
      !isBlank(lines[i]) &&
      !/^#{1,6}\s/.test(lines[i]) &&
      !/^\s*>/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i]) &&
      !/^\s*\|/.test(lines[i]) &&
      !/^-{3,}\s*$/.test(lines[i]) &&
      !IMG_RE.test(lines[i])
    ) {
      buf.push(lines[i]);
      i++;
    }
    out.push({ type: "p", text: buf.join(" ") });
  }

  return out;
}

function splitRow(line: string): string[] {
  // обрезаем ведущие/хвостовые пайпы и сплитим
  const trimmed = line.trim().replace(/^\|/, "").replace(/\|$/, "");
  return trimmed.split("|").map((c) => c.trim());
}

// ---------------------------------------------------------------------------
// Inline формат: **bold**, *italic*, `code`, [text](url)
// ---------------------------------------------------------------------------

let _key = 0;
function nextKey(): string {
  return `k${_key++}`;
}

function renderInline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  let i = 0;
  let buf = "";
  const flush = () => {
    if (buf) {
      parts.push(buf);
      buf = "";
    }
  };

  while (i < text.length) {
    // ссылка [text](url)
    if (text[i] === "[") {
      const close = text.indexOf("]", i + 1);
      if (close > -1 && text[close + 1] === "(") {
        const paren = text.indexOf(")", close + 2);
        if (paren > -1) {
          const label = text.slice(i + 1, close);
          const href = text.slice(close + 2, paren);
          flush();
          const isInternal = href.startsWith("/");
          const inner = renderInline(label);
          if (isInternal) {
            parts.push(
              <Link
                key={nextKey()}
                href={href}
                className="text-sky-300 underline-offset-4 hover:underline"
              >
                {inner}
              </Link>
            );
          } else {
            parts.push(
              <a
                key={nextKey()}
                href={href}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sky-300 underline-offset-4 hover:underline"
              >
                {inner}
              </a>
            );
          }
          i = paren + 1;
          continue;
        }
      }
    }

    // ==geist sticker== — инлайн-чип акцентного цвета.
    // Префиксы внутри: `!` — danger (rose), `+` — success (emerald),
    // `~` — warning (amber), `?` — info (sky), `*` — accent (violet),
    // без префикса — neutral (graphite).
    if (text[i] === "=" && text[i + 1] === "=") {
      const close = text.indexOf("==", i + 2);
      if (close > -1) {
        flush();
        const raw = text.slice(i + 2, close);
        const tone =
          raw.startsWith("!") ? "danger"
          : raw.startsWith("+") ? "success"
          : raw.startsWith("~") ? "warning"
          : raw.startsWith("?") ? "info"
          : raw.startsWith("*") ? "accent"
          : "neutral";
        const body = tone !== "neutral" ? raw.slice(1) : raw;
        const cls = STICKER_CLASS[tone];
        parts.push(
          <span key={nextKey()} className={cls.wrap}>
            <span className={cls.dot} />
            {renderInline(body)}
          </span>
        );
        i = close + 2;
        continue;
      }
    }

    // **bold**
    if (text[i] === "*" && text[i + 1] === "*") {
      const close = text.indexOf("**", i + 2);
      if (close > -1) {
        flush();
        parts.push(
          <strong key={nextKey()} className="font-semibold text-foreground">
            {renderInline(text.slice(i + 2, close))}
          </strong>
        );
        i = close + 2;
        continue;
      }
    }

    // *italic*
    if (text[i] === "*") {
      const close = text.indexOf("*", i + 1);
      if (close > -1) {
        flush();
        parts.push(
          <em key={nextKey()} className="italic">
            {renderInline(text.slice(i + 1, close))}
          </em>
        );
        i = close + 1;
        continue;
      }
    }

    // `inline code`
    if (text[i] === "`") {
      const close = text.indexOf("`", i + 1);
      if (close > -1) {
        flush();
        parts.push(
          <code
            key={nextKey()}
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.85em] text-foreground"
          >
            {text.slice(i + 1, close)}
          </code>
        );
        i = close + 1;
        continue;
      }
    }

    buf += text[i];
    i++;
  }

  flush();
  return parts;
}

// ---------------------------------------------------------------------------
// Render
// ---------------------------------------------------------------------------

export function ArticleMarkdown({
  source,
}: {
  source: string;
  /** Акцентный цвет статьи. Пробрасывается вызывающими; сейчас не используется
   *  разметкой — оставлен, чтобы кастомный рендерер графиков мог его забрать. */
  accent?: Article["accent"];
}) {
  // сбрасываем счётчик ключей на каждый рендер
  _key = 0;
  const tokens = parse(source);

  // Те же id, что и в extractChapters — чтобы якоря из правого навигатора
  // совпадали с реальными заголовками.
  const seen = new Map<string, number>();
  const slugFor = (text: string): string => {
    let id = headingSlug(text);
    const dup = seen.get(id) ?? 0;
    if (dup > 0) id = `${id}-${dup}`;
    seen.set(id.replace(/-\d+$/, ""), dup + 1);
    return id;
  };

  return (
    <div className="article-prose">
      {tokens.map((t, idx) => {
        switch (t.type) {
          case "h1":
            // Главный заголовок уже отрисован в hero — пропускаем
            return null;
          case "h2":
            return (
              <h2
                key={idx}
                id={slugFor(t.text)}
                className="mt-12 mb-3 scroll-mt-24 text-[22px] font-semibold leading-tight tracking-tight"
              >
                {renderInline(t.text)}
              </h2>
            );
          case "h3":
            return (
              <h3
                key={idx}
                id={slugFor(t.text)}
                className="mt-8 mb-2 scroll-mt-24 text-[16px] font-semibold tracking-tight text-foreground"
              >
                {renderInline(t.text)}
              </h3>
            );
          case "p":
            return (
              <p
                key={idx}
                className="my-3.5 text-[15px] leading-[1.75] text-foreground/90"
              >
                {renderInline(t.text)}
              </p>
            );
          case "quote":
            return (
              <aside
                key={idx}
                className="my-6 flex gap-3 rounded-lg border border-border/70 bg-muted/30 px-4 py-3.5 text-[14px] leading-relaxed text-muted-foreground"
              >
                <StickyNote className="mt-0.5 size-4 shrink-0 text-muted-foreground/70" />
                <div className="min-w-0 flex-1">
                  {t.lines.map((ln, j) => (
                    <p key={j} className={j === 0 ? "" : "mt-2"}>
                      {renderInline(ln)}
                    </p>
                  ))}
                </div>
              </aside>
            );
          case "callout": {
            const s = CALLOUT_STYLE[t.kind];
            const Icon = s.icon;
            return (
              <aside
                key={idx}
                className={`my-6 flex gap-3 rounded-lg border ${s.border} ${s.bg} px-4 py-3.5`}
              >
                <Icon className={`mt-0.5 size-[18px] shrink-0 ${s.iconColor}`} />
                <div className="min-w-0 flex-1">
                  {(t.title || t.lines.length === 0) && (
                    <div
                      className={`mb-1 text-[12.5px] font-semibold uppercase tracking-wider ${s.titleColor}`}
                    >
                      {t.title ? renderInline(t.title) : s.label}
                    </div>
                  )}
                  <div className="space-y-2 text-[14px] leading-relaxed text-foreground/85">
                    {t.lines.map((ln, j) =>
                      ln.trim() === "" ? null : (
                        <p key={j}>{renderInline(ln)}</p>
                      )
                    )}
                  </div>
                </div>
              </aside>
            );
          }
          case "img": {
            // Расширенный синтаксис: ![chart:<slug>](alt) — плейсхолдер под график.
            // `(/charts/<slug>.png)` мапится на тот же chart-slug.
            // Компонент-рендерер графиков в этот репозиторий не входит: он был
            // завязан на датасеты конкретного проекта. Подставьте свой.
            const src = t.src || "";
            let chartSlug: string | null = null;
            if (src.startsWith("chart:")) chartSlug = src.slice("chart:".length);
            else if (/^\/charts\//.test(src)) chartSlug = src.replace(/^\/charts\//, "").replace(/\.(png|svg|jpg)$/, "");
            return (
              <figure key={idx} className="my-8">
                <div className="flex h-48 items-center justify-center rounded-lg border border-dashed border-foreground/15 bg-foreground/[0.02] text-[12px] italic text-muted-foreground">
                  {chartSlug ? `график: ${chartSlug}` : t.alt || "график"}
                </div>
              </figure>
            );
          }
          case "hr":
            return <hr key={idx} className="my-10 border-border/60" />;
          case "ul":
            return (
              <ul
                key={idx}
                className="my-3.5 list-disc space-y-1.5 pl-5 text-[15px] leading-[1.7] text-foreground/90 marker:text-muted-foreground"
              >
                {t.items.map((it, j) => (
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </ul>
            );
          case "ol":
            return (
              <ol
                key={idx}
                className="my-3.5 list-decimal space-y-1.5 pl-5 text-[15px] leading-[1.7] text-foreground/90 marker:text-muted-foreground"
              >
                {t.items.map((it, j) => (
                  <li key={j}>{renderInline(it)}</li>
                ))}
              </ol>
            );
          case "table":
            return (
              <div
                key={idx}
                className="my-6 overflow-x-auto rounded-lg border"
              >
                <table className="w-full border-collapse text-[13.5px]">
                  <thead className="bg-muted/40 text-[12px] uppercase tracking-wider text-muted-foreground">
                    <tr>
                      {t.head.map((h, j) => (
                        <th
                          key={j}
                          className="px-3 py-2 font-semibold first:pl-4 last:pr-4"
                          style={{ textAlign: t.aligns[j] || "left" }}
                        >
                          {renderInline(h)}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {t.rows.map((row, j) => (
                      <tr
                        key={j}
                        className="transition-colors hover:bg-muted/20"
                      >
                        {row.map((cell, k) => (
                          <td
                            key={k}
                            className="px-3 py-2 align-top text-foreground/90 first:pl-4 last:pr-4 tabular-nums"
                            style={{ textAlign: t.aligns[k] || "left" }}
                          >
                            {renderInline(cell)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
        }
      })}
    </div>
  );
}
