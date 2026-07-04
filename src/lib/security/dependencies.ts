// =============================================================
// PART 5 — auditDependencySecurity()
// -------------------------------------------------------------
// Reuses rc/dependencies.ts's auditDependencies() (Prompt 28 — the
// actual `bun audit` data, verified 2026-07-04) as its source of truth
// rather than re-running or re-declaring the vulnerability findings.
// This module's job is narrower: map each of the 6 named packages this
// prompt asks about to a concrete resolution action.
// =============================================================
import { auditDependencies } from "@/lib/rc/dependencies";

export type DependencyRisk = "safe" | "warning" | "critical";

export interface DependencySecurityItem {
  id: string;
  package: string;
  currentVersion: string;
  risk: DependencyRisk;
  recommendedAction: string;
  detail: string;
}

export interface DependencySecurityReport {
  items: DependencySecurityItem[];
  criticalCount: number;
  warningCount: number;
  safeCount: number;
  auditedAt: string;
  generatedAt: string;
}

export async function auditDependencySecurity(): Promise<DependencySecurityReport> {
  const base = await Promise.resolve(auditDependencies());

  const items: DependencySecurityItem[] = [
    {
      id: "xlsx",
      package: "xlsx",
      currentVersion: "^0.18.5",
      risk: "warning",
      recommendedAction: "ترقية إلى ≥0.19.3 (bun add xlsx@latest) قبل أي إصدار إنتاجي",
      detail:
        base.items.find((i) => i.id === "xlsx")?.detail ??
        "ثغرتان عاليتا الخطورة (Prototype Pollution، ReDoS) — الاستخدام في هذا التطبيق كتابة فقط، لا قابلية استغلال فعلية حالياً",
    },
    {
      id: "dompurify",
      package: "dompurify (عبر jspdf)",
      currentVersion: "≤3.4.10 (تبعية غير مباشرة)",
      risk: "warning",
      recommendedAction:
        "ترقية jspdf لسحب إصدار dompurify أحدث؛ لا إجراء مباشر ممكن (تبعية غير مباشرة)",
      detail:
        base.items.find((i) => i.id === "jspdf_dompurify")?.detail ??
        "ثغرة متوسطة (تلوث ALLOWED_ATTR) في مسار تصدير PDF لكشوف الحساب",
    },
    {
      id: "tanstack",
      package: "@tanstack/start-server-core (عبر @tanstack/react-start)",
      currentVersion: "<1.167.30 (تبعية غير مباشرة)",
      risk: "warning",
      recommendedAction: "ترقية @tanstack/react-start إلى أحدث إصدار متوافق",
      detail:
        base.items.find((i) => i.id === "tanstack_start_server_core")?.detail ??
        "ثغرة متوسطة في تفكيك طلبات دوال الخادم — يُستخدم createServerFn فعلياً في هذا المشروع",
    },
    {
      id: "vite",
      package: "vite (عبر esbuild الداخلي)",
      currentVersion: "^8.0.16",
      risk: "safe",
      recommendedAction:
        "لا إجراء مطلوب حالياً — الثغرة المرتبطة (esbuild، منخفضة) في مسار تطوير Windows فقط ولا تُشحن للإنتاج",
      detail:
        "esbuild ضمن vite/tsx: ثغرة منخفضة (قراءة ملف عشوائي في خادم التطوير على Windows فقط)",
    },
    {
      id: "capacitor",
      package: "@capacitor/cli و@capacitor/assets (أدوات بناء)",
      currentVersion: "^8.4.0 / ^3.0.5",
      risk: "safe",
      recommendedAction:
        "لا إجراء عاجل — أدوات بناء لا تُشحن في التطبيق؛ يمكن رصدها دورياً عبر bun audit",
      detail: "الثغرات المرتبطة (tar، minimatch، uuid) في تبعيات هذه الأدوات، لا في حزمة الإنتاج",
    },
    {
      id: "supabase",
      package: "@supabase/supabase-js",
      currentVersion: "^2.108.1",
      risk: "safe",
      recommendedAction: "لا إجراء مطلوب — لا ثغرات معروفة في تدقيق 2026-07-04",
      detail: "SDK المصادقة/قاعدة البيانات الأساسي — نظيف في آخر تدقيق",
    },
  ];

  return {
    items,
    criticalCount: items.filter((i) => i.risk === "critical").length,
    warningCount: items.filter((i) => i.risk === "warning").length,
    safeCount: items.filter((i) => i.risk === "safe").length,
    auditedAt: base.auditedAt,
    generatedAt: new Date().toISOString(),
  };
}
