import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Printer, FileSpreadsheet } from "lucide-react";
import { formatMoney, formatDate, todayISO } from "@/lib/format";
import { kindMeta, kindSign } from "@/components/PersonTxForm";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/app/reports")({
  head: () => ({ meta: [{ title: "التقارير — رصد" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayISO());
  const [type, setType] = useState<"expenses" | "people" | "transactions" | "assets">("transactions");
  const [projectId, setProjectId] = useState<string>("all");

  const { data: projects } = useQuery({
    queryKey: ["projects-all"],
    queryFn: async () => (await supabase.from("projects").select("id,name")).data ?? [],
  });

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["report", type, from, to, projectId],
    queryFn: async () => {
      if (type === "transactions") {
        const { data, error } = await supabase.from("transactions")
          .select("id,type,direction,amount,currency,happened_at,description,person_name,account_id,counterparty_account_id")
          .gte("happened_at", from).lte("happened_at", to)
          .order("happened_at", { ascending: false })
          .limit(5000);
        if (error) throw error;
        return { rows: data ?? [] };
      } else if (type === "expenses") {
        let q = supabase.from("expense_allocations")
          .select("amount,currency,period,expenses(id,note,category_id,project_id,wallet_id,categories(name),projects(name),wallets(name))")
          .gte("period", from.slice(0, 7) + "-01")
          .lte("period", to.slice(0, 7) + "-01")
          .order("period", { ascending: false });
        const { data, error } = await q;
        if (error) throw error;
        let rows = (data ?? []) as any[];
        if (projectId !== "all") rows = rows.filter((r) => r.expenses?.project_id === projectId);
        return { rows };
      } else if (type === "assets") {
        const [iRes, tRes] = await Promise.all([
          supabase.from("investments").select("*"),
          supabase.from("investment_transactions").select("*").gte("happened_at", from).lte("happened_at", to),
        ]);
        const txs = (tRes.data ?? []) as any[];
        const byInv = new Map<string, any[]>();
        for (const t of txs) { const a = byInv.get(t.investment_id) ?? []; a.push(t); byInv.set(t.investment_id, a); }
        const { computeAssetMetrics } = await import("@/lib/assets/calculator");
        const rows = (iRes.data ?? []).map((inv: any) => ({
          ...inv,
          _m: computeAssetMetrics(inv, byInv.get(inv.id) ?? []),
        }));
        return { rows };
      } else {
        const { data, error } = await supabase.from("person_ledger")
          .select("*")
          .gte("happened_at", from).lte("happened_at", to)
          .order("happened_at", { ascending: false });
        if (error) throw error;
        return { rows: data ?? [] };
      }
    },
  });

  const rows = data?.rows ?? [];

  function exportExcel() {
    const TYPE_LABEL: Record<string, string> = {
      income: "دخل", expense: "مصروف", transfer: "تحويل", debt: "دين", investment: "استثمار", adjustment: "تسوية",
    };
    const sheetData = type === "transactions"
      ? (rows as any[]).map((r) => ({ "التاريخ": r.happened_at, "النوع": TYPE_LABEL[r.type] ?? r.type, "الاتجاه": r.direction, "الوصف": r.description ?? "", "الشخص": r.person_name ?? "", "المبلغ": Number(r.amount), "العملة": r.currency }))
      : type === "expenses"
      ? rows.map((r: any) => ({ "الشهر": (r.period as string).slice(0, 7), "الفئة": r.expenses?.categories?.name ?? "", "المشروع": r.expenses?.projects?.name ?? "", "المحفظة": r.expenses?.wallets?.name ?? "", "المبلغ": Number(r.amount), "العملة": r.currency, "ملاحظة": r.expenses?.note ?? "" }))
      : rows.map((r: any) => ({ "التاريخ": r.happened_at, "الشخص": r.contact_name, "النوع": kindMeta(r.kind).label, "المبلغ": Number(r.amount), "العملة": r.currency, "الاستحقاق": r.due_date ?? "", "مسدد": r.settled_at ? "نعم" : "لا", "ملاحظات": r.notes ?? "" }));
    if (sheetData.length === 0) return;
    const ws = XLSX.utils.json_to_sheet(sheetData);
    ws["!cols"] = Object.keys(sheetData[0]).map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type === "expenses" ? "المصاريف" : type === "people" ? "الأشخاص" : "العمليات");
    XLSX.writeFile(wb, `تقرير-${type}-${from}_${to}.xlsx`);
  }

  // Totals
  const totalsByCur: Record<string, number> = {};
  if (type === "expenses") for (const r of rows as any[]) totalsByCur[r.currency] = (totalsByCur[r.currency] ?? 0) + Number(r.amount);
  const peopleNet: Record<string, number> = {};
  if (type === "people") for (const r of rows as any[]) peopleNet[r.currency] = (peopleNet[r.currency] ?? 0) + kindSign(r.kind) * Number(r.amount);

  // Income/expense totals for transactions view
  const txIncome: Record<string, number> = {};
  const txExpense: Record<string, number> = {};
  if (type === "transactions") {
    for (const r of rows as any[]) {
      if (r.type === "income") txIncome[r.currency] = (txIncome[r.currency] ?? 0) + Number(r.amount);
      else if (r.type === "expense") txExpense[r.currency] = (txExpense[r.currency] ?? 0) + Number(r.amount);
    }
  }

  return (
    <div className="space-y-5">
      <div className="no-print">
        <h1 className="text-2xl font-bold">التقارير</h1>
        <p className="text-sm text-muted-foreground mt-1">تقارير شهرية بحسب التوزيع</p>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-4 no-print">
        <Tabs value={type} onValueChange={(v) => setType(v as any)}>
          <TabsList className="grid grid-cols-3 w-full">
            <TabsTrigger value="transactions">العمليات</TabsTrigger>
            <TabsTrigger value="expenses">مصاريف</TabsTrigger>
            <TabsTrigger value="people">أشخاص</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="grid grid-cols-2 gap-3">
          <div><Label>من</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} dir="ltr" /></div>
          <div><Label>إلى</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} dir="ltr" /></div>
        </div>

        {type === "expenses" && (
          <div>
            <Label>المشروع</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">كل المشاريع</SelectItem>
                {(projects ?? []).map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="flex gap-2">
          <Button onClick={() => refetch()} variant="outline" className="flex-1">{isFetching ? "جاري..." : "تحديث"}</Button>
          <Button onClick={() => window.print()} className="flex-1"><Printer className="h-4 w-4" /> طباعة</Button>
          <Button onClick={exportExcel} variant="outline" disabled={rows.length === 0}><FileSpreadsheet className="h-4 w-4" /></Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <div className="text-center mb-4 pb-4 border-b">
          <h2 className="text-xl font-bold">تقرير {type === "expenses" ? "المصاريف" : type === "people" ? "الأشخاص" : "العمليات"}</h2>
          <div className="text-sm text-muted-foreground mt-1">من {formatDate(from)} إلى {formatDate(to)}</div>
        </div>

        {type === "transactions" ? (
          <>
            <div className="grid grid-cols-3 gap-3 mb-4">
              <div className="rounded-xl bg-emerald-500/10 p-3">
                <div className="text-xs text-muted-foreground">إجمالي الدخل</div>
                {Object.entries(txIncome).map(([c, v]) => <div key={c} className="font-bold tabular-nums text-emerald-600">{formatMoney(v, c)}</div>)}
                {Object.keys(txIncome).length === 0 && <div className="text-muted-foreground">—</div>}
              </div>
              <div className="rounded-xl bg-rose-500/10 p-3">
                <div className="text-xs text-muted-foreground">إجمالي المصروف</div>
                {Object.entries(txExpense).map(([c, v]) => <div key={c} className="font-bold tabular-nums text-rose-600">{formatMoney(v, c)}</div>)}
                {Object.keys(txExpense).length === 0 && <div className="text-muted-foreground">—</div>}
              </div>
              <div className="rounded-xl bg-sky-500/10 p-3">
                <div className="text-xs text-muted-foreground">الصافي</div>
                {Array.from(new Set([...Object.keys(txIncome), ...Object.keys(txExpense)])).map((c) => {
                  const v = (txIncome[c] ?? 0) - (txExpense[c] ?? 0);
                  return <div key={c} className={`font-bold tabular-nums ${v >= 0 ? "text-emerald-600" : "text-rose-600"}`}>{v >= 0 ? "+" : "−"}{formatMoney(Math.abs(v), c)}</div>;
                })}
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="text-right text-xs text-muted-foreground border-b">
                <tr><th className="py-2">التاريخ</th><th>النوع</th><th>الوصف</th><th>الشخص</th><th className="text-left">المبلغ</th></tr>
              </thead>
              <tbody>
                {(rows as any[]).map((r) => {
                  const TL: Record<string, string> = { income: "دخل", expense: "مصروف", transfer: "تحويل", debt: "دين", investment: "استثمار", adjustment: "تسوية" };
                  const sign = r.direction === "in" ? "+" : r.direction === "out" ? "−" : "";
                  const cls = r.direction === "in" ? "text-emerald-600" : r.direction === "out" ? "text-rose-600" : "";
                  return (
                    <tr key={r.id} className="border-b last:border-0">
                      <td className="py-2">{formatDate(r.happened_at)}</td>
                      <td>{TL[r.type] ?? r.type}</td>
                      <td className="truncate max-w-[160px]">{r.description ?? "—"}</td>
                      <td>{r.person_name ?? "—"}</td>
                      <td className={`text-left tabular-nums ${cls}`}>{sign}{formatMoney(r.amount, r.currency)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </>
        ) : type === "expenses" ? (
          <>
            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl bg-accent/40 p-3"><div className="text-xs text-muted-foreground">عدد التوزيعات</div><div className="text-lg font-bold">{rows.length}</div></div>
              <div className="rounded-xl bg-accent/40 p-3"><div className="text-xs text-muted-foreground">الإجمالي</div>
                {Object.entries(totalsByCur).map(([c, v]) => <div key={c} className="font-bold tabular-nums">{formatMoney(v, c)}</div>)}
                {Object.keys(totalsByCur).length === 0 && <div className="text-muted-foreground">—</div>}
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="text-right text-xs text-muted-foreground border-b">
                <tr><th className="py-2">الشهر</th><th>الفئة</th><th>المحفظة</th><th>المشروع</th><th className="text-left">المبلغ</th></tr>
              </thead>
              <tbody>
                {(rows as any[]).map((r, i) => (
                  <tr key={i} className="border-b last:border-0">
                    <td className="py-2 tabular-nums" dir="ltr">{(r.period as string).slice(0, 7)}</td>
                    <td>{r.expenses?.categories?.name ?? "—"}</td>
                    <td>{r.expenses?.wallets?.name ?? "—"}</td>
                    <td>{r.expenses?.projects?.name ?? "—"}</td>
                    <td className="text-left tabular-nums">{formatMoney(r.amount, r.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>
            <div className="rounded-xl bg-accent/40 p-3 mb-4">
              <div className="text-xs text-muted-foreground">صافي الحركات (موجب = له، سالب = عليه)</div>
              {Object.entries(peopleNet).map(([c, v]) => <div key={c} className="font-bold tabular-nums">{formatMoney(v, c)}</div>)}
              {Object.keys(peopleNet).length === 0 && <div className="text-muted-foreground">—</div>}
            </div>
            <table className="w-full text-sm">
              <thead className="text-right text-xs text-muted-foreground border-b">
                <tr><th className="py-2">التاريخ</th><th>الشخص</th><th>النوع</th><th>الاستحقاق</th><th className="text-left">المبلغ</th></tr>
              </thead>
              <tbody>
                {(rows as any[]).map((r) => (
                  <tr key={r.id} className="border-b last:border-0">
                    <td className="py-2">{formatDate(r.happened_at)}</td>
                    <td>{r.contact_name}</td>
                    <td>{kindMeta(r.kind).label}</td>
                    <td>{r.due_date ? formatDate(r.due_date) : "—"}</td>
                    <td className="text-left tabular-nums">{kindMeta(r.kind).sign}{formatMoney(r.amount, r.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}

        {rows.length === 0 && <div className="text-center py-8 text-muted-foreground">لا توجد بيانات في هذه الفترة</div>}
      </div>
    </div>
  );
}
