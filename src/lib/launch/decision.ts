// =============================================================
// PART 8 — generateFinalLaunchDecision()
// -------------------------------------------------------------
// Reuses evaluateRC2Decision() (Prompt 29) directly for blockers — a
// single unresolved critical condition from RC2 still forces NO_GO
// here, per this prompt's explicit rule, regardless of the final
// launch score.
// =============================================================
import { evaluateRC2Decision } from "@/lib/rc2/decision";
import { generateLaunchCertificate } from "./certificate";

export type FinalLaunchDecision = "GO" | "CONDITIONAL_GO" | "NO_GO";

export interface FinalLaunchDecisionReport {
  decision: FinalLaunchDecision;
  score: number;
  blockers: string[];
  warnings: string[];
  recommendation: string;
  generatedAt: string;
}

export async function generateFinalLaunchDecision(): Promise<FinalLaunchDecisionReport> {
  const [rc2Decision, cert] = await Promise.all([
    evaluateRC2Decision(),
    generateLaunchCertificate(),
  ]);

  const blockers = [...rc2Decision.blockers];
  const warnings = [...rc2Decision.warnings];

  let decision: FinalLaunchDecision;
  if (blockers.length > 0) {
    decision = "NO_GO";
  } else if (cert.final_score >= 90) {
    decision = "GO";
  } else {
    decision = "CONDITIONAL_GO";
  }

  const recommendation =
    decision === "NO_GO"
      ? "عوائق حرجة موروثة من RC2 لا تزال قائمة (راجع القائمة أعلاه) — يجب حلّها جميعاً؛ الرفع الفعلي للمتاجر خارج نطاق الكود من هنا (keystore، حساب Apple Developer، نطاق حقيقي)."
      : decision === "GO"
        ? "لا عوائق حرجة، والدرجة الإجمالية ممتازة — حزمة الإطلاق جاهزة."
        : "لا عوائق حرجة، لكن الدرجة الإجمالية متوسطة — يُنصح بمعالجة التحذيرات قبل الرفع الفعلي للمتاجر.";

  return {
    decision,
    score: cert.final_score,
    blockers,
    warnings,
    recommendation,
    generatedAt: new Date().toISOString(),
  };
}
