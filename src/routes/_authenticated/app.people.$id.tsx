import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ArrowRight, Plus, Trash2, Phone, MessageCircle, CheckCircle2, AlertTriangle, Clock } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PersonTxForm, kindMeta, kindSign } from "@/components/PersonTxForm";
import { mutatePersonLedger } from "@/lib/person-ledger";

export const Route = createFileRoute("/_authenticated/app/people/$id")({
  head: () => ({ meta: [{ title: "كشف الحساب — رصد" }] }),
  component: PersonDetail,
});

function PersonDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const today = new Date().toISOString().slice(0, 10);

  const { data: contact } = useQuery({
    queryKey: ["contact", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*").eq("id", id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: rows, isLoading } = useQuery({
    queryKey: ["person_ledger", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("person_ledger")
        .select("*")
        .eq("contact_id", id)
        .order("happened_at", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["person_ledger"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
    qc.invalidateQueries({ queryKey: ["wallets-list"] });
    qc.invalidateQueries({ queryKey: ["wallet-detail"] });
    qc.invalidateQueries({ queryKey: ["transactions"] });
    qc.invalidateQueries({ queryKey: ["reports"] });
  };

  const del = useMutation({
    mutationFn: async (rid: string) => mutatePersonLedger("delete", rid),
    onSuccess: () => { toast.success("تم الحذف"); invalidate(); },
    onError: (e: any) => toast.error("خطأ", { description: e.userMessage ?? "تعذر حفظ الحركة" }),
  });

  const toggleSettled = useMutation({
    mutationFn: async ({ rid, settled }: { rid: string; settled: boolean }) => {
      await mutatePersonLedger("update", rid, { settled_at: settled ? new Date().toISOString() : null });
    },
    onSuccess: () => { toast.success("تم التحديث"); invalidate(); },
    onError: (e: any) => toast.error("خطأ", { description: e.userMessage ?? "تعذر حفظ الحركة" }),
  });

  const enriched = useMemo(() => {
    const running: Record<string, number> = {};
    return (rows ?? []).map((r: any) => {
      const signed = kindSign(r.kind) * Number(r.amount);
      running[r.currency] = (running[r.currency] ?? 0) + signed;
      return { ...r, balance: running[r.currency] };
    }).reverse();
  }, [rows]);

  const finalBalances = useMemo(() => {
    const m: Record<string, number> = {};
    for (const r of rows ?? []) m[r.currency] = (m[r.currency] ?? 0) + kindSign(r.kind) * Number(r.amount);
    return m;
  }, [rows]);

  const dueCount = (rows ?? []).filter((r: any) => (r.kind === "lend" || r.kind === "borrow") && r.due_date && !r.settled_at).length;
  const overdueCount = (rows ?? []).filter((r: any) => (r.kind === "lend" || r.kind === "borrow") && r.due_date && !r.settled_at && r.due_date < today).length;

  const name = contact?.name ?? "—";
  const phone = contact?.phone ?? null;

  const waMsg = useMemo(() => {
    const parts: string[] = [`مرحباً ${name}،`];
    const owing = Object.entries(finalBalances).filter(([, v]) => v > 0.001);
    if (owing.length) parts.push("تذكير ودي بالرصيد المستحق: " + owing.map(([c, v]) => `${formatMoney(v, c)}`).join("، "));
    const overdue = (rows ?? []).filter((r: any) => r.kind === "lend" && r.due_date && !r.settled_at && r.due_date < today);
    if (overdue.length) parts.push(`(${overdue.length} مبلغ متأخر عن الاستحقاق)`);
    parts.push("شكراً لك.");
    return encodeURIComponent(parts.join("\n"));
  }, [name, finalBalances, rows, today]);

  const phoneClean = phone?.replace(/[^\d+]/g, "");

  return (
    <div className="space-y-5">
      <Link to="/app/people" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4 rotate-180" /> رجوع للأشخاص
      </Link>

      <div className="rounded-2xl bg-[image:var(--gradient-primary)] p-6 text-white shadow-[var(--shadow-elegant)]">
        <div className="text-xs opacity-80">دفتر حساب</div>
        <div className="text-2xl font-bold mt-1">{name}</div>
        {phone && <div className="text-xs opacity-80 mt-0.5" dir="ltr">{phone}</div>}
        <div className="mt-4 space-y-1">
          {Object.keys(finalBalances).length === 0 ? (
            <div className="text-sm opacity-80">لا توجد حركات</div>
          ) : Object.entries(finalBalances).map(([cur, net]) => {
            const positive = net > 0.001;
            const negative = net < -0.001;
            return (
              <div key={cur} className="flex items-baseline justify-between">
                <div className="text-xs opacity-90">{positive ? "له عندك (مدين لك)" : negative ? "عليك (دائن لك)" : "متوازن"}</div>
                <div className="text-2xl font-extrabold tabular-nums">{formatMoney(Math.abs(net), cur)}</div>
              </div>
            );
          })}
        </div>
        {(dueCount > 0 || overdueCount > 0) && (
          <div className="mt-3 flex gap-2 text-[11px]">
            {overdueCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-destructive/30 px-2 py-1"><AlertTriangle className="h-3 w-3" /> {overdueCount} متأخر</span>}
            {dueCount - overdueCount > 0 && <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-2 py-1"><Clock className="h-3 w-3" /> {dueCount - overdueCount} مستحق قريباً</span>}
          </div>
        )}
        {phoneClean && (
          <div className="mt-4 flex gap-2">
            <a href={`tel:${phoneClean}`} className="flex-1 rounded-xl bg-white/15 hover:bg-white/25 px-3 py-2 text-sm font-medium inline-flex items-center justify-center gap-1.5">
              <Phone className="h-4 w-4" /> اتصال
            </a>
            <a href={`https://wa.me/${phoneClean.replace(/^\+/, "")}?text=${waMsg}`} target="_blank" rel="noreferrer" className="flex-1 rounded-xl bg-white/15 hover:bg-white/25 px-3 py-2 text-sm font-medium inline-flex items-center justify-center gap-1.5">
              <MessageCircle className="h-4 w-4" /> تذكير واتساب
            </a>
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full"><Plus className="h-4 w-4" /> إضافة حركة جديدة</Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <PersonTxForm defaultContactId={id} defaultName={name} lockContact onDone={() => { setOpen(false); invalidate(); }} />
        </DialogContent>
      </Dialog>

      <div>
        <h3 className="font-semibold mb-2">سجل الحركات</h3>
        {isLoading ? (
          <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
        ) : enriched.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">لا توجد حركات بعد</div>
        ) : (
          <div className="space-y-2">
            {enriched.map((r: any) => {
              const m = kindMeta(r.kind);
              const Icon = m.icon;
              const isDebt = r.kind === "lend" || r.kind === "borrow";
              const overdue = isDebt && r.due_date && !r.settled_at && r.due_date < today;
              return (
                <div key={r.id} className={cn("flex items-center gap-3 rounded-xl border bg-card p-3", r.settled_at && "opacity-60", overdue && "border-destructive/40")}>
                  <div className={cn("grid h-10 w-10 place-items-center rounded-xl", m.bg, m.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm flex items-center gap-1.5 flex-wrap">
                      {m.label}
                      {r.settled_at && <span className="text-[10px] rounded-full bg-success/15 text-success px-1.5 py-0.5">مسدد</span>}
                      {overdue && <span className="text-[10px] rounded-full bg-destructive/15 text-destructive px-1.5 py-0.5">متأخر</span>}
                      {isDebt && r.due_date && !r.settled_at && !overdue && <span className="text-[10px] rounded-full bg-amber-500/15 text-amber-700 px-1.5 py-0.5">مستحق {formatDate(r.due_date)}</span>}
                    </div>
                    <div className="text-[11px] text-muted-foreground">{formatDate(r.happened_at)}{r.notes ? ` · ${r.notes}` : ""}</div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className={cn("font-bold tabular-nums text-sm", m.color)}>
                      {m.sign}{formatMoney(Number(r.amount), r.currency)}
                    </div>
                    <div className="text-[10px] text-muted-foreground tabular-nums">
                      الرصيد: {formatMoney(Math.abs(r.balance), r.currency)}{r.balance > 0.001 ? " له" : r.balance < -0.001 ? " عليه" : ""}
                    </div>
                  </div>
                  {isDebt && (
                    <Button variant="ghost" size="icon" title={r.settled_at ? "إلغاء السداد" : "تأشير كمسدد"} onClick={() => toggleSettled.mutate({ rid: r.id, settled: !r.settled_at })}>
                      <CheckCircle2 className={cn("h-4 w-4", r.settled_at ? "text-success" : "text-muted-foreground")} />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("حذف الحركة؟")) del.mutate(r.id); }}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
