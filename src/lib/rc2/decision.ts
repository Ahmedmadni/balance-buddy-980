// =============================================================
// PART 8 — evaluateRC2Decision()
// -------------------------------------------------------------
// Reuses evaluateFinalReleaseDecision() (Prompt 28 — RC1's terminal
// decision) directly for blockers rather than re-deriving them: if a
// single critical condition failed for RC1, it still fails for RC2,
// and the decision must be NO_GO per this prompt's explicit rule.
// =============================================================
import { evaluateFinalReleaseDecision } from "@/lib/rc/decision";
import { generateRC2Certificate } from "./certificate";
import { generatePlayStoreSubmission } from "@/lib/store-submission/android";
import { generateAppStoreSubmission } from "@/lib/store-submission/ios";

export type RC2Decision = "CERTIFIED" | "CONDITIONAL" | "NOT_CERTIFIED" | "NO_GO";

export interface RC2DecisionReport {
  decision: RC2Decision;
  score: number;
  blockers: string[];
  warnings: string[];
  recommendation: string;
  generatedAt: string;
}

export async function evaluateRC2Decision(): Promise<RC2DecisionReport> {
  const [rc1Decision, rc2Cert, androidSubmission, iosSubmission] = await Promise.all([
    evaluateFinalReleaseDecision(),
    generateRC2Certificate(),
    generatePlayStoreSubmission(),
    generateAppStoreSubmission(),
  ]);

  const blockers = [...rc1Decision.blockers];
  const warnings = [...rc1Decision.warnings];

  if (!androidSubmission.submissionReady) {
    warnings.push(...androidSubmission.blockers.map((b) => `Android Submission: ${b}`));
  }
  if (!iosSubmission.submissionReady) {
    warnings.push(...iosSubmission.blockers.map((b) => `iOS Submission: ${b}`));
  }

  const uniqueBlockers = Array.from(new Set(blockers));
  const uniqueWarnings = Array.from(new Set(warnings));

  let decision: RC2Decision;
  if (uniqueBlockers.length > 0) {
    decision = "NO_GO";
  } else if (rc2Cert.scores.score >= 90) {
    decision = "CERTIFIED";
  } else if (rc2Cert.scores.score >= 70) {
    decision = "CONDITIONAL";
  } else {
    decision = "NOT_CERTIFIED";
  }

  const recommendation =
    decision === "NO_GO"
      ? "عوائق حرجة موروثة من RC1 لا تزال قائمة (راجع القائمة أعلاه) — يجب حلّها جميعاً قبل أي اعتماد RC2، مهما ارتفعت الدرجة الإجمالية."
      : decision === "CERTIFIED"
        ? "لا عوائق حرجة، والدرجة الإجمالية ممتازة — RC2 معتمد للإطلاق الفعلي."
        : decision === "CONDITIONAL"
          ? "لا عوائق حرجة، لكن الدرجة الإجمالية متوسطة — RC2 معتمد بشرط معالجة التحذيرات أولاً."
          : "لا عوائق حرجة، لكن الدرجة الإجمالية منخفضة — يحتاج تحسينات جوهرية قبل اعتباره RC معتمداً.";

  return {
    decision,
    score: rc2Cert.scores.score,
    blockers: uniqueBlockers,
    warnings: uniqueWarnings,
    recommendation,
    generatedAt: new Date().toISOString(),
  };
}
