// =============================================================
// PART 8 — generateRC2Certificate()
// -------------------------------------------------------------
// Reuses generateReleaseCandidate() (Prompt 28's RC1 build/version
// info) for the build fingerprint, overriding only rc_version to
// "RC2", plus calculateRC2Score() (this prompt) for the score.
// =============================================================
import { generateReleaseCandidate } from "@/lib/rc/certificate";
import { calculateRC2Score, type RC2ScoreBreakdown } from "./score";

export interface RC2Certificate {
  rc_version: "RC2";
  build_id: string;
  git_commit: string;
  build_date: string;
  scores: RC2ScoreBreakdown;
  generatedAt: string;
}

export async function generateRC2Certificate(): Promise<RC2Certificate> {
  const rc1 = generateReleaseCandidate();
  const scores = await calculateRC2Score();

  return {
    rc_version: "RC2",
    build_id: rc1.build.build_id,
    git_commit: rc1.build.git_commit,
    build_date: rc1.build.build_date,
    scores,
    generatedAt: new Date().toISOString(),
  };
}
