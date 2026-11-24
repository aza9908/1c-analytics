/**
 * Реестр аналитических статей блога.
 *
 * Репозиторий публикуется без контента — массив пуст. Чтобы добавить статью:
 *   1. положить markdown в `content/articles/<slug>.md`;
 *   2. описать её метаданные записью в `ARTICLES` ниже (`slug` = имя файла).
 *
 * Рендер: `lib/articles-server.ts` читает файл с диска,
 * `components/blog/markdown.tsx` превращает его в React-дерево.
 */

export type Insight = {
  metric: string;
  label: string;
};

export type Sticker = {
  emoji: string;
  label: string;
};

export type Article = {
  slug: string;
  num: string;
  title: string;
  deck: string;
  category: string;
  accent: "amber" | "rose" | "violet" | "sky" | "emerald" | "fuchsia" | "orange" | "indigo" | "cyan";
  icon: string;
  insights: Insight[];
  readingTime: string;
  cover?: string;
  tags: string[];
  sticker: Sticker;
};

export const ARTICLES: Article[] = [];

export function getArticle(slug: string): Article | undefined {
  return ARTICLES.find((a) => a.slug === slug);
}

export function getAllSlugs(): string[] {
  return ARTICLES.map((a) => a.slug);
}
