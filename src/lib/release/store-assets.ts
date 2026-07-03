// =============================================================
// PART 5 — generateStoreAssetsChecklist()
// -------------------------------------------------------------
// STATIC audit grounded in what actually exists in the repo
// (resources/icon.png, resources/splash.png) plus the Privacy Policy
// URL from metadata-config.ts (reused, not re-checked with new logic).
// =============================================================
import { PRIVACY_POLICY_URL, isPlaceholderUrl } from "./metadata-config";

export type StoreAssetStatus = "ready" | "missing";

export interface StoreAssetItem {
  id: string;
  label: string;
  status: StoreAssetStatus;
  detail: string;
}

export interface StoreAssetsGroup {
  platform: "android" | "ios";
  items: StoreAssetItem[];
  readyCount: number;
  totalCount: number;
}

export interface StoreAssetsChecklistReport {
  android: StoreAssetsGroup;
  ios: StoreAssetsGroup;
  generatedAt: string;
}

function group(platform: "android" | "ios", items: StoreAssetItem[]): StoreAssetsGroup {
  return {
    platform,
    items,
    readyCount: items.filter((i) => i.status === "ready").length,
    totalCount: items.length,
  };
}

export function generateStoreAssetsChecklist(): StoreAssetsChecklistReport {
  const privacyReady = !isPlaceholderUrl(PRIVACY_POLICY_URL);

  const android: StoreAssetItem[] = [
    {
      id: "icon",
      label: "Icon",
      status: "ready",
      detail:
        "resources/icon.png (1024×1024) — يُولَّد منه Play Store icon (512×512) تلقائياً عبر bun run android:assets",
    },
    {
      id: "feature_graphic",
      label: "Feature Graphic (1024×500)",
      status: "missing",
      detail:
        "لا ملف مصدر — مطلوب لصفحة متجر Google Play، يُصمَّم يدوياً (ليس جزءاً من resources/ الحالية)",
    },
    {
      id: "screenshots",
      label: "Screenshots",
      status: "missing",
      detail: "لا لقطات شاشة محفوظة في المستودع — Google Play يتطلب لقطتين على الأقل",
    },
    {
      id: "privacy_policy",
      label: "Privacy Policy",
      status: privacyReady ? "ready" : "missing",
      detail: privacyReady
        ? "رابط مُعدّ"
        : "PRIVACY_POLICY_URL لا يزال placeholder في src/lib/release/metadata-config.ts — إلزامي في Play Console",
    },
    {
      id: "short_description",
      label: "Short Description",
      status: "missing",
      detail: "لا نص وصف قصير (≤80 حرف) محفوظ في المشروع بعد",
    },
    {
      id: "long_description",
      label: "Long Description",
      status: "missing",
      detail: "لا نص وصف طويل (≤4000 حرف) محفوظ في المشروع بعد",
    },
  ];

  const ios: StoreAssetItem[] = [
    {
      id: "icon",
      label: "Icon",
      status: "ready",
      detail: "resources/icon.png (1024×1024) صالح كمصدر لأيقونة App Store (1024×1024 بلا شفافية)",
    },
    {
      id: "screenshots",
      label: "Screenshots",
      status: "missing",
      detail: 'لا لقطات شاشة محفوظة — App Store يتطلب مقاسات لكل حجم جهاز مدعوم (6.7"، 6.5"، إلخ)',
    },
    {
      id: "app_preview",
      label: "App Preview (فيديو)",
      status: "missing",
      detail: "اختياري في App Store لكن غير موجود — يرفع معدّل التحويل عادةً",
    },
    {
      id: "privacy_policy",
      label: "Privacy Policy",
      status: privacyReady ? "ready" : "missing",
      detail: privacyReady ? "رابط مُعدّ" : "إلزامي أيضاً في App Store Connect",
    },
    {
      id: "metadata",
      label: "Metadata (الاسم/الفئة/الكلمات المفتاحية)",
      status: "missing",
      detail: "لا بيانات وصفية لـ App Store Connect محفوظة في المشروع بعد",
    },
  ];

  return {
    android: group("android", android),
    ios: group("ios", ios),
    generatedAt: new Date().toISOString(),
  };
}
