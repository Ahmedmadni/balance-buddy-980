import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { HandCoins, CheckCircle2, Save, Calculator, Info, Coins, Wheat, Mountain, Settings as SettingsIcon, AlertTriangle, CalendarClock } from "lucide-react";
import { CURRENCIES, formatMoney, formatDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { computeWalletBalance } from "@/lib/wallet-balance";
import { computeHaulStatus, validateBeforeCompute, classifyAsset, type ZakatSettings } from "@/lib/zakat/engine";

export const Route = createFileRoute("/_authenticated/app/zakat")({
  head: () => ({ meta: [{ title: "حاسبة الزكاة — رصد" }] }),
  component: ZakatPage,
});

const GOLD_NISAB_GRAMS = 85;
const SILVER_NISAB_GRAMS = 595;

const DEFAULT_GOLD_PRICE_SAR = 380;
const DEFAULT_SILVER_PRICE_SAR = 4.5;

// أسعار صرف تقريبية مقابل الريال السعودي (1 SAR = X)
const DEFAULT_RATES: Record<string, number> = {
  SAR: 1, AED: 0.98, EGP: 13.0, USD: 0.266, EUR: 0.245,
  KWD: 0.082, QAR: 0.97, BHD: 0.1, OMR: 0.102, JOD: 0.189, TRY: 9.0, GBP: 0.21,
};

function ZakatPage() {
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold flex items-center gap-2"><HandCoins className="h-6 w-6" /> حاسبة الزكاة</h1>
        <p className="text-sm text-muted-foreground mt-1">حساب دقيق للزكاة وفق النصاب الشرعي مع دعم تعدد العملات</p>
      </div>

      <Tabs defaultValue="money" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 h-auto">
          <TabsTrigger value="money" className="flex items-center gap-1.5"><Coins className="h-4 w-4" /> زكاة المال</TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-1.5"><SettingsIcon className="h-4 w-4" /> الإعدادات</TabsTrigger>
          <TabsTrigger value="livestock" className="flex items-center gap-1.5"><Wheat className="h-4 w-4" /> الأنعام والثمار</TabsTrigger>
        </TabsList>

        <TabsContent value="money" className="space-y-4 mt-4"><MoneyZakat /></TabsContent>
        <TabsContent value="settings" className="space-y-4 mt-4"><ZakatSettingsTab /></TabsContent>
        <TabsContent value="livestock" className="space-y-4 mt-4"><LivestockZakat /></TabsContent>
      </Tabs>
    </div>
  );
}

// ============== MONEY ZAKAT (multi-currency unified) ==============

