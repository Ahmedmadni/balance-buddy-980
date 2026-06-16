import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ArrowRight, Plus, Trash2, ArrowLeftRight, Wallet as WalletIcon, ArrowDownToLine, ArrowUpFromLine, Send, Inbox, Equal } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { computeWalletBalance, walletKindMeta, INFLOW_KINDS } from "@/lib/wallet-balance";
import { WalletTxForm, WalletTransferForm } from "@/components/WalletTxForm";

export const Route = createFileRoute("/_authenticated/app/wallets/$id")({
  head: () => ({ meta: [{ title: "كشف المحفظة — رصد" }] }),
  component: WalletDetail,
});

const ICONS: Record<string, any> = { deposit: ArrowDownToLine, withdraw: ArrowUpFromLine, send: Send, receive: Inbox, adjustment: Equal, transfer_out: ArrowLeftRight, transfer_in: ArrowLeftRight };

function WalletDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [openTx, setOpenTx] = useState(false);
  const [openTr, setOpenTr] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["wallet-detail", id],
    queryFn: async () => {
      const [wRes, tRes, eRes, allW] = await Promise.all([
        supabase.from("wallets").select("*").eq("id", id).maybeSingle(),
        supabase.from("wallet_transactions").select("*").eq("wallet_id", id).order("happened_at", { ascending: false }).order("created_at", { ascending: false }),
        supabase.from("expenses").select("id,amount,currency,spent_at,note,categories(name,color)").eq("wallet_id", id).order("spent_at", { ascending: false }),
        supabase.from("wallets").select("id,name,currency,color"),
      ]);
      return { wallet: wRes.data, txs: tRes.data ?? [], expenses: eRes.data ?? [], allW: allW.data ?? [] };
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["wallet-detail", id] });
    qc.invalidateQueries({ queryKey: ["wallets-list"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const delTx = useMutation({
    mutationFn: async (tx: any) => {
      if (tx.transfer_group_id) {
        const { error } = await supabase.from("wallet_transactions").delete().eq("transfer_group_id", tx.transfer_group_id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wallet_transactions").delete().eq("id", tx.id);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success("تم الحذف"); invalidate(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  const w = data?.wallet as any;
  const balance = useMemo(() => w ? computeWalletBalance(Number(w.opening_balance), (data?.txs ?? []) as any, (data?.expenses ?? []) as any) : 0, [w, data]);
  const wNames = new Map((data?.allW ?? []).map((x: any) => [x.id, x.name]));

  // Merge txs + expenses into a single timeline
  const timeline = useMemo(() => {
    const out: any[] = [];
    for (const t of data?.txs ?? []) out.push({ type: "tx", date: t.happened_at, ...t });
    for (const e of data?.expenses ?? []) out.push({ type: "expense", date: e.spent_at, ...e });
    return out.sort((a, b) => b.date.localeCompare(a.date));
  }, [data]);

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>;
  if (!w) return <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">المحفظة غير موجودة</div>;

  return (
    <div className="space-y-5">
      <Link to="/app/wallets" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4 rotate-180" /> رجوع للمحافظ
      </Link>

      <div className="rounded-2xl p-6 text-white shadow-[var(--shadow-elegant)] relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${w.color ?? "#0ea5e9"}, ${w.color ?? "#0ea5e9"}cc)` }}>
        <div className="text-xs opacity-80">الرصيد الحالي</div>
        <div className={cn("text-3xl font-extrabold tabular-nums mt-1", balance < 0 && "text-amber-100")}>{formatMoney(balance, w.currency)}</div>
        <div className="text-sm opacity-90 mt-1">{w.name}</div>
        <div className="text-[11px] opacity-75 mt-0.5">افتتاحي: {formatMoney(w.opening_balance, w.currency)}</div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Dialog open={openTx} onOpenChange={setOpenTx}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> عملية جديدة</Button></DialogTrigger>
          <DialogContent className="max-w-md"><WalletTxForm wallet={w} onDone={() => { setOpenTx(false); invalidate(); }} /></DialogContent>
        </Dialog>
        <Dialog open={openTr} onOpenChange={setOpenTr}>
          <DialogTrigger asChild><Button variant="outline" disabled={(data?.allW ?? []).length < 2}><ArrowLeftRight className="h-4 w-4" /> تحويل</Button></DialogTrigger>
          <DialogContent className="max-w-md"><WalletTransferForm wallets={data?.allW ?? []} defaultFromId={id} onDone={() => { setOpenTr(false); invalidate(); }} /></DialogContent>
        </Dialog>
      </div>

      <div>
        <h3 className="font-semibold mb-2">سجل العمليات</h3>
        {timeline.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">لا توجد عمليات بعد</div>
        ) : (
          <div className="space-y-2">
            {timeline.map((row: any) => {
              if (row.type === "expense") {
                return (
                  <div key={`e-${row.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-destructive/10 text-destructive"><WalletIcon className="h-5 w-5" /></div>
                    <div className="flex-1 min-w-0">
                      <div className="font-medium text-sm">مصروف · {row.categories?.name ?? "—"}</div>
                      <div className="text-[11px] text-muted-foreground">{formatDate(row.spent_at)}{row.note ? ` · ${row.note}` : ""}</div>
                    </div>
                    <div className="text-left font-bold tabular-nums text-sm text-destructive">−{formatMoney(row.amount, row.currency)}</div>
                  </div>
                );
              }
              const isTransfer = row.kind === "transfer_in" || row.kind === "transfer_out";
              const m = walletKindMeta(row.kind);
              const Icon = ICONS[row.kind] ?? WalletIcon;
              const inflow = INFLOW_KINDS.has(row.kind) || row.kind === "transfer_in";
              const sign = inflow ? "+" : "−";
              const color = inflow ? "text-success" : "text-destructive";
              const bg = inflow ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive";
              const label = isTransfer
                ? (row.kind === "transfer_in" ? `تحويل وارد من ${wNames.get(row.counterparty_wallet_id) ?? "—"}` : `تحويل صادر إلى ${wNames.get(row.counterparty_wallet_id) ?? "—"}`)
                : m.label;
              return (
                <div key={`t-${row.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                  <div className={cn("grid h-10 w-10 place-items-center rounded-xl", bg)}><Icon className="h-5 w-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm">{label}</div>
                    <div className="text-[11px] text-muted-foreground">{formatDate(row.happened_at)}{row.notes ? ` · ${row.notes}` : ""}</div>
                  </div>
                  <div className={cn("text-left font-bold tabular-nums text-sm", color)}>{sign}{formatMoney(row.amount, row.currency)}</div>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm(isTransfer ? "حذف التحويل (الطرفين)؟" : "حذف العملية؟")) delTx.mutate(row); }}>
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
