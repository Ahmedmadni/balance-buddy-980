// =============================================================
// PART 8 — generateLaunchPackage()
// -------------------------------------------------------------
// The final composition layer: reuses generateProductionCertificate()
// (Prompt 28) directly for security/compliance/backups/notifications/
// release(RC1) rather than recomputing any of them a second time, adds
// generateRC2Certificate() (Prompt 29), auditObservability() (Prompt 27,
// monitoring), generateSupportCertificate() (Prompt 29),
// auditStoreReadiness() (Prompt 25), and the Android/iOS production
// certificates + release runbooks (Prompts 29-30).
// =============================================================
import { generateProductionCertificate } from "@/lib/rc/production-certificate";
import { generateRC2Certificate } from "@/lib/rc2/certificate";
import { auditObservability } from "@/lib/monitoring/audit";
import { generateSupportCertificate } from "@/lib/support-production/certificate";
import { auditStoreReadiness } from "@/lib/release/store-readiness";
import { generateAndroidProductionCertificate } from "@/lib/android-production/certificate";
import { generateIOSProductionCertificate } from "@/lib/ios-production/certificate";
import { generateAndroidReleaseRunbook } from "@/lib/runbooks/android";
import { generateIOSReleaseRunbook } from "@/lib/runbooks/ios";
import type { CertificateSection } from "@/lib/release/certificate";

export interface LaunchPackage {
  rc1: CertificateSection;
  rc2: CertificateSection;
  productionCertificate: CertificateSection;
  security: CertificateSection;
  compliance: CertificateSection;
  backup: CertificateSection;
  notifications: CertificateSection;
  support: CertificateSection;
  monitoring: CertificateSection;
  storeReadiness: CertificateSection;
  android: CertificateSection;
  ios: CertificateSection;
  generatedAt: string;
}

function statusFor(score: number): CertificateSection["status"] {
  return score >= 90 ? "ok" : score >= 60 ? "warning" : "error";
}

export async function generateLaunchPackage(): Promise<LaunchPackage> {
  const [
    productionCert,
    rc2Cert,
    observability,
    supportCert,
    storeReadiness,
    androidCert,
    iosCert,
    androidRunbook,
  ] = await Promise.all([
    generateProductionCertificate(),
    generateRC2Certificate(),
    auditObservability(),
    generateSupportCertificate(),
    auditStoreReadiness(),
    generateAndroidProductionCertificate(),
    generateIOSProductionCertificate(),
    generateAndroidReleaseRunbook(),
  ]);
  const iosRunbook = generateIOSReleaseRunbook();

  const monitoringOkCount = observability.categories.filter((c) => c.status === "ok").length;

  return {
    rc1: productionCert.release,
    rc2: {
      status: statusFor(rc2Cert.scores.score),
      score: rc2Cert.scores.score,
      detail: `${rc2Cert.rc_version} — ${rc2Cert.scores.score}/100`,
    },
    productionCertificate: {
      status: statusFor(productionCert.final_score),
      score: productionCert.final_score,
      detail: `${productionCert.certification} — ${productionCert.final_score}/100`,
    },
    security: productionCert.security,
    compliance: productionCert.compliance,
    backup: productionCert.backups,
    notifications: productionCert.notifications,
    support: {
      status: statusFor(supportCert.score),
      score: supportCert.score,
      detail: `${supportCert.score}/100`,
    },
    monitoring: {
      status: statusFor(observability.score),
      score: observability.score,
      detail: `${monitoringOkCount}/${observability.categories.length} فئة رصد سليمة`,
    },
    storeReadiness: {
      status: statusFor(storeReadiness.score),
      score: storeReadiness.score,
      detail: `${storeReadiness.score}/100`,
    },
    android: {
      status: androidCert.status,
      score: androidCert.score,
      detail: `${androidCert.score}/100 — ${androidRunbook.completedCount}/${androidRunbook.totalCount} خطوة تشغيل مكتملة`,
    },
    ios: {
      status: iosCert.status,
      score: iosCert.score,
      detail: `${iosCert.score}/100 — ${iosRunbook.completedCount}/${iosRunbook.totalCount} خطوة تشغيل مكتملة`,
    },
    generatedAt: new Date().toISOString(),
  };
}
