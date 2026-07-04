// =============================================================
// PART 3 — auditDependencies()
// -------------------------------------------------------------
// Vulnerability data is STATIC — verified once via `bun audit` run
// directly against this repo's lockfile on 2026-07-04 (26 advisories:
// 14 high, 8 moderate, 4 low). This cannot be re-run live from a
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
  vulnerabilities: { high: number; moderate: number; low: number };
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

// Findings from `bun audit` on 2026-07-04 — see comment above.
const FINDINGS: DependencyAuditItem[] = [
  {
    id: "xlsx",
    label: "xlsx (تصدير Excel)",
    risk: "warning",
    detail:
      "^0.18.5 (<0.19.3) — ثغرتان عاليتا الخطورة (Prototype Pollution، ReDoS) في sheetJS. الاستخدام في هذا التطبيق كتابة فقط (XLSX.writeFile) — لا استدعاء XLSX.read() على أي ملف يرفعه المستخدم في أي مكان بالكود، ما يحدّ من قابلية الاستغلال الفعلية، لكن يُنصح بالترقية لـ ≥0.19.3 قبل الإصدار",
  },
  {
    id: "tanstack_start_server_core",
    label: "@tanstack/start-server-core (عبر @tanstack/react-start)",
    risk: "warning",
    detail:
      "<1.167.30 — ثغرة متوسطة: طلب تفكيك (deserialization) وارد لدالة خادم قد يستدعي دالة خادم أخرى مرتبطة بالعميل. يُستخدم createServerFn فعلياً في src/lib/api/example.functions.ts — يُنصح بترقية @tanstack/react-start",
  },
  {
    id: "jspdf_dompurify",
    label: "jspdf › dompurify (تصدير PDF)",
    risk: "warning",
    detail:
      "dompurify ≤3.4.10 (متوسطة الخطورة، تلوث إعدادات ALLOWED_ATTR) — تبعية غير مباشرة عبر jspdf المُستخدم في statement.ts/export-statement.ts لتصدير كشوف الحساب",
  },
  {
    id: "build_tooling_dev_only",
    label: "أدوات البناء والتطوير (devDependencies فقط)",
    risk: "safe",
    detail:
      "tar (عبر @capacitor/cli)، minimatch/brace-expansion (عبر eslint/@capacitor)، esbuild (عبر vite/tsx)، @babel/core، js-yaml، uuid (عبر @capacitor/assets) — كل هذه ثغرات في أدوات بناء لا تُشحن في حزمة الإنتاج للمتصفح/التطبيق، فلا تعريض فعلي للمستخدم النهائي",
  },
  {
    id: "capacitor_plugins",
    label: "Capacitor Plugins (android/app/haptics/keyboard/splash-screen/status-bar)",
    risk: "safe",
    detail:
      "6 حزم @capacitor/* رسمية مثبَّتة — لا ثغرات مباشرة عليها؛ الثغرة الوحيدة المرتبطة بـ Capacitor (tar) في @capacitor/cli، أداة بناء لا تُشحن في التطبيق",
  },
  {
    id: "supabase_sdk",
    label: "Supabase SDK (@supabase/supabase-js)",
    risk: "safe",
    detail: "^2.108.1 — لا ثغرات معروفة مُبلَّغة عليها مباشرة في تدقيق 2026-07-04",
  },
  {
    id: "react_ecosystem",
    label:
      "React Ecosystem (react/react-dom/react-hook-form/react-day-picker/@tanstack/react-query/react-router)",
    risk: "safe",
    detail:
      "react ^19.2.0، react-dom ^19.2.0، وباقي حزم React المباشرة — لا ثغرات معروفة مُبلَّغة عليها مباشرة في تدقيق 2026-07-04",
  },
];

export function auditDependencies(): DependencyAuditReport {
  const dependencyCount = Object.keys(PKG.dependencies ?? {}).length;
  const devDependencyCount = Object.keys(PKG.devDependencies ?? {}).length;

  return {
    items: FINDINGS,
    dependencyCount,
    devDependencyCount,
    vulnerabilities: { high: 14, moderate: 8, low: 4 },
    safeCount: FINDINGS.filter((f) => f.risk === "safe").length,
    warningCount: FINDINGS.filter((f) => f.risk === "warning").length,
    criticalCount: FINDINGS.filter((f) => f.risk === "critical").length,
    auditedAt: "2026-07-04",
    generatedAt: new Date().toISOString(),
  };
}
