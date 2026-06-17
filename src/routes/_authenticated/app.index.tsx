import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney, formatDate } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight, Wallet, TrendingUp, BellRing, AlertTriangle, Plus } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";
import { computeWalletBalance } from "@/lib/wallet-balance";
import { kindSign } from "@/components/PersonTxForm";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "اللوحة الرئيسية — رصد" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [ledgerRes, expensesRes, walletsRes, txRes, allocRes] = await Promise.all([
        supabase.from("person_ledger").select("contact_id,contact_name,kind,amount,currency,due_date,reminder_enabled,settled_at"),
        supabase.from("expenses").select("wallet_id,amount,currency,spent_at,categories(name,color)"),
        supabase.from("wallets").select("id,name,opening_balance,currency,color,type"),
        supabase.from("wallet_transactions").select("wallet_id,kind,amount,currency,happened_at"),
        supabase.from("expense_allocations").select("amount,currency,period"),
      ]);
      return {
        ledger: ledgerRes.data ?? [],
        expenses: expensesRes.data ?? [],
        wallets: walletsRes.data ?? [],
        txs: txRes.data ?? [],
        allocations: allocRes.data ?? [],
      };
    },
  });

  if (isLoading) return <SkeletonGrid />;
  const d = data!;
  const today = new Date().toISOString().slice(0, 10);
  const currentMonth = today.slice(0, 7);

  // People balances (sign-based)
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

  // Liquidity per wallet then per currency
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

  // Monthly expenses from allocations
  const monthlyExp: Record<string, number> = {};
  for (const a of d.allocations as any[]) {
    if ((a.period as string).slice(0, 7) === currentMonth) monthlyExp[a.currency] = (monthlyExp[a.currency] ?? 0) + Number(a.amount);
  }

  // Monthly cashflows from wallet_transactions
  const monthlyInflow: Record<string, number> = {};
  const monthlyOutflow: Record<string, number> = {};
  const INFLOW = new Set(["deposit", "receive", "adjustment"]);
  const OUTFLOW = new Set(["withdraw", "send"]);
  for (const t of d.txs as any[]) {
    if ((t.happened_at as string).slice(0, 7) !== currentMonth) continue;
    if (INFLOW.has(t.kind)) monthlyInflow[t.currency] = (monthlyInflow[t.currency] ?? 0) + Number(t.amount);
    else if (OUTFLOW.has(t.kind)) monthlyOutflow[t.currency] = (monthlyOutflow[t.currency] ?? 0) + Number(t.amount);
  }
  // Add expenses to outflow
  for (const e of d.expenses as any[]) {
    if ((e.spent_at as string).slice(0, 7) === currentMonth) {
      monthlyOutflow[e.currency] = (monthlyOutflow[e.currency] ?? 0) + Number(e.amount);
    }
  }
  const monthlyNet: Record<string, number> = {};
  const allCurs = new Set([...Object.keys(monthlyInflow), ...Object.keys(monthlyOutflow)]);
  for (const c of allCurs) monthlyNet[c] = (monthlyInflow[c] ?? 0) - (monthlyOutflow[c] ?? 0);

  // Daily expenses last 14 days
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

  // Due reminders
  const dueRows = (d.ledger as any[]).filter((r) => (r.kind === "lend" || r.kind === "borrow") && r.due_date && !r.settled_at && r.reminder_enabled);
  dueRows.sort((a, b) => (a.due_date as string).localeCompare(b.due_date as string));
  const overdueCount = dueRows.filter((r) => r.due_date < today).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">اللوحة الرئيسية</h1>
        <p className="text-sm text-muted-foreground mt-1">نظرة عامة على حالتك المالية</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Wallet} label="إجمالي السيولة" gradient="var(--gradient-primary)" amounts={liquidity} emptyText="أضف محفظة" />
        <StatCard icon={ArrowDownRight} label="مستحق لي" gradient="var(--gradient-success)" amounts={owedToMe} emptyText="لا يوجد" />
        <StatCard icon={ArrowUpRight} label="مستحق عليّ" gradient="var(--gradient-destructive)" amounts={owedByMe} emptyText="لا يوجد" />
        <StatCard icon={TrendingUp} label="مصاريف الشهر" gradient="var(--gradient-primary)" amounts={monthlyExp} emptyText="0" />
      </div>

      <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
        <h3 className="font-bold mb-3 text-sm">التدفقات النقدية للشهر الحالي</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <MiniStat label="الإيرادات" amounts={monthlyInflow} tone="positive" />
          <MiniStat label="المصروفات" amounts={monthlyOutflow} tone="negative" />
          <MiniStat label="صافي التدفق" amounts={monthlyNet} tone="signed" />
        </div>
      </div>

      {dueRows.length > 0 && (
        <Link to="/app/people" className="block rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 hover:bg-amber-500/15 transition">
          <div className="flex items-center gap-2">
            <BellRing className="h-5 w-5 text-amber-600" />
            <div className="font-semibold text-sm">
              لديك {dueRows.length} استحقاق مفعّل التذكير {overdueCount > 0 && <span className="text-destructive">· {overdueCount} متأخر</span>}
            </div>
          </div>
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">المحافظ</h3>
            <Link to="/app/wallets" className="text-xs text-primary">عرض الكل</Link>
          </div>
          {walletBalances.length === 0 ? (
            <Link to="/app/wallets" className="block rounded-xl border-2 border-dashed p-6 text-center text-sm text-muted-foreground hover:bg-accent/30">
              <Plus className="h-5 w-5 inline" /> أضف محفظتك الأولى
            </Link>
          ) : (
            <div className="space-y-2">
              {walletBalances.slice(0, 5).map((w) => (
                <Link key={w.id} to="/app/wallets/$id" params={{ id: w.id }} className="flex items-center gap-3 rounded-xl p-2 hover:bg-accent/40">
                  <div className="h-8 w-8 rounded-lg shrink-0" style={{ background: w.color }} />
                  <div className="flex-1 min-w-0 truncate text-sm font-medium">{w.name}</div>
                  <div className={cn("text-sm font-bold tabular-nums", w.balance < 0 && "text-destructive")}>{formatMoney(w.balance, w.currency)}</div>
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold">المصاريف آخر 14 يوم</h3>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="h-56">
            <ResponsiveContainer>
              <BarChart data={daily}>
                <XAxis dataKey="day" tick={{ fontSize: 11 }} reversed />
                <YAxis tick={{ fontSize: 11 }} orientation="right" />
                <Tooltip contentStyle={{ direction: "rtl", borderRadius: 12 }} />
                <Bar dataKey="value" fill="var(--color-primary)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] lg:col-span-2">
          <h3 className="font-bold mb-4">توزيع المصاريف حسب الفئة</h3>
          {pieData.length === 0 ? (
            <div className="grid h-56 place-items-center text-sm text-muted-foreground">لا توجد مصاريف بعد</div>
          ) : (
            <div className="h-56">
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                    {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Legend wrapperStyle={{ direction: "rtl", fontSize: 12 }} />
                  <Tooltip contentStyle={{ direction: "rtl", borderRadius: 12 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, gradient, amounts, emptyText }: { icon: any; label: string; gradient: string; amounts: Record<string, number>; emptyText: string }) {
  const entries = Object.entries(amounts).filter(([, v]) => Math.abs(v) > 0.001);
  return (
    <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] relative overflow-hidden">
      <div className="absolute -top-8 -left-8 h-24 w-24 rounded-full opacity-20" style={{ background: gradient }} />
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ background: gradient }}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="text-sm text-muted-foreground">{label}</div>
      </div>
      <div className="mt-3 space-y-1">
        {entries.length === 0 ? (
          <div className="text-2xl font-bold text-muted-foreground/60">{emptyText}</div>
        ) : entries.map(([cur, amt]) => (
          <div key={cur} className="text-xl font-bold tabular-nums">{formatMoney(amt, cur)}</div>
        ))}
      </div>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="space-y-4">
      <div className="h-8 w-48 animate-pulse rounded-md bg-muted" />
      <div className="grid gap-3 sm:grid-cols-4">{[1,2,3,4].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}</div>
      <div className="grid gap-4 lg:grid-cols-2">{[1,2].map((i) => <div key={i} className="h-72 animate-pulse rounded-2xl bg-muted" />)}</div>
    </div>
  );
}
