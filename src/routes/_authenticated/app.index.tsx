import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/format";
import { ArrowDownRight, ArrowUpRight, Wallet, TrendingUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from "recharts";

export const Route = createFileRoute("/_authenticated/app/")({
  head: () => ({ meta: [{ title: "اللوحة الرئيسية — حسابي" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data, isLoading } = useQuery({
    queryKey: ["dashboard"],
    queryFn: async () => {
      const [debtsRes, paymentsRes, expensesRes, projectsRes, walletsRes] = await Promise.all([
        supabase.from("debts").select("id,direction,amount,currency,status"),
        supabase.from("debt_payments").select("debt_id,amount"),
        supabase.from("expenses").select("amount,currency,spent_at,category_id,wallet_id,categories(name,color)"),
        supabase.from("projects").select("id,name,color"),
        supabase.from("wallets").select("id,opening_balance,currency"),
      ]);
      return {
        debts: debtsRes.data ?? [],
        payments: paymentsRes.data ?? [],
        expenses: expensesRes.data ?? [],
        projects: projectsRes.data ?? [],
        wallets: walletsRes.data ?? [],
      };
    },
  });

  if (isLoading) return <SkeletonGrid />;
  const d = data!;

  // Group remaining per currency, per direction
  const paymentsByDebt = new Map<string, number>();
  for (const p of d.payments) paymentsByDebt.set(p.debt_id, (paymentsByDebt.get(p.debt_id) ?? 0) + Number(p.amount));

  const owedToMe: Record<string, number> = {};
  const owedByMe: Record<string, number> = {};
  for (const debt of d.debts) {
    const remaining = Math.max(0, Number(debt.amount) - (paymentsByDebt.get(debt.id) ?? 0));
    if (remaining <= 0) continue;
    if (debt.direction === "owed_to_me") owedToMe[debt.currency] = (owedToMe[debt.currency] ?? 0) + remaining;
    else owedByMe[debt.currency] = (owedByMe[debt.currency] ?? 0) + remaining;
  }

  // Expenses this month
  const monthStart = new Date(); monthStart.setDate(1);
  const monthlyExp: Record<string, number> = {};
  const byCat: Record<string, { name: string; color: string; value: number }> = {};
  for (const e of d.expenses) {
    const cat = (e as any).categories;
    if (new Date(e.spent_at) >= monthStart) monthlyExp[e.currency] = (monthlyExp[e.currency] ?? 0) + Number(e.amount);
    const key = cat?.name ?? "أخرى";
    byCat[key] = byCat[key] ?? { name: key, color: cat?.color ?? "#64748b", value: 0 };
    byCat[key].value += Number(e.amount);
  }

  // Daily expenses last 14 days
  const daily: { day: string; value: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const date = new Date(); date.setDate(date.getDate() - i);
    const iso = date.toISOString().slice(0, 10);
    const sum = d.expenses.filter((e) => e.spent_at === iso).reduce((s, e) => s + Number(e.amount), 0);
    daily.push({ day: date.toLocaleDateString("ar", { day: "numeric", month: "short" }), value: sum });
  }

  const pieData = Object.values(byCat).slice(0, 6);

  // Liquidity = sum(wallet opening balance) - sum(expenses) per currency
  const liquidity: Record<string, number> = {};
  for (const w of d.wallets) liquidity[w.currency] = (liquidity[w.currency] ?? 0) + Number(w.opening_balance);
  for (const e of d.expenses) liquidity[e.currency] = (liquidity[e.currency] ?? 0) - Number(e.amount);

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

      <div className="grid gap-4 lg:grid-cols-2">
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

        <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
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
  const entries = Object.entries(amounts);
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
      <div className="grid gap-3 sm:grid-cols-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />)}
      </div>
    </div>
  );
}
