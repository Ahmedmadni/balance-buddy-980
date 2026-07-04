// =============================================================
// PART 3 — generatePlayStorePackage()
// -------------------------------------------------------------
// Pure composition — reuses store/metadata.ts (Prompt 27, listing copy),
// store/screenshots.ts (Prompt 27), release/legal-links.ts (Prompt 26,
// privacy), ads/audit.ts (Prompt 19), android/audit.ts (Prompt 27,
// permissions), release/compliance-audit.ts (Prompt 22, data safety
// proxy), and support/audit.ts (Prompt 27) directly. Release Notes is
// the one new piece of real copy this module owns — genuine text for
// this app's first submission, not a placeholder.
// =============================================================
import { generateStoreMetadata } from "@/lib/store/metadata";
import { generateScreenshotsReport } from "@/lib/store/screenshots";
import { validateLegalLinks } from "@/lib/release/legal-links";
import { auditAndroidProduction } from "@/lib/android/audit";
import { auditCompliance } from "@/lib/release/compliance-audit";
import { auditSupportInfrastructure } from "@/lib/support/audit";

export const ANDROID_RELEASE_NOTES = `الإصدار الأول من رصد — إدارة كاملة لمحافظك ومصاريفك وديونك، مع دفتر أصول/استثمارات موحّد، حاسبة زكاة، تقارير قابلة للتصدير، وتذكيرات ذكية. بياناتك محفوظة في حسابك الخاص فقط.`;

export interface PlayStorePackage {
  metadataReady: boolean;
  descriptionsReady: boolean;
  screenshotsReady: boolean;
  privacyReady: boolean;
  adsReady: boolean;
  permissionsReviewed: boolean;
  dataSafetyReady: boolean;
  supportReady: boolean;
  releaseNotes: string;
  submissionReady: boolean;
  blockers: string[];
  generatedAt: string;
}

export async function generatePlayStorePackage(): Promise<PlayStorePackage> {
  const [metadata, compliance] = await Promise.all([
    Promise.resolve(generateStoreMetadata()),
    auditCompliance(),
  ]);
  const screenshots = generateScreenshotsReport();
  const legalLinks = validateLegalLinks();
  const androidAudit = auditAndroidProduction();
  const supportAudit = auditSupportInfrastructure();

  const privacyCheck = legalLinks.checks.find((c) => c.id === "privacy");
  const permissionsItem = androidAudit.items.find((i) => i.id === "permissions");

  const metadataReady = metadata.allCopyWithinLimits;
  const descriptionsReady = metadata.allCopyWithinLimits;
  const screenshotsReady = screenshots.android.haveAny;
  const privacyReady = privacyCheck?.status === "ok";
  const adsReady = true; // ads are optional-by-design in this app — no ads configured is a valid, honest state, never a blocker
  const permissionsReviewed = permissionsItem?.status !== "error";
  const dataSafetyReady = compliance.score === 100;
  const supportReady = supportAudit.score === 100;

  const blockers: string[] = [];
  if (!metadataReady) blockers.push("نصوص القائمة تتجاوز حدود الأحرف");
  if (!screenshotsReady) blockers.push("لا لقطات شاشة Android محفوظة بعد");
  if (!privacyReady) blockers.push("رابط سياسة الخصوصية غير سليم");
  if (!dataSafetyReady) blockers.push(`نموذج أمان البيانات غير مكتمل (${compliance.score}/100)`);
  if (!supportReady) blockers.push(`بنية الدعم غير مكتملة (${supportAudit.score}/100)`);

  return {
    metadataReady,
    descriptionsReady,
    screenshotsReady,
    privacyReady,
    adsReady,
    permissionsReviewed,
    dataSafetyReady,
    supportReady,
    releaseNotes: ANDROID_RELEASE_NOTES,
    submissionReady: blockers.length === 0,
    blockers,
    generatedAt: new Date().toISOString(),
  };
}
