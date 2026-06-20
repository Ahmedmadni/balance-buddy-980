import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight, Wallet, TrendingUp, BellRing, Plus, Receipt, PieChart as PieChartIcon } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { computeWalletBalance } from "@/lib/wallet-balance";
import { kindSign } from "@/components/PersonTxForm";
import { cn } from "@/lib/utils";
import { StaggerGrid, StaggerItem } from "@/components/motion/StaggerGrid";
import { FadeIn } from "@/components/motion/FadeIn";
import { QuickActionsRow } from "@/components/dashboard/QuickActionsRow";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "اللوحة الرئيسية — رصد" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [ledgerRes, expensesRes, walletsRes, txRes, allocRes, invRes, invTxRes] = await Promise.all([
        supabase.from("person_ledger").select("contact_id,contact_name,kind,amount,currency,due_date,reminder_enabled,settled_at"),
        supabase.from("expenses").select("wallet_id,amount,currency,spent_at,categories(name,color)"),
        supabase.from("wallets").select("id,name,opening_balance,currency,color,type"),
        supabase.from("wallet_transactions").select("wallet_id,kind,amount,currency,happened_at"),
        supabase.from("expense_allocations").select("amount,currency,period"),
        supabase.from("investments").select("id,principal,current_value,currency,status"),
        supabase.from("investment_transactions").select("investment_id,kind,amount,currency"),
      ]);
      return {
        ledger: ledgerRes.data ?? [],
        expenses: expensesRes.data ?? [],
        wallets: walletsRes.data ?? [],
        txs: txRes.data ?? [],
        allocations: allocRes.data ?? [],
        investments: invRes.data ?? [],
        invTxs: invTxRes.data ?? [],
      };
    },
  });

  if (isLoading) return <SkeletonGrid />;
  const d = data!;
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);

  const owedToMe: Record<string, number> = {};
  const owedByMe: Record<string, number> = {};
  const balByContact = new Map<string, Record<string, number>>();
  for (const r of d.ledger as any[]) {
    if (!r.contact_id) continue;
    const m = balByContact.get(r.contact_id) ?? {};
    m[r.currency] = (m[r.currency] ?? 0) + kindSign(r.kind) * Number(r.amount);
    balByContact.set(r.contact_id, m);
  }
  for (const m of balByContact.values()) for (const [c, v] of Object.entries(m)) {
    if (v > 0.001) owedToMe[c] = (owedToMe[c] ?? 0) + v;
    else if (v < -0.001) owedByMe[c] = (owedByMe[c] ?? 0) + Math.abs(v);
  }

  const expByWallet = new Map<string, any[]>();
  for (const e of d.expenses as any[]) { if (!e.wallet_id) continue; const a = expByWallet.get(e.wallet_id) ?? []; a.push(e); expByWallet.set(e.wallet_id, a); }
  const txByWallet = new Map<string, any[]>();
  for (const t of d.txs as any[]) { const a = txByWallet.get(t.wallet_id) ?? []; a.push(t); txByWallet.set(t.wallet_id, a); }

  const liquidity: Record<string, number> = {};
  const walletBalances: { id: string; name: string; color: string; type: string; balance: number; currency: string }[] = [];
  for (const w of d.wallets as any[]) {
    const bal = computeWalletBalance(Number(w.opening_balance), txByWallet.get(w.id) ?? [], expByWallet.get(w.id) ?? []);
    liquidity[w.currency] = (liquidity[w.currency] ?? 0) + bal;
    walletBalances.push({ id: w.id, name: w.name, color: w.color ?? "#0ea5e9", type: w.type, balance: bal, currency: w.currency });
  }

  const monthlyExp: Record<string, number> = {};
  for (const a of d.allocations as any[]) {
    if ((a.period as string).slice(0, 7) === currentMonth) monthlyExp[a.currency] = (monthlyExp[a.currency] ?? 0) + Number(a.amount);
  }

  const monthlyInflow: Record<string, number> = {};
  const monthlyOutflow: Record<string, number> = {};
  const INFLOW = new Set(["deposit", "receive", "adjustment"]);
  const OUTFLOW = new Set(["withdraw", "send"]);
  for (const t of d.txs as any[]) {
    if ((t.happened_at as string).slice(0, 7) !== currentMonth) continue;
    if (INFLOW.has(t.kind)) monthlyInflow[t.currency] = (monthlyInflow[t.currency] ?? 0) + Number(t.amount);
    else if (OUTFLOW.has(t.kind)) monthlyOutflow[t.currency] = (monthlyOutflow[t.currency] ?? 0) + Number(t.amount);
  }
  for (const e of d.expenses as any[]) {
    if ((e.spent_at as string).slice(0, 7) === currentMonth) {
      monthlyOutflow[e.currency] = (monthlyOutflow[e.currency] ?? 0) + Number(e.amount);
    }
  }
  const monthlyNet: Record<string, number> = {};
  const allCurs = new Set([...Object.keys(monthlyInflow), ...Object.keys(monthlyOutflow)]);
  for (const c of allCurs) monthlyNet[c] = (monthlyInflow[c] ?? 0) - (monthlyOutflow[c] ?? 0);

  // Investments totals by currency
  const investedByInv = new Map<string, number>();
  const returnsByInv = new Map<string, number>();
  for (const tx of d.invTxs as any[]) {
    if (tx.kind === "capital_add") investedByInv.set(tx.investment_id, (investedByInv.get(tx.investment_id) ?? 0) + Number(tx.amount));
    else if (tx.kind === "capital_withdraw") investedByInv.set(tx.investment_id, (investedByInv.get(tx.investment_id) ?? 0) - Number(tx.amount));
    else if (tx.kind === "return" || tx.kind === "profit") returnsByInv.set(tx.investment_id, (returnsByInv.get(tx.investment_id) ?? 0) + Number(tx.amount));
  }
  const investmentsTotal: Record<string, number> = {};
  const investmentsProfit: Record<string, number> = {};
  for (const inv of d.investments as any[]) {
    if (inv.status === "closed") continue;
    const cur = inv.currency;
    const invested = Number(inv.principal) + (investedByInv.get(inv.id) ?? 0);
    const value = Number(inv.current_value) || invested;
    const profit = value - invested + (returnsByInv.get(inv.id) ?? 0);
    investmentsTotal[cur] = (investmentsTotal[cur] ?? 0) + value;
    investmentsProfit[cur] = (investmentsProfit[cur] ?? 0) + profit;
  }

  const byCat: Record<string, { name: string; color: string; value: number }> = {};
  const daily: { day: string; value: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date(); date.setDate(date.getDate() - i);
    const iso = date.toISOString().slice(0, 10);
    const sum = (d.expenses as any[]).filter((e) => e.spent_at === iso).reduce((s, e) => s + Number(e.amount), 0);
    daily.push({ day: date.toLocaleDateString("ar", { day: "numeric", month: "short" }), value: sum });
  }
  for (const e of d.expenses as any[]) {
    const cat = e.categories;
    const key = cat?.name ?? "أخرى";
    byCat[key] = byCat[key] ?? { name: key, color: cat?.color ?? "#64748b", value: 0 };
    byCat[key].value += Number(e.amount);
  }
  const pieData = Object.values(byCat).slice(0, 6);
  const totalCat = pieData.reduce((s, x) => s + x.value, 0);

  const dueRows = (d.ledger as any[]).filter((r) => (r.kind === "lend" || r.kind === "borrow") && r.due_date && !r.settled_at && r.reminder_enabled);
  dueRows.sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string));
  const overdueCount = dueRows.filter((r) => r.due_date < today).length;

  // Display currency: pick the dominant one in wallets
  const dispCur = Object.keys(liquidity)[0] ?? "SAR";

  return (
    <div className="space-y-6">
      <FadeIn className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold tracking-tight">لوحة التحكم</h1>
          <p className="text-sm text-muted-foreground mt-1">نظرة عامة على وضعك المالي اليوم</p>
        </div>
      </FadeIn>

      {/* KPIs — pairs of two */}
      <StaggerGrid className="grid grid-cols-2 gap-3 sm:gap-4">
        <StaggerItem>
          <KpiCard icon={Wallet} label="إجمالي السيولة" amounts={liquidity} emptyText="أضف محفظة" accent="primary" />
        </StaggerItem>
        <StaggerItem>
          <KpiCard icon={Receipt} label="مصاريف الشهر" amounts={monthlyExp} emptyText="0" accent="muted" />
        </StaggerItem>
        <StaggerItem>
          <KpiCard icon={PieChartIcon} label="الاستثمارات" amounts={investmentsTotal} emptyText="لا يوجد" accent="primary" />
        </StaggerItem>
        <StaggerItem>
          <KpiCard icon={TrendingUp} label="ربح الاستثمارات" amounts={investmentsProfit} emptyText="0" accent="success" signed />
        </StaggerItem>
        <StaggerItem>
          <KpiCard icon={ArrowDownRight} label="مستحق لي" amounts={owedToMe} emptyText="لا يوجد" accent="success" />
        </StaggerItem>
        <StaggerItem>
          <KpiCard icon={ArrowUpRight} label="مستحق عليّ" amounts={owedByMe} emptyText="لا يوجد" accent="destructive" />
        </StaggerItem>
      </StaggerGrid>

      <FadeIn delay={0.08}>
        <QuickActionsRow />
      </FadeIn>


      {dueRows.length > 0 && (
        <FadeIn delay={0.1}>
          <Link to="/app/people" className="block rounded-3xl border border-warning/30 bg-warning/10 p-4 transition-colors hover:bg-warning/15">
            <div className="flex items-center gap-3">
              <div className="grid h-10 w-10 place-items-center rounded-2xl bg-warning/20 text-warning-foreground">
                <BellRing className="h-5 w-5" />
              </div>
              <div className="text-sm font-semibold">
                لديك {dueRows.length} استحقاق مفعّل التذكير
                {overdueCount > 0 && <span className="text-destructive"> · {overdueCount} متأخر</span>}
              </div>
            </div>
          </Link>
        </FadeIn>
      )}

      {/* Cash flow + Wallets row */}
      <div className="grid gap-4 lg:grid-cols-12">
        <FadeIn delay={0.05} className="lg:col-span-8">
          <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold">التدفقات النقدية — الشهر الحالي</h3>
              <span className="text-[11px] text-muted-foreground">{currentMonth}</span>
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              <FlowStat label="الإيرادات" amounts={monthlyInflow} tone="positive" />
              <FlowStat label="المصروفات" amounts={monthlyOutflow} tone="negative" />
              <FlowStat label="صافي التدفق" amounts={monthlyNet} tone="signed" />
            </div>
            <div className="mt-6 h-56">
              <ResponsiveContainer>
                <BarChart data={daily} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis dataKey="day" tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} reversed axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }} orientation="right" axisLine={false} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      direction: "rtl",
                      borderRadius: 12,
                      border: "1px solid var(--color-border)",
                      background: "var(--color-card)",
                      color: "var(--color-foreground)",
                      fontSize: 12,
                    }}
                    cursor={{ fill: "var(--color-accent)", opacity: 0.4 }}
                  />
                  <Bar dataKey="value" fill="var(--color-primary)" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        </FadeIn>

        <FadeIn delay={0.1} className="lg:col-span-4">
          <section className="h-full rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)] flex flex-col">
            <div className="mb-5 flex items-center justify-between">
              <h3 className="text-lg font-bold">المحافظ</h3>
              <Link to="/app/wallets" className="text-xs font-medium text-primary hover:underline">عرض الكل</Link>
            </div>
            {walletBalances.length === 0 ? (
              <Link to="/app/wallets" className="block flex-1 rounded-2xl border-2 border-dashed border-border p-8 text-center text-sm text-muted-foreground transition-colors hover:bg-accent/30">
                <Plus className="h-5 w-5 inline" /> أضف محفظتك الأولى
              </Link>
            ) : (
              <>
                <ul className="space-y-2.5 flex-1">
                  {walletBalances.slice(0, 5).map((w) => (
                    <li key={w.id}>
                      <Link
                        to="/app/wallets/$id"
                        params={{ id: w.id }}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-transparent bg-muted/40 dark:bg-muted/20 p-3 transition-all hover:border-primary/30 hover:bg-muted/60"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          <span className="h-3 w-3 shrink-0 rounded-full ring-4 ring-offset-0" style={{ background: w.color, boxShadow: `0 0 0 4px ${w.color}1f` }} />
                          <span className="truncate text-sm font-semibold">{w.name}</span>
                        </div>
                        <span className={cn("text-sm font-bold tabular-nums shrink-0", w.balance < 0 && "text-destructive")}>
                          {formatMoney(w.balance, w.currency)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
                <Link
                  to="/app/wallets"
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border py-2.5 text-sm text-muted-foreground transition-colors hover:border-primary/40 hover:text-primary"
                >
                  <Plus className="h-4 w-4" /> إضافة محفظة جديدة
                </Link>
              </>
            )}
          </section>
        </FadeIn>
      </div>

      {/* Categories breakdown */}
      <FadeIn delay={0.15}>
        <section className="rounded-3xl border border-border bg-card p-6 shadow-[var(--shadow-card)]">
          <div className="mb-2">
            <h3 className="text-lg font-bold">توزيع المصاريف</h3>
            <p className="text-xs text-muted-foreground">بناءً على نشاطك الحالي</p>
          </div>
          {pieData.length === 0 ? (
            <div className="grid h-56 place-items-center text-sm text-muted-foreground">لا توجد مصاريف بعد</div>
          ) : (
            <div className="mt-4 grid items-center gap-8 md:grid-cols-2">
              <div className="space-y-3">
                {pieData.map((c) => {
                  const pct = totalCat > 0 ? Math.round((c.value / totalCat) * 100) : 0;
                  return (
                    <div key={c.name} className="flex items-center gap-4">
                      <div className="flex items-center gap-2 w-32 shrink-0">
                        <span className="h-2 w-2 rounded-full" style={{ background: c.color }} />
                        <span className="truncate text-xs text-foreground/80">{c.name}</span>
                      </div>
                      <div className="h-1.5 flex-1 rounded-full bg-muted overflow-hidden">
                        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, background: c.color }} />
                      </div>
                      <span className="text-xs font-bold w-10 tabular-nums text-end">{pct}%</span>
                    </div>
                  );
                })}
              </div>
              <div className="relative mx-auto h-52 w-52">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={68}
                      outerRadius={92}
                      paddingAngle={2}
                      strokeWidth={0}
                    >
                      {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        direction: "rtl",
                        borderRadius: 12,
                        border: "1px solid var(--color-border)",
                        background: "var(--color-card)",
                        fontSize: 12,
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-xl font-bold tabular-nums">{formatMoney(totalCat, dispCur)}</span>
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">الإجمالي</span>
                </div>
              </div>
            </div>
          )}
        </section>
      </FadeIn>
    </div>
  );
}

function KpiCard({
  icon: Icon, label, amounts, emptyText, accent, signed = false,
}: {
  icon: any; label: string; amounts: Record<string, number>; emptyText: string;
  accent: "primary" | "success" | "destructive" | "muted"; signed?: boolean;
}) {
  const entries = Object.entries(amounts).filter(([, v]) => Math.abs(v) > 0.001);
  const accentClass = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    destructive: "text-destructive bg-destructive/10",
    muted: "text-foreground bg-muted",
  }[accent];
  const baseValueColor = {
    primary: "text-foreground",
    success: "text-success",
    destructive: "text-destructive",
    muted: "text-foreground",
  }[accent];
  return (
    <div className="group relative h-full rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-[var(--shadow-card)] transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]">
      <div className="flex items-start justify-between gap-3">
        <div className={cn("grid h-10 w-10 sm:h-11 sm:w-11 place-items-center rounded-2xl", accentClass)}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      <p className="mt-3 sm:mt-4 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 space-y-0.5">
        {entries.length === 0 ? (
          <div className="text-xl sm:text-2xl font-bold text-muted-foreground/50">{emptyText}</div>
        ) : entries.map(([cur, amt]) => {
          const color = signed ? (amt > 0 ? "text-success" : amt < 0 ? "text-destructive" : baseValueColor) : baseValueColor;
          const prefix = signed ? (amt > 0 ? "+" : amt < 0 ? "−" : "") : "";
          return (
            <div key={cur} className={cn("text-xl sm:text-2xl font-bold tabular-nums tracking-tight", color)}>
              {prefix}{formatMoney(Math.abs(amt), cur)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function FlowStat({ label, amounts, tone }: { label: string; amounts: Record<string, number>; tone: "positive" | "negative" | "signed" }) {
  const entries = Object.entries(amounts).filter(([, v]) => Math.abs(v) > 0.001);
  const dotColor = tone === "positive" ? "bg-success" : tone === "negative" ? "bg-destructive" : "bg-foreground";
  return (
    <div className="rounded-2xl bg-muted/40 dark:bg-muted/20 p-4">
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <span className={cn("h-2 w-2 rounded-full", dotColor)} /> {label}
      </div>
      {entries.length === 0 ? (
        <div className="mt-1 text-xl font-bold text-muted-foreground/50">0</div>
      ) : entries.map(([cur, amt]) => {
        const color = tone === "positive" ? "text-success"
          : tone === "negative" ? "text-destructive"
          : amt > 0 ? "text-success" : amt < 0 ? "text-destructive" : "";
        const sign = tone === "signed" ? (amt > 0 ? "+" : amt < 0 ? "−" : "") : "";
        return <div key={cur} className={cn("mt-1 text-xl font-bold tabular-nums", color)}>{sign}{formatMoney(Math.abs(amt), cur)}</div>;
      })}
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">{[1,2,3,4].map((i) => <div key={i} className="h-32 animate-pulse rounded-3xl bg-muted" />)}</div>
      <div className="grid gap-4 lg:grid-cols-12">
        <div className="h-80 animate-pulse rounded-3xl bg-muted lg:col-span-8" />
        <div className="h-80 animate-pulse rounded-3xl bg-muted lg:col-span-4" />
      </div>
    </div>
  );
}

export const _unused = TrendingUp;
