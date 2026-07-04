// =============================================================
// PART 6 — Support Channels Audit
// -------------------------------------------------------------
// Reuses getSupportConfig()/isPlaceholderEmail()/isPlaceholderUrl()
// from support/config.ts (Prompt 27) directly for support email/
// website/privacy contact rather than re-declaring the placeholder
// logic. Legal contact and business contact are new concepts this
// prompt introduces — neither exists as a dedicated channel yet
// (distinct from the generic support inbox), reported honestly.
// =============================================================
import { getSupportConfig, isPlaceholderEmail, isPlaceholderUrl } from "@/lib/support/config";
import type { HealthStatus } from "@/lib/system/health";

export interface SupportChannelCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface SupportChannelsAudit {
  items: SupportChannelCheckItem[];
  score: number;
  generatedAt: string;
}

export function auditSupportChannels(): SupportChannelsAudit {
  const config = getSupportConfig();

  const items: SupportChannelCheckItem[] = [
    {
      id: "support_email",
      label: "Support Email",
      status: isPlaceholderEmail(config.supportEmail) ? "error" : "ok",
      detail: isPlaceholderEmail(config.supportEmail)
        ? "لا يزال placeholder — support/config.ts"
        : `مضبوط: ${config.supportEmail}`,
    },
    {
      id: "website",
      label: "Website",
      status: isPlaceholderUrl(config.websiteUrl) ? "error" : "ok",
      detail: isPlaceholderUrl(config.websiteUrl)
        ? "لا يزال placeholder"
        : `مضبوط: ${config.websiteUrl}`,
    },
    {
      id: "privacy_contact",
      label: "Privacy Contact",
      status: isPlaceholderEmail(config.supportEmail) ? "warning" : "ok",
      detail:
        "لا قناة اتصال مخصّصة لشؤون الخصوصية — تُوجَّه حالياً لنفس صندوق الدعم العام (support_email) بمجرد ضبطه",
    },
    {
      id: "legal_contact",
      label: "Legal Contact",
      status: "warning",
      detail: "لا قناة اتصال قانونية مخصّصة (منفصلة عن الدعم العام) بعد — غير حرجة للإطلاق الأول",
    },
    {
      id: "business_contact",
      label: "Business Contact",
      status: "warning",
      detail: "لا قناة اتصال أعمال/شراكات مخصّصة بعد — غير حرجة للإطلاق الأول",
    },
  ];

  const okCount = items.filter((i) => i.status === "ok").length;
  return {
    items,
    score: Math.round((okCount / items.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
