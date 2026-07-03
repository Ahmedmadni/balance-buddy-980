// =============================================================
// PART 3 — auditIOSProduction()
// -------------------------------------------------------------
// Builds on release/ios-audit.ts's auditIOSRelease() — only ADDS the
// checks Prompt 27 asks for that weren't already covered: Apple
// Sign-In readiness, Push readiness, Associated Domains, Privacy
// Manifest, App Store Connect readiness. Grounded facts (2026-07-03):
// signInWithOAuth() in src/integrations/lovable/index.ts already
// accepts "apple" as a provider value, but src/routes/auth.tsx only
// wires up "google" in its UI — Apple Sign-In is reachable in the
// helper but not exposed to users yet. Push is entirely local/stub
// (NotificationProvider.sendPush is a Noop, no APNs/FCM integration
// — see src/lib/notifications/provider.ts).
// =============================================================
import { auditIOSRelease, type IOSReleaseCheckItem } from "@/lib/release/ios-audit";
import type { HealthStatus } from "@/lib/system/health";

// Static facts verified 2026-07-03 by reading src/routes/auth.tsx, src/integrations/lovable/index.ts,
// src/lib/notifications/provider.ts, and capacitor.config.ts directly.
const APPLE_PROVIDER_TYPE_SUPPORTED = true; // signInWithOAuth("apple", ...) is a valid call, just unused in UI
const APPLE_SIGNIN_WIRED_IN_UI = false; // auth.tsx only renders a Google button
const PUSH_HAS_REAL_PROVIDER = false; // NotificationProvider.sendPush has no APNs/FCM adapter, Noop only
const HAS_ASSOCIATED_DOMAINS = false; // no com.apple.developer.associated-domains entitlement configured
const HAS_PRIVACY_MANIFEST = false; // no PrivacyInfo.xcprivacy — no ios/ folder exists yet to hold one

export interface IOSProductionCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface IOSProductionAuditReport {
  items: IOSProductionCheckItem[];
  readyCount: number;
  totalCount: number;
  score: number;
  generatedAt: string;
}

function fromReleaseAudit(items: IOSReleaseCheckItem[]): IOSProductionCheckItem[] {
  return items.map(({ id, label, status, detail }) => ({ id, label, status, detail }));
}

export function auditIOSProduction(): IOSProductionAuditReport {
  const base = auditIOSRelease();

  const extraItems: IOSProductionCheckItem[] = [
    {
      id: "apple_signin",
      label: "Apple Sign-In Readiness",
      status: APPLE_SIGNIN_WIRED_IN_UI ? "ok" : "warning",
      detail: APPLE_PROVIDER_TYPE_SUPPORTED
        ? "signInWithOAuth('apple') مدعوم في طبقة المصادقة لكن غير مفعّل في واجهة auth.tsx (Google فقط حالياً) — قد يُطلب من Apple إن عُرضت طرق تسجيل اجتماعية أخرى"
        : "لا دعم لتسجيل الدخول عبر Apple",
    },
    {
      id: "push_readiness",
      label: "Push Readiness",
      status: "warning",
      detail: PUSH_HAS_REAL_PROVIDER
        ? "مزوّد إشعارات دفع حقيقي (APNs) مضبوط"
        : "NotificationProvider.sendPush() لا يزال Noop محلياً — لا تكامل APNs فعلي (متوقّع حسب قيود الجلسة: ممنوع إضافة SDK دفع حقيقي)",
    },
    {
      id: "associated_domains",
      label: "Associated Domains",
      status: HAS_ASSOCIATED_DOMAINS ? "ok" : "warning",
      detail: HAS_ASSOCIATED_DOMAINS
        ? "com.apple.developer.associated-domains مضبوط"
        : "لا Associated Domains مضبوطة — غير حرج للإطلاق الأول بلا Universal Links",
    },
    {
      id: "privacy_manifest",
      label: "Privacy Manifest",
      status: HAS_PRIVACY_MANIFEST ? "ok" : "error",
      detail: HAS_PRIVACY_MANIFEST
        ? "PrivacyInfo.xcprivacy موجود"
        : "لا PrivacyInfo.xcprivacy — إلزامي من Apple لأي تطبيق جديد يستخدم Required Reason APIs؛ لا يمكن إنشاؤه قبل وجود مجلد ios/ فعلي",
    },
    {
      id: "app_store_connect_readiness",
      label: "App Store Connect Readiness",
      status: "warning",
      detail:
        "لا حساب Apple Developer/App Store Connect متصل بهذه البيئة — يتطلّب جهاز macOS + Xcode + عضوية Apple Developer ($99/سنة) غير متوفرة في هذه الجلسة",
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
