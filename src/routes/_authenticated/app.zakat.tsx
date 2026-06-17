import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HandCoins, CheckCircle2, Save, Calculator, Info } from "lucide-react";
import { formatMoney, formatDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { computeWalletBalance } from "@/lib/wallet-balance";

export const Route = createFileRoute("/_authenticated/app/zakat")({
  head: () => ({ meta: [{ title: "حاسبة الزكاة — رصد" }] }),
  component: ZakatPage,
});

// النصاب الشرعي: 85 جرام ذهب خالص (24 قيراط) أو 595 جرام فضة خالصة
const GOLD_NISAB_GRAMS = 85;
const SILVER_NISAB_GRAMS = 595;

// أسعار افتراضية بالريال السعودي للجرام (يجب تحديثها من السوق)
const DEFAULT_GOLD_PRICE_SAR = 380; // ريال/جرام (تقديري — يحدّثه المستخدم)
const DEFAULT_SILVER_PRICE_SAR = 4.5; // ريال/جرام (تقديري — يحدّثه المستخدم)

// أسعار صرف تقريبية مقابل الريال السعودي (1 SAR = X من العملة)
// تستخدم لتحويل النصاب من الريال إلى عملات أخرى بشكل تقديري
const SAR_RATES: Record<string, number> = {
  SAR: 1,
  AED: 0.98,
  EGP: 13.0,
  USD: 0.266,
  EUR: 0.245,
  KWD: 0.082,
  QAR: 0.97,
  BHD: 0.1,
  OMR: 0.102,
  JOD: 0.189,
  TRY: 9.0,
  GBP: 0.21,
};

function ZakatPage() {
  const qc = useQueryClient();
  const [includeBank, setIncludeBank] = useState(true);
  const [includeCash, setIncludeCash] = useState(true);
  const [includeInvestments, setIncludeInvestments] = useState(true);
  const [includeReceivables, setIncludeReceivables] = useState(true);
  const [deductPayables, setDeductPayables] = useState(true);
  const [nisabMethod, setNisabMethod] = useState<"silver" | "gold">("silver");
  const [goldPrice, setGoldPrice] = useState(DEFAULT_GOLD_PRICE_SAR.toString());
  const [silverPrice, setSilverPrice] = useState(DEFAULT_SILVER_PRICE_SAR.toString());
  const [rate, setRate] = useState("2.5");
  const [hijriYear, setHijriYear] = useState("");
  const [saveOpen, setSaveOpen] = useState<string | null>(null);

  // حساب النصاب الدقيق بالريال السعودي
  const nisabSAR = useMemo(() => {
    const gp = parseFloat(goldPrice) || 0;
    const sp = parseFloat(silverPrice) || 0;
    return nisabMethod === "gold" ? gp * GOLD_NISAB_GRAMS : sp * SILVER_NISAB_GRAMS;
  }, [nisabMethod, goldPrice, silverPrice]);

  // تحويل النصاب لكل عملة
  const nisabFor = (currency: string) => {
    const r = SAR_RATES[currency] ?? 1;
    return nisabSAR * r;
  };

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

    const expByW = new Map<string, any[]>();
    for (const e of data.expenses) { if (!e.wallet_id) continue; const a = expByW.get(e.wallet_id) ?? []; a.push(e); expByW.set(e.wallet_id, a); }
    const txByW = new Map<string, any[]>();
    for (const t of data.txs) { const a = txByW.get(t.wallet_id) ?? []; a.push(t); txByW.set(t.wallet_id, a); }

    for (const w of data.wallets) {
      if (w.type === "credit_card" || w.type === "zakat") continue;
      const bal = computeWalletBalance(Number(w.opening_balance), txByW.get(w.id) ?? [], expByW.get(w.id) ?? []);
      if (bal <= 0) continue;
      const slot = ensure(w.currency);
      if (w.type === "bank") slot.bank += bal;
      else if (w.type === "cash") slot.cash += bal;
      else if (w.type === "investment") slot.investments += bal;
    }

    for (const inv of data.investments) {
      const v = Number(inv.current_value) * (Number(inv.ownership_pct) / 100);
      if (v > 0) ensure(inv.currency).investments += v;
    }

    for (const r of data.ledger) {
      if (r.settled_at) continue;
      const slot = ensure(r.currency);
      if (r.kind === "lend") slot.receivables += Number(r.amount);
      else if (r.kind === "borrow") slot.payables += Number(r.amount);
      else if (r.kind === "collect") slot.receivables -= Number(r.amount);
      else if (r.kind === "repay") slot.payables -= Number(r.amount);
    }

    const rateN = (parseFloat(rate) || 2.5) / 100;
    const computed: Record<string, any> = {};
    for (const [cur, s] of Object.entries(byCur)) {
      const base = (includeBank ? s.bank : 0) + (includeCash ? s.cash : 0)
        + (includeInvestments ? s.investments : 0)
        + (includeReceivables ? Math.max(0, s.receivables) : 0)
        - (deductPayables ? Math.max(0, s.payables) : 0);
      const baseClamped = Math.max(0, base);
      const nisabCur = nisabFor(cur);
      const reaches = baseClamped >= nisabCur;
      computed[cur] = {
        breakdown: s,
        base: baseClamped,
        nisab: nisabCur,
        zakat: reaches ? baseClamped * rateN : 0,
        reachesNisab: reaches,
        progress: nisabCur > 0 ? Math.min(100, (baseClamped / nisabCur) * 100) : 0,
      };
    }
    return computed;
  }, [data, includeBank, includeCash, includeInvestments, includeReceivables, deductPayables, rate, nisabSAR]);

  const saveMut = useMutation({
    mutationFn: async (cur: string) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const r = result![cur];
      const { error } = await supabase.from("zakat_records").insert({
        user_id: u.user.id, currency: cur, hijri_year: hijriYear || null,
        calculated_at: todayISO(), base_amount: r.base, rate: (parseFloat(rate) || 2.5) / 100,
        zakat_amount: r.zakat,
        breakdown: { ...r.breakdown, nisab: r.nisab, nisab_method: nisabMethod, gold_price: parseFloat(goldPrice) || 0, silver_price: parseFloat(silverPrice) || 0 },
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم حفظ الحساب"); qc.invalidateQueries({ queryKey: ["zakat-data"] }); setSaveOpen(null); },
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
        <p className="text-sm text-muted-foreground mt-1">حساب دقيق للزكاة وفق النصاب الشرعي (85 جم ذهب أو 595 جم فضة)</p>
      </div>

      {/* بطاقة النصاب الشرعي */}
      <div className="rounded-2xl border bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-950/20 dark:to-yellow-950/20 p-4 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="font-semibold text-sm flex items-center gap-2">
            <Info className="h-4 w-4 text-amber-600" /> النصاب الشرعي
          </div>
          <Tabs value={nisabMethod} onValueChange={(v) => setNisabMethod(v as any)}>
            <TabsList className="h-8">
              <TabsTrigger value="silver" className="text-xs">الفضة (أحوط)</TabsTrigger>
              <TabsTrigger value="gold" className="text-xs">الذهب</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">سعر جرام الذهب (24ق) — ر.س</Label>
            <Input value={goldPrice} onChange={(e) => setGoldPrice(e.target.value)} type="number" step="0.01" dir="ltr" className="h-9" />
            <div className="text-[10px] text-muted-foreground mt-1">نصاب الذهب = {(parseFloat(goldPrice) || 0) * GOLD_NISAB_GRAMS} ر.س (85 جم)</div>
          </div>
          <div>
            <Label className="text-xs">سعر جرام الفضة — ر.س</Label>
            <Input value={silverPrice} onChange={(e) => setSilverPrice(e.target.value)} type="number" step="0.01" dir="ltr" className="h-9" />
            <div className="text-[10px] text-muted-foreground mt-1">نصاب الفضة = {(parseFloat(silverPrice) || 0) * SILVER_NISAB_GRAMS} ر.س (595 جم)</div>
          </div>
        </div>
        <div className="rounded-xl bg-amber-100 dark:bg-amber-950/40 p-3 text-center">
          <div className="text-[11px] text-amber-900 dark:text-amber-200">النصاب المعتمد ({nisabMethod === "gold" ? "ذهب" : "فضة"})</div>
          <div className="text-xl font-extrabold tabular-nums text-amber-900 dark:text-amber-100">{formatMoney(nisabSAR, "SAR")}</div>
          <div className="text-[10px] text-amber-700 dark:text-amber-300 mt-1">
            ✓ جمهور الفقهاء يرجّحون نصاب الفضة لأنه أنفع للفقراء
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground text-center">
          ⓘ يجب أن يحول الحول الهجري (سنة قمرية كاملة) على بلوغ المال للنصاب — حدّث الأسعار يدوياً وفق سعر السوق وقت الحساب
        </div>
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
          <div><Label>نسبة الزكاة %</Label><Input value={rate} onChange={(e) => setRate(e.target.value)} type="number" step="0.1" dir="ltr" />
            <div className="text-[10px] text-muted-foreground mt-1">2.5% للنقد والعروض (ربع العشر)</div>
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
                  <div className="text-[11px] text-muted-foreground mt-1">
                    النصاب: <span className="font-semibold">{formatMoney(r.nisab, cur)}</span>
                  </div>
                </div>
                <div className="text-left">
                  <div className="text-xs text-muted-foreground">الزكاة المستحقّة ({rate}%)</div>
                  <div className={cn("text-2xl font-extrabold tabular-nums", r.reachesNisab && r.zakat > 0 ? "text-success" : "text-muted-foreground")}>{formatMoney(r.zakat, cur)}</div>
                  <Button size="sm" className="mt-2" onClick={() => setSaveOpen(cur)} disabled={r.zakat <= 0}>
                    <Save className="h-3.5 w-3.5" /> حفظ
                  </Button>
                </div>
              </div>

              {/* شريط التقدم نحو النصاب */}
              <div className="mt-3">
                <div className="flex items-center justify-between text-[11px] mb-1">
                  <span className="text-muted-foreground">التقدم نحو النصاب</span>
                  <span className={cn("font-semibold tabular-nums", r.reachesNisab ? "text-success" : "text-amber-600")}>{r.progress.toFixed(1)}%</span>
                </div>
                <div className="h-2 rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full transition-all", r.reachesNisab ? "bg-success" : "bg-amber-500")} style={{ width: `${r.progress}%` }} />
                </div>
                {!r.reachesNisab && (
                  <div className="text-[11px] text-amber-600 mt-2">
                    ⚠ الوعاء أقل من النصاب بـ {formatMoney(r.nisab - r.base, cur)} — لا تجب الزكاة
                  </div>
                )}
                {r.reachesNisab && (
                  <div className="text-[11px] text-success mt-2">
                    ✓ بلغ المال النصاب — تجب الزكاة (بشرط حولان الحول)
                  </div>
                )}
              </div>

              <div className="mt-4 grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px]">
                <Stat label="بنوك" value={r.breakdown.bank} cur={cur} on={includeBank} />
                <Stat label="نقد" value={r.breakdown.cash} cur={cur} on={includeCash} />
                <Stat label="استثمارات" value={r.breakdown.investments} cur={cur} on={includeInvestments} />
                <Stat label="ديون لي" value={r.breakdown.receivables} cur={cur} on={includeReceivables} />
                <Stat label="ديون عليّ" value={r.breakdown.payables} cur={cur} on={deductPayables} negative />
              </div>

              <Dialog open={saveOpen === cur} onOpenChange={(o) => setSaveOpen(o ? cur : null)}>
                <DialogContent className="max-w-sm">
                  <DialogHeader><DialogTitle>حفظ سجل الزكاة ({cur})</DialogTitle></DialogHeader>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between"><span className="text-muted-foreground">الوعاء</span><span className="font-bold tabular-nums">{formatMoney(r.base, cur)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">النصاب</span><span className="font-bold tabular-nums">{formatMoney(r.nisab, cur)}</span></div>
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
                <div className="text-[11px] text-muted-foreground">الوعاء: {formatMoney(rec.base_amount, rec.currency)}{rec.breakdown?.nisab ? ` · النصاب: ${formatMoney(rec.breakdown.nisab, rec.currency)}` : ""}</div>
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
