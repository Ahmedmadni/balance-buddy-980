import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileSpreadsheet, Printer, ArrowDownRight, ArrowUpRight, ArrowLeftRight, HandCoins, PieChart as PieIcon, Equal, Plus } from "lucide-react";
import { formatMoney, formatDate, todayISO } from "@/lib/format";
import { cn } from "@/lib/utils";
import * as XLSX from "xlsx";
import { FadeIn } from "@/components/motion/FadeIn";

export const Route = createFileRoute("/_authenticated/app/transactions")({
  head: () => ({ meta: [{ title: "العمليات — رصد" }] }),
  component: TransactionsPage,
});

type TxType = "all" | "income" | "expense" | "transfer" | "debt" | "investment" | "adjustment";

const TYPE_META: Record<Exclude<TxType, "all">, { label: string; tone: string; icon: any; sign: "+" | "−" | "" }> = {
  income: { label: "دخل", tone: "text-emerald-500 bg-emerald-500/10", icon: ArrowDownRight, sign: "+" },
  expense: { label: "مصروف", tone: "text-rose-500 bg-rose-500/10", icon: ArrowUpRight, sign: "−" },
  transfer: { label: "تحويل", tone: "text-sky-500 bg-sky-500/10", icon: ArrowLeftRight, sign: "" },
  debt: { label: "دين", tone: "text-amber-500 bg-amber-500/10", icon: HandCoins, sign: "" },
  investment: { label: "استثمار", tone: "text-violet-500 bg-violet-500/10", icon: PieIcon, sign: "" },
  adjustment: { label: "تسوية", tone: "text-slate-500 bg-slate-500/10", icon: Equal, sign: "" },
};

