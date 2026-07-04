// =============================================================
// PART 5 — certifyPerformance()
// -------------------------------------------------------------
// Reuses runSystemHealthCheck() (system/health.ts), collectPerformanceMetrics()
// (system/performance.ts), computeFinancialInsights() (insights/engine.ts —
// the Analytics Engine, timed only, never touched), and evaluateProductionGate()
// (release/production-gate.ts) directly — nothing here recomputes their
// underlying logic. computeFinancialInsights() requires a live authenticated
// Supabase session; if none exists in the calling context, its timing is
// reported as unavailable rather than faked.
// =============================================================
import { runSystemHealthCheck } from "@/lib/system/health";
import { collectPerformanceMetrics } from "@/lib/system/performance";
import { computeFinancialInsights } from "@/lib/insights/engine";
import { evaluateProductionGate } from "@/lib/release/production-gate";
import type { HealthStatus } from "@/lib/system/health";

export interface PerformanceCertification {
  healthScore: number;
  totalQueryMs: number;
  localStorageUsageBytes: number;
  insightsComputeMs: number | null;
  productionGateScore: number;
  score: number;
  status: HealthStatus;
  generatedAt: string;
}

export async function certifyPerformance(): Promise<PerformanceCertification> {
  const [health, perf, gate] = await Promise.all([
    runSystemHealthCheck(),
    collectPerformanceMetrics(),
    evaluateProductionGate(),
  ]);

  let insightsComputeMs: number | null = null;
  try {
    const t0 = performance.now();
    await computeFinancialInsights();
    insightsComputeMs = performance.now() - t0;
  } catch {
    insightsComputeMs = null; // no authenticated Supabase session in this calling context
  }

  const healthCategories = [
    health.database.status,
    health.financialEngine.status,
    health.assets.status,
    health.events.status,
  ];
  const healthOkCount = healthCategories.filter((s) => s === "ok").length;
  const healthScore = Math.round((healthOkCount / healthCategories.length) * 100);
  const totalQueryMs = perf.queryDurations.reduce((s, q) => s + q.ms, 0);

  const score = Math.round((healthScore + gate.score) / 2);
  const status: HealthStatus = score >= 90 ? "ok" : score >= 70 ? "warning" : "error";

  return {
    healthScore,
    totalQueryMs,
    localStorageUsageBytes: perf.localStorageUsageBytes,
    insightsComputeMs,
    productionGateScore: gate.score,
    score,
    status,
    generatedAt: new Date().toISOString(),
  };
}
