// =============================================================
// PART 4 — auditSecurity()
// -------------------------------------------------------------
// Composes existing reports (auditConsentManager(), auditAccountDeletion(),
// auditPWA()) directly rather than re-deriving their logic. localStorage
// usage, auth handling, backup encryption, and notification permissions
// are STATIC facts verified by reading the actual source (2026-07-04) —
// there is no live way to introspect "is the JWT in localStorage
// XSS-exposed" from inside the same origin that would be attacking it.
// =============================================================
import { auditConsentManager } from "@/lib/consent/audit";
import { auditAccountDeletion } from "@/lib/account-deletion/audit";
import { auditPWA } from "@/lib/release/pwa-audit";
import type { HealthStatus } from "@/lib/system/health";

export interface SecurityCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface SecurityAuditReport {
  items: SecurityCheckItem[];
  score: number;
  generatedAt: string;
}

export async function auditSecurity(): Promise<SecurityAuditReport> {
  const [consent, accountDeletion, pwa] = await Promise.all([
    Promise.resolve(auditConsentManager()),
    auditAccountDeletion(),
    auditPWA(),
  ]);
  const notifPermission =
    typeof Notification !== "undefined" ? Notification.permission : "unsupported";
  const accountDeletionOk = accountDeletion.items.every((i) => i.status !== "error");
  const swRegistered = pwa.items.find((i) => i.id === "service_worker")?.status === "ok";

  const items: SecurityCheckItem[] = [
    {
      id: "local_storage_usage",
      label: "استخدام localStorage",
      status: "warning",
      detail:
        "جلسة Supabase Auth (JWT) وتفضيلات الموافقة وكل سجلات النظام مخزَّنة في localStorage غير مشفَّر — معرّض نظرياً لأي XSS ناجح في نفس الأصل (Origin)؛ لا آلية Same-Site cookie/httpOnly بديلة في هذا المعمار (TanStack Start SPA + Supabase JS client القياسي)",
    },
    {
      id: "auth_handling",
      label: "معالجة المصادقة",
      status: "ok",
      detail:
        "Supabase Auth مع persistSession + autoRefreshToken، وRow Level Security (auth.uid() = user_id) على كل الجداول — لا صلاحيات service_role في أي كود عميل",
    },
    {
      id: "consent_handling",
      label: "معالجة الموافقات",
      status: consent.record.bannerShown ? "ok" : "warning",
      detail: `${consent.score}/100 عبر auditConsentManager() — ${consent.record.bannerShown ? "قرار مُتَّخذ فعلياً" : "لم يُعرَض على المستخدم قراراً بعد"}`,
    },
    {
      id: "backup_encryption",
      label: "تشفير النسخ الاحتياطي",
      status: "warning",
      detail:
        "لا تشفير على الإطلاق — تصدير JSON/CSV/XLSX نصي صِرف (موثَّق صراحة في تعليق backup/engine.ts). خطر حقيقي إن حُفظ الملف في مكان غير آمن على الجهاز",
    },
    {
      id: "account_deletion_flow",
      label: "تدفّق حذف الحساب",
      status: accountDeletionOk ? "ok" : "warning",
      detail:
        "معاينة كاملة بلا تنفيذ فعلي، تتطلب كتابة نص تأكيد صريح (AccountDeletionDialog) — لا زر حذف حقيقي يتصل بـ Supabase Admin API من العميل",
    },
    {
      id: "service_worker",
      label: "Service Worker",
      status: swRegistered ? "ok" : "warning",
      detail: swRegistered
        ? "مسجَّل فعلياً ويخدم أصول ثابتة فقط — لا اعتراض لطلبات API حساسة"
        : "غير مسجَّل بعد في هذه الجلسة (يُسجَّل تلقائياً عند فتح أي صفحة على الويب)",
    },
    {
      id: "notification_permissions",
      label: "أذونات الإشعارات",
      status: notifPermission === "granted" ? "ok" : "warning",
      detail: `Notification.permission = "${notifPermission}" — يُطلَب صراحة عبر Notification.requestPermission() فقط عند الحاجة الفعلية، لا طلب تلقائي عند تحميل الصفحة`,
    },
  ];

  const okCount = items.filter((i) => i.status === "ok").length;
  return {
    items,
    score: Math.round((okCount / items.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
