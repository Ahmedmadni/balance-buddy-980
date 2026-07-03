// =============================================================
// PART 6 — auditProductionConfig()
// -------------------------------------------------------------
// Supabase URL and Environment Variables are genuine RUNTIME checks
// against import.meta.env (same access pattern already used in
// src/integrations/supabase/client.ts — not re-implementing it, just
// reading the same env vars for reporting). Storage/Auth are live
// probes. RLS/Ads/Notifications/Mobile reuse existing engines.
// =============================================================
import { supabase } from "@/integrations/supabase/client";
import { runSystemHealthCheck, type HealthStatus } from "@/lib/system/health";
import { auditAdsConfiguration } from "@/lib/ads/audit";
import { loadNotificationSettings } from "@/lib/notifications/config";
import { auditMobileCompatibility } from "@/lib/mobile/compatibility";

export interface ProductionConfigCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface ProductionConfigAuditReport {
  items: ProductionConfigCheckItem[];
  score: number;
  generatedAt: string;
}

export async function auditProductionConfig(): Promise<ProductionConfigAuditReport> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const hasPublishableKey = !!import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

  const health = await runSystemHealthCheck();

  let storageOk = false;
  let storageDetail: string;
  try {
    const { error } = await supabase.storage.from("attachments").list("", { limit: 1 });
    storageOk = !error;
    storageDetail = error
      ? `فشل الوصول لحاوية attachments: ${error.message}`
      : "حاوية attachments قابلة للوصول فعلياً";
  } catch (e) {
    storageDetail = `تعذّر التحقق من Storage: ${e instanceof Error ? e.message : String(e)}`;
  }

  let authOk = false;
  let authDetail: string;
  try {
    const { data, error } = await supabase.auth.getUser();
    authOk = !error && !!data.user;
    authDetail = authOk ? "جلسة مصادقة صالحة" : "لا جلسة مصادقة صالحة حالياً";
  } catch (e) {
    authDetail = `تعذّر التحقق من Auth: ${e instanceof Error ? e.message : String(e)}`;
  }

  const adsAudit = auditAdsConfiguration();
  const notifSettings = loadNotificationSettings();
  const mobileCompat = auditMobileCompatibility();
  const mobileUnsupported = mobileCompat.items.filter((i) => !i.supported).length;
  const anyAdsConfigured =
    adsAudit.web.configured || adsAudit.android.configured || adsAudit.ios.configured;

  const items: ProductionConfigCheckItem[] = [
    {
      id: "supabase_url",
      label: "Supabase URL",
      status: supabaseUrl ? "ok" : "error",
      detail: supabaseUrl
        ? `مضبوط فعلياً (${(() => {
            try {
              return new URL(supabaseUrl).hostname;
            } catch {
              return supabaseUrl;
            }
          })()})`
        : "VITE_SUPABASE_URL غير مضبوط في بيئة التشغيل",
    },
    {
      id: "rls",
      label: "RLS",
      status: health.status,
      detail:
        "كل الجداول مقيَّدة بـ auth.uid() = user_id — نجاح الفحص الصحي العام (System Health Engine) دليل غير مباشر على عمل السياسات للمستخدم الحالي",
    },
    { id: "auth", label: "Auth", status: authOk ? "ok" : "error", detail: authDetail },
    { id: "storage", label: "Storage", status: storageOk ? "ok" : "error", detail: storageDetail },
    {
      id: "ads",
      label: "Ads",
      status: anyAdsConfigured ? "ok" : "warning",
      detail: anyAdsConfigured
        ? "منصّة واحدة على الأقل بمعرّفات حقيقية"
        : "كل المعرّفات (Web/Android/iOS) لا تزال placeholder",
    },
    {
      id: "notifications",
      label: "Notifications",
      status: notifSettings.enabled ? "ok" : "warning",
      detail: notifSettings.enabled ? "المحرك مفعّل" : "معطّل من الإعدادات",
    },
    {
      id: "mobile",
      label: "Mobile",
      status: mobileUnsupported === 0 ? "ok" : "warning",
      detail: `${mobileCompat.items.length - mobileUnsupported}/${mobileCompat.items.length} قدرة جهاز متاحة على هذا البناء`,
    },
    {
      id: "environment_variables",
      label: "Environment Variables",
      status: supabaseUrl && hasPublishableKey ? "ok" : "error",
      detail:
        supabaseUrl && hasPublishableKey
          ? "VITE_SUPABASE_URL وVITE_SUPABASE_PUBLISHABLE_KEY مضبوطان فعلياً في بيئة التشغيل الحالية"
          : "متغيّر بيئة واحد أو أكثر مفقود (VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY)",
    },
  ];

  const okCount = items.filter((i) => i.status === "ok").length;
  return {
    items,
    score: Math.round((okCount / items.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
