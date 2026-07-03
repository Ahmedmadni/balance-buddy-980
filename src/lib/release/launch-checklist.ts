// =============================================================
// PART 8 — generateLaunchChecklist()
// -------------------------------------------------------------
// 5 gated stages (Pre-Beta → Closed Beta → Open Beta → Soft Launch →
// Production Launch), each gated by real reused reports: Release
// Readiness (Prompt 20), Beta Health (Prompt 21), System Health,
// Integrity, plus this prompt's own Android/iOS/PWA/Compliance/
// Production-Environment audits. Nothing here recomputes any of their
// underlying logic — it only reads scores/statuses already produced.
// =============================================================
import { calculateReleaseReadiness } from "@/lib/ux/readiness-score";
import { calculateBetaHealth } from "@/lib/beta/health-score";
import { runSystemHealthCheck } from "@/lib/system/health";
import { validateFinancialIntegrity } from "@/lib/system/integrity";
import { auditAppMetadata } from "./metadata-audit";
import { auditAndroidRelease } from "./android-audit";
import { auditIOSRelease } from "./ios-audit";
import { auditPWA } from "./pwa-audit";
import { auditCompliance } from "./compliance-audit";
import { auditProductionEnvironment } from "./production-audit";

export type LaunchStageId =
  | "pre_beta"
  | "closed_beta"
  | "open_beta"
  | "soft_launch"
  | "production_launch";

export interface LaunchRequirement {
  label: string;
  met: boolean;
  detail: string;
}

export interface LaunchStage {
  id: LaunchStageId;
  label: string;
  ready: boolean;
  requirements: LaunchRequirement[];
}

export interface LaunchChecklistReport {
  stages: LaunchStage[];
  currentStage: LaunchStageId; // furthest stage whose requirements are all met
  generatedAt: string;
}

const STAGE_LABEL: Record<LaunchStageId, string> = {
  pre_beta: "Pre-Beta",
  closed_beta: "Closed Beta",
  open_beta: "Open Beta",
  soft_launch: "Soft Launch",
  production_launch: "Production Launch",
};

export async function generateLaunchChecklist(): Promise<LaunchChecklistReport> {
  const [health, integrity, readiness, betaHealth, pwa, compliance, prodEnv] = await Promise.all([
    runSystemHealthCheck(),
    validateFinancialIntegrity(),
    calculateReleaseReadiness(),
    calculateBetaHealth(),
    auditPWA(),
    auditCompliance(),
    auditProductionEnvironment(),
  ]);
  const metadata = auditAppMetadata();
  const android = auditAndroidRelease();
  const ios = auditIOSRelease();

  const stages: LaunchStage[] = [
    {
      id: "pre_beta",
      label: STAGE_LABEL.pre_beta,
      ready: false,
      requirements: [
        {
          label: "الفحص الصحي للنظام سليم",
          met: health.status !== "error",
          detail: `حالة النظام: ${health.status}`,
        },
        {
          label: "لا أخطاء سلامة بيانات مالية",
          met: integrity.errors.length === 0,
          detail: `${integrity.errors.length} خطأ`,
        },
        {
          label: "درجة جاهزية الإطلاق ≥ 50",
          met: readiness.totalScore >= 50,
          detail: `RC Score: ${readiness.totalScore}/100`,
        },
      ],
    },
    {
      id: "closed_beta",
      label: STAGE_LABEL.closed_beta,
      ready: false,
      requirements: [
        {
          label: "درجة جاهزية الإطلاق ≥ 65",
          met: readiness.totalScore >= 65,
          detail: `RC Score: ${readiness.totalScore}/100`,
        },
        {
          label: "بيئة الإنتاج (Supabase/Auth/Storage) سليمة ≥ 70",
          met: prodEnv.score >= 70,
          detail: `${prodEnv.score}/100`,
        },
        {
          label: "لا خطأ حرج في بند النسخ الاحتياطي ببيئة الإنتاج",
          met: prodEnv.items.find((i) => i.id === "backup")?.status !== "error",
          detail: "راجع بند Backup في تدقيق بيئة الإنتاج",
        },
      ],
    },
    {
      id: "open_beta",
      label: STAGE_LABEL.open_beta,
      ready: false,
      requirements: [
        {
          label: "صحة Beta ≥ 55",
          met: betaHealth.totalScore >= 55,
          detail: `Beta Health: ${betaHealth.totalScore}/100`,
        },
        {
          label: "منصّة Android (Capacitor) مضافة",
          met: android.items.find((i) => i.id === "capacitor_android")?.status === "ok",
          detail: "راجع Android Release Audit",
        },
        {
          label: "تطبيق الويب (PWA) قابل للتثبيت",
          met: pwa.installable,
          detail: pwa.installable ? "معايير Chrome الحقيقية مُستوفاة" : "Service Worker مفقود",
        },
      ],
    },
    {
      id: "soft_launch",
      label: STAGE_LABEL.soft_launch,
      ready: false,
      requirements: [
        {
          label: "بيانات التطبيق الوصفية مكتملة (App Metadata)",
          met: metadata.score === 100,
          detail: `${metadata.configuredCount}/${metadata.totalCount}`,
        },
        {
          label: "الامتثال والخصوصية ≥ 75",
          met: compliance.score >= 75,
          detail: `${compliance.score}/100`,
        },
        {
          label: "لا خطأ حرج في تدقيق iOS (Info.plist موجود)",
          met: ios.items.find((i) => i.id === "info_plist")?.status !== "error",
          detail: "راجع iOS Release Audit",
        },
      ],
    },
    {
      id: "production_launch",
      label: STAGE_LABEL.production_launch,
      ready: false,
      requirements: [
        {
          label: "درجة جاهزية الإطلاق ≥ 90",
          met: readiness.totalScore >= 90,
          detail: `RC Score: ${readiness.totalScore}/100`,
        },
        {
          label: "الامتثال الكامل (GDPR/CCPA/Consent) = 100",
          met: compliance.score === 100,
          detail: `${compliance.score}/100`,
        },
        {
          label: "تدقيقا Android وiOS مكتملان بالكامل",
          met: android.score === 100 && ios.score === 100,
          detail: `Android: ${android.score}/100 — iOS: ${ios.score}/100`,
        },
      ],
    },
  ];

  for (const stage of stages) stage.ready = stage.requirements.every((r) => r.met);

  let currentStage: LaunchStageId = "pre_beta";
  for (const stage of stages) {
    if (!stage.ready) break;
    currentStage = stage.id;
  }

  return { stages, currentStage, generatedAt: new Date().toISOString() };
}
