// =============================================================
// PART 9 — Final Go / No-Go Decision
// -------------------------------------------------------------
// The final capstone of the entire session: composes Prompt 27's
// evaluateLaunchDecision() (production readiness), this prompt's
// generateProductionCertificate() (architecture/security/performance
// certification), and auditDependencies() (supply-chain risk) into one
// terminal decision. Nothing here recomputes any of their logic.
// =============================================================
import { evaluateLaunchDecision } from "@/lib/release/go-no-go";
import { generateProductionCertificate } from "./production-certificate";
import { auditDependencies } from "./dependencies";

export type FinalReleaseDecision = "GO" | "NO_GO" | "BETA_ONLY";
export type ConfidenceLevel = "high" | "medium" | "low";

export interface FinalReleaseDecisionReport {
  decision: FinalReleaseDecision;
  confidence: ConfidenceLevel;
  blockers: string[];
  warnings: string[];
  recommendation: string;
  generatedAt: string;
}

export async function evaluateFinalReleaseDecision(): Promise<FinalReleaseDecisionReport> {
  const [launchDecision, cert, deps] = await Promise.all([
    evaluateLaunchDecision(),
    generateProductionCertificate(),
    Promise.resolve(auditDependencies()),
  ]);

  const blockers = [...launchDecision.blockers];
  const warnings = [...launchDecision.warnings];

  if (cert.architecture.status !== "ok") {
    blockers.push(`Architecture/Freeze Verification: ${cert.architecture.detail}`);
  }
  if (deps.criticalCount > 0) {
    blockers.push(`${deps.criticalCount} تبعية بمستوى خطورة حرج (critical) في auditDependencies()`);
  }
  if (deps.warningCount > 0) {
    warnings.push(
      `${deps.warningCount} تبعية بحاجة ترقية قبل الإصدار (xlsx/@tanstack/start-server-core/dompurify — راجع rc/dependencies.ts)`,
    );
  }

  const uniqueBlockers = Array.from(new Set(blockers));
  const uniqueWarnings = Array.from(new Set(warnings));

  let decision: FinalReleaseDecision;
  if (uniqueBlockers.length > 0) {
    decision = "NO_GO";
  } else if (launchDecision.decision === "GO" && cert.certification !== "not_certified") {
    decision = "GO";
  } else {
    decision = "BETA_ONLY";
  }

  const confidence: ConfidenceLevel =
    uniqueBlockers.length > 3
      ? "low"
      : uniqueBlockers.length > 0 || uniqueWarnings.length > 5
        ? "medium"
        : "high";

  const recommendation =
    decision === "GO"
      ? "لا عوائق حرجة، والشهادة والإطلاق كلاهما بحالة جيدة — جاهز للإطلاق الفعلي."
      : decision === "BETA_ONLY"
        ? "لا عوائق حرجة، لكن الشهادة النهائية لم تصل لمستوى الاعتماد الكامل بعد — يُنصح بـ Beta موسّعة حتى تُعالَج التحذيرات."
        : "عوائق حرجة قائمة (راجع القائمة أعلاه) — يجب معالجتها جميعاً قبل أي إطلاق، حتى التجريبي منه.";

  return {
    decision,
    confidence,
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
    recommendation,
    generatedAt: new Date().toISOString(),
  };
}
