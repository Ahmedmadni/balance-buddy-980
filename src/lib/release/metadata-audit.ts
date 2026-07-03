// =============================================================
// PART 1 — auditAppMetadata()
// -------------------------------------------------------------
// Version is read live from its existing single source of truth
// (package.json via mobile/version.ts). App Name / Package Name mirror
// capacitor.config.ts (appName / appId) as STATIC facts verified by
// reading that file directly (2026-07-03) — not imported live, since
// capacitor.config.ts sits outside tsconfig's `include` and depends on
// @capacitor/cli types that aren't installed in every environment this
// runs in. Update these two constants by hand if capacitor.config.ts
// changes. Build Number and the 4 store-required URLs live in
// metadata-config.ts as placeholders.
// =============================================================
import { APP_VERSION } from "@/lib/mobile/version";
import {
  BUILD_NUMBER,
  PRIVACY_POLICY_URL,
  TERMS_URL,
  SUPPORT_URL,
  WEBSITE_URL,
  isPlaceholderUrl,
} from "./metadata-config";
import type { HealthStatus } from "@/lib/system/health";

// Static mirrors of capacitor.config.ts — verified 2026-07-03.
const APP_NAME_MIRROR = "رصد";
const PACKAGE_NAME_MIRROR = "app.lovable.rasd";

export interface MetadataAuditItem {
  id: string;
  label: string;
  value: string;
  status: HealthStatus;
  detail: string;
}

export interface AppMetadataAuditReport {
  items: MetadataAuditItem[];
  configuredCount: number;
  totalCount: number;
  score: number;
  generatedAt: string;
}

export function auditAppMetadata(): AppMetadataAuditReport {
  const appId = PACKAGE_NAME_MIRROR;
  const appName = APP_NAME_MIRROR;

  const items: MetadataAuditItem[] = [
    {
      id: "app_name",
      label: "App Name",
      value: appName,
      status: appName ? "ok" : "error",
      detail: appName ? "من capacitor.config.ts" : "appName غير مضبوط في capacitor.config.ts",
    },
    {
      id: "package_name",
      label: "Package Name / Bundle ID",
      value: appId,
      status: appId ? "ok" : "error",
      detail: !appId
        ? "appId غير مضبوط في capacitor.config.ts"
        : appId.includes("lovable")
          ? `${appId} — معرّف صالح وفريد، لكنه يحمل نطاق Lovable؛ يُفضّل نقله لنطاقك الخاص قبل النشر الفعلي على المتاجر`
          : "من capacitor.config.ts",
    },
    {
      id: "version",
      label: "Version",
      value: APP_VERSION,
      status: "ok",
      detail: "من package.json (مصدر الحقيقة الوحيد لعرض الإصدار في التطبيق)",
    },
    {
      id: "build_number",
      label: "Build Number",
      value: BUILD_NUMBER,
      status: "warning",
      detail:
        "قيمة أولية محلية في src/lib/release/metadata-config.ts — يجب مزامنتها يدوياً مع versionCode في android/app/build.gradle وCFBundleVersion في iOS عند إنشاء المنصّتين الأصليّتين",
    },
    {
      id: "privacy_policy_url",
      label: "Privacy Policy URL",
      value: PRIVACY_POLICY_URL,
      status: isPlaceholderUrl(PRIVACY_POLICY_URL) ? "error" : "ok",
      detail: isPlaceholderUrl(PRIVACY_POLICY_URL)
        ? "لا يزال placeholder — مطلوب إلزامياً لكل من Google Play وApp Store"
        : "مُعدّ",
    },
    {
      id: "terms_url",
      label: "Terms URL",
      value: TERMS_URL,
      status: isPlaceholderUrl(TERMS_URL) ? "error" : "ok",
      detail: isPlaceholderUrl(TERMS_URL) ? "لا يزال placeholder" : "مُعدّ",
    },
    {
      id: "support_url",
      label: "Support URL",
      value: SUPPORT_URL,
      status: isPlaceholderUrl(SUPPORT_URL) ? "warning" : "ok",
      detail: isPlaceholderUrl(SUPPORT_URL)
        ? "لا يزال placeholder — مطلوب في Google Play Console"
        : "مُعدّ",
    },
    {
      id: "website_url",
      label: "Website URL",
      value: WEBSITE_URL,
      status: isPlaceholderUrl(WEBSITE_URL) ? "warning" : "ok",
      detail: isPlaceholderUrl(WEBSITE_URL) ? "لا يزال placeholder" : "مُعدّ",
    },
  ];

  const configuredCount = items.filter((i) => i.status === "ok").length;
  return {
    items,
    configuredCount,
    totalCount: items.length,
    score: Math.round((configuredCount / items.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
