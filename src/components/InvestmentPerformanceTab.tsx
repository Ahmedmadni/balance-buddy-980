import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import { formatMoney } from "@/lib/format";
import { computeInvestmentPerformance, combinePerformance, type InvestmentPerformance } from "@/lib/assets/performance";
import { TrendingUp, TrendingDown, Coins, Layers, Package } from "lucide-react";

type Scope = "asset" | "components" | "unified";

export function InvestmentPerformanceTab({ asset }: { asset: any }) {
  const [scope, setScope] = useState<Scope>("unified");

  // Children (components) of this asset
  const { data: children = [] } = useQuery({
    queryKey: ["asset-children", asset.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investments")
        .select("*")
        .eq("parent_investment_id", asset.id);
      if (error) throw error;
      return data ?? [];
    },
  });

  const allIds = useMemo(() => [asset.id, ...children.map((c: any) => c.id)], [asset.id, children]);

  // Fetch txs, market values, depreciation profiles for asset + all children in one go
  const { data: bundle } = useQuery({
    queryKey: ["asset-perf-bundle", asset.id, allIds.join(",")],
    queryFn: async () => {
      const [txsRes, mvRes, depRes] = await Promise.all([
        supabase.from("investment_transactions").select("*").in("investment_id", allIds),
        supabase.from("asset_market_values").select("*").in("investment_id", allIds),
        supabase.from("depreciation_profiles").select("*").in("investment_id", allIds).eq("is_active", true),
      ]);
      if (txsRes.error) throw txsRes.error;
      if (mvRes.error) throw mvRes.error;
      if (depRes.error) throw depRes.error;
      return { txs: txsRes.data ?? [], mvs: mvRes.data ?? [], deps: depRes.data ?? [] };
    },
  });

  const perfFor = (a: any): InvestmentPerformance => {
    const txs = (bundle?.txs ?? []).filter((t: any) => t.investment_id === a.id);
    const mvs = (bundle?.mvs ?? []).filter((m: any) => m.investment_id === a.id);
    const dep = (bundle?.deps ?? []).find((d: any) => d.investment_id === a.id) ?? null;
    return computeInvestmentPerformance({ asset: a, txs, marketValues: mvs, depreciationProfile: dep });
  };

  const assetPerf = perfFor(asset);
  const childPerfs = children.map(perfFor);
  const componentsCombined = combinePerformance(childPerfs);
  const unifiedCombined = combinePerformance([assetPerf, ...childPerfs]);

  const active: InvestmentPerformance | null =
    scope === "asset" ? assetPerf
      : scope === "components" ? componentsCombined
      : unifiedCombined;

  const cur = asset.currency;

  return (
    <div className="space-y-3 mt-3">
      {/* Scope selector */}
      <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-muted">
        <ScopeBtn icon={<Package className="h-3.5 w-3.5" />} active={scope === "asset"} onClick={() => setScope("asset")}>الأصل فقط</ScopeBtn>
        <ScopeBtn icon={<Layers className="h-3.5 w-3.5" />} active={scope === "components"} onClick={() => setScope("components")} disabled={children.length === 0}>
          المكونات{children.length > 0 ? ` (${children.length})` : ""}
        </ScopeBtn>
        <ScopeBtn icon={<Coins className="h-3.5 w-3.5" />} active={scope === "unified"} onClick={() => setScope("unified")}>الأداء الموحّد</ScopeBtn>
      </div>

      {!active ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          {scope === "components" ? "لا توجد مكونات لهذا الأصل." : "لا توجد بيانات كافية لحساب الأداء."}
        </div>
      ) : (
        <>
          {/* Headline */}
          <div className="rounded-2xl border bg-[image:var(--gradient-primary)]/5 p-4">
            <div className="text-[11px] text-muted-foreground">إجمالي العائد</div>
            <div className={cn("text-3xl font-extrabold tabular-nums flex items-center gap-2",
              active.totalReturn >= 0 ? "text-success" : "text-destructive")}>
              {active.totalReturn >= 0 ? <TrendingUp className="h-6 w-6" /> : <TrendingDown className="h-6 w-6" />}
              {active.totalReturn >= 0 ? "+" : ""}{formatMoney(active.totalReturn, cur)}
            </div>
            <div className="mt-1 text-xs flex items-center gap-3 flex-wrap">
              <Pill label="ROI" value={`${(active.roi * 100).toFixed(2)}%`} tone={active.roi >= 0 ? "success" : "destructive"} />
              {active.annualizedReturn !== null && (
                <Pill label="عائد سنوي" value={`${(active.annualizedReturn * 100).toFixed(2)}%`} tone={active.annualizedReturn >= 0 ? "success" : "destructive"} />
              )}
              {active.holdingYears !== null && (
                <Pill label="مدة الحيازة" value={`${active.holdingYears.toFixed(2)} سنة`} />
              )}
            </div>
          </div>

          {/* Metric grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            <Stat label="إجمالي الاستثمار" value={formatMoney(active.investmentCost, cur)} accent />
            <Stat label="الإيرادات" value={formatMoney(active.income, cur)} tone="text-success" />
            <Stat label="المصروفات التشغيلية" value={formatMoney(active.opex, cur)} tone="text-amber-600" />
            <Stat label="المصروفات الرأسمالية" value={formatMoney(active.capex, cur)} tone="text-blue-600" />
            <Stat label="مجمع الإهلاك" value={formatMoney(active.accumulatedDepreciation, cur)} tone="text-muted-foreground" />
            <Stat label="القيمة الدفترية" value={formatMoney(active.bookValue, cur)} />
            <Stat label="القيمة السوقية" value={formatMoney(active.marketValue, cur)} accent />
            <Stat
              label="الربح غير المحقق"
              value={`${active.unrealizedGain >= 0 ? "+" : ""}${formatMoney(active.unrealizedGain, cur)}`}
              tone={active.unrealizedGain >= 0 ? "text-success" : "text-destructive"}
            />
            <Stat
              label="الربح المحقق"
              value={`${active.realizedGain >= 0 ? "+" : ""}${formatMoney(active.realizedGain, cur)}`}
              tone={active.realizedGain >= 0 ? "text-success" : "text-destructive"}
            />
          </div>

          {/* Operating profit row */}
          <div className="rounded-xl border bg-accent/20 p-3 text-xs space-y-1">
            <Row label="الربح التشغيلي (إيرادات − تشغيلية)" value={formatMoney(active.operatingProfit, cur)} tone={active.operatingProfit >= 0 ? "text-success" : "text-destructive"} />
            <Row label="إجمالي العائد" value={`${active.totalReturn >= 0 ? "+" : ""}${formatMoney(active.totalReturn, cur)}`} tone={active.totalReturn >= 0 ? "text-success" : "text-destructive"} bold />
            <Row label="ROI" value={`${(active.roi * 100).toFixed(2)}%`} tone={active.roi >= 0 ? "text-success" : "text-destructive"} />
            {active.annualizedReturn !== null && (
              <Row label="العائد السنوي" value={`${(active.annualizedReturn * 100).toFixed(2)}%`} tone={active.annualizedReturn >= 0 ? "text-success" : "text-destructive"} />
            )}
          </div>

          {/* If sold today */}
          <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-4 space-y-2">
            <div className="flex items-center gap-2">
              <Coins className="h-4 w-4 text-primary" />
              <div className="font-bold text-sm">إذا تم بيع الأصل اليوم</div>
            </div>
            <div className="text-[11px] text-muted-foreground">حساب تحليلي افتراضي — لا يُسجَّل أي قيد محاسبي.</div>
            <div className="grid grid-cols-2 gap-2 mt-1 text-xs">
              <Stat label="القيمة السوقية" value={formatMoney(active.ifSoldToday.marketValue, cur)} />
              <Stat label="القيمة الدفترية" value={formatMoney(active.ifSoldToday.bookValue, cur)} />
              <Stat
                label="ربح البيع المتوقع"
                value={`${active.ifSoldToday.expectedSaleGain >= 0 ? "+" : ""}${formatMoney(active.ifSoldToday.expectedSaleGain, cur)}`}
                tone={active.ifSoldToday.expectedSaleGain >= 0 ? "text-success" : "text-destructive"}
              />
              <Stat
                label="الأرباح التشغيلية"
                value={formatMoney(active.ifSoldToday.operatingProfit, cur)}
                tone={active.ifSoldToday.operatingProfit >= 0 ? "text-success" : "text-destructive"}
              />
              <Stat
                label="إجمالي العائد المتوقع"
                value={`${active.ifSoldToday.totalReturn >= 0 ? "+" : ""}${formatMoney(active.ifSoldToday.totalReturn, cur)}`}
                tone={active.ifSoldToday.totalReturn >= 0 ? "text-success" : "text-destructive"}
                accent
              />
            </div>
          </div>

          {/* Components breakdown when relevant */}
          {(scope === "components" || scope === "unified") && children.length > 0 && (
            <div className="rounded-xl border bg-card p-3 space-y-2">
              <div className="text-xs font-semibold flex items-center gap-1.5"><Layers className="h-3.5 w-3.5" /> تفصيل المكونات</div>
              {children.map((c: any) => {
                const p = perfFor(c);
                return (
                  <div key={c.id} className="flex items-center justify-between rounded-lg border p-2 text-xs">
                    <div className="min-w-0">
                      <div className="font-medium truncate">{c.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        تكلفة {formatMoney(p.investmentCost, p.currency)} · دفترية {formatMoney(p.bookValue, p.currency)}
                      </div>
                    </div>
                    <div className={cn("font-bold tabular-nums shrink-0", p.totalReturn >= 0 ? "text-success" : "text-destructive")}>
                      {p.totalReturn >= 0 ? "+" : ""}{formatMoney(p.totalReturn, p.currency)}
                      <span className="text-[10px] mr-1 opacity-70">({(p.roi * 100).toFixed(1)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ScopeBtn({ children, icon, active, onClick, disabled }: { children: React.ReactNode; icon: React.ReactNode; active: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-medium transition",
        active ? "bg-background shadow text-foreground" : "text-muted-foreground hover:text-foreground",
        disabled && "opacity-40 cursor-not-allowed",
      )}
    >
      {icon}{children}
    </button>
  );
}

function Stat({ label, value, tone, accent }: { label: string; value: string; tone?: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-2.5", accent ? "bg-primary/5 border-primary/30" : "bg-card")}>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums mt-0.5", tone)}>{value}</div>
    </div>
  );
}

function Row({ label, value, tone, bold }: { label: string; value: string; tone?: string; bold?: boolean }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className={cn("tabular-nums", bold ? "font-bold" : "font-medium", tone)}>{value}</span>
    </div>
  );
}

function Pill({ label, value, tone }: { label: string; value: string; tone?: "success" | "destructive" | "muted" }) {
  return (
    <span className={cn(
      "rounded-full px-2 py-0.5 text-[10px] flex items-center gap-1",
      tone === "success" && "bg-success/15 text-success",
      tone === "destructive" && "bg-destructive/15 text-destructive",
      (!tone || tone === "muted") && "bg-muted text-muted-foreground",
    )}>
      <span className="opacity-70">{label}</span>
      <span className="font-bold tabular-nums">{value}</span>
    </span>
  );
}
