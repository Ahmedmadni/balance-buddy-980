// =============================================================
// PART 6 — generateProductionCertificate()
// -------------------------------------------------------------
// Builds directly on generateReleaseCertificate() (Prompt 26) for
// financial_engine/investments/depreciation/zakat/analytics/notifications/
// backups/compliance rather than recomputing any of them, and adds the
// 4 sections this prompt introduces: architecture (freeze verification),
// release (this RC's version manifest), security, and performance.
// =============================================================
import { generateReleaseCertificate, type CertificateSection } from "@/lib/release/certificate";
import { runFreezeVerification } from "./freeze";
import { auditSecurity } from "./security";
import { certifyPerformance } from "./performance";
import { generateReleaseCandidate } from "./certificate";

export type CertificationLevel = "gold" | "silver" | "bronze" | "not_certified";

export const CERTIFICATION_LABEL: Record<CertificationLevel, string> = {
  gold: "معتمد ذهبي (Gold) — جاهز للإطلاق الفعلي",
  silver: "معتمد فضي (Silver) — جاهز لـ Beta موسّع",
  bronze: "معتمد برونزي (Bronze) — جاهز لـ Closed Beta فقط",
  not_certified: "غير معتمد (Not Certified)",
};

export interface ProductionCertificate {
  architecture: CertificateSection;
  financial_engine: CertificateSection;
  investments: CertificateSection;
  depreciation: CertificateSection;
  zakat: CertificateSection;
  analytics: CertificateSection;
  notifications: CertificateSection;
  backups: CertificateSection;
  compliance: CertificateSection;
  release: CertificateSection;
  security: CertificateSection;
  performance: CertificateSection;
  final_score: number;
  certification: CertificationLevel;
  generatedAt: string;
}

function levelForScore(score: number): CertificationLevel {
  if (score >= 95) return "gold";
  if (score >= 85) return "silver";
  if (score >= 70) return "bronze";
  return "not_certified";
}

export async function generateProductionCertificate(): Promise<ProductionCertificate> {
  const [releaseCert, freeze, security, performance] = await Promise.all([
    generateReleaseCertificate(),
    Promise.resolve(runFreezeVerification()),
    auditSecurity(),
    certifyPerformance(),
  ]);
  const rc = generateReleaseCandidate();

  const architecture: CertificateSection = {
    status: freeze.allPassed ? "ok" : "error",
    score: freeze.allPassed
      ? 100
      : Math.round(
          (freeze.items.filter((i) => i.status === "ok").length / freeze.items.length) * 100,
        ),
    detail: `${freeze.items.filter((i) => i.status === "ok").length}/${freeze.items.length} محرك مجمَّد سليم`,
  };

  const release: CertificateSection = {
    status: "ok",
    score: 100,
    detail: `${rc.rc_version} — build ${rc.build.build_id}`,
  };

  const securitySection: CertificateSection = {
    status: security.score >= 90 ? "ok" : security.score >= 70 ? "warning" : "error",
    score: security.score,
    detail: `${security.score}/100`,
  };

  const performanceSection: CertificateSection = {
    status: performance.status,
    score: performance.score,
    detail: `${performance.score}/100`,
  };

  const allSections = [
    architecture,
    releaseCert.financial_engine,
    releaseCert.investments,
    releaseCert.depreciation,
    releaseCert.zakat,
    releaseCert.analytics,
    releaseCert.notifications,
    releaseCert.backup,
    releaseCert.compliance,
    release,
    securitySection,
    performanceSection,
  ];
  const final_score = Math.round(allSections.reduce((s, c) => s + c.score, 0) / allSections.length);

  return {
    architecture,
    financial_engine: releaseCert.financial_engine,
    investments: releaseCert.investments,
    depreciation: releaseCert.depreciation,
    zakat: releaseCert.zakat,
    analytics: releaseCert.analytics,
    notifications: releaseCert.notifications,
    backups: releaseCert.backup,
    compliance: releaseCert.compliance,
    release,
    security: securitySection,
    performance: performanceSection,
    final_score,
    certification: levelForScore(final_score),
    generatedAt: new Date().toISOString(),
  };
}
