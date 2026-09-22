// =============================================================
// PART 3 — auditDependencies()
// -------------------------------------------------------------
// Vulnerability data is STATIC — verified via `npm audit --omit=dev`
// and `bun audit` directly against this repo's lockfile on 2026-09-22.
// Production dependencies have zero known advisories. The full lockfile
// has 15 dev-only advisories (1 critical, 10 high, 4 moderate) through
// @capacitor/assets/@capacitor/cli, with no fully patched compatible release.
// This cannot be re-run live from a
// browser at runtime (no npm/GitHub Advisory Database access from the
// client), so results are hardcoded here with the verification date,
// same convention as release/android-audit.ts's static facts. Must be
// re-run (`bun audit`) and this file updated before every real release.
// Dependency/devDependency counts and package lists ARE live — read
// directly from package.json, the actual source of truth.
// =============================================================
import pkg from "../../../package.json";

export type DependencyRisk = "safe" | "warning" | "critical";

export interface DependencyAuditItem {
  id: string;
  label: string;
  risk: DependencyRisk;
  detail: string;
}

export interface DependencyAuditReport {
  items: DependencyAuditItem[];
  dependencyCount: number;
  devDependencyCount: number;
  vulnerabilities: { critical: number; high: number; moderate: number; low: number };
  safeCount: number;
  warningCount: number;
  criticalCount: number;
  auditedAt: string; // when `bun audit` was actually run, not when this report is generated
  generatedAt: string;
}

const PKG = pkg as {
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
};

// Findings from the audits on 2026-09-22 — see comment above.
const FINDINGS: DependencyAuditItem[] = [
  {
    id: "xlsx",
    label: "xlsx (تصدير Excel)",
    risk: "safe",
    detail:
      "0.20.3 من حزمة SheetJS الرسمية — تمت إزالة إصدار npm القديم ذي ثغرتي Prototype Pollution وReDoS، وتدقيق تبعيات الإنتاج لا يسجل أي ثغرة",
  },
  {
    id: "build_tooling_dev_only",
    label: "أدوات البناء والتطوير (devDependencies فقط)",
    risk: "warning",
    detail:
      "15 تنبيهاً متبقياً (1 critical، 10 high، 4 moderate) عبر أداتي التطوير @capacitor/assets و@capacitor/cli وتبعيات sharp/tar/uuid. لا تُشحن هذه الأدوات للمستخدم، ولا يوجد إصدار متوافق يحلها بالكامل حالياً",
  },
  {
    id: "capacitor_plugins",
    label: "Capacitor Plugins (android/app/haptics/keyboard/splash-screen/status-bar)",
    risk: "safe",
    detail:
      "6 حزم @capacitor/* رسمية مثبَّتة — لا ثغرات مباشرة عليها؛ نُقل @capacitor/cli إلى devDependencies وثُبّت على 8.4.3",
  },
  {
    id: "supabase_sdk",
    label: "Supabase SDK (@supabase/supabase-js)",
    risk: "safe",
    detail: "^2.108.1 — لا ثغرات معروفة مُبلَّغة عليها مباشرة في تدقيق 2026-09-22",
  },
  {
    id: "react_ecosystem",
    label:
      "React Ecosystem (react/react-dom/react-hook-form/react-day-picker/@tanstack/react-query/react-router)",
    risk: "safe",
    detail:
      "react ^19.2.0، react-dom ^19.2.0، وباقي حزم React المباشرة — لا ثغرات معروفة مُبلَّغة عليها مباشرة في تدقيق 2026-09-22",
  },
];

export function auditDependencies(): DependencyAuditReport {
  const dependencyCount = Object.keys(PKG.dependencies ?? {}).length;
  const devDependencyCount = Object.keys(PKG.devDependencies ?? {}).length;

  return {
    items: FINDINGS,
    dependencyCount,
    devDependencyCount,
    vulnerabilities: { critical: 1, high: 10, moderate: 4, low: 0 },
    safeCount: FINDINGS.filter((f) => f.risk === "safe").length,
    warningCount: FINDINGS.filter((f) => f.risk === "warning").length,
    criticalCount: FINDINGS.filter((f) => f.risk === "critical").length,
    auditedAt: "2026-09-22",
    generatedAt: new Date().toISOString(),
  };
}
