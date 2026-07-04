// =============================================================
// PART 7 — generateDisasterRecoveryPlan()
// -------------------------------------------------------------
// Composes auditDisasterRecovery() (Prompt 23) for readiness scoring
// with 6 concrete recovery procedures this prompt asks for — pure
// documentation, naming the real existing tool for each (importUserData(),
// Supabase Auth password reset, local storage re-seed, notification
// settings reset).
// =============================================================
import { auditDisasterRecovery } from "@/lib/compliance/disaster-recovery-audit";

export interface DisasterRecoveryProcedure {
  id: string;
  label: string;
  steps: string;
}

export interface DisasterRecoveryPlan {
  readinessScore: number;
  procedures: DisasterRecoveryProcedure[];
  generatedAt: string;
}

export async function generateDisasterRecoveryPlan(): Promise<DisasterRecoveryPlan> {
  const readiness = await auditDisasterRecovery();

  const procedures: DisasterRecoveryProcedure[] = [
    {
      id: "restore_backup",
      label: "Restore Backup",
      steps:
        "planImport(bundle) لمعاينة التغييرات، ثم importUserData(bundle, mode) — mode='merge' للدمج الآمن أو 'replace' لاستبدال كامل (backup/engine.ts، لم يُعدَّل)",
    },
    {
      id: "recover_user",
      label: "Recover User",
      steps:
        "إعادة تعيين كلمة مرور عبر تدفّق Supabase Auth القياسي (supabase.auth.resetPasswordForEmail) — لا حاجة لتدخل يدوي في قاعدة البيانات",
    },
    {
      id: "recover_device",
      label: "Recover Device",
      steps:
        "على جهاز جديد: تسجيل الدخول بنفس الحساب يُعيد كل بيانات Supabase تلقائياً (RLS)؛ البيانات المحلية فقط (rasd.*) تحتاج استيراد نسخة احتياطية يدوياً إن وُجدت",
    },
    {
      id: "recover_notifications",
      label: "Recover Notifications",
      steps:
        "saveNotificationSettings() بالقيم الافتراضية، أو حذف مفتاح rasd.notificationSettings.v1 يدوياً لإعادته للافتراضي، ثم processPendingNotifications() لإعادة فحص الأحداث القادمة",
    },
    {
      id: "recover_local_state",
      label: "Recover Local State",
      steps:
        "مسح مفاتيح rasd.*/dashboard.* من localStorage يعيد كل التفضيلات المحلية (إعلانات، Consent، تفضيلات) لقيمها الافتراضية الآمنة — لا يؤثر على بيانات Supabase",
    },
    {
      id: "recover_supabase",
      label: "Recover Supabase",
      steps:
        "لا صلاحية تدخل من العميل على مستوى المشروع (النسخ الاحتياطي لقاعدة البيانات نفسها من مسؤولية Supabase Cloud) — يتطلب فتح تذكرة دعم مع Supabase لاستعادة نقطة زمنية إن لزم",
    },
  ];

  return {
    readinessScore: readiness.score,
    procedures,
    generatedAt: new Date().toISOString(),
  };
}
