// =============================================================
// PART 6 — generateSupportCertificate()
// -------------------------------------------------------------
// Composes auditSupportChannels() + generateSupportSLA() (this
// prompt) with auditSupportInfrastructure() (Prompt 27) — nothing
// here recomputes any of their underlying logic.
// =============================================================
import { auditSupportChannels } from "./channels";
import { generateSupportSLA } from "./sla";
import { auditSupportInfrastructure } from "@/lib/support/audit";
import type { HealthStatus } from "@/lib/system/health";

export interface SupportCertificate {
  channelsScore: number;
  infrastructureScore: number;
  slaTierCount: number;
  score: number;
  status: HealthStatus;
  generatedAt: string;
}

export async function generateSupportCertificate(): Promise<SupportCertificate> {
  const channels = auditSupportChannels();
  const sla = generateSupportSLA();
  const infrastructure = auditSupportInfrastructure();

  const score = Math.round((channels.score + infrastructure.score) / 2);
  const status: HealthStatus = score >= 90 ? "ok" : score >= 60 ? "warning" : "error";

  return {
    channelsScore: channels.score,
    infrastructureScore: infrastructure.score,
    slaTierCount: sla.tiers.length,
    score,
    status,
    generatedAt: new Date().toISOString(),
  };
}
