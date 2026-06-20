import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  TrendingDown, TrendingUp, ArrowLeftRight, HandCoins, PieChart, BadgePercent,
  Repeat, FileBarChart, Settings, Sparkles, Receipt, Wallet,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { ComponentType } from "react";

type Tone = "rose" | "emerald" | "sky" | "amber" | "violet" | "teal" | "indigo" | "slate";

const toneClass: Record<Tone, string> = {
  rose: "bg-rose-500/10 text-rose-500 dark:text-rose-400",
  emerald: "bg-emerald-500/10 text-emerald-500 dark:text-emerald-400",
  sky: "bg-sky-500/10 text-sky-500 dark:text-sky-400",
  amber: "bg-amber-500/10 text-amber-500 dark:text-amber-400",
  violet: "bg-violet-500/10 text-violet-500 dark:text-violet-400",
  teal: "bg-teal-500/10 text-teal-500 dark:text-teal-400",
  indigo: "bg-indigo-500/10 text-indigo-500 dark:text-indigo-400",
  slate: "bg-slate-500/10 text-slate-600 dark:text-slate-300",
};

type Action = {
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone: Tone;
  to: string;
  search?: Record<string, string>;
};

const QUICK: Action[] = [
  { label: "مصروف", icon: TrendingDown, tone: "rose", to: "/app/expenses", search: { new: "1" } },
  { label: "دخل", icon: TrendingUp, tone: "emerald", to: "/app/wallets", search: { new: "income" } },
  { label: "تحويل", icon: ArrowLeftRight, tone: "sky", to: "/app/wallets", search: { new: "transfer" } },
  { label: "دين / تحصيل", icon: HandCoins, tone: "amber", to: "/app/people", search: { new: "1" } },
  { label: "استثمار", icon: PieChart, tone: "violet", to: "/app/investments" },
  { label: "الزكاة", icon: BadgePercent, tone: "teal", to: "/app/zakat" },
];

const TOOLS: Action[] = [
  { label: "دورية", icon: Repeat, tone: "sky" },
  { label: "المصاريف", icon: Receipt, tone: "rose", to: "/app/expenses" },
  { label: "المحافظ", icon: Wallet, tone: "indigo", to: "/app/wallets" },
  { label: "التقارير", icon: FileBarChart, tone: "emerald", to: "/app/reports" },
  { label: "المستشار", icon: Sparkles, tone: "violet", to: "/app/reports" },
  { label: "الإعدادات", icon: Settings, tone: "slate", to: "/app/settings" },
].map((t) => ({ ...t, to: t.to ?? "/app/recurring" })) as Action[];

function ActionCard({ a, delay }: { a: Action; delay: number }) {
  const Icon = a.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: [0.22, 1, 0.36, 1] as any }}
      whileTap={{ scale: 0.94 }}
      whileHover={{ y: -2 }}
    >
      <Link
        to={a.to as any}
        search={a.search as any}
        preload="intent"
        className="group flex flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)] transition-colors hover:border-primary/30"
      >
        <span className={cn("grid h-11 w-11 place-items-center rounded-xl transition-transform group-hover:scale-110", toneClass[a.tone])}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-[12px] font-semibold text-center leading-tight">{a.label}</span>
      </Link>
    </motion.div>
  );
}

function Row({ title, items }: { title: string; items: Action[] }) {
  return (
    <section className="space-y-3">
      <h3 className="text-base font-bold">{title}</h3>
      <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4 md:grid-cols-6">
        {items.map((a, i) => <ActionCard key={a.label} a={a} delay={i * 0.04} />)}
      </div>
    </section>
  );
}

export function QuickActionsRow() {
  return (
    <div className="space-y-5">
      <Row title="إجراءات سريعة" items={QUICK} />
      <Row title="الأدوات" items={TOOLS} />
    </div>
  );
}
