// =============================================================
// PART 8 — calculateRC2Score()
// -------------------------------------------------------------
// Pure composition over every audit built in PARTs 1-7 of this prompt
// plus Prompt 28's production certificate (RC1) — nothing here
// recomputes any of their underlying logic.
// =============================================================
import { generateAndroidProductionCertificate } from "@/lib/android-production/certificate";
import { generateIOSProductionCertificate } from "@/lib/ios-production/certificate";
import { auditBackupEncryption } from "@/lib/security/backup-encryption";
import { auditDependencySecurity } from "@/lib/security/dependencies";
import { generateSupportCertificate } from "@/lib/support-production/certificate";
import { generatePlayStoreSubmission } from "@/lib/store-submission/android";
import { generateAppStoreSubmission } from "@/lib/store-submission/ios";
import { generateProductionCertificate } from "@/lib/rc/production-certificate";

export interface RC2ScoreBreakdown {
  androidScore: number;
  iosScore: number;
  securityScore: number;
  supportScore: number;
  storeSubmissionScore: number;
  rc1Score: number;
  score: number;
  generatedAt: string;
}

export async function calculateRC2Score(): Promise<RC2ScoreBreakdown> {
  const [
    androidCert,
    iosCert,
    backupEncryption,
    depSecurity,
    supportCert,
    androidSubmission,
    iosSubmission,
    rc1Cert,
  ] = await Promise.all([
    generateAndroidProductionCertificate(),
    generateIOSProductionCertificate(),
    auditBackupEncryption(),
    auditDependencySecurity(),
    generateSupportCertificate(),
    generatePlayStoreSubmission(),
    generateAppStoreSubmission(),
    generateProductionCertificate(),
  ]);

  const depSecurityScore = Math.max(
    0,
    100 - depSecurity.criticalCount * 40 - depSecurity.warningCount * 10,
  );
  const securityScore = Math.round((backupEncryption.score + depSecurityScore) / 2);

  const androidSubmissionScore = Math.round(
    (androidSubmission.productionCertificateScore + androidSubmission.assetsScore) / 2,
  );
  const iosSubmissionScore = Math.round(
    (iosSubmission.productionCertificateScore + iosSubmission.assetsScore) / 2,
  );
  const storeSubmissionScore = Math.round((androidSubmissionScore + iosSubmissionScore) / 2);

  const componentScores = [
    androidCert.score,
    iosCert.score,
    securityScore,
    supportCert.score,
    storeSubmissionScore,
    rc1Cert.final_score,
  ];
  const score = Math.round(componentScores.reduce((s, v) => s + v, 0) / componentScores.length);

  return {
    androidScore: androidCert.score,
    iosScore: iosCert.score,
    securityScore,
    supportScore: supportCert.score,
    storeSubmissionScore,
    rc1Score: rc1Cert.final_score,
    score,
    generatedAt: new Date().toISOString(),
  };
}
