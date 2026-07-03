// =============================================================
// PART 4 — computeLaunchBlockers()
// -------------------------------------------------------------
// Normalizes 7 existing reports into one flat, uniform blocker list —
// nothing here recomputes any of their underlying logic.
// =============================================================
import { detectReleaseBlockers } from "@/lib/beta/release-blockers";
import { evaluateProductionGate } from "./production-gate";
import { generateLaunchChecklist } from "./launch-checklist";
import { auditCompliance } from "./compliance-audit";
import { auditPWA } from "./pwa-audit";
import { auditAndroidRelease } from "./android-audit";
import { auditIOSRelease } from "./ios-audit";

export type BlockerSeverity = "critical" | "warning" | "info";

export interface LaunchBlocker {
  blocker_id: string;
  severity: BlockerSeverity;
  category: string;
  title: string;
  description: string;
  fix: string;
  resolved: boolean;
}

export interface LaunchBlockersReport {
  blockers: LaunchBlocker[];
  unresolvedCount: number;
  criticalCount: number;
  generatedAt: string;
}

const CATEGORY_FIX: Record<string, string> = {
  release: "راجع تفاصيل العائق في قسم Beta Operations بـ /app/system",
  production_gate: "راجع تفاصيل الفئة في قسم Production Gate بـ /app/system",
  compliance:
    "راجع تفاصيل البند في قسم Compliance بـ /app/system، أو استكمل الصفحات القانونية على /legal/*",
  pwa: "افتح أي صفحة في التطبيق ليُسجَّل Service Worker تلقائياً",
  mobile:
    "أضف منصّة Android/iOS الأصلية حسب المنصّة (راجع MOBILE_BUILD.md)، وعطّل Live Reload قبل البناء النهائي",
  launch_stage:
    "راجع قسم Release Engineering في /app/system لتفاصيل المتطلبات غير المُستوفاة لهذه المرحلة",
};

export async function computeLaunchBlockers(): Promise<LaunchBlockersReport> {
  const [releaseBlockers, gate, launchChecklist, compliance, pwa] = await Promise.all([
    detectReleaseBlockers(),
    evaluateProductionGate(),
    generateLaunchChecklist(),
    auditCompliance(),
    auditPWA(),
  ]);
  const android = auditAndroidRelease();
  const ios = auditIOSRelease();

  const blockers: LaunchBlocker[] = [];

  for (const b of releaseBlockers.blockers) {
    blockers.push({
      blocker_id: `release_${b.id}`,
      severity: b.blocking ? "critical" : "info",
      category: "release",
      title: b.label,
      description: b.detail,
      fix: CATEGORY_FIX.release,
      resolved: !b.blocking,
    });
  }

  for (const item of gate.checklist) {
    blockers.push({
      blocker_id: `gate_${item.id}`,
      severity:
        item.status === "error" ? "critical" : item.status === "warning" ? "warning" : "info",
      category: "production_gate",
      title: item.label,
      description: item.detail,
      fix: CATEGORY_FIX.production_gate,
      resolved: item.status === "ok",
    });
  }

  for (const item of compliance.items) {
    blockers.push({
      blocker_id: `compliance_${item.id}`,
      severity:
        item.status === "error" ? "critical" : item.status === "warning" ? "warning" : "info",
      category: "compliance",
      title: item.label,
      description: item.detail,
      fix: CATEGORY_FIX.compliance,
      resolved: item.status === "ok",
    });
  }

  blockers.push({
    blocker_id: "pwa_installable",
    severity: pwa.installable ? "info" : "warning",
    category: "pwa",
    title: "PWA Installability",
    description: pwa.installable
      ? "قابل للتثبيت"
      : "غير قابل للتثبيت — Service Worker غير مسجَّل بعد",
    fix: CATEGORY_FIX.pwa,
    resolved: pwa.installable,
  });

  blockers.push({
    blocker_id: "android_readiness",
    severity: android.score === 100 ? "info" : android.score >= 60 ? "warning" : "critical",
    category: "mobile",
    title: "Android Release Readiness",
    description: `${android.score}/100`,
    fix: CATEGORY_FIX.mobile,
    resolved: android.score === 100,
  });

  blockers.push({
    blocker_id: "ios_readiness",
    severity: ios.score === 100 ? "info" : ios.score >= 60 ? "warning" : "critical",
    category: "mobile",
    title: "iOS Release Readiness",
    description: `${ios.score}/100`,
    fix: CATEGORY_FIX.mobile,
    resolved: ios.score === 100,
  });

  for (const stage of launchChecklist.stages) {
    if (!stage.ready) {
      const unmet = stage.requirements.filter((r) => !r.met);
      blockers.push({
        blocker_id: `stage_${stage.id}`,
        severity: "warning",
        category: "launch_stage",
        title: `مرحلة ${stage.label} غير مكتملة`,
        description: unmet.map((r) => r.label).join("، "),
        fix: CATEGORY_FIX.launch_stage,
        resolved: false,
      });
    }
  }

  const unresolved = blockers.filter((b) => !b.resolved);
  return {
    blockers,
    unresolvedCount: unresolved.length,
    criticalCount: unresolved.filter((b) => b.severity === "critical").length,
    generatedAt: new Date().toISOString(),
  };
}
