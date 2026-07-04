// =============================================================
// PART 1 — Release Candidate Engine: version manifest
// -------------------------------------------------------------
// Per-module version numbers are STATIC — this app has no independent
// semver per module, so these track "last prompt that touched this
// engine" as a human-readable version string, verified by git history
// this session (2026-07-04). app_version/schema_version reuse existing
// single sources of truth (package.json via APP_VERSION, Schema Freeze
// v1.0) rather than re-declaring them.
// =============================================================
import { APP_VERSION } from "@/lib/mobile/version";

const SCHEMA_VERSION = "v1.0"; // Schema Freeze v1.0 — unmodified the entire session
const FEATURE_FLAGS_VERSION = "1.0.0"; // src/lib/features/* introduced Prompt 25, unmodified since
const BACKUP_VERSION = "1.1.0"; // backup/engine.ts LOCAL_KEYS fix in Prompt 24 was the last change, frozen since
const NOTIFICATION_VERSION = "1.0.0"; // notifications/* introduced Prompt 15, unmodified since
const FINANCIAL_ENGINE_VERSION = "1.0.0-frozen"; // assets/calculator.ts computeAssetMetrics, unmodified all session

export interface VersionManifest {
  app_version: string;
  schema_version: string;
  feature_flags_version: string;
  backup_version: string;
  notification_version: string;
  financial_engine_version: string;
  generatedAt: string;
}

export function generateVersionManifest(): VersionManifest {
  return {
    app_version: APP_VERSION,
    schema_version: SCHEMA_VERSION,
    feature_flags_version: FEATURE_FLAGS_VERSION,
    backup_version: BACKUP_VERSION,
    notification_version: NOTIFICATION_VERSION,
    financial_engine_version: FINANCIAL_ENGINE_VERSION,
    generatedAt: new Date().toISOString(),
  };
}
