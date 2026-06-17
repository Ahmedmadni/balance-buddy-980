import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { ArrowRight, Plus, ArrowLeftRight } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { computeWalletBalance } from "@/lib/wallet-balance";
import { WalletTxForm, WalletTransferForm } from "@/components/WalletTxForm";
import { buildWalletStatement } from "@/lib/statement";
import { StatementTable } from "@/components/StatementTable";
import { typeMeta } from "@/routes/_authenticated/app.wallets";

export const Route = createFileRoute("/_authenticated/app/wallets/$id")({
  head: () => ({ meta: [{ title: "كشف الحساب — رصد" }] }),
  component: WalletDetail,
});

function WalletDetail() {
  const { id } = Route.useParams();
  const qc = useQueryClient();
  const [openTx, setOpenTx] = useState(false);
  const [openTr, setOpenTr] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["wallet-detail", id],
    queryFn: async () => {
      const [wRes, tRes, eRes, allW, catsRes] = await Promise.all([
        supabase.from("wallets").select("*").eq("id", id).maybeSingle(),
        supabase.from("wallet_transactions").select("*").eq("wallet_id", id).order("happened_at", { ascending: false }),
        supabase.from("expenses").select("id,amount,currency,spent_at,note,categories(name,color)").eq("wallet_id", id).order("spent_at", { ascending: false }),
        supabase.from("wallets").select("id,name,currency,color"),
        supabase.from("wallet_tx_categories" as any).select("id,name"),
      ]);
      return { wallet: wRes.data, txs: tRes.data ?? [], expenses: eRes.data ?? [], allW: allW.data ?? [], cats: (catsRes.data ?? []) as any[] };
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["wallet-detail", id] });
    qc.invalidateQueries({ queryKey: ["wallets-list"] });
    qc.invalidateQueries({ queryKey: ["dashboard"] });
  };

  const w = data?.wallet as any;
  const balance = useMemo(() => w ? computeWalletBalance(Number(w.opening_balance), (data?.txs ?? []) as any, (data?.expenses ?? []) as any) : 0, [w, data]);

  const statement = useMemo(() => {
    if (!w) return [];
    const wNames = new Map((data?.allW ?? []).map((x: any) => [x.id, x.name]));
    const cNames = new Map((data?.cats ?? []).map((c: any) => [c.id, c.name]));
    return buildWalletStatement({
      openingBalance: Number(w.opening_balance),
      currency: w.currency,
      txs: (data?.txs ?? []) as any,
      expenses: (data?.expenses ?? []) as any,
      walletNames: wNames,
      categoryNames: cNames,
    });
  }, [w, data]);

  if (isLoading) return <div className="space-y-3">{[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>;
  if (!w) return <div className="rounded-2xl border bg-card p-8 text-center text-muted-foreground">الحساب غير موجود</div>;

  const meta = typeMeta(w.type);

  return (
    <div className="space-y-5">
      <Link to="/app/wallets" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4 rotate-180" /> رجوع للحسابات
      </Link>

      <div className="rounded-2xl p-6 text-white shadow-[var(--shadow-elegant)] relative overflow-hidden" style={{ background: `linear-gradient(135deg, ${w.color ?? meta.color}, ${w.color ?? meta.color}cc)` }}>
        <div className="text-xs opacity-80">{meta.label}</div>
        <div className="text-sm opacity-90 mt-0.5">{w.name}</div>
        <div className="text-xs opacity-80 mt-3">الرصيد الحالي</div>
        <div className={cn("text-3xl font-extrabold tabular-nums mt-1", balance < 0 && "text-amber-100")}>{formatMoney(balance, w.currency)}</div>
        <div className="text-[11px] opacity-75 mt-1">افتتاحي: {formatMoney(w.opening_balance, w.currency)}</div>
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
        <h3 className="font-semibold mb-2">كشف الحساب</h3>
        <StatementTable
          rows={statement}
          meta={{
            title: `كشف حساب — ${w.name}`,
            subtitle: `${meta.label} · العملة: ${w.currency}`,
            currency: w.currency,
            openingBalance: Number(w.opening_balance),
            closingBalance: balance,
          }}
        />
      </div>
    </div>
  );
}
