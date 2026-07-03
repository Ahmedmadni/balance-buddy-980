// =============================================================
// PART 5 — Support & Contact Infrastructure: config
// -------------------------------------------------------------
// Re-exports the URL constants already owned by release/metadata-config.ts
// (single source of truth — not duplicated) and adds the one field that
// module doesn't have yet: SUPPORT_EMAIL. Left as an honest placeholder,
// same principle as SUPPORT_URL/WEBSITE_URL — no real support mailbox
// exists for this app yet, so isPlaceholderEmail() flags it rather than
// inventing a fake-looking one.
// =============================================================
import {
  SUPPORT_URL,
  WEBSITE_URL,
  PRIVACY_POLICY_URL,
  TERMS_URL,
  COOKIES_URL,
  isPlaceholderUrl,
} from "@/lib/release/metadata-config";

export const SUPPORT_EMAIL = "support@example.com"; // TODO — no real support mailbox yet

export function isPlaceholderEmail(email: string): boolean {
  return !email || email.includes("example.com");
}

export interface SupportConfigSnapshot {
  supportEmail: string;
  supportUrl: string;
  websiteUrl: string;
  privacyUrl: string;
  termsUrl: string;
  cookieUrl: string;
}

export function getSupportConfig(): SupportConfigSnapshot {
  return {
    supportEmail: SUPPORT_EMAIL,
    supportUrl: SUPPORT_URL,
    websiteUrl: WEBSITE_URL,
    privacyUrl: PRIVACY_POLICY_URL,
    termsUrl: TERMS_URL,
    cookieUrl: COOKIES_URL,
  };
}

export { isPlaceholderUrl };
