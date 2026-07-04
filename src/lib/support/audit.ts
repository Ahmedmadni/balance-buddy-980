// =============================================================
// PART 5 — auditSupportInfrastructure()
// -------------------------------------------------------------
// Checks presence of email/domain/support pages/legal pages. Legal
// pages reuse validateLegalLinks() directly rather than re-checking the
// same 4 URLs with new logic.
// =============================================================
import { validateLegalLinks } from "@/lib/release/legal-links";
import { getSupportConfig, isPlaceholderEmail, isPlaceholderUrl } from "./config";
import type { HealthStatus } from "@/lib/system/health";

export interface SupportInfrastructureCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface SupportInfrastructureAuditReport {
  items: SupportInfrastructureCheckItem[];
  score: number;
  generatedAt: string;
}

export function auditSupportInfrastructure(): SupportInfrastructureAuditReport {
  const config = getSupportConfig();
  const legalLinks = validateLegalLinks();
  const legalOkCount = legalLinks.checks.filter(
    (c) => c.id !== "support" && c.status === "ok",
  ).length;
  const legalTotal = legalLinks.checks.filter((c) => c.id !== "support").length;

  const items: SupportInfrastructureCheckItem[] = [
    {
      id: "support_email",
      label: "Support Email",
      status: isPlaceholderEmail(config.supportEmail) ? "error" : "ok",
      detail: isPlaceholderEmail(config.supportEmail)
        ? "لا بريد دعم حقيقي مضبوط بعد — src/lib/support/config.ts"
        : `مضبوط: ${config.supportEmail}`,
    },
    {
      id: "domain",
      label: "Website Domain",
      status: isPlaceholderUrl(config.websiteUrl) ? "error" : "ok",
      detail: isPlaceholderUrl(config.websiteUrl)
        ? "لا نطاق حقيقي مضبوط بعد — WEBSITE_URL لا يزال example.com"
        : `مضبوط: ${config.websiteUrl}`,
    },
    {
      id: "support_pages",
      label: "Support Pages",
      status: isPlaceholderUrl(config.supportUrl) ? "error" : "ok",
      detail: isPlaceholderUrl(config.supportUrl)
        ? "لا صفحة دعم منشورة بعد — SUPPORT_URL لا يزال placeholder"
        : `مضبوط: ${config.supportUrl}`,
    },
    {
      id: "legal_pages",
      label: "Legal Pages",
      status: legalOkCount === legalTotal ? "ok" : legalOkCount > 0 ? "warning" : "error",
      detail: `${legalOkCount}/${legalTotal} صفحة قانونية منشورة وسليمة (خصوصية/شروط/كوكيز/تصدير بيانات)`,
    },
  ];

  const okCount = items.filter((i) => i.status === "ok").length;
  return {
    items,
    score: Math.round((okCount / items.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
