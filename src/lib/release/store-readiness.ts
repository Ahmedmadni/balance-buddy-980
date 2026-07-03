// =============================================================
// PART 7 — App Store Readiness
// -------------------------------------------------------------
// Every check below reuses an existing audit's real item — nothing
// here re-derives a fact already established by metadata-audit.ts,
// android-audit.ts, ios-audit.ts, or compliance-audit.ts.
// =============================================================
import { auditAppMetadata } from "./metadata-audit";
import { auditAndroidRelease } from "./android-audit";
import { auditIOSRelease } from "./ios-audit";
import { auditCompliance } from "./compliance-audit";
import { loadNotificationSettings } from "@/lib/notifications/config";
import type { HealthStatus } from "@/lib/system/health";

export interface StoreReadinessCheck {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface PlatformStoreReadiness {
  checks: StoreReadinessCheck[];
  score: number;
}

export interface StoreReadinessReport {
  android: PlatformStoreReadiness;
  ios: PlatformStoreReadiness;
  score: number;
  blockers: string[];
  warnings: string[];
  generatedAt: string;
}

function scoreOf(checks: StoreReadinessCheck[]): number {
  const ok = checks.filter((c) => c.status === "ok").length;
  return checks.length > 0 ? Math.round((ok / checks.length) * 100) : 0;
}

export async function auditStoreReadiness(): Promise<StoreReadinessReport> {
  const compliance = await auditCompliance();
  const metadata = auditAppMetadata();
  const androidRelease = auditAndroidRelease();
  const iosRelease = auditIOSRelease();
  const notifSettings = loadNotificationSettings();

  const privacyItem = metadata.items.find((i) => i.id === "privacy_policy_url");
  const termsItem = metadata.items.find((i) => i.id === "terms_url");
  const supportItem = metadata.items.find((i) => i.id === "support_url");
  const dataExportItem = compliance.items.find((i) => i.id === "data_export");
  const dataDeletionItem = compliance.items.find((i) => i.id === "data_deletion");
  const adsConsentItem = compliance.items.find((i) => i.id === "ads_consent");
  const backupRulesItem = androidRelease.items.find((i) => i.id === "backup_rules");
  const infoPlistItem = iosRelease.items.find((i) => i.id === "info_plist");

  // ----- Google Play -----
  const androidChecks: StoreReadinessCheck[] = [
    {
      id: "privacy_policy",
      label: "Privacy Policy",
      status: privacyItem?.status ?? "error",
      detail: privacyItem?.detail ?? "غير متاح",
    },
    {
      id: "data_safety",
      label: "Data Safety",
      status:
        dataExportItem?.status === "ok" && dataDeletionItem?.status === "ok" ? "ok" : "warning",
      detail: `تصدير البيانات: ${dataExportItem?.status ?? "؟"} — حذف البيانات: ${dataDeletionItem?.status ?? "؟"} — نموذج Data Safety في Play Console يحتاج تعبئة يدوية تطابق هذا`,
    },
    {
      id: "ads_declaration",
      label: "Ads Declaration",
      status: adsConsentItem?.status ?? "warning",
      detail: adsConsentItem?.detail ?? "غير متاح",
    },
    {
      id: "target_sdk",
      label: "Target SDK",
      status: "warning",
      detail:
        "لا مشروع Android أصلي بعد لقراءة targetSdkVersion من build.gradle — Capacitor 8 يضبطه تلقائياً عند الإضافة، لكن يجب التحقق يدوياً من مطابقته لأحدث متطلبات Google Play قبل الرفع",
    },
    {
      id: "backup",
      label: "Backup",
      status: backupRulesItem?.status ?? "warning",
      detail: backupRulesItem?.detail ?? "غير متاح",
    },
    {
      id: "notifications",
      label: "Notifications",
      status: notifSettings.enabled ? "ok" : "warning",
      detail: notifSettings.enabled ? "مفعّلة" : "معطّلة من الإعدادات",
    },
  ];

  // ----- Apple App Store -----
  const iosChecks: StoreReadinessCheck[] = [
    {
      id: "privacy_manifest",
      label: "Privacy Manifest (PrivacyInfo.xcprivacy)",
      status: infoPlistItem?.status === "error" ? "error" : "warning",
      detail: "تتطلبه Apple منذ 2024 لأي SDK يجمع بيانات — لا مشروع iOS أصلي بعد لإضافته",
    },
    {
      id: "att",
      label: "App Tracking Transparency (ATT)",
      status: "ok",
      detail: "لا تتبّع عبر تطبيقات/مواقع أخرى (IDFA) في هذا التطبيق — لا حاجة لطلب إذن ATT حالياً",
    },
    {
      id: "in_app_purchases",
      label: "In-App Purchases",
      status: "ok",
      detail:
        "لا مشتريات داخل التطبيق في هذا الإصدار — وضع Premium الحالي تفضيل محلي بلا فوترة فعلية",
    },
    {
      id: "notifications",
      label: "Notifications",
      status: notifSettings.enabled ? "ok" : "warning",
      detail: notifSettings.enabled ? "مفعّلة" : "معطّلة من الإعدادات",
    },
    {
      id: "account_deletion",
      label: "Account Deletion",
      status: "error",
      detail:
        "دليل Apple 5.1.1(v) يتطلب آلية حذف حساب فعلية داخل التطبيق — يوجد حالياً معاينة فقط (generateAccountDeletionReport)، بلا مسار تنفيذ فعلي",
    },
    {
      id: "legal_urls",
      label: "Legal URLs",
      status:
        privacyItem?.status === "ok" && termsItem?.status === "ok" && supportItem?.status === "ok"
          ? "ok"
          : "warning",
      detail: `Privacy: ${privacyItem?.status ?? "؟"} — Terms: ${termsItem?.status ?? "؟"} — Support: ${supportItem?.status ?? "؟"}`,
    },
  ];

  const android: PlatformStoreReadiness = { checks: androidChecks, score: scoreOf(androidChecks) };
  const ios_: PlatformStoreReadiness = { checks: iosChecks, score: scoreOf(iosChecks) };

  const blockers: string[] = [];
  const warnings: string[] = [];
  for (const c of [...androidChecks, ...iosChecks]) {
    if (c.status === "error") blockers.push(`${c.label}: ${c.detail}`);
    else if (c.status === "warning") warnings.push(`${c.label}: ${c.detail}`);
  }

  return {
    android,
    ios: ios_,
    score: Math.round((android.score + ios_.score) / 2),
    blockers,
    warnings,
    generatedAt: new Date().toISOString(),
  };
}
