import { Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import {
  TrendingDown, TrendingUp, ArrowLeftRight, HandCoins, PieChart, BadgePercent,
  Repeat, FileBarChart, Settings, Sparkles, Receipt, Wallet, Sliders, Check, ListOrdered,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useMemo, useState, type ComponentType } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

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
  id: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
  tone: Tone;
  to: string;
  search?: Record<string, string>;
};

const QUICK: Action[] = [
  { id: "expense", label: "مصروف", icon: TrendingDown, tone: "rose", to: "/app/expenses", search: { new: "1" } },
  { id: "income", label: "دخل", icon: TrendingUp, tone: "emerald", to: "/app/wallets", search: { new: "income" } },
  { id: "transfer", label: "تحويل", icon: ArrowLeftRight, tone: "sky", to: "/app/wallets", search: { new: "transfer" } },
  { id: "debt", label: "دين / تحصيل", icon: HandCoins, tone: "amber", to: "/app/people", search: { new: "1" } },
  { id: "invest", label: "استثمار", icon: PieChart, tone: "violet", to: "/app/investments" },
  { id: "zakat", label: "الزكاة", icon: BadgePercent, tone: "teal", to: "/app/zakat" },
];

const TOOLS: Action[] = [
  { id: "transactions", label: "العمليات", icon: ListOrdered, tone: "teal", to: "/app/transactions" },
  { id: "recurring", label: "دورية", icon: Repeat, tone: "sky", to: "/app/recurring" },
  { id: "expenses", label: "المصاريف", icon: Receipt, tone: "rose", to: "/app/expenses" },
  { id: "wallets", label: "المحافظ", icon: Wallet, tone: "indigo", to: "/app/wallets" },
  { id: "reports", label: "التقارير", icon: FileBarChart, tone: "emerald", to: "/app/reports" },
  { id: "advisor", label: "المستشار", icon: Sparkles, tone: "violet", to: "/app/reports" },
  { id: "settings", label: "الإعدادات", icon: Settings, tone: "slate", to: "/app/settings" },
];

const STORAGE_KEY = "dashboard.quickActions.v1";
const DEFAULT_IDS = QUICK.map((q) => q.id);

function loadSelection(): string[] {
  if (typeof window === "undefined") return DEFAULT_IDS;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_IDS;
    const arr = JSON.parse(raw) as string[];
    if (!Array.isArray(arr) || arr.length === 0) return DEFAULT_IDS;
    return arr.filter((id) => QUICK.some((q) => q.id === id));
  } catch { return DEFAULT_IDS; }
}

function ActionCard({ a, delay }: { a: Action; delay: number }) {
  const Icon = a.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3, ease: [0.22, 1, 0.36, 1] as any }}
      whileTap={{ scale: 0.94 }}
      whileHover={{ y: -2 }}
      className="snap-start shrink-0 w-[88px]"
    >
      <Link
        to={a.to as any}
        search={a.search as any}
        preload="intent"
        className="group flex h-full flex-col items-center justify-center gap-2 rounded-2xl border border-border bg-card p-3 shadow-[var(--shadow-card)] transition-colors hover:border-primary/30"
      >
        <span className={cn("grid h-11 w-11 place-items-center rounded-xl transition-transform group-hover:scale-110", toneClass[a.tone])}>
          <Icon className="h-5 w-5" />
        </span>
        <span className="text-[12px] font-semibold text-center leading-tight">{a.label}</span>
      </Link>
    </motion.div>
  );
}

function ScrollRow({ items }: { items: Action[] }) {
  return (
    <div
      className="flex gap-2.5 overflow-x-auto snap-x snap-mandatory pb-2 -mx-1 px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {items.map((a, i) => <ActionCard key={a.id} a={a} delay={i * 0.04} />)}
    </div>
  );
}

function CustomizeDialog({
  selected, onChange,
}: { selected: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<string[]>(selected);
  useEffect(() => { if (open) setDraft(selected); }, [open, selected]);

  const toggle = (id: string) => {
    setDraft((d) => d.includes(id) ? d.filter((x) => x !== id) : [...d, id]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          aria-label="تخصيص الإجراءات السريعة"
          className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
        >
          <Sliders className="h-3.5 w-3.5" /> تخصيص
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>تخصيص الإجراءات السريعة</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-2 gap-2 py-2">
          {QUICK.map((a) => {
            const Icon = a.icon;
            const active = draft.includes(a.id);
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => toggle(a.id)}
                className={cn(
                  "flex items-center gap-3 rounded-xl border p-3 text-right transition-all",
                  active ? "border-primary/60 bg-primary/5" : "border-border bg-card hover:border-primary/30",
                )}
              >
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-lg", toneClass[a.tone])}>
                  <Icon className="h-4 w-4" />
                </span>
                <span className="flex-1 text-sm font-semibold">{a.label}</span>
                {active && <Check className="h-4 w-4 text-primary shrink-0" />}
              </button>
            );
          })}
        </div>
        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="ghost" onClick={() => setDraft(DEFAULT_IDS)}>إعادة الافتراضي</Button>
          <Button
            onClick={() => {
              const final = draft.length === 0 ? DEFAULT_IDS : draft;
              localStorage.setItem(STORAGE_KEY, JSON.stringify(final));
              onChange(final);
              setOpen(false);
            }}
          >
            حفظ
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function QuickActionsRow() {
  const [selectedIds, setSelectedIds] = useState<string[]>(DEFAULT_IDS);
  useEffect(() => { setSelectedIds(loadSelection()); }, []);

  const quickItems = useMemo(
    () => selectedIds.map((id) => QUICK.find((q) => q.id === id)).filter(Boolean) as Action[],
    [selectedIds],
  );

  return (
    <div className="space-y-5">
      <section className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-base font-bold">إجراءات سريعة</h3>
          <CustomizeDialog selected={selectedIds} onChange={setSelectedIds} />
        </div>
        <ScrollRow items={quickItems} />
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-bold">الأدوات</h3>
        <ScrollRow items={TOOLS} />
      </section>
    </div>
  );
}
