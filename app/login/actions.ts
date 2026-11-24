"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { AUTH_COOKIE, credsMatch, expectedToken } from "@/lib/auth";

export interface LoginState {
  ok: boolean | null;
  error: string | null;
}

function sanitizeNext(raw: string): string {
  // только внутренние пути, чтобы кука не использовалась для open-redirect
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/";
  if (raw.startsWith("/login")) return "/";
  return raw;
}

export async function loginAction(
  _prev: LoginState,
  formData: FormData
): Promise<LoginState> {
  const user = String(formData.get("user") ?? "").trim();
  const pass = String(formData.get("pass") ?? "");
  const next = sanitizeNext(String(formData.get("next") ?? "/"));

  if (!credsMatch(user, pass)) {
    return { ok: false, error: "Неверный логин или пароль" };
  }

  const token = await expectedToken();
  const jar = await cookies();
  // secure:false — у нас HTTP за nginx. Иначе браузер не отправляет cookie
  // обратно по HTTP и каждый переход триггерит /login.
  // Если поставите HTTPS — поменяйте на `process.env.AUTH_COOKIE_SECURE === "1"`.
  jar.set(AUTH_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 7, // неделя
    secure: process.env.AUTH_COOKIE_SECURE === "1",
  });

  redirect(next);
}
