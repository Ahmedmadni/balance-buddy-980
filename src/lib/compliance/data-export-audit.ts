// =============================================================
// PART 3 — auditUserDataExport()
// -------------------------------------------------------------
// STATIC audit grounded in reading src/lib/backup/engine.ts directly
// (2026-07-03). Real finding: engine.ts's private LOCAL_KEYS list
// declares 4 keys, but 2 of them don't match any localStorage key
// actually WRITTEN anywhere else in the app:
//   - "rasd.quickActions.v1" declared, but QuickActionsRow.tsx writes
//     to "dashboard.quickActions.v1" instead — mismatch, always empty.
//   - "rasd.ads.v1" declared, but ad-config.ts's real AD_PREFS_KEY is
//     "rasd.adPrefs.v1" — mismatch, always empty.
// Also entirely absent from LOCAL_KEYS: notification settings/log,
// beta feedback, beta sessions, audit log, error log. Backup Engine
// itself is out of scope to modify (Schema Freeze); this only reports
// the gap honestly.
// =============================================================
import type { HealthStatus } from "@/lib/system/health";

export interface DataExportCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface DataExportAuditReport {
  items: DataExportCheckItem[];
  score: number;
  generatedAt: string;
}

export function auditUserDataExport(): DataExportAuditReport {
  const items: DataExportCheckItem[] = [
    {
      id: "backup_json",
      label: "Backup JSON (بيانات Supabase)",
      status: "ok",
      detail:
        "exportUserData() يصدّر كل جداول المستخدم الـ17 عبر Supabase فعلياً في نطاق full — يعمل بشكل صحيح",
    },
    {
      id: "attachments",
      label: "Attachments (المرفقات)",
      status: "error",
      detail:
        "النسخة الاحتياطية تصدّر صفوف جدول attachments (المسارات فقط) لكن لا تُنزّل الملفات الفعلية من Supabase Storage — محتوى الملفات نفسه لا يُصدَّر أبداً",
    },
    {
      id: "notifications",
      label: "Notifications (الإعدادات والسجل)",
      status: "error",
      detail:
        "rasd.notificationSettings.v1 وrasd.notificationLog.v1 غير مدرجَين في LOCAL_KEYS بمحرك النسخ الاحتياطي — لا يُصدَّران في backup JSON إطلاقاً",
    },
    {
      id: "feedback",
      label: "Feedback (ملاحظات Beta)",
      status: "warning",
      detail:
        "rasd.betaFeedback.v1 غير مشمول في backup JSON العام، لكن يوجد مسار تصدير منفصل خاص به (زر تصدير JSON داخل لوحة الملاحظات في Settings > المساعدة)",
    },
    {
      id: "beta_sessions",
      label: "Beta Sessions (بيانات الاستخدام المحلية)",
      status: "error",
      detail:
        "rasd.betaSessions.v1 غير مشمول في backup JSON ولا يوجد أي مسار تصدير منفصل له حالياً",
    },
    {
      id: "preferences",
      label: "Preferences (التفضيلات)",
      status: "warning",
      detail:
        'localPrefs وreminderPrefs يُصدَّران بشكل صحيح (المفاتيح مطابقة)، لكن مفتاحي "rasd.quickActions.v1" و"rasd.ads.v1" المُعلَنين في LOCAL_KEYS لا يطابقان أي مفتاح حقيقي مكتوب فعلياً — تفضيلات الإجراءات السريعة (dashboard.quickActions.v1) والإعلانات (rasd.adPrefs.v1) تظهر في القائمة لكنها لا تُصدَّر فعلياً',
    },
  ];

  const okCount = items.filter((i) => i.status === "ok").length;
  return {
    items,
    score: Math.round((okCount / items.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
