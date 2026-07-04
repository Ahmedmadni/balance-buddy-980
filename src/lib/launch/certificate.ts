// =============================================================
// PART 8 — generateLaunchCertificate()
// -------------------------------------------------------------
// Thin wrapper over generateLaunchPackage() — averages its 12 section
// scores into one final_score, nothing recomputed.
// =============================================================
import { generateLaunchPackage, type LaunchPackage } from "./package";

export interface LaunchCertificate {
  package: LaunchPackage;
  final_score: number;
  generatedAt: string;
}

export async function generateLaunchCertificate(): Promise<LaunchCertificate> {
  const pkg = await generateLaunchPackage();

  const sections = [
    pkg.rc1,
    pkg.rc2,
    pkg.productionCertificate,
    pkg.security,
    pkg.compliance,
    pkg.backup,
    pkg.notifications,
    pkg.support,
    pkg.monitoring,
    pkg.storeReadiness,
    pkg.android,
    pkg.ios,
  ];
  const final_score = Math.round(sections.reduce((s, c) => s + c.score, 0) / sections.length);

  return {
    package: pkg,
    final_score,
    generatedAt: new Date().toISOString(),
  };
}
