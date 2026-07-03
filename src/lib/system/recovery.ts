// =============================================================
// Recovery Tools — Settings > System actions.
// -------------------------------------------------------------
// Every action here is either a local TanStack Query cache operation
// (rebuild/recompute) or a read-only diagnostic pass. Nothing deletes or
// rewrites financial data; "Recompute" only invalidates client-side
// query caches so the next read re-runs the existing pure engines.
// =============================================================
import type { QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { computeAssetMetrics, type AssetTx } from "@/lib/assets/calculator";
import { computeInvestmentPerformance } from "@/lib/assets/performance";
import type { DepreciationProfile } from "@/lib/assets/depreciation";
import { runSystemHealthCheck, type SystemHealthReport } from "./health";
import { validateFinancialIntegrity, type IntegrityResult } from "./integrity";
import { collectPerformanceMetrics, type PerformanceMetrics } from "./performance";
import { loadAuditLog, createAuditEntry, type AuditEntry } from "./audit";
import { loadErrorLog, captureApplicationError, type ErrorEntry } from "./errors";

export async function verifyDatabase(): Promise<SystemHealthReport> {
  return runSystemHealthCheck();
}

export function rebuildCache(queryClient: QueryClient) {
  queryClient.clear();
  createAuditEntry("settings_change", "إعادة بناء الذاكرة المؤقتة (Cache)");
}

export function recomputeInsights(queryClient: QueryClient) {
  return queryClient.invalidateQueries({ queryKey: ["financial-insights"] });
}

export function recomputeEvents(queryClient: QueryClient) {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: ["upcoming-events"] }),
    queryClient.invalidateQueries({ queryKey: ["financial-insights"] }),
  ]);
}

export interface AssetValidationResult {
  checked: number;
  issues: string[];
}

/** Structural checks for assets: orphan components, missing valuations, depreciation completeness. */
export async function validateAssets(): Promise<AssetValidationResult> {
  const report = await runSystemHealthCheck();
  const issues = report.assets.items
    .filter((i) => i.status !== "ok")
    .map((i) => `${i.label}: ${i.detail}`);
  const { count } = await supabase.from("investments").select("*", { count: "exact", head: true });
  return { checked: count ?? 0, issues };
}

/** Runs computeInvestmentPerformance() across every active investment and flags computation failures. */
export async function validateInvestments(): Promise<AssetValidationResult> {
  const [invRes, txRes, mvRes, depRes] = await Promise.all([
    supabase
      .from("investments")
      .select(
        "id,name,currency,status,base_value,principal,current_value,sold_amount,acquired_at,start_date",
      ),
    supabase.from("investment_transactions").select("investment_id,tx_class,kind,amount"),
    supabase.from("asset_market_values").select("investment_id,valuation_date,market_value"),
    supabase
      .from("depreciation_profiles")
      .select("investment_id,method,useful_life_months,salvage_value,start_date,is_active"),
  ]);
  interface InvestmentValidationRow {
    id: string;
    name: string;
    currency: string;
    status: string;
    base_value: number | null;
    principal: number;
    current_value: number;
    sold_amount: number | null;
    acquired_at: string | null;
    start_date: string | null;
  }
  interface DepreciationValidationRow extends DepreciationProfile {
    investment_id: string;
  }

  const investments = ((invRes.data ?? []) as InvestmentValidationRow[]).filter(
    (i) => i.status !== "archived",
  );
  const txByInv = new Map<string, AssetTx[]>();
  for (const t of (txRes.data ?? []) as (AssetTx & { investment_id: string })[]) {
    const a = txByInv.get(t.investment_id) ?? [];
    a.push(t);
    txByInv.set(t.investment_id, a);
  }
  const mvByInv = new Map<string, { valuation_date: string; market_value: number }[]>();
  for (const m of (mvRes.data ?? []) as {
    investment_id: string;
    valuation_date: string;
    market_value: number;
  }[]) {
    const a = mvByInv.get(m.investment_id) ?? [];
    a.push(m);
    mvByInv.set(m.investment_id, a);
  }
  const depByInv = new Map(
    ((depRes.data ?? []) as DepreciationValidationRow[])
      .filter((d) => d.is_active)
      .map((d) => [d.investment_id, d] as const),
  );

  const issues: string[] = [];
  for (const inv of investments) {
    try {
      const perf = computeInvestmentPerformance({
        asset: inv,
        txs: txByInv.get(inv.id) ?? [],
        marketValues: mvByInv.get(inv.id),
        depreciationProfile: depByInv.get(inv.id) ?? null,
      });
      if (!Number.isFinite(perf.roi) || !Number.isFinite(perf.totalReturn)) {
        issues.push(`أصل "${inv.name}": نتيجة أداء غير رقمية (ROI/العائد)`);
      }
    } catch (e) {
      captureApplicationError(e, "runtime", { scope: "validateInvestments", investmentId: inv.id });
      issues.push(
        `أصل "${inv.name}": فشل حساب الأداء — ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }
  return { checked: investments.length, issues };
}

export interface DiagnosticReport {
  generatedAt: string;
  health: SystemHealthReport;
  integrity: IntegrityResult;
  performance: PerformanceMetrics;
  auditLog: AuditEntry[];
  errorLog: ErrorEntry[];
}

export async function buildDiagnosticReport(): Promise<DiagnosticReport> {
  const [health, integrity, performance] = await Promise.all([
    runSystemHealthCheck(),
    validateFinancialIntegrity(),
    collectPerformanceMetrics(),
  ]);
  return {
    generatedAt: new Date().toISOString(),
    health,
    integrity,
    performance,
    auditLog: loadAuditLog(),
    errorLog: loadErrorLog(),
  };
}

export function downloadDiagnosticReport(report: DiagnosticReport) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rasd-diagnostics-${report.generatedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
  createAuditEntry("export", "تصدير تقرير تشخيصي (Diagnostic Report)");
}
