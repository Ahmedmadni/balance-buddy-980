import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, ArrowDownRight, ArrowUpRight, CircleAlert } from "lucide-react";
import { CURRENCIES, formatMoney, formatDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/debts")({
  head: () => ({ meta: [{ title: "الديون — رصد" }] }),
  component: DebtsPage,
});

type Filter = "all" | "owed_to_me" | "owed_by_me" | "paid";

function DebtsPage() {
  const qc = useQueryClient();
  const [filter, setFilter] = useState<Filter>("all");
  const [open, setOpen] = useState(false);

  const { data: debts, isLoading } = useQuery({
    queryKey: ["debts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .select("*, debt_payments(amount)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const filtered = (debts ?? []).filter((d: any) => {
    const paid = (d.debt_payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
    const remaining = Number(d.amount) - paid;
    if (filter === "paid") return remaining <= 0.001;
    if (filter === "owed_to_me") return d.direction === "owed_to_me" && remaining > 0.001;
    if (filter === "owed_by_me") return d.direction === "owed_by_me" && remaining > 0.001;
    return true;
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الديون</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة الديون المستحقة لك أو عليك</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button className="shrink-0"><Plus className="h-4 w-4" /> إضافة دين</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DebtForm onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["debts"] }); }} />
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={filter} onValueChange={(v) => setFilter(v as Filter)}>
        <TabsList className="grid grid-cols-4 w-full">
          <TabsTrigger value="all">الكل</TabsTrigger>
          <TabsTrigger value="owed_to_me">لي</TabsTrigger>
          <TabsTrigger value="owed_by_me">عليّ</TabsTrigger>
          <TabsTrigger value="paid">مسددة</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="space-y-2">
          {filtered.map((d: any) => <DebtRow key={d.id} debt={d} />)}
        </div>
      )}
    </div>
  );
}

function DebtRow({ debt }: { debt: any }) {
  const paid = (debt.debt_payments ?? []).reduce((s: number, p: any) => s + Number(p.amount), 0);
  const remaining = Math.max(0, Number(debt.amount) - paid);
  const isOwedToMe = debt.direction === "owed_to_me";
  const overdue = debt.due_date && remaining > 0 && new Date(debt.due_date) < new Date(new Date().toDateString());

  return (
    <Link
      to="/app/debts/$id"
      params={{ id: debt.id }}
      className="flex items-center gap-4 rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]"
    >
      <div className={cn("grid h-11 w-11 place-items-center rounded-xl text-white shrink-0",
        isOwedToMe ? "bg-[image:var(--gradient-success)]" : "bg-[image:var(--gradient-destructive)]")}>
        {isOwedToMe ? <ArrowDownRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <div className="font-semibold truncate">{debt.contact_name}</div>
          {overdue && <span className="inline-flex items-center gap-1 rounded-full bg-destructive/10 px-2 py-0.5 text-[10px] text-destructive"><CircleAlert className="h-3 w-3" />متأخر</span>}
          {remaining <= 0.001 && <span className="rounded-full bg-success/10 px-2 py-0.5 text-[10px] text-success">مسدد</span>}
        </div>
        <div className="text-xs text-muted-foreground mt-0.5">
          {debt.due_date ? `استحقاق: ${formatDate(debt.due_date)}` : "بدون موعد"}
          {paid > 0 && remaining > 0 && ` · مدفوع ${formatMoney(paid, debt.currency)}`}
        </div>
      </div>
      <div className="text-left shrink-0">
        <div className={cn("font-bold tabular-nums", isOwedToMe ? "text-success" : "text-destructive")}>
          {formatMoney(remaining > 0 ? remaining : debt.amount, debt.currency)}
        </div>
        <div className="text-[11px] text-muted-foreground">{isOwedToMe ? "لي" : "عليّ"}</div>
      </div>
    </Link>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border bg-card p-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent">
        <ArrowDownRight className="h-6 w-6 text-accent-foreground" />
      </div>
      <h3 className="mt-4 font-semibold">لا توجد ديون بعد</h3>
      <p className="mt-1 text-sm text-muted-foreground">ابدأ بإضافة أول دين لتتبعه</p>
    </div>
  );
}

export function DebtForm({ onDone, initial, defaults, lockContact }: { onDone: () => void; initial?: any; defaults?: { contact_name?: string; direction?: string }; lockContact?: boolean }) {
  const isEdit = !!initial;
  const [direction, setDirection] = useState<string>(initial?.direction ?? defaults?.direction ?? "owed_to_me");
  const [contactName, setContactName] = useState(initial?.contact_name ?? defaults?.contact_name ?? "");
  const [amount, setAmount] = useState(initial?.amount?.toString() ?? "");
  const [currency, setCurrency] = useState(initial?.currency ?? "SAR");
  const [dueDate, setDueDate] = useState(initial?.due_date ?? "");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const mutation = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const payload = {
        user_id: u.user.id,
        contact_name: contactName.trim(),
        direction,
        amount: parseFloat(amount),
        currency,
        due_date: dueDate || null,
        notes: notes.trim() || null,
      };
      if (isEdit) {
        const { error } = await supabase.from("debts").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("debts").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(isEdit ? "تم التحديث" : "تمت الإضافة"); onDone(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mutation.mutate(); }} className="space-y-4">
      <DialogHeader><DialogTitle>{isEdit ? "تعديل دين" : (defaults?.contact_name ? `معاملة جديدة مع ${defaults.contact_name}` : "دين جديد")}</DialogTitle></DialogHeader>

      <Tabs value={direction} onValueChange={setDirection}>
        <TabsList className="grid grid-cols-2 w-full">
          <TabsTrigger value="owed_to_me">مستحق لي</TabsTrigger>
          <TabsTrigger value="owed_by_me">مستحق عليّ</TabsTrigger>
        </TabsList>
      </Tabs>

      <div>
        <Label>اسم الشخص</Label>
        <Input value={contactName} onChange={(e) => setContactName(e.target.value)} required maxLength={100} placeholder="مثلاً: أحمد محمد" disabled={lockContact} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>المبلغ</Label>
          <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required dir="ltr" />
        </div>
        <div>
          <Label>العملة</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name} ({c.symbol})</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>تاريخ الاستحقاق (اختياري)</Label>
        <Input type="date" value={dueDate ?? ""} onChange={(e) => setDueDate(e.target.value)} dir="ltr" />
      </div>

      <div>
        <Label>ملاحظات</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={500} rows={2} />
      </div>

      <DialogFooter>
        <Button type="submit" disabled={mutation.isPending} className="w-full">{mutation.isPending ? "جاري الحفظ..." : "حفظ"}</Button>
      </DialogFooter>
    </form>
  );
}
