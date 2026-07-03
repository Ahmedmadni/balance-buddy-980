// =============================================================
// PART 6 (Prompt 24) — generateAccountDeletionReport()
// -------------------------------------------------------------
// STRICTLY READ-ONLY: every Supabase call below is a `count`-only,
// `head: true` select — never `.delete()`, never `.remove()`, on
// anything, anywhere. Builds on top of Prompt 23's generateDeletionPlan()
// rather than re-declaring the same table/key lists a third time, and
// adds real per-table row counts (for a genuine time estimate) plus a
// structured risk assessment.
// =============================================================
import { supabase } from "@/integrations/supabase/client";
import { generateDeletionPlan, DB_TABLES, LOCAL_STORAGE_KEYS } from "./data-deletion-plan";

export interface AffectedTable {
  table: string;
  estimatedRows: number;
  deletable: boolean;
}

export interface NonDeletableItem {
  label: string;
  reason: string;
}

export type RiskSeverity = "low" | "medium" | "high";

export interface DeletionRisk {
  id: string;
  label: string;
  severity: RiskSeverity;
  detail: string;
}

export interface AccountDeletionReport {
  affectedTables: AffectedTable[];
  localData: string[];
  cloudData: string[];
  nonDeletableData: NonDeletableItem[];
  estimatedDurationSeconds: number;
  risks: DeletionRisk[];
  generatedAt: string;
}

export async function generateAccountDeletionReport(): Promise<AccountDeletionReport> {
  const plan = await generateDeletionPlan();
  const authItem = plan.items.find((i) => i.id === "auth_account");

  // Real, read-only row counts per table — never a DELETE, only a count probe.
  const affectedTables: AffectedTable[] = [];
  let totalRows = 0;
  for (const table of DB_TABLES) {
    try {
      const { count } = await supabase
        .from(table as any)
        .select("*", { count: "exact", head: true });
      const rows = count ?? 0;
      totalRows += rows;
      affectedTables.push({ table, estimatedRows: rows, deletable: true });
    } catch {
      affectedTables.push({ table, estimatedRows: 0, deletable: true });
    }
  }

  const localData = [...LOCAL_STORAGE_KEYS];
  const cloudData = [
    ...DB_TABLES.filter((t) => t !== "attachments"),
    "ملفات المرفقات (Supabase Storage)",
  ];

  const nonDeletableData: NonDeletableItem[] = [
    {
      label: "حساب المصادقة (auth.users)",
      reason:
        authItem?.detail ?? "يحتاج استدعاء Admin API بصلاحية service_role غير متاحة من جهة العميل",
    },
  ];

  // Rough estimate only (~50ms/row for a delete round-trip + 1s fixed overhead
  // per table for the request itself) — not a measured benchmark.
  const estimatedDurationSeconds = Math.max(
    5,
    Math.round(totalRows * 0.05 + affectedTables.length),
  );

  const risks: DeletionRisk[] = [
    {
      id: "irreversible",
      label: "لا استرجاع بعد التنفيذ",
      severity: "high",
      detail:
        "لا يوجد Soft Delete في قاعدة البيانات — يجب أخذ نسخة احتياطية (Backup JSON) قبل أي تنفيذ فعلي مستقبلي",
    },
    {
      id: "partial_failure",
      label: "فشل جزئي محتمل",
      severity: "medium",
      detail: `حذف ${DB_TABLES.length} جدولاً بالتسلسل يعني أن انقطاع شبكة في منتصف العملية قد يترك بيانات يتيمة في بعض الجداول دون غيرها`,
    },
    {
      id: "storage_orphans",
      label: "ملفات يتيمة في Storage",
      severity: "medium",
      detail:
        "حذف صف جدول attachments لا يحذف الملف الفعلي في Supabase Storage تلقائياً — يحتاج استدعاء storage.remove() منفصلاً لكل مسار، وإلا بقيت الملفات تحتلّ مساحة",
    },
    {
      id: "auth_account_remains",
      label: "حساب Auth يبقى بعد الحذف",
      severity: "low",
      detail:
        "يمكن للمستخدم تسجيل الدخول مجدداً لحساب فارغ تماماً ما لم يُحذف auth.users يدوياً بصلاحية إدارية",
    },
    {
      id: "no_execution_path",
      label: "لا مسار تنفيذ فعلي مبني بعد",
      severity: "high",
      detail:
        "هذا التقرير معاينة فقط — لا يوجد زر أو دالة تُنفّذ الحذف الفعلي في التطبيق حالياً، بالتصميم (خارج نطاق هذه المرحلة)",
    },
  ];

  return {
    affectedTables,
    localData,
    cloudData,
    nonDeletableData,
    estimatedDurationSeconds,
    risks,
    generatedAt: new Date().toISOString(),
  };
}
