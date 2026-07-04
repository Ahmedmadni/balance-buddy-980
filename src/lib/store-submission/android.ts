// =============================================================
// PART 7 — generatePlayStoreSubmission()
// -------------------------------------------------------------
// Composes store/metadata.ts's Google Play listing (Prompt 27),
// android-production/certificate.ts (this prompt's PART 1), and
// auditStoreSubmissionAssets() (this prompt) into one submission
// package summary — nothing here recomputes any of their logic.
// =============================================================
import { generateStoreMetadata } from "@/lib/store/metadata";
import { generateAndroidProductionCertificate } from "@/lib/android-production/certificate";
import { auditStoreSubmissionAssets } from "./assets";

export interface PlayStoreSubmission {
  listingTitle: string;
  listingReady: boolean;
  productionCertificateScore: number;
  assetsScore: number;
  submissionReady: boolean;
  blockers: string[];
  generatedAt: string;
}

export async function generatePlayStoreSubmission(): Promise<PlayStoreSubmission> {
  const [metadata, productionCert] = await Promise.all([
    Promise.resolve(generateStoreMetadata()),
    generateAndroidProductionCertificate(),
  ]);
  const assets = auditStoreSubmissionAssets();

  const blockers: string[] = [];
  if (!metadata.allCopyWithinLimits) blockers.push("نصوص القائمة تتجاوز حدود أحرف Google Play");
  if (productionCert.signingStatus !== "ok") blockers.push("لا keystore توقيع Android جاهز");
  if (assets.score < 100) blockers.push("أصول متجر ناقصة (لقطات شاشة/رسم مميز/مواد ترويجية)");

  return {
    listingTitle: metadata.googlePlay.title,
    listingReady: metadata.allCopyWithinLimits,
    productionCertificateScore: productionCert.score,
    assetsScore: assets.score,
    submissionReady: blockers.length === 0,
    blockers,
    generatedAt: new Date().toISOString(),
  };
}
