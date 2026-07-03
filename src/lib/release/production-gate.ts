// =============================================================
// PART 8 — Production Gate Engine
// -------------------------------------------------------------
// Reuses 9 existing reports directly — nothing here recomputes any of
// their underlying logic. This is the final go/no-go gate sitting on
// top of every audit built across Prompts 20-25.
// =============================================================
import { runFinalProductionAudit } from "./final-audit";
import { auditCompliance } from "./compliance-audit";
import { generateReleaseChecklist } from "@/lib/mobile/readiness";
import { calculateBetaHealth } from "@/lib/beta/health-score";
import { auditFeatureCoverage } from "@/lib/beta/feature-coverage";
import { auditMobileCompatibility } from "@/lib/mobile/compatibility";
import { auditAdsConfiguration } from "@/lib/ads/audit";
import { loadLastBackup } from "@/lib/backup/engine";
import { verifyBackupIntegrity } from "@/lib/backup/integrity";
import { detectReleaseBlockers } from "@/lib/beta/release-blockers";
import type { HealthStatus } from "@/lib/system/health";

export interface ProductionGateChecklistItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface ProductionGateReport {
  productionReady: boolean;
  score: number;
  blockers: string[];
  warnings: string[];
  recommendations: string[];
  checklist: ProductionGateChecklistItem[];
  generatedAt: string;
}

export async function evaluateProductionGate(): Promise<ProductionGateReport> {
  const [
    finalAudit,
    compliance,
    releaseChecklist,
    betaHealth,
    featureCoverage,
    releaseBlockers,
    lastBackup,
  ] = await Promise.all([
    runFinalProductionAudit(),
    auditCompliance(),
    generateReleaseChecklist(),
    calculateBetaHealth(),
    auditFeatureCoverage(),
    detectReleaseBlockers(),
    loadLastBackup(),
  ]);
  const mobileCompat = auditMobileCompatibility();
  const adsAudit = auditAdsConfiguration();
  const backupIntegrity = lastBackup ? await verifyBackupIntegrity(lastBackup) : null;

  const mobileAllSupported = mobileCompat.items.every((i) => i.supported);
  const anyAdsConfigured =
    adsAudit.web.configured || adsAudit.android.configured || adsAudit.ios.configured;

  const checklist: ProductionGateChecklistItem[] = [
    {
      id: "final_audit",
      label: "التدقيق النهائي للإنتاج",
      status: finalAudit.score >= 90 ? "ok" : finalAudit.score >= 70 ? "warning" : "error",
      detail: `${finalAudit.score}/100`,
    },
    {
      id: "compliance",
      label: "الامتثال",
      status: compliance.score === 100 ? "ok" : compliance.score >= 75 ? "warning" : "error",
      detail: `${compliance.score}/100`,
    },
    {
      id: "release_checklist",
      label: "قائمة الإصدار (Mobile Readiness)",
      status: releaseChecklist.overallStatus,
      detail: `${releaseChecklist.items.filter((i) => i.status === "ok").length}/${releaseChecklist.items.length} بند سليم`,
    },
    {
      id: "beta_health",
      label: "صحة Beta",
      status:
        betaHealth.totalScore >= 80 ? "ok" : betaHealth.totalScore >= 55 ? "warning" : "error",
      detail: `${betaHealth.totalScore}/100`,
    },
    {
      id: "feature_coverage",
      label: "تغطية الميزات",
      status: featureCoverage.neverUsedCount === 0 ? "ok" : "warning",
      detail: `${featureCoverage.coveredCount}/${featureCoverage.items.length} مغطاة، ${featureCoverage.neverUsedCount} لم تُستخدم`,
    },
    {
      id: "mobile_audit",
      label: "توافق الجوال",
      status: mobileAllSupported ? "ok" : "warning",
      detail: `${mobileCompat.items.filter((i) => i.supported).length}/${mobileCompat.items.length} قدرة متاحة`,
    },
    {
      id: "ads_audit",
      label: "تدقيق الإعلانات",
      status: anyAdsConfigured ? "ok" : "warning",
      detail: anyAdsConfigured
        ? "منصّة واحدة على الأقل بمعرّفات حقيقية"
        : "كل المعرّفات لا تزال placeholder",
    },
    {
      id: "backup_integrity",
      label: "سلامة النسخة الاحتياطية",
      status: backupIntegrity ? (backupIntegrity.valid ? "ok" : "error") : "warning",
      detail: backupIntegrity ? `${backupIntegrity.score}/100` : "لا نسخة احتياطية محلية بعد",
    },
    {
      id: "release_blockers",
      label: "عوائق الإطلاق",
      status: releaseBlockers.blockingCount === 0 ? "ok" : "error",
      detail: `${releaseBlockers.blockingCount} عائق نشط من أصل ${releaseBlockers.blockers.length}`,
    },
  ];

  const blockers: string[] = [];
  const warnings: string[] = [];
  for (const item of checklist) {
    if (item.status === "error") blockers.push(`${item.label}: ${item.detail}`);
    else if (item.status === "warning") warnings.push(`${item.label}: ${item.detail}`);
  }

  const okCount = checklist.filter((i) => i.status === "ok").length;
  const score = Math.round((okCount / checklist.length) * 100);
  const productionReady = blockers.length === 0 && score >= 90;

  const recommendations: string[] = [];
  for (const item of checklist) {
    if (item.status === "error") recommendations.push(`عالج أولاً: ${item.label} (${item.detail})`);
  }
  if (recommendations.length === 0 && warnings.length > 0) {
    recommendations.push("لا عوائق حرجة — راجع التحذيرات أعلاه لرفع الدرجة قبل الإطلاق الفعلي");
  }
  if (recommendations.length === 0 && warnings.length === 0) {
    recommendations.push("كل الفحوصات ناجحة — راجع لوحة Production Gate دورياً قبل كل إصدار جديد");
  }

  return {
    productionReady,
    score,
    blockers,
    warnings,
    recommendations,
    checklist,
    generatedAt: new Date().toISOString(),
  };
}
