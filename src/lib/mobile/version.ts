// Single source of truth for the displayed app version — read directly
// from package.json (Vite bundles JSON imports natively) instead of a
// hardcoded string that would drift out of sync.
import pkg from "../../../package.json";

export const APP_VERSION: string = (pkg as { version?: string }).version ?? "0.0.0";
