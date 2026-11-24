import { NextResponse, type NextRequest } from "next/server";
import { AUTH_COOKIE, AUTH_DISABLED, expectedToken, safeEq } from "@/lib/auth";

// Всё под авторизацией. Для /api/* возвращаем 401 JSON (чтобы client fetch
// не следовал за 307 на HTML логина и не парсил его как JSON → "Нет данных").
// Для page-роутов — нормальный редирект на /login?next=...

export async function middleware(req: NextRequest) {
  if (AUTH_DISABLED) return NextResponse.next();

  const token = req.cookies.get(AUTH_COOKIE)?.value;
  if (token) {
    const expected = await expectedToken();
    if (safeEq(token, expected)) return NextResponse.next();
  }

  const isApi = req.nextUrl.pathname.startsWith("/api/");
  if (isApi) {
    return new NextResponse(
      JSON.stringify({ error: "unauthorized", code: 401 }),
      { status: 401, headers: { "content-type": "application/json" } },
    );
  }

  const url = req.nextUrl.clone();
  const nextParam = req.nextUrl.pathname + req.nextUrl.search;
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(nextParam)}`;
  return NextResponse.redirect(url);
}

export const config = {
  matcher: [
    // всё, кроме: статики Next, favicon и самой страницы /login
    "/((?!_next/static|_next/image|favicon.ico|login).*)",
  ],
};
