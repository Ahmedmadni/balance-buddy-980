// =============================================================
// PART 4 — generateDeletionPlan()
// -------------------------------------------------------------
// READ-ONLY PREVIEW ONLY. Never calls .delete()/.remove() on anything —
// no Supabase table, no Storage object, no localStorage key. It only
// enumerates what a real "delete my account" flow (not built — out of
// scope per DO NOT IMPLEMENT: Remote Deletion) would need to touch.
// =============================================================
import { supabase } from "@/integrations/supabase/client";

export type DeletionCategory = "will_delete" | "will_remain" | "needs_confirmation";

export interface DeletionPlanItem {
  id: string;
  label: string;
  category: DeletionCategory;
  detail: string;
}

export interface DeletionPlanReport {
  items: DeletionPlanItem[];
  willDeleteCount: number;
  willRemainCount: number;
  needsConfirmationCount: number;
  generatedAt: string;
}

// Mirrors backup/engine.ts's ALL_TABLES — verified 2026-07-03. Duplicated
// as a read-only static list here rather than imported, since engine.ts
// doesn't export it and this module must never touch write paths there.
const DB_TABLES = [
  "profiles",
  "categories",
  "wallet_tx_categories",
  "contacts",
  "projects",
  "wallets",
  "wallet_transactions",
  "expenses",
  "recurring_expenses",
  "person_ledger",
  "investments",
  "investment_transactions",
  "asset_market_values",
  "depreciation_profiles",
  "zakat_settings",
  "zakat_records",
  "system_events",
  "attachments",
] as const;

// Every rasd.* localStorage key verified in use across the app (2026-07-03).
const LOCAL_STORAGE_KEYS = [
  "rasd.localPrefs.v1",
  "rasd.reminderPrefs.v1",
  "dashboard.quickActions.v1",
  "rasd.adPrefs.v1",
  "rasd.notificationSettings.v1",
  "rasd.notificationLog.v1",
  "rasd.auditLog.v1",
  "rasd.errorLog.v1",
  "rasd.betaFeedback.v1",
  "rasd.betaSessions.v1",
];

export async function generateDeletionPlan(): Promise<DeletionPlanReport> {
  const { data: userRes } = await supabase.auth.getUser();

  const items: DeletionPlanItem[] = [
    {
      id: "db_rows",
      label: `صفوف قاعدة البيانات (${DB_TABLES.length} جدولاً)`,
      category: "will_delete",
      detail: `${DB_TABLES.join("، ")} — كل الجداول مقيَّدة بـ auth.uid() = user_id عبر RLS`,
    },
    {
      id: "attachments_storage",
      label: "ملفات المرفقات (Supabase Storage)",
      category: "will_delete",
      detail:
        "حاوية attachments تحتوي ملفات مرتبطة بصفوف جدول attachments — حذف الصف لا يحذف الملف الفعلي تلقائياً، يحتاج استدعاء storage.remove() صريحاً لكل مسار",
    },
    {
      id: "local_storage",
      label: `بيانات محلية (${LOCAL_STORAGE_KEYS.length} مفتاح localStorage)`,
      category: "will_delete",
      detail: LOCAL_STORAGE_KEYS.join("، "),
    },
    {
      id: "auth_account",
      label: "حساب المصادقة (auth.users)",
      category: "will_remain",
      detail:
        "حذف صفوف الجداول لا يحذف حساب Supabase Auth نفسه — يحتاج استدعاء Admin API بصلاحية service_role غير متاحة من جهة العميل؛ يبقى الحساب قابلاً لتسجيل الدخول ببيانات فارغة ما لم يُحذف يدوياً من طرف مشغّل التطبيق",
    },
    {
      id: "irreversible",
      label: "لا استرجاع بعد الحذف",
      category: "needs_confirmation",
      detail:
        "لا يوجد Soft Delete أو فترة سماح في قاعدة البيانات — الحذف نهائي فور التنفيذ؛ يُنصح بأخذ نسخة احتياطية (Backup JSON) أولاً",
    },
    {
      id: "confirm_identity",
      label: "تأكيد صريح مطلوب",
      category: "needs_confirmation",
      detail: `يجب طلب تأكيد صريح من المستخدم (${userRes?.user?.email ?? "—"}) قبل أي تنفيذ فعلي — هذه الدالة تعرض الخطة فقط ولا تنفّذ أي حذف`,
    },
  ];

  return {
    items,
    willDeleteCount: items.filter((i) => i.category === "will_delete").length,
    willRemainCount: items.filter((i) => i.category === "will_remain").length,
    needsConfirmationCount: items.filter((i) => i.category === "needs_confirmation").length,
    generatedAt: new Date().toISOString(),
  };
}
