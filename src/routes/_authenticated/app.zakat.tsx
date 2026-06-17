import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { HandCoins, CheckCircle2, Save, Calculator } from "lucide-react";
import { formatMoney, formatDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { computeWalletBalance } from "@/lib/wallet-balance";

export const Route = createFileRoute("/_authenticated/app/zakat")({
  head: () => ({ meta: [{ title: "حاسبة الزكاة — رصد" }] }),
  component: ZakatPage,
});

const NISAB_SAR_DEFAULT = 24000; // approx, user can adjust

function ZakatPage() {
  const qc = useQueryClient();
  const [includeBank, setIncludeBank] = useState(true);
  const [includeCash, setIncludeCash] = useState(true);
  const [includeInvestments, setIncludeInvestments] = useState(true);
  const [includeReceivables, setIncludeReceivables] = useState(true);
  const [deductPayables, setDeductPayables] = useState(true);
  const [nisab, setNisab] = useState(NISAB_SAR_DEFAULT.toString());
  const [rate, setRate] = useState("2.5");
  const [hijriYear, setHijriYear] = useState("");
  const [saveOpen, setSaveOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["zakat-data"],
    queryFn: async () => {
      const [wRes, eRes, tRes, iRes, pRes, rRes] = await Promise.all([
        supabase.from("wallets").select("*").eq("is_archived", false),
        supabase.from("expenses").select("wallet_id,amount,currency"),
        supabase.from("wallet_transactions").select("wallet_id,kind,amount"),
        supabase.from("investments").select("*").eq("status", "active").eq("is_zakatable", true),
        supabase.from("person_ledger").select("kind,amount,currency,settled_at"),
        supabase.from("zakat_records").select("*").order("calculated_at", { ascending: false }),
      ]);
      return { wallets: wRes.data ?? [], expenses: eRes.data ?? [], txs: tRes.data ?? [], investments: iRes.data ?? [], ledger: pRes.data ?? [], records: rRes.data ?? [] };
    },
  });

  const result = useMemo(() => {
    if (!data) return null;
    const byCur: Record<string, { bank: number; cash: number; investments: number; receivables: number; payables: number }> = {};
    const ensure = (c: string) => (byCur[c] ??= { bank: 0, cash: 0, investments: 0, receivables: 0, payables: 0 });

    // Wallet balances
    const expByW = new Map<string, any[]>();
    for (const e of data.expenses) { if (!e.wallet_id) continue; const a = expByW.get(e.wallet_id) ?? []; a.push(e); expByW.set(e.wallet_id, a); }
    const txByW = new Map<string, any[]>();
    for (const t of data.txs) { const a = txByW.get(t.wallet_id) ?? []; a.push(t); txByW.set(t.wallet_id, a); }

    for (const w of data.wallets) {
      if (w.type === "credit_card" || w.type === "zakat") continue; // skip
      const bal = computeWalletBalance(Number(w.opening_balance), txByW.get(w.id) ?? [], expByW.get(w.id) ?? []);
      if (bal <= 0) continue;
      const slot = ensure(w.currency);
      if (w.type === "bank") slot.bank += bal;
      else if (w.type === "cash") slot.cash += bal;
      else if (w.type === "investment") slot.investments += bal;
    }

    // Investments (current_value * ownership%)
    for (const inv of data.investments) {
      const v = Number(inv.current_value) * (Number(inv.ownership_pct) / 100);
      if (v > 0) ensure(inv.currency).investments += v;
    }

    // Ledger receivables & payables (unsettled)
    for (const r of data.ledger) {
      if (r.settled_at) continue;
      const slot = ensure(r.currency);
      if (r.kind === "lend") slot.receivables += Number(r.amount);
      else if (r.kind === "borrow") slot.payables += Number(r.amount);
      else if (r.kind === "collect") slot.receivables -= Number(r.amount);
      else if (r.kind === "repay") slot.payables -= Number(r.amount);
    }

    const rateN = (parseFloat(rate) || 2.5) / 100;
    const nisabN = parseFloat(nisab) || 0;

    const computed: Record<string, any> = {};
    for (const [cur, s] of Object.entries(byCur)) {
      const base = (includeBank ? s.bank : 0) + (includeCash ? s.cash : 0)
        + (includeInvestments ? s.investments : 0)
        + (includeReceivables ? Math.max(0, s.receivables) : 0)
        - (deductPayables ? Math.max(0, s.payables) : 0);
      const reaches = cur !== "SAR" ? true : base >= nisabN;
      computed[cur] = {
        breakdown: s,
        base: Math.max(0, base),
        zakat: Math.max(0, base) * rateN,
        reachesNisab: reaches,
      };
    }
    return computed;
  }, [data, includeBank, includeCash, includeInvestments, includeReceivables, deductPayables, rate, nisab]);

  const saveMut = useMutation({
    mutationFn: async (cur: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const r = result![cur];
      const { error } = await supabase.from("zakat_records").insert({
        user_id: u.user.id, currency: cur, hijri_year: hijriYear || null,
        calculated_at: todayISO(), base_amount: r.base, rate: (parseFloat(rate) || 2.5) / 100,
        zakat_amount: r.zakat, breakdown: r.breakdown,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حفظ الحساب"); qc.invalidateQueries({ queryKey: ["zakat-data"] }); setSaveOpen(false); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  const markPaid = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("zakat_records").update({ paid: true, paid_at: todayISO() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم"); qc.invalidateQueries({ queryKey: ["zakat-data"] }); },
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><HandCoins className="h-6 w-6" /> حاسبة الزكاة</h1>
        <p className="text-sm text-muted-foreground mt-1">احسب وعاء الزكاة من البنوك، النقد، الاستثمارات والديون</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="font-semibold text-sm flex items-center gap-2"><Calculator className="h-4 w-4" /> مكوّنات الوعاء</div>
          <ToggleRow label="الأرصدة البنكية" checked={includeBank} onChange={setIncludeBank} />
          <ToggleRow label="النقد" checked={includeCash} onChange={setIncludeCash} />
          <ToggleRow label="الاستثمارات القابلة للزكاة" checked={includeInvestments} onChange={setIncludeInvestments} />
          <ToggleRow label="الديون المرجوّة (لي)" checked={includeReceivables} onChange={setIncludeReceivables} />
          <ToggleRow label="خصم الديون المستحقّة (عليّ)" checked={deductPayables} onChange={setDeductPayables} />
        </div>
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div className="font-semibold text-sm">الإعدادات</div>
          <div><Label>نسبة الزكاة %</Label><Input value={rate} onChange={(e) => setRate(e.target.value)} type="number" step="0.1" dir="ltr" /></div>
          <div><Label>نصاب الزكاة (ر.س تقريباً)</Label><Input value={nisab} onChange={(e) => setNisab(e.target.value)} type="number" dir="ltr" />
            <div className="text-[10px] text-muted-foreground mt-1">قابل للتعديل وفق سعر الذهب الحالي</div>
          </div>
          <div><Label>السنة الهجرية</Label><Input value={hijriYear} onChange={(e) => setHijriYear(e.target.value)} placeholder="مثلاً 1447" /></div>
        </div>
      </div>

      {isLoading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      ) : !result || Object.keys(result).length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">لا توجد أصول لحسابها</div>
      ) : (
        <div className="space-y-3">
          {Object.entries(result).map(([cur, r]: [string, any]) => (
            <div key={cur} className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)]">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="text-xs text-muted-foreground">وعاء الزكاة بالـ {cur}</div>
                  <div className="text-3xl font-extrabold tabular-nums">{formatMoney(r.base, cur)}</div>
                  {!r.reachesNisab && cur === "SAR" && (
                    <div className="text-[11px] text-amber-600 mt-1">⚠ الوعاء أقل من النصاب — لا تجب الزكاة</div>
                  )}
                </div>
                <div className="text-left">
                  <div className="text-xs text-muted-foreground">الزكاة المستحقّة ({rate}%)</div>
                  <div className={cn("text-2xl font-extrabold tabular-nums", r.reachesNisab && r.zakat > 0 ? "text-success" : "text-muted-foreground")}>{formatMoney(r.zakat, cur)}</div>
                  <Button size="sm" className="mt-2" onClick={() => { setSaveOpen(true); (saveMut as any)._cur = cur; }} disabled={r.zakat <= 0}>
                    <Save className="h-3.5 w-3.5" /> حفظ
                  </Button>
                </div>
              </div>
              <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                <Stat label="بنوك" value={r.breakdown.bank} cur={cur} on={includeBank} />
                <Stat label="نقد" value={r.breakdown.cash} cur={cur} on={includeCash} />
                <Stat label="استثمارات" value={r.breakdown.investments} cur={cur} on={includeInvestments} />
                <Stat label="ديون لي" value={r.breakdown.receivables} cur={cur} on={includeReceivables} />
                <Stat label="ديون عليّ" value={r.breakdown.payables} cur={cur} on={deductPayables} negative />
              </div>

              <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>حفظ سجل الزكاة ({cur})</DialogTitle></DialogHeader>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">الوعاء</span><span className="font-bold tabular-nums">{formatMoney(r.base, cur)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">الزكاة</span><span className="font-bold tabular-nums text-success">{formatMoney(r.zakat, cur)}</span></div>
                    {hijriYear && <div className="flex justify-between"><span className="text-muted-foreground">السنة</span><span>{hijriYear} هـ</span></div>}
                  </div>
                  <DialogFooter><Button className="w-full" onClick={() => saveMut.mutate(cur)} disabled={saveMut.isPending}>تأكيد الحفظ</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          ))}
        </div>
      )}

      {(data?.records ?? []).length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-semibold">السجلات السابقة</div>
          {data!.records.map((rec: any) => (
            <div key={rec.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
              <HandCoins className="h-4 w-4 text-amber-600 shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium">{formatDate(rec.calculated_at)}{rec.hijri_year ? ` · ${rec.hijri_year} هـ` : ""}</div>
                <div className="text-[11px] text-muted-foreground">الوعاء: {formatMoney(rec.base_amount, rec.currency)}</div>
              </div>
              <div className="text-left">
                <div className="font-bold tabular-nums text-success">{formatMoney(rec.zakat_amount, rec.currency)}</div>
                {rec.paid ? (
                  <div className="text-[10px] text-success inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> مدفوعة {rec.paid_at ? `· ${formatDate(rec.paid_at)}` : ""}</div>
                ) : (
                  <Button size="sm" variant="outline" className="mt-1 h-6 text-[10px]" onClick={() => markPaid.mutate(rec.id)}>تأشير مدفوعة</Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ToggleRow({ label, checked, onChange }: { label: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span>{label}</span>
      <Switch checked={checked} onCheckedChange={onChange} />
    </div>
  );
}

function Stat({ label, value, cur, on, negative }: { label: string; value: number; cur: string; on: boolean; negative?: boolean }) {
  return (
    <div className={cn("rounded-lg border bg-accent/30 p-2", !on && "opacity-40")}>
      <div className="text-muted-foreground">{label}</div>
      <div className={cn("font-bold tabular-nums", negative && "text-destructive")}>{negative && value > 0 ? "-" : ""}{formatMoney(Math.abs(value), cur)}</div>
    </div>
  );
}
