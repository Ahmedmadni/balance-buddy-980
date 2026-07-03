// =============================================================
// PART 2 — auditAndroidProduction()
// -------------------------------------------------------------
// Builds on release/android-audit.ts's auditAndroidRelease() rather than
// re-deriving package name/version/permissions/AdMob facts — this module
// only ADDS the checks Prompt 27 explicitly asks for that Prompt 22's
// audit didn't cover: App Bundle configuration, Signing configuration,
// Deep Links, Play Console readiness. Same static-fact convention: each
// constant below was verified once by reading capacitor.config.ts /
// MOBILE_BUILD.md / src/routes directly (2026-07-03), not re-scanned.
// =============================================================
import { auditAndroidRelease, type AndroidReleaseCheckItem } from "@/lib/release/android-audit";
import type { HealthStatus } from "@/lib/system/health";

// Static facts verified 2026-07-03 by reading capacitor.config.ts / MOBILE_BUILD.md / src/routes directly.
const HAS_AAB_BUILD_DOC = true; // MOBILE_BUILD.md documents `bundleRelease` / signed AAB steps
const HAS_SIGNING_KEYSTORE = false; // no committed keystore/keystore.properties — expected, must be generated per MOBILE_BUILD.md before first release build
const HAS_DEEP_LINK_ROUTES = false; // no android:autoVerify intent-filter / associated domain configured in capacitor.config.ts

export interface AndroidProductionCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface AndroidProductionAuditReport {
  items: AndroidProductionCheckItem[];
  readyCount: number;
  totalCount: number;
  score: number;
  generatedAt: string;
}

function fromReleaseAudit(items: AndroidReleaseCheckItem[]): AndroidProductionCheckItem[] {
  return items.map(({ id, label, status, detail }) => ({ id, label, status, detail }));
}

export function auditAndroidProduction(): AndroidProductionAuditReport {
  const base = auditAndroidRelease();

  const extraItems: AndroidProductionCheckItem[] = [
    {
      id: "app_bundle_config",
      label: "App Bundle Configuration",
      status: HAS_AAB_BUILD_DOC ? "warning" : "error",
      detail: HAS_AAB_BUILD_DOC
        ? "خطوات بناء AAB موثّقة في MOBILE_BUILD.md — لم يُبنَ AAB فعلياً بعد في هذه البيئة"
        : "لا توثيق لخطوات بناء AAB",
    },
    {
      id: "signing_config",
      label: "Signing Configuration",
      status: HAS_SIGNING_KEYSTORE ? "ok" : "error",
      detail: HAS_SIGNING_KEYSTORE
        ? "keystore موقّع موجود"
        : "لا keystore موقّع بعد — يجب توليده (keytool) وضبط android/keystore.properties قبل أي بناء AAB للنشر (راجع MOBILE_BUILD.md)",
    },
    {
      id: "deep_links",
      label: "Deep Links",
      status: HAS_DEEP_LINK_ROUTES ? "ok" : "warning",
      detail: HAS_DEEP_LINK_ROUTES
        ? "Deep Links مضبوطة عبر intent-filter مع autoVerify"
        : "لا Deep Links/App Links مضبوطة حالياً — التطبيق يعمل بمسار داخلي فقط (bottom-nav)، غير حرج للإطلاق الأول",
    },
    {
      id: "play_console_readiness",
      label: "Play Console Readiness",
      status: "warning",
      detail:
        "لا حساب Play Console متصل بهذه البيئة — قائمة المتجر، تصنيف المحتوى، ونموذج أمان البيانات يجب تعبئتها يدوياً في Play Console (انظر store/metadata.ts للمحتوى الجاهز)",
    },
  ];

  const items = [...fromReleaseAudit(base.items), ...extraItems];
  const readyCount = items.filter((i) => i.status === "ok").length;
  return {
    items,
    readyCount,
    totalCount: items.length,
    score: Math.round((readyCount / items.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
