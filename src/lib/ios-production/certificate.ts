// =============================================================
// PART 2 — generateIOSProductionCertificate()
// -------------------------------------------------------------
// Composes auditIOSProject() + auditIOSPrivacy() (this prompt) with
// auditIOSProduction() (Prompt 27) — nothing here recomputes any of
// their underlying logic.
// =============================================================
import { auditIOSProject } from "./project";
import { auditIOSPrivacy } from "./privacy";
import { auditIOSProduction } from "@/lib/ios/audit";
import type { HealthStatus } from "@/lib/system/health";

export interface IOSProductionCertificate {
  projectScore: number;
  privacyScore: number;
  productionAuditScore: number;
  score: number;
  status: HealthStatus;
  generatedAt: string;
}

export async function generateIOSProductionCertificate(): Promise<IOSProductionCertificate> {
  const project = auditIOSProject();
  const privacy = auditIOSPrivacy();
  const productionAudit = auditIOSProduction();

  const scores = [project.score, privacy.score, productionAudit.score];
  const score = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  const status: HealthStatus = score >= 90 ? "ok" : score >= 60 ? "warning" : "error";

  return {
    projectScore: project.score,
    privacyScore: privacy.score,
    productionAuditScore: productionAudit.score,
    score,
    status,
    generatedAt: new Date().toISOString(),
  };
}
