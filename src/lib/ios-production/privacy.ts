// =============================================================
// PART 2 — iOS Privacy Manifest Audit
// -------------------------------------------------------------
// STATIC facts verified by reading the actual app code (2026-07-04):
// no camera usage anywhere (no @capacitor/camera package installed;
// mobile/compatibility.ts's "camera" check is a browser mediaDevices
// capability probe, never wired into any feature), no biometric/Face
// ID usage, no App Tracking Transparency (no cross-app tracking SDK —
// no analytics SDK at all by design). Notification usage description
// is the one real, actually-needed Info.plist string once iOS exists.
// =============================================================
import type { HealthStatus } from "@/lib/system/health";

export interface IOSPrivacyCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface IOSPrivacyAudit {
  items: IOSPrivacyCheckItem[];
  score: number;
  generatedAt: string;
}

export function auditIOSPrivacy(): IOSPrivacyAudit {
  const items: IOSPrivacyCheckItem[] = [
    {
      id: "privacy_manifest",
      label: "PrivacyInfo.xcprivacy",
      status: "error",
      detail:
        "غير موجود — إلزامي من Apple منذ 2024 لأي تطبيق يستخدم Required Reason APIs، لا يمكن إنشاؤه قبل وجود مجلد ios/ فعلي",
    },
    {
      id: "tracking_usage",
      label: "Tracking Usage (App Tracking Transparency)",
      status: "ok",
      detail:
        "لا حاجة لـ NSUserTrackingUsageDescription — لا SDK تحليلات أو إعلانات يتتبّع عبر تطبيقات أخرى في هذا المشروع",
    },
    {
      id: "notification_usage",
      label: "Notification Usage",
      status: "warning",
      detail:
        "الإشعارات المحلية مبنية فعلياً (notifications/provider.ts) وتطلب إذن المتصفح بالفعل — نص NSUserNotificationsUsageDescription (اختياري) لم يُكتَب بعد لأن Info.plist غير موجود",
    },
    {
      id: "camera_usage",
      label: "Camera Usage",
      status: "ok",
      detail: "لا استخدام كاميرا فعلي في أي ميزة — لا حاجة لـ NSCameraUsageDescription",
    },
    {
      id: "biometric_usage",
      label: "Biometric Usage (Face ID/Touch ID)",
      status: "ok",
      detail: "لا مصادقة بيومترية في هذا التطبيق — لا حاجة لـ NSFaceIDUsageDescription",
    },
  ];

  const okCount = items.filter((i) => i.status === "ok").length;
  return {
    items,
    score: Math.round((okCount / items.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
