import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, TrendingUp, Trash2, Pencil, Wallet as WalletIcon, ArrowDownCircle, ArrowUpCircle, RefreshCw, PiggyBank } from "lucide-react";
import { CURRENCIES, formatMoney, formatDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/investments")({
  head: () => ({ meta: [{ title: "الاستثمارات — رصد" }] }),
  component: InvestmentsPage,
});

const INV_TYPES = [
  { value: "stocks", label: "أسهم" },
  { value: "real_estate", label: "عقار" },
  { value: "partnership", label: "شراكة" },
  { value: "fund", label: "صندوق استثماري" },
  { value: "crypto", label: "عملات رقمية" },
  { value: "business", label: "نشاط تجاري" },
  { value: "other", label: "أخرى" },
];
const typeLabel = (v: string) => INV_TYPES.find((t) => t.value === v)?.label ?? v;

const TX_KINDS = [
  { value: "capital_add", label: "إضافة رأس مال", icon: ArrowDownCircle, color: "text-primary" },
  { value: "return", label: "عائد/ربح", icon: TrendingUp, color: "text-success" },
  { value: "withdraw", label: "سحب", icon: ArrowUpCircle, color: "text-destructive" },
  { value: "revaluation", label: "إعادة تقييم", icon: RefreshCw, color: "text-amber-600" },
];
const kindMeta = (v: string) => TX_KINDS.find((k) => k.value === v) ?? TX_KINDS[0];

function InvestmentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [txFor, setTxFor] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["investments-list"],
    queryFn: async () => {
      const [iRes, tRes, wRes] = await Promise.all([
        supabase.from("investments").select("*, wallets(name,color,currency)").order("created_at", { ascending: false }),
        supabase.from("investment_transactions").select("*").order("happened_at", { ascending: false }),
        supabase.from("wallets").select("*").order("created_at"),
      ]);
      return { items: iRes.data ?? [], txs: (tRes.data ?? []) as any[], wallets: wRes.data ?? [] };
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("investments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["investments-list"] }); toast.success("تم الحذف"); },
  });

  const txByInv = new Map<string, any[]>();
  for (const t of data?.txs ?? []) {
    const a = txByInv.get(t.investment_id) ?? []; a.push(t); txByInv.set(t.investment_id, a);
  }

  const totals = useMemo(() => {
    const byCur: Record<string, { invested: number; value: number; returns: number }> = {};
    for (const inv of data?.items ?? []) {
      const cur = inv.currency;
      const t = (byCur[cur] ??= { invested: 0, value: 0, returns: 0 });
      const txs = txByInv.get(inv.id) ?? [];
      const invested = txs.filter(x => x.kind === "capital_add").reduce((s, x) => s + Number(x.amount), 0) + Number(inv.principal);
      const returns = txs.filter(x => x.kind === "return").reduce((s, x) => s + Number(x.amount), 0);
      const withdraws = txs.filter(x => x.kind === "withdraw").reduce((s, x) => s + Number(x.amount), 0);
      t.invested += invested - withdraws;
      t.value += Number(inv.current_value || invested);
      t.returns += returns;
    }
    return byCur;
  }, [data, txByInv]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="h-6 w-6" /> الاستثمارات</h1>
          <p className="text-sm text-muted-foreground mt-1">تتبّع رؤوس أموالك وعوائدك ونسب ملكيتك</p>
        </div>
        <Dialog open={open || !!editing} onOpenChange={(v) => { if (!v) { setOpen(false); setEditing(null); } }}>
          <DialogTrigger asChild><Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> استثمار</Button></DialogTrigger>
          <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
            <InvestmentForm initial={editing} wallets={data?.wallets ?? []} onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["investments-list"] }); }} />
          </DialogContent>
        </Dialog>
      </div>

      {Object.keys(totals).length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(totals).map(([cur, t]) => {
            const pnl = t.value - t.invested + t.returns;
            return (
              <div key={cur} className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
                <div className="text-[11px] text-muted-foreground">إجمالي رأس المال ({cur})</div>
                <div className="text-xl font-extrabold tabular-nums">{formatMoney(t.invested, cur)}</div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
                  <div><div className="text-muted-foreground">القيمة الحالية</div><div className="font-bold tabular-nums">{formatMoney(t.value, cur)}</div></div>
                  <div><div className="text-muted-foreground">الأرباح</div><div className={cn("font-bold tabular-nums", pnl >= 0 ? "text-success" : "text-destructive")}>{formatMoney(pnl, cur)}</div></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isLoading ? (
        <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : (data?.items ?? []).length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent"><TrendingUp className="h-6 w-6" /></div>
          <h3 className="mt-4 font-semibold">لا يوجد استثمارات</h3>
          <p className="mt-1 text-sm text-muted-foreground">أضف أول استثمار لمتابعة عوائده</p>
        </div>
      ) : (
        <div className="space-y-2">
          {data!.items.map((inv: any) => {
            const txs = txByInv.get(inv.id) ?? [];
            const invested = txs.filter(x => x.kind === "capital_add").reduce((s, x) => s + Number(x.amount), 0) + Number(inv.principal);
            const returns = txs.filter(x => x.kind === "return").reduce((s, x) => s + Number(x.amount), 0);
            const withdraws = txs.filter(x => x.kind === "withdraw").reduce((s, x) => s + Number(x.amount), 0);
            const net = invested - withdraws;
            const pnl = Number(inv.current_value || net) - net + returns;
            const pnlPct = net > 0 ? (pnl / net) * 100 : 0;
            return (
              <div key={inv.id} className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)] transition" onClick={() => setDetail(inv)}>
                <div className="flex items-start gap-3">
                  <div className="grid h-11 w-11 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-white shrink-0"><TrendingUp className="h-5 w-5" /></div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate flex items-center gap-2 flex-wrap">
                      {inv.name}
                      <span className="text-[10px] rounded-full bg-primary/15 text-primary px-1.5 py-0.5">{typeLabel(inv.type)}</span>
                      {inv.is_zakatable && <span className="text-[10px] rounded-full bg-amber-500/15 text-amber-700 px-1.5 py-0.5">قابل للزكاة</span>}
                      {inv.status === "closed" && <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5">مغلق</span>}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">الملكية {inv.ownership_pct}% · بدأ {formatDate(inv.start_date)}</div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                      <div><div className="text-muted-foreground">رأس المال</div><div className="font-bold tabular-nums">{formatMoney(net, inv.currency)}</div></div>
                      <div><div className="text-muted-foreground">القيمة</div><div className="font-bold tabular-nums">{formatMoney(inv.current_value || net, inv.currency)}</div></div>
                      <div><div className="text-muted-foreground">العائد</div><div className={cn("font-bold tabular-nums", pnl >= 0 ? "text-success" : "text-destructive")}>{pnl >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%</div></div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                    <Button variant="outline" size="sm" onClick={() => setTxFor(inv)}><Plus className="h-3.5 w-3.5" /> حركة</Button>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => setEditing(inv)}><Pencil className="h-4 w-4" /></Button>
                      <Button variant="ghost" size="icon" onClick={() => { if (confirm("حذف الاستثمار؟")) del.mutate(inv.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!txFor} onOpenChange={(v) => !v && setTxFor(null)}>
        <DialogContent className="max-w-md">
          {txFor && <InvestmentTxForm investment={txFor} wallets={data?.wallets ?? []} onDone={() => { setTxFor(null); qc.invalidateQueries({ queryKey: ["investments-list"] }); qc.invalidateQueries({ queryKey: ["wallets-list"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); }} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          {detail && (
            <>
              <DialogHeader><DialogTitle>{detail.name} — سجل الحركات</DialogTitle></DialogHeader>
              <div className="space-y-2 mt-2">
                {(txByInv.get(detail.id) ?? []).length === 0 ? (
                  <div className="text-center text-sm text-muted-foreground py-6">لا توجد حركات بعد</div>
                ) : (txByInv.get(detail.id) ?? []).map((t: any) => {
                  const m = kindMeta(t.kind); const Icon = m.icon;
                  return (
                    <div key={t.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                      <Icon className={cn("h-4 w-4", m.color)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium">{m.label}</div>
                        <div className="text-[11px] text-muted-foreground">{formatDate(t.happened_at)}{t.notes ? ` · ${t.notes}` : ""}</div>
                      </div>
                      <div className={cn("font-bold tabular-nums", m.color)}>{formatMoney(t.amount, t.currency)}</div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function InvestmentForm({ initial, wallets, onDone }: any) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? "stocks");
  const [walletId, setWalletId] = useState<string>(initial?.wallet_id ?? "none");
  const [principal, setPrincipal] = useState(initial?.principal?.toString() ?? "0");
  const [currentValue, setCurrentValue] = useState(initial?.current_value?.toString() ?? "0");
  const [ownership, setOwnership] = useState(initial?.ownership_pct?.toString() ?? "100");
  const [currency, setCurrency] = useState(initial?.currency ?? "SAR");
  const [isZakatable, setIsZakatable] = useState(initial?.is_zakatable ?? true);
  const [startDate, setStartDate] = useState(initial?.start_date ?? todayISO());
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const payload: any = {
        user_id: u.user.id, name: name.trim(), type,
        wallet_id: walletId === "none" ? null : walletId,
        principal: parseFloat(principal) || 0,
        current_value: parseFloat(currentValue) || 0,
        ownership_pct: parseFloat(ownership) || 100,
        currency, is_zakatable: isZakatable, start_date: startDate, status, notes: notes || null,
      };
      if (isEdit) { const { error } = await supabase.from("investments").update(payload).eq("id", initial.id); if (error) throw error; }
      else { const { error } = await supabase.from("investments").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { toast.success(isEdit ? "تم التحديث" : "تمت الإضافة"); onDone(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
      <DialogHeader><DialogTitle>{isEdit ? "تعديل استثمار" : "استثمار جديد"}</DialogTitle></DialogHeader>
      <div><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="مثلاً: أسهم أرامكو، شقة الرياض..." /></div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>النوع</Label>
          <Select value={type} onValueChange={setType}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{INV_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent></Select>
        </div>
        <div><Label>نسبة الملكية %</Label><Input type="number" step="0.01" value={ownership} onChange={(e) => setOwnership(e.target.value)} dir="ltr" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>رأس المال</Label><Input type="number" step="0.01" value={principal} onChange={(e) => setPrincipal(e.target.value)} required dir="ltr" /></div>
        <div><Label>القيمة الحالية</Label><Input type="number" step="0.01" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} dir="ltr" /></div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>العملة</Label>
          <Select value={currency} onValueChange={setCurrency}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent></Select>
        </div>
        <div>
          <Label>المحفظة المرتبطة</Label>
          <Select value={walletId} onValueChange={setWalletId}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="none">—</SelectItem>{wallets.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>تاريخ البدء</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} dir="ltr" /></div>
        <div>
          <Label>الحالة</Label>
          <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="active">نشط</SelectItem><SelectItem value="closed">مغلق</SelectItem></SelectContent></Select>
        </div>
      </div>
      <div className="flex items-center justify-between rounded-xl border bg-accent/30 p-3">
        <div>
          <div className="text-sm font-medium">قابل للزكاة</div>
          <div className="text-[11px] text-muted-foreground">يُحتسب ضمن وعاء الزكاة</div>
        </div>
        <Switch checked={isZakatable} onCheckedChange={setIsZakatable} />
      </div>
      <div><Label>ملاحظات</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} /></div>
      <DialogFooter><Button type="submit" className="w-full" disabled={mut.isPending}>حفظ</Button></DialogFooter>
    </form>
  );
}

function InvestmentTxForm({ investment, wallets, onDone }: any) {
  const [kind, setKind] = useState("capital_add");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState<string>(investment.wallet_id ?? "none");
  const [happenedAt, setHappenedAt] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [updateValue, setUpdateValue] = useState(true);

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const amt = parseFloat(amount);
      if (!amt) throw new Error("أدخل المبلغ");
      const { error } = await supabase.from("investment_transactions").insert({
        user_id: u.user.id, investment_id: investment.id, kind, amount: amt,
        currency: investment.currency, wallet_id: walletId === "none" ? null : walletId,
        happened_at: happenedAt, notes: notes || null,
      });
      if (error) throw error;

      // Update investment current value based on kind
      if (updateValue) {
        const cur = Number(investment.current_value) || 0;
        let newVal = cur;
        if (kind === "capital_add") newVal = cur + amt;
        else if (kind === "withdraw") newVal = Math.max(0, cur - amt);
        else if (kind === "revaluation") newVal = amt;
        if (kind !== "return") {
          await supabase.from("investments").update({ current_value: newVal }).eq("id", investment.id);
        }
      }

      // Wallet effect: capital_add → outflow ('send'), return/withdraw → inflow ('receive')
      if (walletId && walletId !== "none") {
        let txKind: string | null = null;
        if (kind === "capital_add") txKind = "send";
        else if (kind === "return" || kind === "withdraw") txKind = "receive";
        if (txKind) {
          await supabase.from("wallet_transactions").insert({
            user_id: u.user.id, wallet_id: walletId, kind: txKind,
            amount: amt, currency: investment.currency, happened_at: happenedAt,
            note: `${kindMeta(kind).label} — ${investment.name}`,
          });
        }
      }
    },
    onSuccess: () => { toast.success("تمت الإضافة"); onDone(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
      <DialogHeader><DialogTitle>حركة على: {investment.name}</DialogTitle></DialogHeader>
      <div>
        <Label>النوع</Label>
        <Select value={kind} onValueChange={setKind}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{TX_KINDS.map(k => <SelectItem key={k.value} value={k.value}>{k.label}</SelectItem>)}</SelectContent></Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>{kind === "revaluation" ? "القيمة الجديدة" : "المبلغ"}</Label><Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required dir="ltr" /></div>
        <div><Label>التاريخ</Label><Input type="date" value={happenedAt} onChange={(e) => setHappenedAt(e.target.value)} dir="ltr" /></div>
      </div>
      <div>
        <Label>المحفظة المتأثرة (اختياري)</Label>
        <Select value={walletId} onValueChange={setWalletId}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="none">— بدون تأثير على المحافظ</SelectItem>{wallets.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select>
      </div>
      <div><Label>ملاحظة</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} /></div>
      <div className="flex items-center justify-between rounded-xl border bg-accent/30 p-3">
        <div className="text-xs text-muted-foreground">تحديث القيمة الحالية للاستثمار تلقائياً</div>
        <Switch checked={updateValue} onCheckedChange={setUpdateValue} />
      </div>
      <DialogFooter><Button type="submit" className="w-full" disabled={mut.isPending}>حفظ</Button></DialogFooter>
    </form>
  );
}
