// =============================================================
// PART 1 — Release Candidate Engine: generateReleaseCandidate()
// -------------------------------------------------------------
// Thin composition of build.ts + version.ts — this module owns only
// the rc_version label, nothing else is recomputed here.
// =============================================================
import { generateBuildFingerprint, type BuildFingerprint } from "./build";
import { generateVersionManifest, type VersionManifest } from "./version";

export interface ReleaseCandidate {
  rc_version: string;
  build: BuildFingerprint;
  versions: VersionManifest;
  generatedAt: string;
}

export function generateReleaseCandidate(): ReleaseCandidate {
  return {
    rc_version: "RC1",
    build: generateBuildFingerprint(),
    versions: generateVersionManifest(),
    generatedAt: new Date().toISOString(),
  };
}
