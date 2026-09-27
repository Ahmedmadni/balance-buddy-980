// =============================================================
// PART 1 — Account Deletion UI Engine: flow
// -------------------------------------------------------------
// This module remains a read-only planning + export layer. Actual deletion is
// performed only by the authenticated `delete-account` Edge Function; the
// service_role key never enters the browser bundle. This layer sits on top of
// Prompt 23/24's
// generateDeletionPlan()/generateAccountDeletionReport() — it composes
// them into a user-facing execution plan, a readiness check, and a
// downloadable "deletion package" (a fresh full backup + the plan, so
// the user has proof of their data before any future real deletion).
// =============================================================
import {
  generateAccountDeletionReport,
  type AccountDeletionReport,
} from "@/lib/compliance/deletion-report";
import { loadLastBackup, exportUserData, type BackupBundle } from "@/lib/backup/engine";

export interface DeletionExecutionStep {
  id: string;
  order: number;
  label: string;
  detail: string;
}

export interface DeletionExecutionPlan {
  steps: DeletionExecutionStep[];
  tablesAffected: number;
  estimatedDataSizeBytes: number;
  nonDeletableFromClient: string[];
  estimatedDurationSeconds: number;
  recoveryWarnings: string[];
  generatedAt: string;
}

// Rough estimate only — average row size assumption, not a measurement.
const AVG_ROW_SIZE_BYTES = 500;

export async function generateDeletionExecutionPlan(): Promise<DeletionExecutionPlan> {
  const report = await generateAccountDeletionReport();

  const steps: DeletionExecutionStep[] = [
    {
      id: "backup",
      order: 1,
      label: "تصدير نسخة احتياطية كاملة",
      detail: "خطوة إلزامية أولى — يجب أخذها قبل أي تنفيذ فعلي مستقبلي لأن الحذف نهائي بلا استرجاع",
    },
    {
      id: "local_data",
      order: 2,
      label: "مسح البيانات المحلية",
      detail: `${report.localData.length} مفتاح localStorage على هذا الجهاز`,
    },
    {
      id: "cloud_tables",
      order: 3,
      label: "حذف صفوف الجداول السحابية",
      detail: `${report.affectedTables.length} جدول في Supabase عبر Edge Function، بالترتيب العكسي لتبعيّات المفاتيح الأجنبية`,
    },
    {
      id: "storage_files",
      order: 4,
      label: "حذف ملفات المرفقات",
      detail:
        "تحذف Edge Function كل المسارات المسجلة وأي ملفات يتيمة تحت مجلد المستخدم في حاوية attachments",
    },
    {
      id: "auth_account",
      order: 5,
      label: "حذف حساب المصادقة",
      detail:
        "تنفّذه Edge Function أخيراً عبر Admin API بعد التحقق من JWT وإعادة المصادقة بكلمة المرور",
    },
  ];

  const estimatedDataSizeBytes = report.affectedTables.reduce(
    (sum, t) => sum + t.estimatedRows * AVG_ROW_SIZE_BYTES,
    0,
  );

  return {
    steps,
    tablesAffected: report.affectedTables.length,
    estimatedDataSizeBytes,
    nonDeletableFromClient: report.nonDeletableData.map((d) => `${d.label}: ${d.reason}`),
    estimatedDurationSeconds: report.estimatedDurationSeconds,
    recoveryWarnings: report.risks
      .filter((r) => r.severity === "high")
      .map((r) => `${r.label}: ${r.detail}`),
    generatedAt: new Date().toISOString(),
  };
}

export interface DeletionReadinessCheck {
  id: string;
  label: string;
  ready: boolean;
  detail: string;
}

export interface DeletionReadinessReport {
  ready: boolean;
  checks: DeletionReadinessCheck[];
  generatedAt: string;
}

export async function validateDeletionReadiness(): Promise<DeletionReadinessReport> {
  const lastBackup = await loadLastBackup();

  const checks: DeletionReadinessCheck[] = [
    {
      id: "has_backup",
      label: "توجد نسخة احتياطية محدَّثة",
      ready: !!lastBackup,
      detail: lastBackup
        ? `آخر نسخة بتاريخ ${lastBackup.meta.exported_at}`
        : "لا نسخة احتياطية محلية بعد — يُنصح بشدّة بإنشاء واحدة (أو تصدير حزمة الحذف أدناه) أولاً",
    },
    {
      id: "server_execution",
      label: "التنفيذ الخادمي متاح",
      ready: true,
      detail:
        "Edge Function باسم delete-account تنفّذ الحذف بصلاحية خادمية بعد التحقق من الجلسة وإعادة المصادقة",
    },
  ];

  return { ready: checks.every((c) => c.ready), checks, generatedAt: new Date().toISOString() };
}

export interface DeletionPackage {
  backup: BackupBundle;
  plan: DeletionExecutionPlan;
  generatedAt: string;
}

/** Bundles a fresh full backup with the execution plan into one downloadable package. Exports/reads only — no deletion. */
export async function exportDeletionPackage(): Promise<DeletionPackage> {
  const [backup, plan] = await Promise.all([
    exportUserData("full"),
    generateDeletionExecutionPlan(),
  ]);
  return { backup, plan, generatedAt: new Date().toISOString() };
}

export function downloadDeletionPackage(pkg: DeletionPackage): void {
  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rasd-account-deletion-package-${pkg.generatedAt.slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

export type { AccountDeletionReport };
