// =============================================================
// PART 7 — generateAppStoreSubmission()
// -------------------------------------------------------------
// Composes store/metadata.ts's Apple listing (Prompt 27),
// ios-production/certificate.ts (this prompt's PART 2), and
// auditStoreSubmissionAssets() (this prompt) — nothing here
// recomputes any of their logic.
// =============================================================
import { generateStoreMetadata } from "@/lib/store/metadata";
import { generateIOSProductionCertificate } from "@/lib/ios-production/certificate";
import { auditStoreSubmissionAssets } from "./assets";

export interface AppStoreSubmission {
  listingTitle: string;
  listingReady: boolean;
  productionCertificateScore: number;
  assetsScore: number;
  submissionReady: boolean;
  blockers: string[];
  generatedAt: string;
}

export async function generateAppStoreSubmission(): Promise<AppStoreSubmission> {
  const [metadata, productionCert] = await Promise.all([
    Promise.resolve(generateStoreMetadata()),
    generateIOSProductionCertificate(),
  ]);
  const assets = auditStoreSubmissionAssets();

  const blockers: string[] = [];
  if (!metadata.allCopyWithinLimits) blockers.push("نصوص القائمة تتجاوز حدود أحرف App Store");
  if (productionCert.projectScore < 100) blockers.push("لا مشروع Xcode/منصّة iOS مضافة بعد");
  if (assets.score < 100) blockers.push("أصول متجر ناقصة (لقطات شاشة/مواد ترويجية)");

  return {
    listingTitle: metadata.appleAppStore.title,
    listingReady: metadata.allCopyWithinLimits,
    productionCertificateScore: productionCert.score,
    assetsScore: assets.score,
    submissionReady: blockers.length === 0,
    blockers,
    generatedAt: new Date().toISOString(),
  };
}
