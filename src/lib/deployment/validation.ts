// =============================================================
// PART 1 — validateEnvironment()
// -------------------------------------------------------------
// Supabase URL/Key are genuine RUNTIME checks against import.meta.env
// (same pattern as compliance/production-config-audit.ts). The legal/
// support/website URLs reuse metadata-config.ts's isPlaceholderUrl()
// rather than re-implementing placeholder detection. Ad IDs reuse
// ads/audit.ts's auditAdsConfiguration(). "Analytics IDs" has no real
// SDK in this app by design — reported honestly as not_applicable
// rather than faked as configured.
// =============================================================
import { auditAdsConfiguration } from "@/lib/ads/audit";
import {
  PRIVACY_POLICY_URL,
  TERMS_URL,
  COOKIES_URL,
  DATA_EXPORT_URL,
  SUPPORT_URL,
  WEBSITE_URL,
  isPlaceholderUrl,
} from "@/lib/release/metadata-config";
import type { HealthStatus } from "@/lib/system/health";

export interface EnvironmentCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface EnvironmentValidationReport {
  items: EnvironmentCheckItem[];
  score: number;
  generatedAt: string;
}

export function validateEnvironment(): EnvironmentValidationReport {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const supabaseKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined;
  const adsAudit = auditAdsConfiguration();
  const anyAdsConfigured =
    adsAudit.web.configured || adsAudit.android.configured || adsAudit.ios.configured;

  const urlChecks: { id: string; label: string; url: string }[] = [
    { id: "website_url", label: "Website URL", url: WEBSITE_URL },
    { id: "support_url", label: "Support URL", url: SUPPORT_URL },
    { id: "privacy_url", label: "Privacy URL", url: PRIVACY_POLICY_URL },
    { id: "terms_url", label: "Terms URL", url: TERMS_URL },
    { id: "cookie_url", label: "Cookie URL", url: COOKIES_URL },
    { id: "data_export_url", label: "Data Export URL", url: DATA_EXPORT_URL },
  ];

  const items: EnvironmentCheckItem[] = [
    {
      id: "supabase_url",
      label: "Supabase URL",
      status: supabaseUrl ? "ok" : "error",
      detail: supabaseUrl ? "مضبوط فعلياً في بيئة التشغيل" : "VITE_SUPABASE_URL غير مضبوط",
    },
    {
      id: "supabase_key",
      label: "Supabase Key",
      status: supabaseKey ? "ok" : "error",
      detail: supabaseKey
        ? "مضبوط فعلياً في بيئة التشغيل"
        : "VITE_SUPABASE_PUBLISHABLE_KEY غير مضبوط",
    },
    ...urlChecks.map((c) => ({
      id: c.id,
      label: c.label,
      status: (isPlaceholderUrl(c.url) ? "warning" : "ok") as HealthStatus,
      detail: isPlaceholderUrl(c.url) ? `لا يزال placeholder: ${c.url}` : `مضبوط: ${c.url}`,
    })),
    {
      id: "ad_ids",
      label: "Ad IDs",
      status: anyAdsConfigured ? "ok" : "warning",
      detail: anyAdsConfigured
        ? "منصّة واحدة على الأقل بمعرّفات إعلانات حقيقية"
        : "كل معرّفات الإعلانات (Web/Android/iOS) لا تزال placeholder",
    },
    {
      id: "analytics_ids",
      label: "Analytics IDs",
      status: "warning",
      detail: "لا يوجد SDK تحليلات خارجي في هذا التطبيق بالتصميم — لا معرّفات مطلوبة حالياً",
    },
  ];

  const okCount = items.filter((i) => i.status === "ok").length;
  return {
    items,
    score: Math.round((okCount / items.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
