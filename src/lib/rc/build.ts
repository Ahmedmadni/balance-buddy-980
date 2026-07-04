// =============================================================
// PART 1 — Release Candidate Engine: build fingerprint
// -------------------------------------------------------------
// git_commit cannot be read live from a browser bundle — vite.config.ts
// (intentionally minimal per CLAUDE.md) doesn't inject a VITE_GIT_COMMIT
// build-time constant, and there is no way to shell out to `git` from
// client code. Reported honestly as unavailable rather than faked.
// build_date is this report's generation time, not a real recorded
// build timestamp (no CI step stamps one) — labeled as such.
// =============================================================
import { APP_VERSION } from "@/lib/mobile/version";
import { BUILD_NUMBER } from "@/lib/release/metadata-config";

export interface BuildFingerprint {
  build_id: string;
  git_commit: string;
  build_date: string;
  note: string;
}

export function generateBuildFingerprint(): BuildFingerprint {
  const gitCommit = (import.meta.env.VITE_GIT_COMMIT as string | undefined) ?? null;

  return {
    build_id: `${APP_VERSION}+${BUILD_NUMBER}`,
    git_commit: gitCommit ?? "غير متاح — vite.config.ts لا يحقن VITE_GIT_COMMIT في هذه البيئة",
    build_date: new Date().toISOString(),
    note: "build_date هو وقت توليد هذا التقرير، وليس ختم بناء CI فعلياً مُسجَّلاً (لا خطوة بناء تحقن هذه القيمة حالياً)",
  };
}
