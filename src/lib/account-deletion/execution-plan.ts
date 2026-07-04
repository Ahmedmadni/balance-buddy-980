// =============================================================
// PART 3 — Account Deletion Execution Architecture
// -------------------------------------------------------------
// STRICTLY DOCUMENTATION: executable is always false, no service_role
// key exists client-side, nothing is deleted. Composes Prompt 27's
// generateServerDeletionSpec()/generateSupabaseDeletionPlan() directly
// into the 6 categories this prompt asks for, rather than redeclaring
// their step lists a second time.
// =============================================================
import { generateServerDeletionSpec, generateSupabaseDeletionPlan } from "./execution";

export type DeletionExecutionCategoryId =
  | "auth"
  | "storage"
  | "database"
  | "notification"
  | "backup"
  | "audit";

export interface DeletionExecutionCategory {
  id: DeletionExecutionCategoryId;
  label: string;
  detail: string;
}

export interface AccountDeletionExecutionPlan {
  categories: DeletionExecutionCategory[];
  executable: false;
  requires_service_role: true;
  generatedAt: string;
}

export function buildDeletionExecutionPlan(): AccountDeletionExecutionPlan {
  const serverSpec = generateServerDeletionSpec();
  const supabasePlan = generateSupabaseDeletionPlan();

  const categories: DeletionExecutionCategory[] = [
    {
      id: "auth",
      label: "حذف حساب المصادقة (Auth)",
      detail:
        serverSpec.steps.find((s) => s.id === "delete_auth_user")?.detail ??
        "supabase.auth.admin.deleteUser(userId) — يتطلّب service_role",
    },
    {
      id: "storage",
      label: "حذف كائنات Storage",
      detail:
        serverSpec.steps.find((s) => s.id === "delete_storage_objects")?.detail ??
        "storage.from('attachments').remove([...]) لكل مسار مرتبط بالمستخدم",
    },
    {
      id: "database",
      label: "حذف صفوف قاعدة البيانات",
      detail: `${supabasePlan.tables.length} جدولاً بالترتيب العكسي لتبعيّات المفاتيح الأجنبية (راجع generateSupabaseDeletionPlan())`,
    },
    {
      id: "notification",
      label: "حذف بيانات الإشعارات المحلية",
      detail:
        "مسح مفاتيح rasd.notificationSettings.v1 وrasd.notificationLog.v1 من localStorage الجهاز",
    },
    {
      id: "backup",
      label: "حذف النسخ الاحتياطية",
      detail:
        "لا نسخ سحابية آلية لحذفها (Backup Engine محلي بالكامل بالتصميم) — النسخة المحلية المخبَّأة (IndexedDB) تُمسح ضمن مسح بيانات الجهاز",
    },
    {
      id: "audit",
      label: "تسجيل تدقيق منفصل",
      detail:
        serverSpec.steps.find((s) => s.id === "audit_log")?.detail ??
        "سجل خارج قاعدة بيانات المستخدم يوثّق من/متى/كم صفاً حُذف",
    },
  ];

  return {
    categories,
    executable: false,
    requires_service_role: true,
    generatedAt: new Date().toISOString(),
  };
}
