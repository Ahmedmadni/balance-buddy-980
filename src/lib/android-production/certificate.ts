// =============================================================
// PART 1 — generateAndroidProductionCertificate()
// -------------------------------------------------------------
// Composes verifyAndroidSigning() + auditAndroidReleaseConfig() (this
// prompt) with auditAndroidProduction() (Prompt 27) — nothing here
// recomputes any of their underlying logic.
// =============================================================
import { verifyAndroidSigning } from "./keystore";
import { auditAndroidReleaseConfig } from "./release-config";
import { auditAndroidProduction } from "@/lib/android/audit";
import type { HealthStatus } from "@/lib/system/health";

export interface AndroidProductionCertificate {
  signingStatus: HealthStatus;
  releaseConfigScore: number;
  productionAuditScore: number;
  score: number;
  status: HealthStatus;
  generatedAt: string;
}

export async function generateAndroidProductionCertificate(): Promise<AndroidProductionCertificate> {
  const [signing, releaseConfig] = await Promise.all([
    verifyAndroidSigning(),
    Promise.resolve(auditAndroidReleaseConfig()),
  ]);
  const productionAudit = auditAndroidProduction();

  const signingScore = signing.status === "ok" ? 100 : 0;
  const scores = [signingScore, releaseConfig.score, productionAudit.score];
  const score = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
  const status: HealthStatus = score >= 90 ? "ok" : score >= 60 ? "warning" : "error";

  return {
    signingStatus: signing.status,
    releaseConfigScore: releaseConfig.score,
    productionAuditScore: productionAudit.score,
    score,
    status,
    generatedAt: new Date().toISOString(),
  };
}
