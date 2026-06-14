import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ArrowRight, Plus, Trash2 } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { PersonTxForm, kindMeta, kindSign } from "@/components/PersonTxForm";

export const Route = createFileRoute("/_authenticated/app/people/$name")({
  head: ({ params }) => ({ meta: [{ title: `${decodeURIComponent(params.name)} — حسابي` }] }),
  component: PersonDetail,
});

function PersonDetail() {
  const { name: rawName } = Route.useParams();
  const name = decodeURIComponent(rawName);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["person_ledger", name],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("person_ledger")
        .select("*")
        .ilike("contact_name", name)
        .order("happened_at", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("person_ledger").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحذف"); invalidate(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["person_ledger"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  // Running balance per currency (chronological)
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

  return (
    <div className="space-y-5">
      <Link to="/app/people" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4 rotate-180" /> رجوع للأشخاص
      </Link>

      <div className="rounded-2xl bg-[image:var(--gradient-primary)] p-6 text-white shadow-[var(--shadow-elegant)]">
        <div className="text-xs opacity-80">دفتر حساب</div>
        <div className="text-2xl font-bold mt-1">{name}</div>
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
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="w-full"><Plus className="h-4 w-4" /> إضافة حركة جديدة</Button>
        </DialogTrigger>
        <DialogContent className="max-w-md">
          <PersonTxForm defaultName={name} lockName onDone={() => { setOpen(false); invalidate(); }} />
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
              return (
                <div key={r.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                  <div className={cn("grid h-10 w-10 place-items-center rounded-xl", m.bg, m.color)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{m.label}</div>
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
