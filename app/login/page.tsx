import { LoginForm } from "./login-form";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Вход · 1С Аналитика",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  const next = params.next || "/";

  return (
    <div className="fixed inset-0 z-[60] h-dvh w-dvw overflow-hidden bg-[#0a0a0b] text-white">
      {/* decorative blurred dashboard behind the card */}
      <BackdropPreview />

      {/* dimming + blur wash */}
      <div className="absolute inset-0 z-10 bg-black/50 backdrop-blur-[18px]" />

      {/* soft coloured glows */}
      <div
        className="absolute -left-40 top-0 z-0 h-[520px] w-[520px] rounded-full opacity-60 blur-[110px]"
        style={{ background: "radial-gradient(circle, hsl(var(--ds-blue-700-value)) 0%, transparent 70%)" }}
      />
      <div
        className="absolute -right-40 bottom-0 z-0 h-[520px] w-[520px] rounded-full opacity-50 blur-[110px]"
        style={{ background: "radial-gradient(circle, hsl(var(--ds-amber-700-value)) 0%, transparent 70%)" }}
      />

      {/* login card */}
      <div className="relative z-20 flex h-full items-center justify-center px-4">
        <div
          className="font-igra-sans w-full max-w-[380px] rounded-2xl border border-white/10 bg-white/[0.04] p-7 shadow-[0_24px_80px_-20px_rgba(0,0,0,0.6)] backdrop-blur-2xl"
          style={{ fontFamily: "var(--font-igra-sans), var(--font-sans), system-ui, sans-serif" }}
        >
          <div className="mb-6">
            <h1 className="text-[28px] font-semibold leading-none tracking-tight text-white">
              1С Аналитика
            </h1>
            <p className="mt-2 text-sm text-white/55">
              Внутренний дашборд. Введите логин и пароль.
            </p>
          </div>

          <LoginForm next={next} />

          <div className="mt-5 text-center text-[11px] text-white/35">
            защищённый доступ · только для команды
          </div>
        </div>
      </div>
    </div>
  );
}

// Декоративный «блюр-превью» дашборда за окном логина — силуэты сайдбара,
// KPI-ряда, таблицы и графиков. Всё размыто, никаких реальных данных.
function BackdropPreview() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0 z-0 select-none opacity-80"
      style={{ filter: "blur(6px)" }}
    >
      <div className="flex h-full w-full">
        {/* sidebar silhouette */}
        <div className="hidden h-full w-[220px] shrink-0 border-r border-white/5 bg-white/[0.02] p-4 md:block">
          <div className="mb-6 h-5 w-28 rounded bg-white/10" />
          <div className="flex flex-col gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md px-2 py-1.5"
                style={{ background: i === 6 ? "rgba(255,255,255,0.08)" : "transparent" }}
              >
                <div className="size-4 rounded bg-white/10" />
                <div className="h-3 w-24 rounded bg-white/10" />
              </div>
            ))}
          </div>
        </div>

        {/* main grid */}
        <div className="flex flex-1 flex-col gap-4 p-6">
          {/* topbar strip */}
          <div className="mb-2 flex items-center justify-between">
            <div>
              <div className="h-5 w-40 rounded bg-white/10" />
              <div className="mt-2 h-3 w-64 rounded bg-white/5" />
            </div>
            <div className="h-8 w-24 rounded-md bg-white/5" />
          </div>

          {/* KPI row */}
          <div className="grid grid-cols-6 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div
                key={i}
                className="relative overflow-hidden rounded-xl border border-white/5 bg-white/[0.03] p-4"
              >
                <div
                  className="absolute left-0 top-0 h-full w-[3px]"
                  style={{
                    background:
                      i % 3 === 0
                        ? "hsl(var(--ds-green-700-value))"
                        : i % 3 === 1
                          ? "hsl(var(--ds-blue-700-value))"
                          : "hsl(var(--ds-amber-700-value))",
                  }}
                />
                <div className="h-2.5 w-16 rounded bg-white/10" />
                <div className="mt-3 h-6 w-24 rounded bg-white/20" />
                <div className="mt-2 h-2 w-20 rounded bg-white/5" />
              </div>
            ))}
          </div>

          {/* content grid */}
          <div className="grid flex-1 grid-cols-3 gap-4">
            {/* big chart card */}
            <div className="col-span-2 flex flex-col gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-5">
              <div className="h-4 w-40 rounded bg-white/10" />
              <div className="h-3 w-60 rounded bg-white/5" />
              <div className="mt-4 flex-1">
                <FakeAreaChart />
              </div>
            </div>

            {/* bar list card */}
            <div className="flex flex-col gap-3 rounded-xl border border-white/5 bg-white/[0.03] p-5">
              <div className="h-4 w-36 rounded bg-white/10" />
              <div className="h-3 w-52 rounded bg-white/5" />
              <div className="mt-3 flex flex-col gap-2">
                {[88, 72, 60, 48, 38, 28, 20, 14].map((w, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div
                      className="h-6 rounded-md"
                      style={{
                        width: `${w}%`,
                        background:
                          "linear-gradient(90deg, hsl(var(--ds-blue-100-value)) 0%, hsl(var(--ds-blue-400-value)) 100%)",
                        opacity: 0.65,
                      }}
                    />
                    <div className="h-2 w-8 rounded bg-white/10" />
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* table card */}
          <div className="rounded-xl border border-white/5 bg-white/[0.03] p-5">
            <div className="h-4 w-44 rounded bg-white/10" />
            <div className="mt-4 flex flex-col divide-y divide-white/5">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="grid grid-cols-7 gap-4 py-2.5">
                  <div className="col-span-2 h-3 rounded bg-white/10" />
                  <div className="h-3 rounded bg-white/5" />
                  <div className="h-3 rounded bg-white/5" />
                  <div className="h-3 rounded bg-white/5" />
                  <div className="h-3 rounded bg-white/5" />
                  <div className="h-3 rounded bg-white/10" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* agent panel silhouette */}
        <div className="hidden h-full w-[320px] shrink-0 border-l border-white/5 bg-white/[0.02] p-4 xl:block">
          <div className="mb-4 h-5 w-28 rounded bg-white/10" />
          <div className="flex flex-col gap-3">
            <div className="h-16 rounded-md bg-white/5" />
            <div className="h-24 rounded-md bg-white/5" />
            <div className="h-10 rounded-md bg-white/5" />
          </div>
        </div>
      </div>
    </div>
  );
}

// Примитивный «SVG-график» как силуэт area-chart — сплошная кривая + заливка.
function FakeAreaChart() {
  const path =
    "M0,120 C60,80 90,130 150,90 C210,50 260,140 320,100 C380,60 430,110 500,70 L500,180 L0,180 Z";
  const line =
    "M0,120 C60,80 90,130 150,90 C210,50 260,140 320,100 C380,60 430,110 500,70";
  return (
    <svg viewBox="0 0 500 180" className="h-full w-full" preserveAspectRatio="none">
      <defs>
        <linearGradient id="area-fill" x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="hsl(var(--ds-blue-600-value))" stopOpacity="0.45" />
          <stop offset="100%" stopColor="hsl(var(--ds-blue-600-value))" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={path} fill="url(#area-fill)" />
      <path d={line} fill="none" stroke="hsl(var(--ds-blue-500-value))" strokeWidth="1.5" opacity="0.8" />
    </svg>
  );
}
