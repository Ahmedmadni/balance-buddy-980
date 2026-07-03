// =============================================================
// PART 7 — auditObservability()
// -------------------------------------------------------------
// Pure composition over existing engines — computes nothing new,
// combines auditCrashReporting() (crash/errors), collectPerformanceMetrics()
// (performance), loadNotificationSettings() (notifications), and
// loadLastBackup()/verifyBackupIntegrity() (backups). Analytics has no
// backing engine (see monitoring/config.ts) and is reported as
// not_applicable rather than faked.
// =============================================================
import { auditCrashReporting } from "@/lib/crash/audit";
import { collectPerformanceMetrics } from "@/lib/system/performance";
import { loadNotificationSettings } from "@/lib/notifications/config";
import { loadLastBackup } from "@/lib/backup/engine";
import { verifyBackupIntegrity } from "@/lib/backup/integrity";
import type { HealthStatus } from "@/lib/system/health";
import { type MonitoringCategory, MONITORING_CATEGORY_LABEL } from "./config";

export interface ObservabilityCategoryReport {
  id: MonitoringCategory;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface ObservabilityAuditReport {
  categories: ObservabilityCategoryReport[];
  score: number;
  generatedAt: string;
}

export async function auditObservability(): Promise<ObservabilityAuditReport> {
  const [crash, performance, lastBackup] = await Promise.all([
    Promise.resolve(auditCrashReporting()),
    collectPerformanceMetrics(),
    loadLastBackup(),
  ]);
  const notifSettings = loadNotificationSettings();
  const backupIntegrity = lastBackup ? await verifyBackupIntegrity(lastBackup) : null;
  const totalQueryMs = performance.queryDurations.reduce((s, q) => s + q.ms, 0);

  const categories: ObservabilityCategoryReport[] = [
    {
      id: "crash_reporting",
      label: MONITORING_CATEGORY_LABEL.crash_reporting,
      status: crash.errorRatePerDay > 10 ? "warning" : "ok",
      detail: `${crash.activeProvider} — ${crash.errorCount} خطأ مسجّل، ${crash.errorRatePerDay} خلال آخر 24 ساعة`,
    },
    {
      id: "analytics",
      label: MONITORING_CATEGORY_LABEL.analytics,
      status: "warning",
      detail: "لا SDK تحليلات خارجي في هذا التطبيق بالتصميم — غير قابل للتطبيق",
    },
    {
      id: "performance",
      label: MONITORING_CATEGORY_LABEL.performance,
      status: totalQueryMs > 2000 ? "warning" : "ok",
      detail: `إجمالي زمن استعلامات لوحة الأداء: ${Math.round(totalQueryMs)} مل ثانية عبر ${performance.queryDurations.length} استعلاماً`,
    },
    {
      id: "errors",
      label: MONITORING_CATEGORY_LABEL.errors,
      status: crash.errorCount > 0 ? "warning" : "ok",
      detail: crash.lastError
        ? `آخر خطأ: ${crash.lastError.message} (${crash.lastError.category})`
        : "لا أخطاء مسجّلة",
    },
    {
      id: "notifications",
      label: MONITORING_CATEGORY_LABEL.notifications,
      status: notifSettings.enabled ? "ok" : "warning",
      detail: notifSettings.enabled ? "المحرك مفعّل" : "معطّل من الإعدادات",
    },
    {
      id: "backups",
      label: MONITORING_CATEGORY_LABEL.backups,
      status: backupIntegrity ? (backupIntegrity.valid ? "ok" : "error") : "warning",
      detail: backupIntegrity
        ? `آخر نسخة احتياطية: ${backupIntegrity.score}/100`
        : "لا نسخة احتياطية محلية بعد",
    },
  ];

  const okCount = categories.filter((c) => c.status === "ok").length;
  return {
    categories,
    score: Math.round((okCount / categories.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
