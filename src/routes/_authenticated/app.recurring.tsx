import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Repeat, Zap, CalendarClock, Pencil } from "lucide-react";
import { CURRENCIES, formatMoney, formatDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/recurring")({
  head: () => ({ meta: [{ title: "المصاريف الدورية — رصد" }] }),
  component: RecurringPage,
});

const FREQS = [
  { value: "daily", label: "يومي" },
  { value: "weekly", label: "أسبوعي" },
  { value: "monthly", label: "شهري" },
  { value: "yearly", label: "سنوي" },
];
const freqLabel = (v: string) => FREQS.find((f) => f.value === v)?.label ?? v;

function addInterval(date: string, freq: string, n: number) {
  const d = new Date(date);
  if (freq === "daily") d.setDate(d.getDate() + n);
  else if (freq === "weekly") d.setDate(d.getDate() + 7 * n);
  else if (freq === "monthly") d.setMonth(d.getMonth() + n);
  else if (freq === "yearly") d.setFullYear(d.getFullYear() + n);
  return d.toISOString().slice(0, 10);
}

function RecurringPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["recurring-list"],
    queryFn: async () => {
      const [rRes, cRes, pRes, wRes, conRes] = await Promise.all([
        supabase.from("recurring_expenses").select("*, categories(name,color), wallets(name,color,currency), contacts(name)").order("next_due"),
        supabase.from("categories").select("*").order("name"),
        supabase.from("projects").select("*").eq("status", "active").order("name"),
        supabase.from("wallets").select("*").order("created_at"),
        supabase.from("contacts").select("id,name").order("name"),
      ]);
      return { items: rRes.data ?? [], categories: cRes.data ?? [], projects: pRes.data ?? [], wallets: wRes.data ?? [], contacts: conRes.data ?? [] };
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("recurring_expenses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["recurring-list"] }); toast.success("تم الحذف"); },
  });

  const post = useMutation({
    mutationFn: async (r: any) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      // Create one expense for next_due
      const period = new Date(r.next_due);
      const periodStr = new Date(period.getFullYear(), period.getMonth(), 1).toISOString().slice(0, 10);
      const { data: ins, error: eErr } = await supabase.from("expenses").insert({
        user_id: u.user.id, amount: r.amount, currency: r.currency,
        category_id: r.category_id, wallet_id: r.wallet_id, project_id: r.project_id,
        spent_at: r.next_due, note: r.notes ?? r.name, allocation_kind: "single",
      }).select("id").single();
      if (eErr) throw eErr;
      await supabase.from("expense_allocations").insert({
        user_id: u.user.id, expense_id: (ins as any).id, period: periodStr, amount: r.amount, currency: r.currency,
      });
      const next = addInterval(r.next_due, r.frequency, r.interval_count || 1);
      const active = !r.end_date || next <= r.end_date;
      await supabase.from("recurring_expenses").update({
        last_posted_at: r.next_due, next_due: next, is_active: active,
      }).eq("id", r.id);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["recurring-list"] });
      qc.invalidateQueries({ queryKey: ["expenses-list"] });
      qc.invalidateQueries({ queryKey: ["expense-month-alloc"] });
      qc.invalidateQueries({ queryKey: ["wallets-list"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      toast.success("تم تسجيل المصروف");
    },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  const today = todayISO();
  const items = data?.items ?? [];
  const dueNow = items.filter((r: any) => r.is_active && r.next_due <= today);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><Repeat className="h-6 w-6" /> المصاريف الدورية</h1>
          <p className="text-sm text-muted-foreground mt-1">اشتراكات، إيجار، فواتير ثابتة — مع تذكير وتسجيل تلقائي</p>
        </div>
        <Dialog open={open || !!editing} onOpenChange={(v) => { if (!v) { setOpen(false); setEditing(null); } }}>
          <DialogTrigger asChild><Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> مصروف دوري</Button></DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <RecurringForm
              initial={editing}
              categories={data?.categories ?? []}
              wallets={data?.wallets ?? []}
              projects={data?.projects ?? []}
              contacts={data?.contacts ?? []}
              onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["recurring-list"] }); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {dueNow.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="font-semibold text-sm flex items-center gap-2 mb-2"><CalendarClock className="h-4 w-4 text-amber-600" /> مستحقات للتسجيل ({dueNow.length})</div>
          <div className="space-y-1.5">
            {dueNow.map((r: any) => (
              <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg bg-background/60 p-2 text-xs">
                <div className="min-w-0 flex-1 truncate">
                  <span className="font-medium">{r.name}</span>
                  <span className="text-muted-foreground"> · {formatDate(r.next_due)}</span>
                </div>
                <span className="font-bold tabular-nums">{formatMoney(r.amount, r.currency)}</span>
                <Button size="sm" variant="default" onClick={() => post.mutate(r)} disabled={post.isPending}><Zap className="h-3 w-3" /> تسجيل الآن</Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent"><Repeat className="h-6 w-6 text-accent-foreground" /></div>
          <h3 className="mt-4 font-semibold">لا يوجد مصاريف دورية</h3>
          <p className="mt-1 text-sm text-muted-foreground">أضف اشتراكاتك أو إيجارك ليتم تذكيرك تلقائياً</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((r: any) => {
            const overdue = r.is_active && r.next_due < today;
            return (
              <div key={r.id} className={cn("flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]", !r.is_active && "opacity-50")}>
                <div className="grid h-11 w-11 place-items-center rounded-xl text-white shrink-0" style={{ background: r.categories?.color ?? r.wallets?.color ?? "#0ea5e9" }}>
                  <Repeat className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold truncate flex items-center gap-2 flex-wrap">
                    {r.name}
                    <span className="text-[10px] rounded-full bg-primary/15 text-primary px-1.5 py-0.5">{freqLabel(r.frequency)}</span>
                    {r.auto_post && <span className="text-[10px] rounded-full bg-success/15 text-success px-1.5 py-0.5">تلقائي</span>}
                    {!r.is_active && <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5">منتهي</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {r.wallets?.name && <span>{r.wallets.name} · </span>}
                    <span className={overdue ? "text-destructive font-medium" : ""}>الاستحقاق: {formatDate(r.next_due)}</span>
                    {r.contacts?.name && <span> · {r.contacts.name}</span>}
                  </div>
                </div>
                <div className="text-left shrink-0">
                  <div className="font-bold tabular-nums">{formatMoney(r.amount, r.currency)}</div>
                </div>
                <div className="flex gap-1 shrink-0">
                  {r.is_active && <Button variant="outline" size="sm" onClick={() => post.mutate(r)} disabled={post.isPending}><Zap className="h-3.5 w-3.5" /></Button>}
                  <Button variant="ghost" size="icon" onClick={() => setEditing(r)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("حذف؟")) del.mutate(r.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="text-[11px] text-muted-foreground text-center pt-2">
        <Link to="/app/expenses" className="text-primary hover:underline">عرض جميع المصاريف</Link>
      </div>
    </div>
  );
}

function RecurringForm({ initial, categories, wallets, projects, contacts, onDone }: any) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [walletId, setWalletId] = useState<string>(initial?.wallet_id ?? wallets[0]?.id ?? "");
  const w0 = wallets.find((x: any) => x.id === walletId);
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? w0?.currency ?? "SAR");
  const [categoryId, setCategoryId] = useState<string>(initial?.category_id ?? categories[0]?.id ?? "");
  const [projectId, setProjectId] = useState<string>(initial?.project_id ?? "none");
  const [contactId, setContactId] = useState<string>(initial?.contact_id ?? "none");
  const [frequency, setFrequency] = useState(initial?.frequency ?? "monthly");
  const [intervalCount, setIntervalCount] = useState(initial?.interval_count?.toString() ?? "1");
  const [startDate, setStartDate] = useState(initial?.start_date ?? todayISO());
  const [endDate, setEndDate] = useState(initial?.end_date ?? "");
  const [nextDue, setNextDue] = useState(initial?.next_due ?? todayISO());
  const [autoPost, setAutoPost] = useState(initial?.auto_post ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const payload: any = {
        user_id: u.user.id, name: name.trim(), amount: parseFloat(amount), currency,
        wallet_id: walletId || null, category_id: categoryId || null,
        project_id: projectId === "none" ? null : projectId,
        contact_id: contactId === "none" ? null : contactId,
        frequency, interval_count: parseInt(intervalCount) || 1,
        start_date: startDate, end_date: endDate || null, next_due: nextDue,
        auto_post: autoPost, notes: notes || null,
      };
      if (isEdit) {
        const { error } = await supabase.from("recurring_expenses").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("recurring_expenses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(isEdit ? "تم التحديث" : "تمت الإضافة"); onDone(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
      <DialogHeader><DialogTitle>{isEdit ? "تعديل مصروف دوري" : "مصروف دوري جديد"}</DialogTitle></DialogHeader>
      <div><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="إيجار الشقة، اشتراك Netflix..." /></div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>المبلغ</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required dir="ltr" /></div>
        <div>
          <Label>العملة</Label>
          <Select value={currency} onValueChange={setCurrency}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent></Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>المحفظة</Label>
          <Select value={walletId} onValueChange={(v) => { setWalletId(v); const w = wallets.find((x: any) => x.id === v); if (w?.currency) setCurrency(w.currency); }}>
            <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
            <SelectContent>{wallets.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select>
        </div>
        <div>
          <Label>الفئة</Label>
          <Select value={categoryId} onValueChange={setCategoryId}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{categories.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>التكرار</Label>
          <Select value={frequency} onValueChange={setFrequency}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{FREQS.map(f => <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>)}</SelectContent></Select>
        </div>
        <div><Label>كل (×)</Label><Input type="number" min="1" value={intervalCount} onChange={(e) => setIntervalCount(e.target.value)} dir="ltr" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>تاريخ البداية</Label><Input type="date" value={startDate} onChange={(e) => { setStartDate(e.target.value); if (!isEdit) setNextDue(e.target.value); }} dir="ltr" /></div>
        <div><Label>الاستحقاق التالي</Label><Input type="date" value={nextDue} onChange={(e) => setNextDue(e.target.value)} dir="ltr" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>تاريخ النهاية (اختياري)</Label><Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} dir="ltr" /></div>
        <div>
          <Label>الشخص (اختياري)</Label>
          <Select value={contactId} onValueChange={setContactId}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">—</SelectItem>{contacts.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent></Select>
        </div>
      </div>
      <div>
        <Label>المشروع (اختياري)</Label>
        <Select value={projectId} onValueChange={setProjectId}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="none">—</SelectItem>{projects.map((p: any) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="flex items-center justify-between rounded-xl border bg-accent/30 p-3">
        <div>
          <div className="text-sm font-medium">تسجيل تلقائي</div>
          <div className="text-[11px] text-muted-foreground">سجّل المصروف تلقائياً عند حلول التاريخ</div>
        </div>
        <Switch checked={autoPost} onCheckedChange={setAutoPost} />
      </div>
      <div><Label>ملاحظة</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} /></div>
      <DialogFooter><Button type="submit" className="w-full" disabled={mut.isPending}>{mut.isPending ? "جاري الحفظ..." : "حفظ"}</Button></DialogFooter>
    </form>
  );
}
