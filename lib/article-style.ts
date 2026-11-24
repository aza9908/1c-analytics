import type { Article } from "./articles";

export const ACCENT: Record<
  Article["accent"],
  { ring: string; chip: string; dot: string; gradient: string; text: string; iconBg: string }
> = {
  amber: {
    ring: "ring-amber-500/30",
    chip: "bg-amber-500/10 text-amber-300 ring-1 ring-inset ring-amber-400/20",
    dot: "bg-amber-400",
    gradient: "from-amber-500/15 via-amber-400/5 to-transparent",
    text: "text-amber-300",
    iconBg: "bg-amber-500/15 text-amber-300",
  },
  rose: {
    ring: "ring-rose-500/30",
    chip: "bg-rose-500/10 text-rose-300 ring-1 ring-inset ring-rose-400/20",
    dot: "bg-rose-400",
    gradient: "from-rose-500/20 via-rose-400/5 to-transparent",
    text: "text-rose-300",
    iconBg: "bg-rose-500/15 text-rose-300",
  },
  violet: {
    ring: "ring-violet-500/30",
    chip: "bg-violet-500/10 text-violet-300 ring-1 ring-inset ring-violet-400/20",
    dot: "bg-violet-400",
    gradient: "from-violet-500/20 via-violet-400/5 to-transparent",
    text: "text-violet-300",
    iconBg: "bg-violet-500/15 text-violet-300",
  },
  sky: {
    ring: "ring-sky-500/30",
    chip: "bg-sky-500/10 text-sky-300 ring-1 ring-inset ring-sky-400/20",
    dot: "bg-sky-400",
    gradient: "from-sky-500/20 via-sky-400/5 to-transparent",
    text: "text-sky-300",
    iconBg: "bg-sky-500/15 text-sky-300",
  },
  emerald: {
    ring: "ring-emerald-500/30",
    chip: "bg-emerald-500/10 text-emerald-300 ring-1 ring-inset ring-emerald-400/20",
    dot: "bg-emerald-400",
    gradient: "from-emerald-500/20 via-emerald-400/5 to-transparent",
    text: "text-emerald-300",
    iconBg: "bg-emerald-500/15 text-emerald-300",
  },
  fuchsia: {
    ring: "ring-fuchsia-500/30",
    chip: "bg-fuchsia-500/10 text-fuchsia-300 ring-1 ring-inset ring-fuchsia-400/20",
    dot: "bg-fuchsia-400",
    gradient: "from-fuchsia-500/20 via-fuchsia-400/5 to-transparent",
    text: "text-fuchsia-300",
    iconBg: "bg-fuchsia-500/15 text-fuchsia-300",
  },
  orange: {
    ring: "ring-orange-500/30",
    chip: "bg-orange-500/10 text-orange-300 ring-1 ring-inset ring-orange-400/20",
    dot: "bg-orange-400",
    gradient: "from-orange-500/20 via-orange-400/5 to-transparent",
    text: "text-orange-300",
    iconBg: "bg-orange-500/15 text-orange-300",
  },
  indigo: {
    ring: "ring-indigo-500/30",
    chip: "bg-indigo-500/10 text-indigo-300 ring-1 ring-inset ring-indigo-400/20",
    dot: "bg-indigo-400",
    gradient: "from-indigo-500/20 via-indigo-400/5 to-transparent",
    text: "text-indigo-300",
    iconBg: "bg-indigo-500/15 text-indigo-300",
  },
  cyan: {
    ring: "ring-cyan-500/30",
    chip: "bg-cyan-500/10 text-cyan-300 ring-1 ring-inset ring-cyan-400/20",
    dot: "bg-cyan-400",
    gradient: "from-cyan-500/20 via-cyan-400/5 to-transparent",
    text: "text-cyan-300",
    iconBg: "bg-cyan-500/15 text-cyan-300",
  },
};
