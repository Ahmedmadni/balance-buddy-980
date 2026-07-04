// =============================================================
// PART 9 — Go / No-Go Engine
// -------------------------------------------------------------
// The ultimate capstone: reuses runFinalProductionAudit() (schema
// freeze + financial facts), evaluateProductionGate() (9-report gate),
// computeLaunchBlockers() (flat blocker list), performFinalAudit()
// (legal links + unresolved blockers double-check), plus this prompt's
// own auditAndroidProduction()/auditIOSProduction()/auditSupportInfrastructure().
// Nothing here recomputes any of their underlying logic — it only
// derives a single decision from their outputs. iOS is deliberately
// NOT a gating factor for GO: this project has never added an iOS
// platform or documented iOS steps (see release/ios-audit.ts), so an
// Android+Web launch is a legitimate outcome without it — iOS is
// surfaced as a warning, not a blocker.
// =============================================================
import { runFinalProductionAudit } from "./final-audit";
import { evaluateProductionGate } from "./production-gate";
import { computeLaunchBlockers } from "./blockers";
import { performFinalAudit } from "./final-check";
import { auditAndroidProduction } from "@/lib/android/audit";
import { auditIOSProduction } from "@/lib/ios/audit";
import { auditSupportInfrastructure } from "@/lib/support/audit";

export type LaunchDecision = "GO" | "NO_GO" | "BETA_ONLY";

export interface LaunchDecisionReport {
  decision: LaunchDecision;
  score: number;
  blockers: string[];
  warnings: string[];
  recommendations: string[];
  generatedAt: string;
}

export async function evaluateLaunchDecision(): Promise<LaunchDecisionReport> {
  const [finalAudit, gate, launchBlockers, finalCheck] = await Promise.all([
    runFinalProductionAudit(),
    evaluateProductionGate(),
    computeLaunchBlockers(),
    performFinalAudit(),
  ]);
  const android = auditAndroidProduction();
  const ios = auditIOSProduction();
  const support = auditSupportInfrastructure();

  const scores = [finalAudit.score, gate.score, android.score, support.score];
  const score = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);

  const blockers: string[] = [];
  const warnings: string[] = [...gate.warnings];
  const recommendations: string[] = [];

  for (const item of finalCheck.items) {
    if (item.status === "error") blockers.push(`${item.label}: ${item.detail}`);
  }
  if (launchBlockers.criticalCount > 0) {
    blockers.push(
      `${launchBlockers.criticalCount} عائق حرج غير محلول من أصل ${launchBlockers.blockers.length} (راجع Launch Readiness Resolution Center)`,
    );
  }
  blockers.push(...gate.blockers);

  if (android.score < 100) warnings.push(`Android Production Readiness: ${android.score}/100`);
  if (ios.score < 100)
    warnings.push(`iOS Production Readiness: ${ios.score}/100 (منصّة iOS لم تُضَف بعد)`);
  if (support.score < 100) warnings.push(`Support Infrastructure: ${support.score}/100`);

  const uniqueBlockers = Array.from(new Set(blockers));
  const uniqueWarnings = Array.from(new Set(warnings));

  let decision: LaunchDecision;
  if (uniqueBlockers.length > 0) {
    decision = "NO_GO";
    recommendations.push("عالج كل العوائق الحرجة المذكورة أعلاه قبل أي إطلاق، حتى التجريبي");
  } else if (gate.productionReady && android.score >= 90 && support.score === 100) {
    decision = "GO";
    recommendations.push(
      "لا عوائق حرجة وكل بنود الإنتاج الأساسية مكتملة — جاهز للإطلاق الفعلي على Android والويب",
    );
  } else {
    decision = "BETA_ONLY";
    recommendations.push(
      "لا عوائق حرجة، لكن التطبيق غير جاهز للإطلاق العلني الكامل بعد — مناسب لـ Closed/Open Beta فقط حتى تُستوفى بنود جاهزية المتجر والدعم (راجع التحذيرات أعلاه)",
    );
  }

  return {
    decision,
    score,
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}