function TransactionsPage() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayISO());
  const [type, setType] = useState<TxType>("all");
  const [accountId, setAccountId] = useState<string>("all");
  const [personId, setPersonId] = useState<string>("all");

  const { data: refs } = useQuery({
    queryKey: ["tx-refs"],
    queryFn: async () => {
      const [w, c] = await Promise.all([
        supabase.from("wallets").select("id,name,currency,color"),
        supabase.from("contacts").select("id,display_name"),
      ]);
      return { wallets: w.data ?? [], contacts: c.data ?? [] };
    },
  });

  const { data: rows = [], isFetching, refetch } = useQuery({
    queryKey: ["transactions", from, to, type, accountId, personId],
    queryFn: async () => {
      let q = supabase.from("transactions")
        .select("id,type,direction,amount,currency,happened_at,description,notes,account_id,counterparty_account_id,person_id,person_name,source_kind,meta")
        .gte("happened_at", from).lte("happened_at", to)
        .order("happened_at", { ascending: false })
        .limit(2000);
      if (type !== "all") q = q.eq("type", type as any);
      if (accountId !== "all") q = q.eq("account_id", accountId);
      if (personId !== "all") q = q.eq("person_id", personId);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const walletName = useMemo(() => {
    const m = new Map<string, string>();
    for (const w of refs?.wallets ?? []) m.set((w as any).id, (w as any).name);
    return m;
  }, [refs]);

  // Totals
  const totals = useMemo(() => {
    const inc: Record<string, number> = {};
    const exp: Record<string, number> = {};
    for (const r of rows as any[]) {
      if (r.type === "income") inc[r.currency] = (inc[r.currency] ?? 0) + Number(r.amount);
      else if (r.type === "expense") exp[r.currency] = (exp[r.currency] ?? 0) + Number(r.amount);
    }
    const curs = Array.from(new Set([...Object.keys(inc), ...Object.keys(exp)]));
    const net: Record<string, number> = {};
    for (const c of curs) net[c] = (inc[c] ?? 0) - (exp[c] ?? 0);
    return { inc, exp, net };
  }, [rows]);

  function exportExcel() {
    const sheet = (rows as any[]).map((r) => ({
      "التاريخ": r.happened_at,
      "النوع": TYPE_META[r.type as keyof typeof TYPE_META]?.label ?? r.type,
      "الاتجاه": r.direction === "in" ? "وارد" : r.direction === "out" ? "صادر" : "—",
      "الحساب": walletName.get(r.account_id) ?? "—",
      "الحساب المقابل": walletName.get(r.counterparty_account_id) ?? "",
      "الشخص": r.person_name ?? "",
      "الوصف": r.description ?? r.notes ?? "",
      "المبلغ": Number(r.amount),
      "العملة": r.currency,
    }));
    if (sheet.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(sheet);
    ws["!cols"] = Object.keys(sheet[0]).map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "العمليات");
    XLSX.writeFile(wb, `العمليات-${from}_${to}.xlsx`);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between gap-2 no-print">
        <div>
          <h1 className="text-2xl font-bold">العمليات</h1>
          <p className="text-sm text-muted-foreground mt-1">سجل موحّد لكل الحركات المالية</p>
        </div>
        <Link to="/app/wallets" search={{ new: "income" } as any} className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90">
          <Plus className="h-4 w-4" /> دخل
        </Link>
      </div>

      {/* KPI row */}
      <FadeIn>
        <div className="grid grid-cols-3 gap-2">
          <KpiMini label="دخل" tone="emerald" map={totals.inc} />
          <KpiMini label="مصروف" tone="rose" map={totals.exp} />
          <KpiMini label="صافي" tone="sky" map={totals.net} signed />
        </div>
      </FadeIn>

      {/* Filters */}
      <div className="rounded-2xl border bg-card p-4 space-y-3 no-print">
        <Tabs value={type} onValueChange={(v) => setType(v as TxType)}>
          <TabsList className="grid grid-cols-4 sm:grid-cols-7 w-full h-auto">
            <TabsTrigger value="all">الكل</TabsTrigger>
            <TabsTrigger value="income">دخل</TabsTrigger>
            <TabsTrigger value="expense">مصروف</TabsTrigger>
            <TabsTrigger value="transfer">تحويل</TabsTrigger>
            <TabsTrigger value="debt">دين</TabsTrigger>
            <TabsTrigger value="investment">استثمار</TabsTrigger>
            <TabsTrigger value="adjustment">تسوية</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-2 gap-3">
          <div><Label>من</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" /></div>
          <div><Label>إلى</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" /></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>الحساب</Label>
            <Select value={accountId} onValueChange={setAccountId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الحسابات</SelectItem>
                {(refs?.wallets ?? []).map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>الشخص</Label>
            <Select value={personId} onValueChange={setPersonId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل الأشخاص</SelectItem>
                {(refs?.contacts ?? []).map((c: any) => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => refetch()}>{isFetching ? "جاري..." : "تحديث"}</Button>
          <Button variant="outline" onClick={() => window.print()}><Printer className="h-4 w-4" /></Button>
          <Button variant="outline" onClick={exportExcel} disabled={rows.length === 0}><FileSpreadsheet className="h-4 w-4" /></Button>
        </div>
      </div>

      {/* List */}
      <div className="rounded-2xl border bg-card divide-y">
        {rows.length === 0 && (
          <div className="p-10 text-center text-sm text-muted-foreground">لا توجد عمليات في هذه الفترة</div>
        )}
        {(rows as any[]).map((r) => {
          const m = TYPE_META[r.type as keyof typeof TYPE_META];
          const Icon = m?.icon ?? Equal;
          const sign = r.direction === "in" ? "+" : r.direction === "out" ? "−" : "";
          const valColor = r.direction === "in" ? "text-emerald-500" : r.direction === "out" ? "text-rose-500" : "text-foreground";
          return (
            <div key={r.id} className="flex items-center gap-3 p-3">
              <span className={cn("grid h-10 w-10 place-items-center rounded-xl shrink-0", m?.tone ?? "bg-muted")}>
                <Icon className="h-4 w-4" />
              </span>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold truncate">
                  {r.description || r.person_name || m?.label || "—"}
                </div>
                <div className="text-[11px] text-muted-foreground truncate">
                  {formatDate(r.happened_at)} · {walletName.get(r.account_id) ?? "—"}
                  {r.counterparty_account_id ? ` ← ${walletName.get(r.counterparty_account_id) ?? ""}` : ""}
                </div>
              </div>
              <div className={cn("text-sm font-bold tabular-nums whitespace-nowrap", valColor)}>
                {sign}{formatMoney(r.amount, r.currency)}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function KpiMini({ label, tone, map, signed }: { label: string; tone: "emerald" | "rose" | "sky"; map: Record<string, number>; signed?: boolean }) {
  const entries = Object.entries(map);
  const toneCls = tone === "emerald" ? "text-emerald-500" : tone === "rose" ? "text-rose-500" : "text-sky-500";
  return (
    <div className="rounded-2xl border bg-card p-3">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      {entries.length === 0 && <div className={cn("text-sm font-bold mt-1", toneCls)}>—</div>}
      {entries.map(([c, v]) => (
        <div key={c} className={cn("text-sm font-bold tabular-nums mt-0.5", signed ? (v >= 0 ? "text-emerald-500" : "text-rose-500") : toneCls)}>
          {signed ? (v >= 0 ? "+" : "−") : ""}{formatMoney(Math.abs(v), c)}
        </div>
      ))}
    </div>
  );
}
