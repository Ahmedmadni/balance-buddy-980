// =============================================================
// PART 4 — generateAppStorePackage()
// -------------------------------------------------------------
// Pure composition — reuses store/metadata.ts (Prompt 27, Apple
// listing copy), ios-production/privacy.ts (Prompt 29, privacy
// manifest/tracking), store/screenshots.ts (Prompt 27), and
// release/legal-links.ts + support/config.ts (support/legal URLs)
// directly. App Review Notes is the one new piece of real copy this
// module owns — honest instructions for Apple's reviewer given there
// is no demo account (the app requires a real Supabase sign-up).
// =============================================================
import { generateStoreMetadata } from "@/lib/store/metadata";
import { auditIOSPrivacy } from "@/lib/ios-production/privacy";
import { generateScreenshotsReport } from "@/lib/store/screenshots";
import { validateLegalLinks } from "@/lib/release/legal-links";
import { getSupportConfig } from "@/lib/support/config";

export const APP_REVIEW_NOTES = `تطبيق رصد لا يحتوي حساب تجريبي جاهز — يتطلب تسجيل حساب جديد بالبريد الإلكتروني عبر شاشة "إنشاء حساب" (Supabase Auth). لا حاجة لأي إعداد إضافي بعد التسجيل؛ التطبيق يعمل بالكامل بلا اشتراك مدفوع أو ميزات مقفلة تتطلب مراجعة خاصة.`;

export const AGE_RATING = "4+"; // no objectionable content; financial-management tool, no gambling/mature themes

export interface AppStorePackage {
  metadataReady: boolean;
  privacyManifestReady: boolean;
  screenshotsReady: boolean;
  ageRating: string;
  trackingDeclared: boolean;
  appReviewNotes: string;
  supportUrlReady: boolean;
  legalUrlsReady: boolean;
  submissionReady: boolean;
  blockers: string[];
  generatedAt: string;
}

export async function generateAppStorePackage(): Promise<AppStorePackage> {
  const metadata = generateStoreMetadata();
  const privacy = auditIOSPrivacy();
  const screenshots = generateScreenshotsReport();
  const legalLinks = validateLegalLinks();
  const support = getSupportConfig();

  const privacyManifestReady =
    privacy.items.find((i) => i.id === "privacy_manifest")?.status === "ok";
  const trackingDeclared = privacy.items.find((i) => i.id === "tracking_usage")?.status === "ok";
  const legalIds = ["privacy", "terms", "cookies", "data_export"];
  const legalUrlsReady = legalLinks.checks
    .filter((c) => legalIds.includes(c.id))
    .every((c) => c.status === "ok");
  const supportCheck = legalLinks.checks.find((c) => c.id === "support");
  const supportUrlReady = supportCheck?.status === "ok";

  const metadataReady = metadata.allCopyWithinLimits;
  const screenshotsReady = screenshots.ios.haveAny;

  const blockers: string[] = [];
  if (!metadataReady) blockers.push("نصوص القائمة تتجاوز حدود أحرف App Store");
  if (!privacyManifestReady) blockers.push("لا PrivacyInfo.xcprivacy — إلزامي من Apple");
  if (!screenshotsReady) blockers.push("لا لقطات شاشة iOS محفوظة بعد");
  if (!supportUrlReady) blockers.push(`رابط الدعم لا يزال placeholder: ${support.supportUrl}`);
  if (!legalUrlsReady) blockers.push("رابط قانوني واحد على الأقل غير سليم");

  return {
    metadataReady,
    privacyManifestReady,
    screenshotsReady,
    ageRating: AGE_RATING,
    trackingDeclared,
    appReviewNotes: APP_REVIEW_NOTES,
    supportUrlReady,
    legalUrlsReady,
    submissionReady: blockers.length === 0,
    blockers,
    generatedAt: new Date().toISOString(),
  };
}
