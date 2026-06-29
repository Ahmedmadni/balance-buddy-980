import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HandCoins, Save, Info, AlertTriangle } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  computeAssetZakat,
  readAssetZakatSettings,
  METHOD_LABEL,
  SCOPE_LABEL,
  type AssetZakatMethod,
  type AssetZakatScope,
  type AssetZakatMode,
  type AssetZakatResult,
} from "@/lib/assets/zakat-asset";

export function AssetZakatTab({ asset }: { asset: any }) {
  const qc = useQueryClient();
  const cur = asset.currency;

  // Settings stored in meta.zakat → no new column
  const initial = readAssetZakatSettings(asset);
  const [isZ, setIsZ] = useState<boolean>(initial.is_zakatable);
  const [method, setMethod] = useState<AssetZakatMethod>(initial.method);
  const [custom, setCustom] = useState<string>(initial.custom_value != null ? String(initial.custom_value) : "");
  const [scope, setScope] = useState<AssetZakatScope>(initial.scope || "both");
  const [mode, setMode] = useState<AssetZakatMode>("market_based");
  const [rate, setRate] = useState<string>("2.5");

  // Children components (sub-assets) + per-asset data needed for computation
  const { data } = useQuery({
    queryKey: ["asset-zakat-bundle", asset.id],
    queryFn: async () => {
      const [cRes, txRes, mvRes, depRes] = await Promise.all([
        supabase.from("investments").select("*").eq("parent_investment_id", asset.id),
        supabase.from("investment_transactions").select("*").or(`investment_id.eq.${asset.id}`),
        supabase.from("asset_market_values").select("*").eq("investment_id", asset.id),
        supabase.from("depreciation_profiles").select("*").eq("investment_id", asset.id).eq("is_active", true).maybeSingle(),
      ]);
      const children = cRes.data ?? [];
      // Fetch children dependencies in bulk
      const childIds = children.map((c) => c.id);
      let childTx: any[] = [], childMv: any[] = [], childDep: any[] = [];
      if (childIds.length) {
        const [tR, mR, dR] = await Promise.all([
          supabase.from("investment_transactions").select("*").in("investment_id", childIds),
          supabase.from("asset_market_values").select("*").in("investment_id", childIds),
          supabase.from("depreciation_profiles").select("*").in("investment_id", childIds).eq("is_active", true),
        ]);
        childTx = tR.data ?? []; childMv = mR.data ?? []; childDep = dR.data ?? [];
      }
      return {
        parentTxs: txRes.data ?? [],
        parentMv: mvRes.data ?? [],
        parentDep: depRes.data ?? null,
        children, childTx, childMv, childDep,
      };
    },
  });

  const rateN = (parseFloat(rate) || 2.5) / 100;

  const parentResult: AssetZakatResult | null = useMemo(() => {
    if (!data) return null;
    const overlayAsset = { ...asset, meta: { ...(asset.meta || {}), zakat: { is_zakatable: isZ, method, custom_value: parseFloat(custom) || 0, scope } } };
    return computeAssetZakat({
      asset: overlayAsset,
      txs: data.parentTxs,
      marketValues: data.parentMv,
      depreciationProfile: data.parentDep as any,
      mode,
      rate: rateN,
    });
  }, [asset, data, isZ, method, custom, scope, mode, rateN]);

  const childResults: AssetZakatResult[] = useMemo(() => {
    if (!data) return [];
    return data.children.map((c: any) => computeAssetZakat({
      asset: c,
      txs: data.childTx.filter((t: any) => t.investment_id === c.id),
      marketValues: data.childMv.filter((m: any) => m.investment_id === c.id),
      depreciationProfile: (data.childDep.find((d: any) => d.investment_id === c.id) || null) as any,
      mode,
      rate: rateN,
    }));
  }, [data, mode, rateN]);

  const totals = useMemo(() => {
    const list: AssetZakatResult[] = [];
    if (scope !== "components_only" && parentResult) list.push(parentResult);
    if (scope !== "asset_only") list.push(...childResults);
    const value = list.reduce((a, b) => a + b.zakatableValue, 0);
    const zakat = list.reduce((a, b) => a + b.zakatAmount, 0);
    return { value, zakat, list };
  }, [scope, parentResult, childResults]);

  const save = useMutation({
    mutationFn: async () => {
      const newMeta = { ...(asset.meta || {}), zakat: { is_zakatable: isZ, method, custom_value: parseFloat(custom) || 0, scope } };
      const { error } = await supabase.from("investments").update({ meta: newMeta }).eq("id", asset.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حفظ إعدادات الزكاة");
      qc.invalidateQueries({ queryKey: ["investments-list"] });
      qc.invalidateQueries({ queryKey: ["asset-zakat-bundle", asset.id] });
    },
    onError: (e: any) => toast.error("فشل الحفظ", { description: e.message }),
  });

  return (
    <div className="space-y-3 mt-3">
      <div className="rounded-2xl border bg-amber-50/40 dark:bg-amber-950/10 p-3 text-[11px] text-amber-800 dark:text-amber-200 flex gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>هذه الحسابات تحليلية فقط — لا تُنشئ أي قيود محاسبية ولا تؤثر على أرصدتك. التصنيف الأولي مستنتج من نوع الأصل والغرض.</span>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold flex items-center gap-2">
            <HandCoins className="h-4 w-4" /> إعدادات الزكاة لهذا الأصل
          </div>
          <Switch checked={isZ} onCheckedChange={setIsZ} />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">طريقة التقييم</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as AssetZakatMethod)} disabled={!isZ}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["market_value","book_value","custom_value","excluded"] as AssetZakatMethod[]).map((m) => (
                  <SelectItem key={m} value={m}>{METHOD_LABEL[m]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">نطاق الاحتساب</Label>
            <Select value={scope} onValueChange={(v) => setScope(v as AssetZakatScope)} disabled={!isZ}>
              <SelectTrigger className="h-9 text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {(["asset_only","components_only","both"] as AssetZakatScope[]).map((s) => (
                  <SelectItem key={s} value={s}>{SCOPE_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {method === "custom_value" && (
            <div className="col-span-2">
              <Label className="text-xs">قيمة مخصّصة ({cur})</Label>
              <Input type="number" dir="ltr" value={custom} onChange={(e) => setCustom(e.target.value)} className="h-9" />
            </div>
          )}
          <div>
            <Label className="text-xs">نسبة الزكاة %</Label>
            <Input type="number" step="0.1" dir="ltr" value={rate} onChange={(e) => setRate(e.target.value)} className="h-9" />
          </div>
          <div>
            <Label className="text-xs">وضع الحساب</Label>
            <Tabs value={mode} onValueChange={(v) => setMode(v as AssetZakatMode)}>
              <TabsList className="h-9 w-full grid grid-cols-2">
                <TabsTrigger value="market_based" className="text-xs">سوقي</TabsTrigger>
                <TabsTrigger value="conservative" className="text-xs">متحفّظ</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        <Button onClick={() => save.mutate()} disabled={save.isPending} size="sm" className="w-full">
          <Save className="h-3.5 w-3.5 ml-1" /> حفظ إعدادات الزكاة
        </Button>
      </div>

      {/* Result panel */}
      <div className="grid grid-cols-2 gap-2">
        <Stat label="القيمة الزكوية" value={formatMoney(totals.value, cur)} accent />
        <Stat label="مبلغ الزكاة المستحق" value={formatMoney(totals.zakat, cur)} tone={totals.zakat > 0 ? "text-success" : ""} accent />
      </div>

      {parentResult && (
        <div className="rounded-2xl border bg-card p-3 space-y-2 text-xs">
          <div className="font-semibold text-sm">تفاصيل الأصل</div>
          <Row k="هل خاضع للزكاة؟" v={parentResult.isZakatable ? "نعم" : "لا"} />
          <Row k="السبب" v={parentResult.reason} />
          <Row k="الطريقة المُختارة" v={METHOD_LABEL[parentResult.method]} />
          <Row k="الطريقة الفعلية (بعد الوضع)" v={METHOD_LABEL[parentResult.effectiveMethod]} />
          <Row k="القيمة السوقية" v={formatMoney(parentResult.marketValue, cur)} />
          <Row k="القيمة الدفترية" v={formatMoney(parentResult.bookValue, cur)} />
          <Row k="القيمة الزكوية" v={formatMoney(parentResult.zakatableValue, cur)} />
          <Row k="نسبة الزكاة" v={`${(parentResult.rate * 100).toFixed(2)}%`} />
          <Row k="مبلغ الزكاة" v={formatMoney(parentResult.zakatAmount, cur)} />
        </div>
      )}

      {childResults.length > 0 && scope !== "asset_only" && (
        <div className="rounded-2xl border bg-card p-3 space-y-2">
          <div className="font-semibold text-sm">المكوّنات</div>
          <div className="space-y-1.5">
            {childResults.map((c) => (
              <div key={c.assetId} className="grid grid-cols-4 gap-2 text-[11px] items-center border-b last:border-0 pb-1.5">
                <div className="truncate">{c.assetName}</div>
                <div className="text-muted-foreground">{METHOD_LABEL[c.effectiveMethod]}</div>
                <div className="tabular-nums">{formatMoney(c.zakatableValue, c.currency)}</div>
                <div className={cn("tabular-nums font-semibold", c.zakatAmount > 0 ? "text-success" : "text-muted-foreground")}>
                  {formatMoney(c.zakatAmount, c.currency)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!parentResult?.isZakatable && (
        <div className="rounded-xl border border-amber-300/40 bg-amber-50 dark:bg-amber-950/20 p-3 text-xs text-amber-800 dark:text-amber-200 flex gap-2">
          <AlertTriangle className="h-3.5 w-3.5 mt-0.5" />
          <span>الأصل غير خاضع للزكاة وفق الإعدادات الحالية. يمكنك تفعيل الخضوع يدويًا أعلاه.</span>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value, tone, accent }: { label: string; value: string; tone?: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-3", accent ? "bg-primary/5 border-primary/30" : "bg-card")}>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("text-base font-extrabold tabular-nums mt-1", tone)}>{value}</div>
    </div>
  );
}
function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-2"><span className="text-muted-foreground">{k}</span><span className="font-medium">{v}</span></div>;
}
