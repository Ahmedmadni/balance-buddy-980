// =============================================================
// PART 7 — Store Submission Assets Audit
// -------------------------------------------------------------
// Reuses generateStoreAssetsChecklist() (Prompt 22) for icon/feature
// graphic/screenshots rather than re-deriving those facts, and adds
// the 2 new checks this prompt asks for: promo assets and privacy
// screenshots (both genuinely missing — neither exists anywhere in
// this repo).
// =============================================================
import { generateStoreAssetsChecklist } from "@/lib/release/store-assets";
import type { HealthStatus } from "@/lib/system/health";

export interface StoreSubmissionAssetItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface StoreSubmissionAssetsAudit {
  android: StoreSubmissionAssetItem[];
  ios: StoreSubmissionAssetItem[];
  score: number;
  generatedAt: string;
}

export function auditStoreSubmissionAssets(): StoreSubmissionAssetsAudit {
  const storeAssets = generateStoreAssetsChecklist();

  const toItem = (i: {
    id: string;
    label: string;
    status: string;
    detail: string;
  }): StoreSubmissionAssetItem => ({
    id: i.id,
    label: i.label,
    status: i.status === "ready" ? "ok" : "error",
    detail: i.detail,
  });

  const promoAssets: StoreSubmissionAssetItem = {
    id: "promo_assets",
    label: "Promo Assets",
    status: "error",
    detail: "لا مواد ترويجية إضافية (بانرات، فيديو دعائي) محفوظة في المستودع بعد",
  };
  const privacyScreenshots: StoreSubmissionAssetItem = {
    id: "privacy_screenshots",
    label: "Privacy Screenshots",
    status: "error",
    detail:
      "لا لقطات شاشة مخصّصة لتوضيح ممارسات الخصوصية (مطلوبة أحياناً في نموذج أمان بيانات Play Console)",
  };

  const android = [...storeAssets.android.items.map(toItem), promoAssets, privacyScreenshots];
  const ios = [...storeAssets.ios.items.map(toItem), promoAssets, privacyScreenshots];

  const okCount = [...android, ...ios].filter((i) => i.status === "ok").length;
  const total = android.length + ios.length;

  return {
    android,
    ios,
    score: Math.round((okCount / total) * 100),
    generatedAt: new Date().toISOString(),
  };
}
