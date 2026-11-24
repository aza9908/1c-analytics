"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Loader2, Lock, User } from "lucide-react";

const INITIAL: LoginState = { ok: null, error: null };

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, isPending] = useActionState(loginAction, INITIAL);

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-[0.14em] text-white/60">
          Логин
        </span>
        <div className="relative">
          <User className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
          <Input
            name="user"
            autoComplete="username"
            required
            autoFocus
            defaultValue=""
            className="h-11 bg-white/5 border-white/10 pl-9 text-white placeholder:text-white/30 focus-visible:ring-white/40"
            placeholder="admin"
          />
        </div>
      </label>

      <label className="flex flex-col gap-1.5">
        <span className="text-[11px] uppercase tracking-[0.14em] text-white/60">
          Пароль
        </span>
        <div className="relative">
          <Lock className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-white/40" />
          <Input
            name="pass"
            type="password"
            autoComplete="current-password"
            required
            className="h-11 bg-white/5 border-white/10 pl-9 text-white placeholder:text-white/30 focus-visible:ring-white/40"
            placeholder="••••••"
          />
        </div>
      </label>

      {state.error && (
        <div className="rounded-md border border-[hsl(var(--ds-red-400-value))]/40 bg-[hsl(var(--ds-red-400-value))]/10 px-3 py-2 text-sm text-[hsl(var(--ds-red-200-value))]">
          {state.error}
        </div>
      )}

      <Button
        type="submit"
        size="lg"
        disabled={isPending}
        className="mt-2 h-11 bg-white text-black hover:bg-white/90 disabled:opacity-70"
      >
        {isPending ? (
          <>
            <Loader2 className="size-4 animate-spin" /> Входим…
          </>
        ) : (
          "Войти"
        )}
      </Button>
    </form>
  );
}
