// =============================================================
// PART 6 — Real Account Deletion Execution Plan (documentation only)
// -------------------------------------------------------------
// STRICTLY DOCUMENTATION: no service_role key exists client-side, no
// network call is made, nothing is deleted. This module describes what
// would need to be BUILT (a server-side Edge Function) to perform real
// account deletion in the future — distinct from flow.ts's PART 1
// (which plans/exports the CLIENT-visible preview using only the
// anon/authenticated client). Reuses DB_TABLES from
// compliance/data-deletion-plan.ts as the authoritative table list
// rather than redeclaring it a third time.
// =============================================================
import { DB_TABLES, LOCAL_STORAGE_KEYS } from "@/lib/compliance/data-deletion-plan";

export interface ServerDeletionSpecStep {
  id: string;
  order: number;
  label: string;
  detail: string;
}

export interface ServerDeletionSpec {
  summary: string;
  requiresServiceRole: true;
  steps: ServerDeletionSpecStep[];
  generatedAt: string;
}

/** What a future server-side deletion handler would need to do — never executed here. */
export function generateServerDeletionSpec(): ServerDeletionSpec {
  const steps: ServerDeletionSpecStep[] = [
    {
      id: "verify_identity",
      order: 1,
      label: "التحقق من هوية الطالب",
      detail:
        "التحقق من Authorization: Bearer JWT الخاص بالمستخدم قبل قبول الطلب — لا يُقبل الطلب بدون جلسة صالحة",
    },
    {
      id: "reauth_confirmation",
      order: 2,
      label: "طلب تأكيد إعادة مصادقة",
      detail: "طلب كلمة المرور أو رمز تأكيد حديث (خلال آخر 5 دقائق) قبل تنفيذ حذف نهائي",
    },
    {
      id: "delete_storage_objects",
      order: 3,
      label: "حذف كائنات Storage",
      detail: "storage.from('attachments').remove([...]) لكل مسار مرتبط بالمستخدم قبل حذف الصفوف",
    },
    {
      id: "delete_table_rows",
      order: 4,
      label: "حذف صفوف الجداول بالترتيب العكسي للتبعيات",
      detail: `${DB_TABLES.length} جدولاً — يبدأ بالجداول التابعة (attachments، zakat_records) وينتهي بالجداول الجذرية (profiles)`,
    },
    {
      id: "delete_auth_user",
      order: 5,
      label: "حذف حساب Supabase Auth",
      detail:
        "supabase.auth.admin.deleteUser(userId) — يتطلّب service_role، لا يمكن تنفيذه من العميل مطلقاً",
    },
    {
      id: "audit_log",
      order: 6,
      label: "تسجيل الحذف في سجل تدقيق منفصل",
      detail: "سجل خارج قاعدة بيانات المستخدم (لأنها ستُحذف) يوثّق: من، متى، وعدد الصفوف المحذوفة",
    },
  ];

  return {
    summary:
      "خطة توثيقية فقط لما يحتاجه محرك حذف فعلي مستقبلي على الخادم — لا تنفيذ فعلي، لا service_role، لا استدعاء شبكة",
    requiresServiceRole: true,
    steps,
    generatedAt: new Date().toISOString(),
  };
}

export interface SupabaseDeletionPlanTable {
  table: string;
  order: number;
  reason: string;
}

export interface SupabaseDeletionPlan {
  tables: SupabaseDeletionPlanTable[];
  localStorageKeys: string[];
  generatedAt: string;
}

/** Concrete per-table deletion order respecting FK dependencies — documentation only. */
export function generateSupabaseDeletionPlan(): SupabaseDeletionPlan {
  // Leaf tables (reference other user tables) first, root tables last —
  // mirrors the FK graph established across supabase/migrations/*.
  const orderedLeafFirst = [
    "attachments",
    "zakat_records",
    "zakat_settings",
    "depreciation_profiles",
    "asset_market_values",
    "investment_transactions",
    "investments",
    "system_events",
    "person_ledger",
    "recurring_expenses",
    "expenses",
    "wallet_transactions",
    "wallets",
    "projects",
    "contacts",
    "wallet_tx_categories",
    "categories",
    "profiles",
  ] as const;

  const tables: SupabaseDeletionPlanTable[] = orderedLeafFirst.map((table, i) => ({
    table,
    order: i + 1,
    reason:
      i === orderedLeafFirst.length - 1
        ? "جدول جذري — يُحذف أخيراً"
        : "جدول تابع أو مستقل — يُحذف قبل الجداول التي يعتمد عليها",
  }));

  return {
    tables,
    localStorageKeys: [...LOCAL_STORAGE_KEYS],
    generatedAt: new Date().toISOString(),
  };
}

export interface EdgeFunctionRequirement {
  id: string;
  label: string;
  detail: string;
}

export interface EdgeFunctionRequirementsReport {
  functionName: string;
  requirements: EdgeFunctionRequirement[];
  generatedAt: string;
}

/** What a `delete-account` Supabase Edge Function would need — documentation only, no function exists yet. */
export function generateEdgeFunctionRequirements(): EdgeFunctionRequirementsReport {
  const requirements: EdgeFunctionRequirement[] = [
    {
      id: "secret_service_role",
      label: "SUPABASE_SERVICE_ROLE_KEY كسر Edge Function",
      detail: "يُخزَّن فقط كـ Edge Function secret — لا يظهر أبداً في كود العميل أو bundle الويب",
    },
    {
      id: "jwt_verification",
      label: "التحقق من JWT الوارد",
      detail: "استخراج userId من Authorization header والتحقق منه عبر supabase.auth.getUser(jwt)",
    },
    {
      id: "rate_limiting",
      label: "تحديد معدل الطلبات",
      detail: "منع إساءة استخدام endpoint الحذف (مثلاً طلب واحد كل 24 ساعة لكل مستخدم)",
    },
    {
      id: "idempotency",
      label: "قابلية إعادة المحاولة الآمنة (Idempotency)",
      detail:
        "إن فشل الحذف منتصف الطريق (مثلاً بعد حذف الجداول وقبل حذف حساب Auth)، يجب أن تكون إعادة الاستدعاء آمنة",
    },
    {
      id: "separate_audit_store",
      label: "سجل تدقيق منفصل عن بيانات المستخدم",
      detail:
        "لأن بيانات المستخدم ستُحذف بالكامل، يجب تسجيل «تم حذف حساب X بتاريخ Y» في مكان لا يُحذف معه",
    },
    {
      id: "email_confirmation",
      label: "تأكيد بالبريد الإلكتروني قبل التنفيذ",
      detail:
        "رابط تأكيد صالح لفترة محدودة يُرسل عبر Resend أو مزوّد بريد مشابه قبل التنفيذ الفعلي",
    },
  ];

  return {
    functionName: "delete-account",
    requirements,
    generatedAt: new Date().toISOString(),
  };
}
