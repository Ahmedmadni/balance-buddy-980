// =============================================================
// PART 7 — auditProductionEnvironment()
// -------------------------------------------------------------
// Supabase/RLS reuse the System Health Engine's own database check.
// Storage and Auth are live probes (a real Storage list call, a real
// getUser() call) — genuine runtime checks, not estimates. Backup,
// Notifications, Ads, Mobile, Analytics all reuse their existing
// engines directly, per REUSE EXISTING.
// =============================================================
import { supabase } from "@/integrations/supabase/client";
import { runSystemHealthCheck, type HealthStatus } from "@/lib/system/health";
import { loadLastBackup } from "@/lib/backup/engine";
import { loadNotificationSettings } from "@/lib/notifications/config";
import { auditAdsConfiguration } from "@/lib/ads/audit";
import { auditMobileCompatibility } from "@/lib/mobile/compatibility";
import { generateReleaseChecklist } from "@/lib/mobile/readiness";

export interface ProductionEnvCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface ProductionEnvironmentAuditReport {
  items: ProductionEnvCheckItem[];
  score: number;
  generatedAt: string;
}

export async function auditProductionEnvironment(): Promise<ProductionEnvironmentAuditReport> {
  const [health, lastBackup, checklist] = await Promise.all([
    runSystemHealthCheck(),
    loadLastBackup(),
    generateReleaseChecklist(),
  ]);

  let storageOk = false;
  let storageDetail: string;
  try {
    const { error } = await supabase.storage.from("attachments").list("", { limit: 1 });
    storageOk = !error;
    storageDetail = error
      ? `فشل الوصول لحاوية attachments: ${error.message}`
      : "حاوية attachments (المرفقات) قابلة للوصول فعلياً";
  } catch (e) {
    storageDetail = `تعذّر التحقق من Storage: ${e instanceof Error ? e.message : String(e)}`;
  }

  let authOk = false;
  let authDetail: string;
  try {
    const { data, error } = await supabase.auth.getUser();
    authOk = !error && !!data.user;
    authDetail = authOk
      ? `جلسة صالحة (${data.user?.email ?? data.user?.id})`
      : "لا جلسة مستخدم صالحة حالياً";
  } catch (e) {
    authDetail = `تعذّر التحقق من Auth: ${e instanceof Error ? e.message : String(e)}`;
  }

  const notifSettings = loadNotificationSettings();
  const adsAudit = auditAdsConfiguration();
  const mobileCompat = auditMobileCompatibility();
  const analyticsItem = checklist.items.find((i) => i.id === "analytics");
  const mobileUnsupported = mobileCompat.items.filter((i) => !i.supported).length;
  const anyAdsConfigured =
    adsAudit.web.configured || adsAudit.android.configured || adsAudit.ios.configured;

  const items: ProductionEnvCheckItem[] = [
    {
      id: "supabase",
      label: "Supabase",
      status: health.database.status,
      detail: `فحص الجداول الأساسية (System Health Engine): ${health.database.status}`,
    },
    { id: "storage", label: "Storage", status: storageOk ? "ok" : "error", detail: storageDetail },
    { id: "auth", label: "Auth", status: authOk ? "ok" : "error", detail: authDetail },
    {
      id: "rls",
      label: "RLS",
      status: health.status,
      detail:
        "كل الجداول مقيَّدة بـ auth.uid() = user_id (راجع migrations) — نجاح الفحص الصحي العام دليل غير مباشر على عمل السياسات للمستخدم الحالي",
    },
    {
      id: "backup",
      label: "Backup",
      status: lastBackup ? "ok" : "warning",
      detail: lastBackup
        ? `آخر نسخة بتاريخ ${lastBackup.meta.exported_at}`
        : "لا نسخة احتياطية محلية بعد",
    },
    {
      id: "notifications",
      label: "Notifications",
      status: notifSettings.enabled ? "ok" : "warning",
      detail: notifSettings.enabled ? "المحرك مفعّل" : "معطّل من الإعدادات",
    },
    {
      id: "ads",
      label: "Ads",
      status: anyAdsConfigured ? "ok" : "warning",
      detail: `Web: ${adsAudit.web.configured ? "جاهز" : "placeholder"} — Android: ${adsAudit.android.configured ? "جاهز" : "placeholder"} — iOS: ${adsAudit.ios.configured ? "جاهز" : "placeholder"}`,
    },
    {
      id: "mobile",
      label: "Mobile",
      status: mobileUnsupported === 0 ? "ok" : "warning",
      detail: `${mobileCompat.items.length - mobileUnsupported}/${mobileCompat.items.length} قدرة جهاز متاحة على هذا البناء`,
    },
    {
      id: "analytics",
      label: "Analytics",
      status: analyticsItem?.status ?? "warning",
      detail: analyticsItem?.detail ?? "غير متاح",
    },
  ];

  const okCount = items.filter((i) => i.status === "ok").length;
  return {
    items,
    score: Math.round((okCount / items.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