function MoneyZakat() {
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
  const [baseCurrency, setBaseCurrency] = useState("SAR");
  const [rates, setRates] = useState<Record<string, number>>(DEFAULT_RATES);
  const [editRates, setEditRates] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);

  // النصاب بالريال السعودي ثم محوّل للعملة الأساسية
  const nisabSAR = useMemo(() => {
    const gp = parseFloat(goldPrice) || 0;
    const sp = parseFloat(silverPrice) || 0;
    return nisabMethod === "gold" ? gp * GOLD_NISAB_GRAMS : sp * SILVER_NISAB_GRAMS;
  }, [nisabMethod, goldPrice, silverPrice]);

  // تحويل من عملة → العملة الأساسية: amount_base = amount_cur / rate_cur * rate_base
  // rates[cur] = كم من العملة `cur` يساوي 1 SAR. لذا 1 cur = 1/rates[cur] SAR، و1 SAR = rates[base] base
  const toBase = (amount: number, fromCur: string) => {
    const fr = rates[fromCur] ?? DEFAULT_RATES[fromCur] ?? 1;
    const br = rates[baseCurrency] ?? DEFAULT_RATES[baseCurrency] ?? 1;
    if (!fr) return 0;
    return (amount / fr) * br;
  };

  const nisabBase = toBase(nisabSAR, "SAR");

  const { data, isLoading } = useQuery({
    queryKey: ["zakat-data"],
    queryFn: async () => {
      const [wRes, eRes, tRes, iRes, pRes, rRes, sRes, xRes] = await Promise.all([
        supabase.from("wallets").select("*").eq("is_archived", false),
        supabase.from("expenses").select("wallet_id,amount,currency"),
        supabase.from("wallet_transactions").select("wallet_id,kind,amount"),
        supabase.from("investments").select("*").eq("status", "active"),
        supabase.from("person_ledger").select("kind,amount,currency,settled_at"),
        supabase.from("zakat_records").select("*").order("calculated_at", { ascending: false }),
        supabase.from("zakat_settings").select("*").maybeSingle(),
        supabase.from("exchange_rates").select("*"),
      ]);
      return {
        wallets: wRes.data ?? [], expenses: eRes.data ?? [], txs: tRes.data ?? [],
        investments: iRes.data ?? [], ledger: pRes.data ?? [], records: rRes.data ?? [],
        settings: (sRes.data ?? null) as ZakatSettings | null,
        savedRates: xRes.data ?? [],
      };
    },
  });

  // Apply saved settings/rates from DB once loaded
  useEffect(() => {
    if (!data) return;
    if (data.settings) {
      setBaseCurrency(data.settings.base_currency || "SAR");
      setNisabMethod(data.settings.nisab_method as any);
      if (data.settings.gold_gram_price) setGoldPrice(String(data.settings.gold_gram_price));
      if (data.settings.silver_gram_price) setSilverPrice(String(data.settings.silver_gram_price));
    }
    if (data.savedRates && data.savedRates.length > 0) {
      setRates((prev) => {
        const next = { ...prev };
        for (const r of data.savedRates as any[]) next[r.currency] = Number(r.rate_to_base);
        return next;
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);


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

    const jewelryOpinion = (data.settings?.gold_jewelry_opinion ?? "no_zakat") as "zakat" | "no_zakat";
    for (const inv of data.investments) {
      // Smart classification (purpose + type) overrides legacy is_zakatable when purpose set
      const cls = classifyAsset(inv as any, { gold_jewelry_opinion: jewelryOpinion });
      const eligible = inv.purpose ? cls.isZakatable : (inv.is_zakatable !== false);
      if (!eligible) continue;
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

    // Per-currency raw + per-currency converted to base
    const perCurrency: Record<string, { base: number; baseConverted: number; breakdown: any }> = {};
    let unifiedBase = 0;
    for (const [cur, s] of Object.entries(byCur)) {
      const baseRaw = (includeBank ? s.bank : 0) + (includeCash ? s.cash : 0)
        + (includeInvestments ? s.investments : 0)
        + (includeReceivables ? Math.max(0, s.receivables) : 0)
        - (deductPayables ? Math.max(0, s.payables) : 0);
      const baseClamped = Math.max(0, baseRaw);
      const converted = toBase(baseClamped, cur);
      perCurrency[cur] = { base: baseClamped, baseConverted: converted, breakdown: s };
      unifiedBase += converted;
    }

    const rateN = (parseFloat(rate) || 2.5) / 100;
    const reaches = unifiedBase >= nisabBase;
    const zakat = reaches ? unifiedBase * rateN : 0;
    return {
      perCurrency,
      unifiedBase,
      nisabBase,
      reachesNisab: reaches,
      zakat,
      progress: nisabBase > 0 ? Math.min(100, (unifiedBase / nisabBase) * 100) : 0,
    };
  }, [data, includeBank, includeCash, includeInvestments, includeReceivables, deductPayables, rate, nisabBase, baseCurrency, rates]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      if (!result) return;
      const { error } = await supabase.from("zakat_records").insert({
        user_id: u.user.id, currency: baseCurrency, hijri_year: hijriYear || null,
        calculated_at: todayISO(), base_amount: result.unifiedBase, rate: (parseFloat(rate) || 2.5) / 100,
        zakat_amount: result.zakat,
        breakdown: { per_currency: result.perCurrency, nisab: result.nisabBase, nisab_method: nisabMethod, gold_price: parseFloat(goldPrice) || 0, silver_price: parseFloat(silverPrice) || 0, base_currency: baseCurrency, rates },
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
    <div className="space-y-4">
      {/* العملة الأساسية */}
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="font-semibold text-sm flex items-center gap-2"><Info className="h-4 w-4 text-primary" /> العملة الأساسية</div>
          <Select value={baseCurrency} onValueChange={setBaseCurrency}>
            <SelectTrigger className="w-44 h-9"><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div className="text-[11px] text-muted-foreground">سيتم تحويل جميع أرصدتك بمختلف العملات إلى {baseCurrency} لحساب وعاء الزكاة الموحّد.</div>
        <div className="flex items-center justify-between">
          <button type="button" className="text-xs text-primary hover:underline" onClick={() => setEditRates((s) => !s)}>
            {editRates ? "إخفاء أسعار الصرف" : "تعديل أسعار الصرف"}
          </button>
        </div>
        {editRates && (
          <div className="grid grid-cols-3 gap-2 pt-2 border-t">
            {CURRENCIES.map((c) => (
              <div key={c.code}>
                <Label className="text-[10px]">{c.code} لكل 1 ر.س</Label>
                <Input type="number" step="0.0001" dir="ltr" className="h-8 text-xs" value={rates[c.code] ?? DEFAULT_RATES[c.code] ?? 1}
                  onChange={(e) => setRates((r) => ({ ...r, [c.code]: parseFloat(e.target.value) || 0 }))} />
              </div>
            ))}
            <div className="col-span-3 text-[10px] text-muted-foreground">
              تنبيه: الأسعار يدوية — حدّثها وقت الحساب من مصدر موثوق.
            </div>
          </div>
        )}
      </div>

      {/* النصاب */}
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
          </div>
          <div>
            <Label className="text-xs">سعر جرام الفضة — ر.س</Label>
            <Input value={silverPrice} onChange={(e) => setSilverPrice(e.target.value)} type="number" step="0.01" dir="ltr" className="h-9" />
          </div>
        </div>
        <div className="rounded-xl bg-amber-100 dark:bg-amber-950/40 p-3 text-center">
          <div className="text-[11px] text-amber-900 dark:text-amber-200">النصاب المعتمد بالعملة الأساسية</div>
          <div className="text-xl font-extrabold tabular-nums text-amber-900 dark:text-amber-100">{formatMoney(nisabBase, baseCurrency)}</div>
        </div>
      </div>

      {/* الإعدادات */}
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
          <div className="font-semibold text-sm">إعدادات الحساب</div>
          <div><Label>نسبة الزكاة %</Label><Input value={rate} onChange={(e) => setRate(e.target.value)} type="number" step="0.1" dir="ltr" />
            <div className="text-[10px] text-muted-foreground mt-1">2.5% للنقد والعروض (ربع العشر)</div>
          </div>
          <div><Label>السنة الهجرية</Label><Input value={hijriYear} onChange={(e) => setHijriYear(e.target.value)} placeholder="مثلاً 1447" /></div>
        </div>
      </div>

      {/* تنبيهات التدقيق + حالة الحول */}
      {data && (() => {
        const usedCurs = Array.from(new Set([
          ...data.wallets.map((w: any) => w.currency),
          ...data.investments.map((i: any) => i.currency),
        ]));
        const missing = validateBeforeCompute({
          settings: data.settings,
          assets: data.investments as any,
          usedCurrencies: usedCurs,
          rates: Object.fromEntries(usedCurs.map((c) => [c, c === baseCurrency ? 1 : (rates[c] ?? 0)])),
        });
        const haul = data.settings ? computeHaulStatus({
          settings: data.settings,
          currentWealthBase: result?.unifiedBase ?? 0,
          nisabBase: result?.nisabBase ?? 0,
        }) : null;
        return (
          <>
            {missing.length > 0 && (
              <div className="rounded-2xl border border-destructive/40 bg-destructive/5 p-4 space-y-2">
                <div className="font-semibold text-sm flex items-center gap-2 text-destructive">
                  <AlertTriangle className="h-4 w-4" /> بيانات ناقصة قبل الحساب الدقيق
                </div>
                <ul className="text-xs space-y-1 list-disc pr-5">
                  {missing.slice(0, 6).map((m, i) => <li key={i}>{m}</li>)}
                  {missing.length > 6 && <li>... و {missing.length - 6} تنبيهات أخرى</li>}
                </ul>
                <div className="text-[10px] text-muted-foreground">أكمل البيانات من تبويب «الإعدادات» وصفحة الاستثمارات لضمان دقة الحساب.</div>
              </div>
            )}
            {haul && data.settings && (
              <div className="rounded-2xl border bg-card p-4 grid sm:grid-cols-3 gap-3 text-center">
                <div>
                  <div className="text-[11px] text-muted-foreground flex items-center justify-center gap-1"><CalendarClock className="h-3.5 w-3.5" /> تاريخ الزكاة القادم</div>
                  <div className="font-bold text-sm mt-1">{formatDate(haul.nextZakatDate)}</div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">حالة بلوغ النصاب</div>
                  <div className={cn("font-bold text-sm mt-1", haul.reachesNisab ? "text-success" : "text-amber-600")}>
                    {haul.reachesNisab ? "✓ بلغ النصاب" : "⚠ دون النصاب"}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-muted-foreground">الحول الشرعي</div>
                  <div className="font-bold text-sm mt-1">
                    {haul.haulStart ? (haul.haulComplete ? "✓ اكتمل" : `${haul.daysRemaining} يوماً متبقية`) : "لم يبدأ بعد"}
                  </div>
                </div>
              </div>
            )}
          </>
        );
      })()}

      {/* النتيجة الموحّدة */}
      {isLoading ? (
        <div className="h-32 animate-pulse rounded-2xl bg-muted" />
      ) : !result ? null : (
        <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] space-y-4">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <div className="text-xs text-muted-foreground">إجمالي وعاء الزكاة الموحّد ({baseCurrency})</div>
              <div className="text-3xl font-extrabold tabular-nums">{formatMoney(result.unifiedBase, baseCurrency)}</div>
              <div className="text-[11px] text-muted-foreground mt-1">
                النصاب: <span className="font-semibold">{formatMoney(result.nisabBase, baseCurrency)}</span>
              </div>
            </div>
            <div className="text-left">
              <div className="text-xs text-muted-foreground">الزكاة المستحقّة ({rate}%)</div>
              <div className={cn("text-2xl font-extrabold tabular-nums", result.reachesNisab && result.zakat > 0 ? "text-success" : "text-muted-foreground")}>{formatMoney(result.zakat, baseCurrency)}</div>
              <Button size="sm" className="mt-2" onClick={() => setSaveOpen(true)} disabled={result.zakat <= 0}>
                <Save className="h-3.5 w-3.5" /> حفظ
              </Button>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="text-muted-foreground">التقدم نحو النصاب</span>
              <span className={cn("font-semibold tabular-nums", result.reachesNisab ? "text-success" : "text-amber-600")}>{result.progress.toFixed(1)}%</span>
            </div>
            <div className="h-2 rounded-full bg-muted overflow-hidden">
              <div className={cn("h-full transition-all", result.reachesNisab ? "bg-success" : "bg-amber-500")} style={{ width: `${result.progress}%` }} />
            </div>
            {!result.reachesNisab ? (
              <div className="text-[11px] text-amber-600 mt-2">⚠ الوعاء أقل من النصاب بـ {formatMoney(result.nisabBase - result.unifiedBase, baseCurrency)} — لا تجب الزكاة</div>
            ) : (
              <div className="text-[11px] text-success mt-2">✓ بلغ المال النصاب — تجب الزكاة (بشرط حولان الحول الهجري)</div>
            )}
          </div>

          {/* تفصيل لكل عملة */}
          {Object.keys(result.perCurrency).length > 0 && (
            <div className="space-y-2 pt-3 border-t">
              <div className="text-xs font-semibold text-muted-foreground">التفصيل حسب العملة</div>
              <div className="space-y-2">
                {Object.entries(result.perCurrency).map(([cur, r]: [string, any]) => (
                  <div key={cur} className="rounded-xl bg-accent/30 p-3 text-xs flex items-center justify-between flex-wrap gap-2">
                    <div>
                      <div className="font-bold">{cur}</div>
                      <div className="text-muted-foreground text-[10px]">
                        بنوك {formatMoney(r.breakdown.bank, cur)} · نقد {formatMoney(r.breakdown.cash, cur)} · استثمار {formatMoney(r.breakdown.investments, cur)}
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="font-bold tabular-nums">{formatMoney(r.base, cur)}</div>
                      <div className="text-primary text-[10px] tabular-nums">≈ {formatMoney(r.baseConverted, baseCurrency)}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
            <DialogContent className="max-w-sm">
              <DialogHeader><DialogTitle>حفظ سجل الزكاة ({baseCurrency})</DialogTitle></DialogHeader>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">الوعاء الموحّد</span><span className="font-bold tabular-nums">{formatMoney(result.unifiedBase, baseCurrency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">النصاب</span><span className="font-bold tabular-nums">{formatMoney(result.nisabBase, baseCurrency)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">الزكاة</span><span className="font-bold tabular-nums text-success">{formatMoney(result.zakat, baseCurrency)}</span></div>
              </div>
              <DialogFooter><Button className="w-full" onClick={() => saveMut.mutate()} disabled={saveMut.isPending}>تأكيد الحفظ</Button></DialogFooter>
            </DialogContent>
          </Dialog>
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
                  <div className="text-[10px] text-success inline-flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> مدفوعة</div>
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

// ============== LIVESTOCK & CROPS (independent unit) ==============

function LivestockZakat() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-amber-50 dark:bg-amber-950/20 p-4 text-xs text-amber-900 dark:text-amber-200">
        <div className="font-semibold flex items-center gap-1.5 mb-1"><Info className="h-3.5 w-3.5" /> وحدة شرعية مستقلة</div>
        هذه الحاسبات تطبّق الأنصبة الشرعية المعروفة لزكاة الأنعام والثمار والمعادن. النتائج هنا لا ترتبط بالمحافظ ولا تؤثر على التقارير المالية.
      </div>

      <Tabs defaultValue="camels" className="space-y-3">
        <TabsList className="w-full grid grid-cols-5 h-auto">
          <TabsTrigger value="camels" className="text-xs">إبل</TabsTrigger>
          <TabsTrigger value="cattle" className="text-xs">بقر</TabsTrigger>
          <TabsTrigger value="sheep" className="text-xs">غنم</TabsTrigger>
          <TabsTrigger value="crops" className="text-xs">حبوب وثمار</TabsTrigger>
          <TabsTrigger value="treasure" className="text-xs">ركاز ومعادن</TabsTrigger>
        </TabsList>
        <TabsContent value="camels"><CamelsCalc /></TabsContent>
        <TabsContent value="cattle"><CattleCalc /></TabsContent>
        <TabsContent value="sheep"><SheepCalc /></TabsContent>
        <TabsContent value="crops"><CropsCalc /></TabsContent>
        <TabsContent value="treasure"><TreasureCalc /></TabsContent>
      </Tabs>
    </div>
  );
}

function camelDue(n: number): string {
  if (n < 5) return "لا زكاة (دون النصاب)";
  if (n <= 9) return "شاة واحدة";
  if (n <= 14) return "شاتان";
  if (n <= 19) return "ثلاث شياه";
  if (n <= 24) return "أربع شياه";
  if (n <= 35) return "بنت مخاض (أنثى من الإبل عمرها سنة)";
  if (n <= 45) return "بنت لبون (أنثى عمرها سنتان)";
  if (n <= 60) return "حِقّة (أنثى عمرها ثلاث سنوات)";
  if (n <= 75) return "جَذَعة (أنثى عمرها أربع سنوات)";
  if (n <= 90) return "بنتا لبون";
  if (n <= 120) return "حِقّتان";
  // بعد 120: في كل 40 بنت لبون، وفي كل 50 حقة
  const hiqqa = Math.floor(n / 50);
  const bint = Math.floor((n % 50) / 40);
  const parts: string[] = [];
  if (hiqqa) parts.push(`${hiqqa} حِقّة`);
  if (bint) parts.push(`${bint} بنت لبون`);
  return parts.join(" + ") || `حِقّتان + ${Math.floor((n - 120) / 40)} بنت لبون`;
}

function cattleDue(n: number): string {
  if (n < 30) return "لا زكاة (دون النصاب)";
  // في كل 30: تبيع، وفي كل 40: مسنة
  const musinna = Math.floor(n / 40);
  let remaining = n - musinna * 40;
  const tabi = Math.floor(remaining / 30);
  // معالجة بسيطة
  if (n < 40) return "تبيع أو تبيعة (عمر سنة)";
  if (n < 60) return "مسنة (عمر سنتين)";
  if (n < 70) return "تبيعان";
  const parts: string[] = [];
  if (musinna) parts.push(`${musinna} مسنة`);
  if (tabi) parts.push(`${tabi} تبيع`);
  return parts.join(" + ");
}

function sheepDue(n: number): string {
  if (n < 40) return "لا زكاة (دون النصاب)";
  if (n <= 120) return "شاة واحدة";
  if (n <= 200) return "شاتان";
  if (n <= 399) return "ثلاث شياه";
  // ثم في كل 100: شاة
  const sheep = Math.floor(n / 100);
  return `${sheep} شياه`;
}

function SimpleCalc({ title, icon, label, suffix, compute, hint }: { title: string; icon: any; label: string; suffix: string; compute: (n: number) => string; hint?: string }) {
  const Icon = icon;
  const [n, setN] = useState("");
  const result = useMemo(() => compute(parseInt(n) || 0), [n, compute]);
  return (
    <div className="rounded-2xl border bg-card p-5 space-y-3">
      <div className="font-semibold flex items-center gap-2"><Icon className="h-4 w-4 text-amber-600" /> {title}</div>
      <div>
        <Label>{label}</Label>
        <div className="flex gap-2 items-center">
          <Input type="number" min="0" value={n} onChange={(e) => setN(e.target.value)} dir="ltr" placeholder="0" />
          <span className="text-xs text-muted-foreground shrink-0">{suffix}</span>
        </div>
      </div>
      {n && (
        <div className="rounded-xl bg-amber-100 dark:bg-amber-950/40 p-3">
          <div className="text-[11px] text-amber-900 dark:text-amber-200">الواجب الشرعي</div>
          <div className="text-base font-bold text-amber-900 dark:text-amber-100">{result}</div>
        </div>
      )}
      {hint && <div className="text-[10px] text-muted-foreground">{hint}</div>}
    </div>
  );
}

function CamelsCalc() {
  return <SimpleCalc title="زكاة الإبل" icon={Coins} label="عدد الإبل" suffix="رأس" compute={camelDue}
    hint="النصاب 5 إبل. الواجب يختلف حسب العدد. (في الأعداد الكبيرة قد تتعدد الفتاوى — استشر أهل العلم)" />;
}
function CattleCalc() {
  return <SimpleCalc title="زكاة البقر" icon={Coins} label="عدد الأبقار" suffix="رأس" compute={cattleDue}
    hint="النصاب 30 بقرة. في كل 30: تبيع، وفي كل 40: مسنة." />;
}
function SheepCalc() {
  return <SimpleCalc title="زكاة الغنم" icon={Coins} label="عدد الأغنام" suffix="رأس" compute={sheepDue}
    hint="النصاب 40 شاة. 40-120: شاة، 121-200: شاتان، 201-399: ثلاث، ثم في كل 100: شاة." />;
}

function CropsCalc() {
  const [qty, setQty] = useState("");
  const [irrigation, setIrrigation] = useState<"rainfed" | "irrigated" | "mixed">("rainfed");
  const NISAB_KG = 612; // الخمسة أوسق ≈ 612 كجم تقريباً (ويُذكر 653)
  const qtyN = parseFloat(qty) || 0;
  const reaches = qtyN >= NISAB_KG;
  const rate = irrigation === "rainfed" ? 0.10 : irrigation === "irrigated" ? 0.05 : 0.075;
  const due = reaches ? qtyN * rate : 0;
  return (
    <div className="rounded-2xl border bg-card p-5 space-y-3">
      <div className="font-semibold flex items-center gap-2"><Wheat className="h-4 w-4 text-amber-600" /> زكاة الحبوب والثمار</div>
      <div>
        <Label>كمية المحصول</Label>
        <div className="flex gap-2 items-center">
          <Input type="number" min="0" value={qty} onChange={(e) => setQty(e.target.value)} dir="ltr" placeholder="0" />
          <span className="text-xs text-muted-foreground shrink-0">كجم</span>
        </div>
      </div>
      <div>
        <Label>طريقة الري</Label>
        <Select value={irrigation} onValueChange={(v: any) => setIrrigation(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rainfed">بَعْلي (مطر/سيول) — 10%</SelectItem>
            <SelectItem value="irrigated">بمؤونة (سقي بآلة) — 5%</SelectItem>
            <SelectItem value="mixed">مختلط — 7.5%</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="rounded-xl bg-amber-100 dark:bg-amber-950/40 p-3 space-y-1">
        <div className="text-[11px] text-amber-900 dark:text-amber-200">النصاب: {NISAB_KG} كجم (خمسة أوسق)</div>
        {!qty ? null : reaches ? (
          <>
            <div className="text-[11px] text-success">✓ بلغ النصاب</div>
            <div className="text-base font-bold text-amber-900 dark:text-amber-100">الواجب: {due.toFixed(2)} كجم ({(rate * 100)}%)</div>
          </>
        ) : (
          <div className="text-[11px] text-amber-700">⚠ لم يبلغ النصاب — لا تجب الزكاة</div>
        )}
      </div>
    </div>
  );
}

function TreasureCalc() {
  const [val, setVal] = useState("");
  const [kind, setKind] = useState<"rikaz" | "metals">("rikaz");
  const valN = parseFloat(val) || 0;
  const rate = kind === "rikaz" ? 0.20 : 0.025;
  const due = valN * rate;
  return (
    <div className="rounded-2xl border bg-card p-5 space-y-3">
      <div className="font-semibold flex items-center gap-2"><Mountain className="h-4 w-4 text-amber-600" /> زكاة الركاز والمعادن</div>
      <div>
        <Label>النوع</Label>
        <Select value={kind} onValueChange={(v: any) => setKind(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="rikaz">ركاز (دفين الجاهلية) — الخُمس 20%</SelectItem>
            <SelectItem value="metals">معادن مستخرجة — 2.5%</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>قيمة المستخرَج</Label>
        <Input type="number" min="0" value={val} onChange={(e) => setVal(e.target.value)} dir="ltr" placeholder="0.00" />
      </div>
      {val && (
        <div className="rounded-xl bg-amber-100 dark:bg-amber-950/40 p-3">
          <div className="text-[11px] text-amber-900 dark:text-amber-200">الواجب ({rate * 100}%)</div>
          <div className="text-base font-bold tabular-nums text-amber-900 dark:text-amber-100">{due.toFixed(2)}</div>
        </div>
      )}
      <div className="text-[10px] text-muted-foreground">الركاز يجب فيه الخُمس بلا اشتراط نصاب أو حول، أما المعادن فتُزكّى ربع العشر عند بلوغها النصاب.</div>
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

// ============== ZAKAT SETTINGS TAB ==============
function ZakatSettingsTab() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["zakat-settings"],
    queryFn: async () => {
      const [s, r] = await Promise.all([
        supabase.from("zakat_settings").select("*").maybeSingle(),
        supabase.from("exchange_rates").select("*"),
      ]);
      return { settings: s.data, rates: r.data ?? [] };
    },
  });

  const [annualType, setAnnualType] = useState<"hijri" | "gregorian">("hijri");
  const [annualValue, setAnnualValue] = useState("01-09");
  const [baseCurrency, setBaseCurrency] = useState("SAR");
  const [nisabMethod, setNisabMethod] = useState<"gold" | "silver">("silver");
  const [jewelry, setJewelry] = useState<"zakat" | "no_zakat">("no_zakat");
  const [goldPrice, setGoldPrice] = useState("380");
  const [silverPrice, setSilverPrice] = useState("4.5");
  const [haulStart, setHaulStart] = useState("");
  const [firstNisab, setFirstNisab] = useState("");
  const [ratesMap, setRatesMap] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!data?.settings) return;
    const s = data.settings;
    setAnnualType(s.annual_date_type as "hijri" | "gregorian");
    setAnnualValue(s.annual_date_value);
    setBaseCurrency(s.base_currency);
    setNisabMethod(s.nisab_method as "gold" | "silver");
    setJewelry(s.gold_jewelry_opinion as "zakat" | "no_zakat");
    if (s.gold_gram_price) setGoldPrice(String(s.gold_gram_price));
    if (s.silver_gram_price) setSilverPrice(String(s.silver_gram_price));
    if (s.last_haul_start_date) setHaulStart(s.last_haul_start_date);
    if (s.first_nisab_reached_at) setFirstNisab(s.first_nisab_reached_at);
    const rm: Record<string, string> = {};
    for (const r of data.rates as any[]) rm[r.currency] = String(r.rate_to_base);
    setRatesMap(rm);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const payload = {
        user_id: u.user.id,
        annual_date_type: annualType,
        annual_date_value: annualValue,
        base_currency: baseCurrency,
        nisab_method: nisabMethod,
        gold_jewelry_opinion: jewelry,
        gold_gram_price: parseFloat(goldPrice) || null,
        silver_gram_price: parseFloat(silverPrice) || null,
        last_haul_start_date: haulStart || null,
        first_nisab_reached_at: firstNisab || null,
      };
      const { error } = await supabase.from("zakat_settings").upsert(payload, { onConflict: "user_id" });
      if (error) throw error;

      // Save exchange rates (upsert each)
      const rows = Object.entries(ratesMap)
        .filter(([c, v]) => c !== baseCurrency && parseFloat(v) > 0)
        .map(([currency, v]) => ({
          user_id: u.user!.id, currency, rate_to_base: parseFloat(v), base_currency: baseCurrency,
        }));
      if (rows.length) {
        const { error: e2 } = await supabase.from("exchange_rates").upsert(rows, { onConflict: "user_id,currency,base_currency" });
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success("تم حفظ إعدادات الزكاة");
      qc.invalidateQueries({ queryKey: ["zakat-settings"] });
      qc.invalidateQueries({ queryKey: ["zakat-data"] });
    },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  if (isLoading) return <div className="h-32 animate-pulse rounded-2xl bg-muted" />;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="font-semibold text-sm flex items-center gap-2"><CalendarClock className="h-4 w-4 text-primary" /> تاريخ الزكاة السنوي</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>التقويم</Label>
            <Select value={annualType} onValueChange={(v: any) => setAnnualType(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="hijri">هجري</SelectItem>
                <SelectItem value="gregorian">ميلادي</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>اليوم-الشهر (DD-MM)</Label>
            <Input value={annualValue} onChange={(e) => setAnnualValue(e.target.value)} dir="ltr" placeholder="01-09" />
            <div className="text-[10px] text-muted-foreground mt-1">مثال: 01-09 = 1 رمضان (هجري) أو 1 سبتمبر (ميلادي)</div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="font-semibold text-sm">العملة والنصاب</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>العملة الأساسية</Label>
            <Select value={baseCurrency} onValueChange={setBaseCurrency}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CURRENCIES.map((c) => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div>
            <Label>طريقة النصاب</Label>
            <Select value={nisabMethod} onValueChange={(v: any) => setNisabMethod(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="silver">الفضة (أحوط)</SelectItem>
                <SelectItem value="gold">الذهب</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>سعر جرام الذهب 24ق ({baseCurrency})</Label>
            <Input type="number" step="0.01" value={goldPrice} onChange={(e) => setGoldPrice(e.target.value)} dir="ltr" />
          </div>
          <div>
            <Label>سعر جرام الفضة ({baseCurrency})</Label>
            <Input type="number" step="0.01" value={silverPrice} onChange={(e) => setSilverPrice(e.target.value)} dir="ltr" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="font-semibold text-sm">الذهب الملبوس (الرأي الفقهي)</div>
        <Select value={jewelry} onValueChange={(v: any) => setJewelry(v)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="no_zakat">لا زكاة على الذهب المُعدّ للزينة (الجمهور)</SelectItem>
            <SelectItem value="zakat">تجب الزكاة على الذهب الملبوس (الحنفية ورأي معاصر)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="font-semibold text-sm">الحول الشرعي</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>أول مرة بلغ النصاب</Label>
            <Input type="date" value={firstNisab} onChange={(e) => setFirstNisab(e.target.value)} dir="ltr" />
          </div>
          <div>
            <Label>بداية الحول الحالي</Label>
            <Input type="date" value={haulStart} onChange={(e) => setHaulStart(e.target.value)} dir="ltr" />
          </div>
        </div>
        <div className="text-[10px] text-muted-foreground">عند بلوغ النصاب لأول مرة يبدأ الحول. الأصول الجديدة المُضافة خلال العام تنضم تلقائياً للوعاء.</div>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="font-semibold text-sm">أسعار صرف العملات (مقابل {baseCurrency})</div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {CURRENCIES.filter((c) => c.code !== baseCurrency).map((c) => (
            <div key={c.code}>
              <Label className="text-[10px]">1 {c.code} =</Label>
              <Input type="number" step="0.0001" dir="ltr" className="h-8 text-xs"
                value={ratesMap[c.code] ?? ""}
                onChange={(e) => setRatesMap((m) => ({ ...m, [c.code]: e.target.value }))}
                placeholder="—" />
            </div>
          ))}
        </div>
        <div className="text-[10px] text-muted-foreground">حدّث الأسعار يدوياً وقت احتساب الزكاة من مصدر موثوق.</div>
      </div>

      <Button className="w-full" onClick={() => save.mutate()} disabled={save.isPending}>
        <Save className="h-4 w-4" /> حفظ الإعدادات
      </Button>
    </div>
  );
}
