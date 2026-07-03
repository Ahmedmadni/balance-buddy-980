// =============================================================
// Release Metadata — Central Configuration
// -------------------------------------------------------------
// Prompt 26 (PART 3): Privacy/Terms/Cookies/Data Export now point at
// the real published pages built in Prompt 24 (src/routes/legal/*.tsx)
// instead of placeholders. SUPPORT_URL and WEBSITE_URL are still
// placeholders — this app has no real domain or support channel yet,
// and inventing one would be dishonest; isPlaceholderUrl() keeps
// flagging them until a real one is set.
//
// App Name / Package Name / Bundle ID / Version are NOT duplicated here
// — they're read live from capacitor.config.ts and package.json (their
// existing single source of truth), see metadata-audit.ts.
// =============================================================

export const BUILD_NUMBER = "1"; // TODO — bump with each store submission (Android versionCode / iOS CFBundleVersion)
export const PRIVACY_POLICY_URL = "/legal/privacy";
export const TERMS_URL = "/legal/terms";
export const COOKIES_URL = "/legal/cookies";
export const DATA_EXPORT_URL = "/legal/data-export";
export const SUPPORT_URL = "https://example.com/support"; // TODO — no real support channel yet
export const WEBSITE_URL = "https://example.com"; // TODO — no real domain yet

export function isPlaceholderUrl(url: string): boolean {
  return !url || url.includes("example.com");
}
