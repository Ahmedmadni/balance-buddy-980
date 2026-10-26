/** Build-time validation only; never permit a release WebView to load cleartext or credentials. */
export function validateAndroidReleaseUrl(value: string): string {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) {
    throw new Error("Android production requires a credential-free HTTPS URL.");
  }
  if (url.hostname === "localhost" || url.hostname === "127.0.0.1" ||
      url.hostname.endsWith(".lovableproject.com") || url.hostname.startsWith("id-preview--")) {
    throw new Error("Android production cannot load a development or preview host.");
  }
  return url.href;
}