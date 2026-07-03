// =============================================================
// Release Metadata — Central Configuration
// -------------------------------------------------------------
// IMPORTANT: The 4 URL constants below are PLACEHOLDERS ONLY — same
// convention as src/lib/ads/ad-config.ts. Replace them with real URLs
// before any store submission; auditAppMetadata() flags them until then.
//
// App Name / Package Name / Bundle ID / Version are NOT duplicated here
// — they're read live from capacitor.config.ts and package.json (their
// existing single source of truth), see metadata-audit.ts.
// =============================================================

export const BUILD_NUMBER = "1"; // TODO — bump with each store submission (Android versionCode / iOS CFBundleVersion)
export const PRIVACY_POLICY_URL = "https://example.com/privacy"; // TODO
export const TERMS_URL = "https://example.com/terms"; // TODO
export const SUPPORT_URL = "https://example.com/support"; // TODO
export const WEBSITE_URL = "https://example.com"; // TODO

export function isPlaceholderUrl(url: string): boolean {
  return !url || url.includes("example.com");
}
