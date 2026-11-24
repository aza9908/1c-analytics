import "server-only";
import fs from "node:fs";
import path from "node:path";

const ARTICLES_DIR = path.join(process.cwd(), "content", "articles");

export function getArticleMarkdown(slug: string): string | null {
  const file = path.join(ARTICLES_DIR, `${slug}.md`);
  if (!fs.existsSync(file)) return null;
  return fs.readFileSync(file, "utf8");
}
