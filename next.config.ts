import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Включаем gzip-компрессию ответов из `next start`. Уменьшает payload
  // дашбордов в 10x (3.7 MB → ~370 KB).
  compress: true,
};

export default nextConfig;
