import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Wallet, CalendarRange, Paperclip } from "lucide-react";
import { CURRENCIES, formatMoney, formatDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { AttachmentUploader } from "@/components/AttachmentUploader";

export const Route = createFileRoute("/_authenticated/app/expenses")({
  head: () => ({ meta: [{ title: "المصاريف — رصد" }] }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["expenses-list"],
    queryFn: async () => {
      const [eRes, cRes, pRes, wRes] = await Promise.all([
        supabase.from("expenses").select("*, categories(name,color), projects(name,color), wallets(name,color)").order("spent_at", { ascending: false }).limit(200),
        supabase.from("categories").select("*").order("name"),
        supabase.from("projects").select("*").eq("status", "active").order("name"),
        supabase.from("wallets").select("*").order("created_at"),
      ]);
      return { expenses: eRes.data ?? [], categories: cRes.data ?? [], projects: pRes.data ?? [], wallets: wRes.data ?? [] };
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expenses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses-list"] }); qc.invalidateQueries({ queryKey: ["wallets-list"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("تم الحذف"); },
  });

  // Use allocations for the current month total
  const { data: monthAlloc } = useQuery({
    queryKey: ["expense-month-alloc"],
    queryFn: async () => {
      const ms = new Date(); ms.setDate(1);
      const start = ms.toISOString().slice(0, 10);
      const { data, error } = await supabase.from("expense_allocations").select("amount,currency,period").gte("period", start);
      if (error) throw error;
      const cur = new Date().toISOString().slice(0, 7);
      const totals: Record<string, number> = {};
      for (const r of data ?? []) if ((r as any).period.slice(0, 7) === cur) totals[(r as any).currency] = (totals[(r as any).currency] ?? 0) + Number((r as any).amount);
      return totals;
    },
  });

  const noWallets = (data?.wallets ?? []).length === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">المصاريف</h1>
          <p className="text-sm text-muted-foreground mt-1">سجّل وتتبّع جميع مصاريفك (مع دعم التوزيع على أشهر)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button disabled={noWallets}><Plus className="h-4 w-4" /> مصروف جديد</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <ExpenseForm
              categories={data?.categories ?? []}
              projects={data?.projects ?? []}
              wallets={data?.wallets ?? []}
              onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["expenses-list"] }); qc.invalidateQueries({ queryKey: ["expense-month-alloc"] }); qc.invalidateQueries({ queryKey: ["wallets-list"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {noWallets && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <div className="font-semibold mb-1">أنشئ محفظة أولاً</div>
          <div className="text-muted-foreground mb-3">يجب ربط كل مصروف بمحفظة (نقد/بنكية/أصل).</div>
          <Button asChild size="sm"><Link to="/app/wallets"><Wallet className="h-4 w-4" /> إنشاء محفظة</Link></Button>
        </div>
      )}

      <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] relative overflow-hidden">
        <div className="absolute -top-8 -left-8 h-24 w-24 rounded-full bg-[image:var(--gradient-primary)] opacity-20" />
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-white"><Wallet className="h-5 w-5" /></div>
          <div className="text-sm text-muted-foreground">إجمالي مصاريف هذا الشهر <span className="text-[10px]">(بحسب التوزيع الشهري)</span></div>
        </div>
        <div className="mt-3 space-y-1">
          {Object.keys(monthAlloc ?? {}).length === 0
            ? <div className="text-2xl font-bold text-muted-foreground/60">لا توجد مصاريف</div>
            : Object.entries(monthAlloc ?? {}).map(([c, v]) => (<div key={c} className="text-xl font-bold tabular-nums">{formatMoney(v as number, c)}</div>))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : (data?.expenses ?? []).length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">لا توجد مصاريف بعد</div>
      ) : (
        <div className="space-y-2">
          {data!.expenses.map((e: any) => (
            <div key={e.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]">
              <div className="h-10 w-10 rounded-xl shrink-0" style={{ backgroundColor: (e.categories?.color ?? "#64748b") + "33", border: `1px solid ${e.categories?.color ?? "#64748b"}` }} />
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  <span>{e.categories?.name ?? "بدون فئة"}</span>
                  {e.wallets && <span className="text-[10px] rounded-full px-2 py-0.5" style={{ backgroundColor: (e.wallets.color ?? "#0ea5e9") + "22", color: e.wallets.color }}>{e.wallets.name}</span>}
                  {e.projects && <span className="text-[10px] rounded-full px-2 py-0.5" style={{ backgroundColor: (e.projects.color ?? "#0ea5e9") + "22", color: e.projects.color }}>{e.projects.name}</span>}
                  {e.allocation_kind === "spread" && (
                    <span className="text-[10px] rounded-full px-2 py-0.5 bg-primary/15 text-primary inline-flex items-center gap-1"><CalendarRange className="h-3 w-3" /> موزّع {e.spread_months} شهر</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">{formatDate(e.spent_at)}{e.note ? ` · ${e.note}` : ""}</div>
              </div>
              <div className="font-bold tabular-nums shrink-0">{formatMoney(e.amount, e.currency)}</div>
              <Dialog>
                <DialogTrigger asChild><Button variant="ghost" size="icon" title="المرفقات"><Paperclip className="h-4 w-4" /></Button></DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>مرفقات المصروف</DialogTitle></DialogHeader>
                  <AttachmentUploader entityType="expense" entityId={e.id} />
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="icon" onClick={() => del.mutate(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExpenseForm({ categories, projects, wallets, onDone }: { categories: any[]; projects: any[]; wallets: any[]; onDone: () => void }) {
  const [walletId, setWalletId] = useState<string>(wallets[0]?.id ?? "");
  const initialWallet = wallets.find((w) => w.id === walletId);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(initialWallet?.currency ?? "SAR");
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? "");
  const [projectId, setProjectId] = useState<string>("none");
  const [spentAt, setSpentAt] = useState(todayISO());
  const [note, setNote] = useState("");
  const [spread, setSpread] = useState(false);
  const [months, setMonths] = useState("6");
  const [startMonth, setStartMonth] = useState(todayISO().slice(0, 7));

  const onWalletChange = (v: string) => {
    setWalletId(v);
    const w = wallets.find((x) => x.id === v);
    if (w?.currency) setCurrency(w.currency);
  };

  const monthsN = Math.max(1, Math.min(60, parseInt(months) || 1));
  const monthly = useMemo(() => {
    const a = parseFloat(amount); if (!a || !spread) return 0;
    return a / monthsN;
  }, [amount, spread, monthsN]);

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      if (!walletId) throw new Error("اختر محفظة");
      if (!categoryId) throw new Error("اختر فئة");
      const a = parseFloat(amount);
      const payload: any = {
        user_id: u.user.id,
        amount: a, currency,
        category_id: categoryId,
        wallet_id: walletId,
        project_id: projectId === "none" ? null : projectId,
        spent_at: spentAt, note: note || null,
        allocation_kind: spread ? "spread" : "single",
        spread_months: spread ? monthsN : null,
        spread_start: spread ? `${startMonth}-01` : null,
      };
      const { data: ins, error } = await supabase.from("expenses").insert(payload).select("id").single();
      if (error) throw error;

      // Build allocations
      const allocs: any[] = [];
      if (spread) {
        const [y, m] = startMonth.split("-").map(Number);
        const each = +(a / monthsN).toFixed(2);
        let sum = 0;
        for (let i = 0; i < monthsN; i++) {
          const d = new Date(y, (m - 1) + i, 1);
          const period = d.toISOString().slice(0, 10);
          const amt = i === monthsN - 1 ? +(a - sum).toFixed(2) : each;
          sum += each;
          allocs.push({ user_id: u.user.id, expense_id: (ins as any).id, period, amount: amt, currency });
        }
      } else {
        const d = new Date(spentAt);
        const period = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
        allocs.push({ user_id: u.user.id, expense_id: (ins as any).id, period, amount: a, currency });
      }
      const { error: aErr } = await supabase.from("expense_allocations").insert(allocs);
      if (aErr) throw aErr;
    },
    onSuccess: () => { toast.success("تمت الإضافة"); onDone(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
      <DialogHeader><DialogTitle>مصروف جديد</DialogTitle></DialogHeader>

      <div>
        <Label>المحفظة <span className="text-destructive">*</span></Label>
        <Select value={walletId} onValueChange={onWalletChange}>
          <SelectTrigger><SelectValue placeholder="اختر محفظة" /></SelectTrigger>
          <SelectContent>{wallets.map(w => <SelectItem key={w.id} value={w.id}>{w.name} · {w.currency}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div>
        <Label>الفئة <span className="text-destructive">*</span></Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue placeholder="اختر فئة" /></SelectTrigger>
          <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><Label>المبلغ</Label><Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required dir="ltr" /></div>
        <div>
          <Label>العملة</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>المشروع (اختياري)</Label>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">بدون مشروع</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div><Label>تاريخ الدفع</Label><Input type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} required dir="ltr" /></div>

      <div className="rounded-xl border bg-accent/30 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium flex items-center gap-1"><CalendarRange className="h-4 w-4" /> توزيع المبلغ على عدة أشهر</div>
            <div className="text-[11px] text-muted-foreground">مفيد للإيجار/الاشتراكات المدفوعة مسبقاً</div>
          </div>
          <Switch checked={spread} onCheckedChange={setSpread} />
        </div>
        {spread && (
          <div className="grid grid-cols-2 gap-3">
            <div><Label>عدد الأشهر</Label><Input type="number" min="1" max="60" value={months} onChange={(e) => setMonths(e.target.value)} dir="ltr" /></div>
            <div><Label>شهر البداية</Label><Input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} dir="ltr" /></div>
            {monthly > 0 && (
              <div className="col-span-2 text-xs text-muted-foreground">سيُحسب <span className="font-bold tabular-nums">{formatMoney(monthly, currency)}</span> شهرياً لمدة {monthsN} شهر.</div>
            )}
          </div>
        )}
      </div>

      <div><Label>ملاحظة</Label><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></div>

      <DialogFooter><Button type="submit" className="w-full" disabled={mut.isPending}>حفظ</Button></DialogFooter>
    </form>
  );
}
