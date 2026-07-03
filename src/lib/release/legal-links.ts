// =============================================================
// PART 3 — validateLegalLinks()
// -------------------------------------------------------------
// Checks Privacy/Terms/Cookies/Data Export/Support. The first 4 are
// real internal /legal/* routes (Prompt 24's pages, wired in Prompt 26)
// — "ok" means the URL genuinely points at one of them, not just that
// it's non-empty. Support has no dedicated page and is still a
// placeholder; flagged honestly rather than pretending it's resolved.
// =============================================================
import {
  PRIVACY_POLICY_URL,
  TERMS_URL,
  COOKIES_URL,
  DATA_EXPORT_URL,
  SUPPORT_URL,
  isPlaceholderUrl,
} from "./metadata-config";
import type { HealthStatus } from "@/lib/system/health";

export interface LegalLinkCheck {
  id: string;
  label: string;
  url: string;
  status: HealthStatus;
  detail: string;
}

export interface LegalLinksReport {
  checks: LegalLinkCheck[];
  score: number;
  generatedAt: string;
}

function isInternalLegalRoute(url: string): boolean {
  return url.startsWith("/legal/");
}

function internalRouteCheck(id: string, label: string, url: string): LegalLinkCheck {
  const ok = isInternalLegalRoute(url);
  return {
    id,
    label,
    url,
    status: ok ? "ok" : isPlaceholderUrl(url) ? "error" : "warning",
    detail: ok
      ? `مربوط فعلياً بصفحة داخلية منشورة: ${url}`
      : isPlaceholderUrl(url)
        ? "لا يزال placeholder"
        : "رابط مضبوط لكنه ليس صفحة قانونية داخلية معروفة",
  };
}

export function validateLegalLinks(): LegalLinksReport {
  const checks: LegalLinkCheck[] = [
    internalRouteCheck("privacy", "Privacy", PRIVACY_POLICY_URL),
    internalRouteCheck("terms", "Terms", TERMS_URL),
    internalRouteCheck("cookies", "Cookies", COOKIES_URL),
    internalRouteCheck("data_export", "Data Export", DATA_EXPORT_URL),
    {
      id: "support",
      label: "Support",
      url: SUPPORT_URL,
      status: isPlaceholderUrl(SUPPORT_URL) ? "error" : "ok",
      detail: isPlaceholderUrl(SUPPORT_URL)
        ? "لا يزال placeholder — يحتاج قناة دعم حقيقية (بريد إلكتروني أو صفحة) قبل النشر على المتاجر"
        : "مُعدّ",
    },
  ];

  const okCount = checks.filter((c) => c.status === "ok").length;
  return {
    checks,
    score: Math.round((okCount / checks.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
