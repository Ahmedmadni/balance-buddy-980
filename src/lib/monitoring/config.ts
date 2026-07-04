// =============================================================
// PART 7 — Monitoring & Observability: config
// -------------------------------------------------------------
// A static registry of which observability category is backed by which
// provider today. Every category in this app is local-only by design
// (no Sentry/Firebase Crashlytics/PostHog — forbidden this session) —
// this module documents that honestly rather than implying a remote
// vendor is wired up.
// =============================================================

export type MonitoringCategory =
  | "crash_reporting"
  | "analytics"
  | "performance"
  | "errors"
  | "notifications"
  | "backups";

export const MONITORING_CATEGORY_LABEL: Record<MonitoringCategory, string> = {
  crash_reporting: "تتبّع الأعطال",
  analytics: "التحليلات",
  performance: "الأداء",
  errors: "الأخطاء",
  notifications: "الإشعارات",
  backups: "النسخ الاحتياطي",
};

export interface MonitoringCategoryConfig {
  id: MonitoringCategory;
  label: string;
  provider: string;
  isLocalOnly: boolean;
}

const REGISTRY: Record<MonitoringCategory, { provider: string; isLocalOnly: boolean }> = {
  crash_reporting: { provider: "LocalCrashProvider (src/lib/crash/local.ts)", isLocalOnly: true },
  analytics: {
    provider: "لا مزوّد — لا SDK تحليلات خارجي في هذا التطبيق بالتصميم",
    isLocalOnly: true,
  },
  performance: {
    provider: "system/performance.ts (قياسات محلية عبر Performance API)",
    isLocalOnly: true,
  },
  errors: { provider: "system/errors.ts (سجل محلي في localStorage)", isLocalOnly: true },
  notifications: { provider: "notifications/engine.ts (محلي، لا push حقيقي)", isLocalOnly: true },
  backups: {
    provider: "backup/engine.ts (تصدير/استيراد يدوي، لا رفع سحابي تلقائي)",
    isLocalOnly: true,
  },
};

export function getMonitoringConfig(): MonitoringCategoryConfig[] {
  return (Object.keys(REGISTRY) as MonitoringCategory[]).map((id) => ({
    id,
    label: MONITORING_CATEGORY_LABEL[id],
    provider: REGISTRY[id].provider,
    isLocalOnly: REGISTRY[id].isLocalOnly,
  }));
}
