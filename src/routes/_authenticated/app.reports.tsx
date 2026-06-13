import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Download, Printer, FileSpreadsheet } from "lucide-react";
import { formatMoney, formatDate, todayISO } from "@/lib/format";
import * as XLSX from "xlsx";

export const Route = createFileRoute("/_authenticated/reports")({
  head: () => ({ meta: [{ title: "التقارير — حسابي" }] }),
  component: ReportsPage,
});

function ReportsPage() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10);
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(todayISO());
  const [type, setType] = useState<"expenses" | "debts">("expenses");
  const [projectId, setProjectId] = useState<string>("all");

  const { data: projects } = useQuery({
    queryKey: ["projects-all"],
    queryFn: async () => (await supabase.from("projects").select("id,name")).data ?? [],
  });

  const { data, refetch, isFetching } = useQuery({
    queryKey: ["report", type, from, to, projectId],
    queryFn: async () => {
      if (type === "expenses") {
        let q = supabase.from("expenses").select("*, categories(name), projects(name)").gte("spent_at", from).lte("spent_at", to).order("spent_at", { ascending: false });
        if (projectId !== "all") q = q.eq("project_id", projectId);
        const { data, error } = await q;
        if (error) throw error;
        return { rows: data ?? [] };
      } else {
        const [dRes, payRes] = await Promise.all([
          supabase.from("debts").select("*").gte("created_at", from).lte("created_at", to + "T23:59:59"),
          supabase.from("debt_payments").select("debt_id, amount"),
        ]);
        const paid = new Map<string, number>();
        for (const p of payRes.data ?? []) paid.set(p.debt_id, (paid.get(p.debt_id) ?? 0) + Number(p.amount));
        const rows = (dRes.data ?? []).map((d: any) => ({ ...d, paid: paid.get(d.id) ?? 0, remaining: Math.max(0, Number(d.amount) - (paid.get(d.id) ?? 0)) }));
        return { rows };
      }
    },
  });

  const rows = data?.rows ?? [];

  function exportExcel() {
    const sheetData = type === "expenses"
      ? rows.map((e: any) => ({ "التاريخ": e.spent_at, "الفئة": e.categories?.name ?? "", "المشروع": e.projects?.name ?? "", "المبلغ": Number(e.amount), "العملة": e.currency, "ملاحظة": e.note ?? "" }))
      : rows.map((d: any) => ({ "التاريخ": d.created_at?.slice(0, 10), "الشخص": d.contact_name, "النوع": d.direction === "owed_to_me" ? "لي" : "عليّ", "المبلغ": Number(d.amount), "مدفوع": Number(d.paid), "متبقي": Number(d.remaining), "العملة": d.currency, "تاريخ الاستحقاق": d.due_date ?? "", "ملاحظات": d.notes ?? "" }));
    const ws = XLSX.utils.json_to_sheet(sheetData);
    ws["!cols"] = Object.keys(sheetData[0] ?? {}).map(() => ({ wch: 18 }));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, type === "expenses" ? "المصاريف" : "الديون");
    XLSX.writeFile(wb, `تقرير-${type === "expenses" ? "مصاريف" : "ديون"}-${from}_${to}.xlsx`);
  }

  function exportPDF() {
    window.print();
  }

  // Totals
  const totalsByCur: Record<string, number> = {};
  if (type === "expenses") {
    for (const r of rows) totalsByCur[r.currency] = (totalsByCur[r.currency] ?? 0) + Number(r.amount);
  }
  const debtTotals = { lendByCur: {} as Record<string, number>, borrowByCur: {} as Record<string, number> };
  if (type === "debts") {
    for (const r of rows as any[]) {
      const map = r.direction === "owed_to_me" ? debtTotals.lendByCur : debtTotals.borrowByCur;
      map[r.currency] = (map[r.currency] ?? 0) + Number(r.remaining);
    }
  }

  return (
    <div className="space-y-5">
      <div className="no-print">
        <h1 className="text-2xl font-bold">التقارير</h1>
        <p className="text-sm text-muted-foreground mt-1">تقارير قابلة للتصدير بصيغة PDF و Excel</p>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-4 no-print">
        <Tabs value={type} onValueChange={(v) => setType(v as any)}>
          <TabsList className="grid grid-cols-2 w-full">
            <TabsTrigger value="expenses">مصاريف</TabsTrigger>
            <TabsTrigger value="debts">ديون</TabsTrigger>
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
          <Button onClick={exportPDF} className="flex-1"><Printer className="h-4 w-4" /> طباعة / PDF</Button>
          <Button onClick={exportExcel} variant="outline" disabled={rows.length === 0}><FileSpreadsheet className="h-4 w-4" /> Excel</Button>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-6">
        <div className="text-center mb-4 pb-4 border-b">
          <h2 className="text-xl font-bold">تقرير {type === "expenses" ? "المصاريف" : "الديون"}</h2>
          <div className="text-sm text-muted-foreground mt-1">من {formatDate(from)} إلى {formatDate(to)}</div>
        </div>

        {type === "expenses" ? (
          <>
            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl bg-accent/40 p-3"><div className="text-xs text-muted-foreground">عدد العمليات</div><div className="text-lg font-bold">{rows.length}</div></div>
              <div className="rounded-xl bg-accent/40 p-3"><div className="text-xs text-muted-foreground">الإجمالي</div>
                {Object.entries(totalsByCur).map(([c, v]) => <div key={c} className="font-bold tabular-nums">{formatMoney(v, c)}</div>)}
                {Object.keys(totalsByCur).length === 0 && <div className="text-muted-foreground">—</div>}
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="text-right text-xs text-muted-foreground border-b">
                <tr><th className="py-2">التاريخ</th><th>الفئة</th><th>المشروع</th><th className="text-left">المبلغ</th></tr>
              </thead>
              <tbody>
                {rows.map((e: any) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="py-2">{formatDate(e.spent_at)}</td>
                    <td>{e.categories?.name ?? "—"}</td>
                    <td>{e.projects?.name ?? "—"}</td>
                    <td className="text-left tabular-nums">{formatMoney(e.amount, e.currency)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        ) : (
          <>
            <div className="grid sm:grid-cols-2 gap-3 mb-4">
              <div className="rounded-xl bg-success/10 p-3"><div className="text-xs text-success">مستحق لي (متبقي)</div>
                {Object.entries(debtTotals.lendByCur).map(([c, v]) => <div key={c} className="font-bold tabular-nums">{formatMoney(v, c)}</div>)}
                {Object.keys(debtTotals.lendByCur).length === 0 && <div className="text-muted-foreground">—</div>}
              </div>
              <div className="rounded-xl bg-destructive/10 p-3"><div className="text-xs text-destructive">مستحق عليّ (متبقي)</div>
                {Object.entries(debtTotals.borrowByCur).map(([c, v]) => <div key={c} className="font-bold tabular-nums">{formatMoney(v, c)}</div>)}
                {Object.keys(debtTotals.borrowByCur).length === 0 && <div className="text-muted-foreground">—</div>}
              </div>
            </div>
            <table className="w-full text-sm">
              <thead className="text-right text-xs text-muted-foreground border-b">
                <tr><th className="py-2">الشخص</th><th>النوع</th><th>المبلغ</th><th>المتبقي</th><th>الاستحقاق</th></tr>
              </thead>
              <tbody>
                {rows.map((d: any) => (
                  <tr key={d.id} className="border-b last:border-0">
                    <td className="py-2">{d.contact_name}</td>
                    <td>{d.direction === "owed_to_me" ? "لي" : "عليّ"}</td>
                    <td className="tabular-nums">{formatMoney(d.amount, d.currency)}</td>
                    <td className="tabular-nums">{formatMoney(d.remaining, d.currency)}</td>
                    <td>{d.due_date ? formatDate(d.due_date) : "—"}</td>
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
