import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, Plus, Pencil, Trash2 } from "lucide-react";
import { formatMoney, formatDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DebtForm } from "./app.debts";

export const Route = createFileRoute("/_authenticated/app/debts/$id")({
  head: () => ({ meta: [{ title: "تفاصيل الدين — رصد" }] }),
  component: DebtDetail,
});

function DebtDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [payOpen, setPayOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);

  const { data: debt, isLoading } = useQuery({
    queryKey: ["debt", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("debts").select("*").eq("id", id).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: payments } = useQuery({
    queryKey: ["debt_payments", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("debt_payments").select("*").eq("debt_id", id).order("paid_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("debts").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["debts"] }); navigate({ to: "/app/debts" }); },
  });

  const delPay = useMutation({
    mutationFn: async (pid: string) => {
      const { error } = await supabase.from("debt_payments").delete().eq("id", pid);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["debt_payments", id] }); qc.invalidateQueries({ queryKey: ["debts"] }); },
  });

  if (isLoading || !debt) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;

  const paid = (payments ?? []).reduce((s, p) => s + Number(p.amount), 0);
  const remaining = Math.max(0, Number(debt.amount) - paid);
  const percent = Math.min(100, (paid / Number(debt.amount)) * 100);
  const isOwedToMe = debt.direction === "owed_to_me";

  return (
    <div className="space-y-5">
      <Link to="/app/debts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4 rotate-180" /> رجوع للديون
      </Link>

      <div className={cn("rounded-2xl p-6 text-white shadow-[var(--shadow-elegant)]",
        isOwedToMe ? "bg-[image:var(--gradient-success)]" : "bg-[image:var(--gradient-destructive)]")}>
        <div className="text-xs opacity-80">{isOwedToMe ? "مستحق لي من" : "مستحق عليّ لـ"}</div>
        <div className="text-2xl font-bold mt-1">{debt.contact_name}</div>
        <div className="mt-4 flex items-end justify-between">
          <div>
            <div className="text-xs opacity-80">المتبقي</div>
            <div className="text-3xl font-extrabold tabular-nums">{formatMoney(remaining, debt.currency)}</div>
          </div>
          <div className="text-left text-xs opacity-90">
            <div>المبلغ: <span className="tabular-nums">{formatMoney(debt.amount, debt.currency)}</span></div>
            <div>مدفوع: <span className="tabular-nums">{formatMoney(paid, debt.currency)}</span></div>
            {debt.due_date && <div>استحقاق: {formatDate(debt.due_date)}</div>}
          </div>
        </div>
        <Progress value={percent} className="mt-3 h-2 bg-white/20" />
      </div>

      {debt.notes && <div className="rounded-xl border bg-card p-4 text-sm">{debt.notes}</div>}

      <div className="flex gap-2">
        <Dialog open={payOpen} onOpenChange={setPayOpen}>
          <DialogTrigger asChild><Button className="flex-1" disabled={remaining <= 0}><Plus className="h-4 w-4" /> تسجيل دفعة</Button></DialogTrigger>
          <DialogContent className="max-w-sm">
            <PaymentForm debtId={id} maxAmount={remaining} onDone={() => { setPayOpen(false); qc.invalidateQueries({ queryKey: ["debt_payments", id] }); qc.invalidateQueries({ queryKey: ["debts"] }); }} />
          </DialogContent>
        </Dialog>
        <Dialog open={editOpen} onOpenChange={setEditOpen}>
          <DialogTrigger asChild><Button variant="outline" size="icon"><Pencil className="h-4 w-4" /></Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <DebtForm initial={debt} onDone={() => { setEditOpen(false); qc.invalidateQueries({ queryKey: ["debt", id] }); qc.invalidateQueries({ queryKey: ["debts"] }); }} />
          </DialogContent>
        </Dialog>
        <Button variant="outline" size="icon" onClick={() => { if (confirm("حذف الدين؟")) del.mutate(); }}>
          <Trash2 className="h-4 w-4 text-destructive" />
        </Button>
      </div>

      <div>
        <h3 className="font-semibold mb-2">سجل الدفعات</h3>
        {(payments ?? []).length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">لا توجد دفعات بعد</div>
        ) : (
          <div className="space-y-2">
            {payments!.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-xl border bg-card p-3">
                <div>
                  <div className="font-medium tabular-nums">{formatMoney(p.amount, debt.currency)}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(p.paid_at)}{p.notes ? ` · ${p.notes}` : ""}</div>
                </div>
                <Button variant="ghost" size="icon" onClick={() => delPay.mutate(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function PaymentForm({ debtId, maxAmount, onDone }: { debtId: string; maxAmount: number; onDone: () => void }) {
  const [amount, setAmount] = useState(maxAmount.toFixed(2));
  const [paidAt, setPaidAt] = useState(todayISO());
  const [notes, setNotes] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const { error } = await supabase.from("debt_payments").insert({
        debt_id: debtId, user_id: u.user.id, amount: parseFloat(amount), paid_at: paidAt, notes: notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم تسجيل الدفعة"); onDone(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
      <DialogHeader><DialogTitle>تسجيل دفعة</DialogTitle></DialogHeader>
      <div>
        <Label>المبلغ</Label>
        <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required dir="ltr" />
        <div className="mt-1 text-xs text-muted-foreground">الحد الأقصى: {maxAmount.toFixed(2)}</div>
      </div>
      <div>
        <Label>تاريخ الدفع</Label>
        <Input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} required dir="ltr" />
      </div>
      <div>
        <Label>ملاحظة</Label>
        <Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} />
      </div>
      <DialogFooter>
        <Button type="submit" className="w-full" disabled={mut.isPending}>حفظ</Button>
      </DialogFooter>
    </form>
  );
}
