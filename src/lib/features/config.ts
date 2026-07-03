// =============================================================
// PART 1 — Feature Flags Engine: flag registry
// -------------------------------------------------------------
// A static registry mapping real features built across this session to
// a flag type. This is a control-plane layer only — flags here can
// hide/show UI (via isFeatureEnabled() checks a caller adds later), but
// this module never touches the underlying feature's own code.
// =============================================================
import type { FeatureFlagDef } from "./types";

const NO_ROLLOUT = { rollout: 100, betaOnly: false, premiumOnly: false };

export const FEATURE_FLAGS: FeatureFlagDef[] = [
  {
    id: "dashboard_insights",
    label: "الرؤى المالية في لوحة التحكم",
    type: "always",
    description: "بطاقات الرؤى المالية على الصفحة الرئيسية (Prompt 16)",
    rollout: NO_ROLLOUT,
  },
  {
    id: "ads_placements",
    label: "أماكن الإعلانات",
    type: "production",
    description: "عرض أماكن الإعلانات المُعدَّة (Prompt 19) — يُنشَر تدريجياً عبر rollout",
    rollout: { rollout: 100, betaOnly: false, premiumOnly: false },
  },
  {
    id: "beta_feedback_dashboard",
    label: "لوحة ملاحظات Beta",
    type: "beta",
    description: "لوحة الملاحظات التفاعلية داخل /app/system (Prompt 21)",
    rollout: { rollout: 100, betaOnly: true, premiumOnly: false },
  },
  {
    id: "system_diagnostics_page",
    label: "صفحة تشخيص النظام",
    type: "internal",
    description: "/app/system بكل أقسامه — أداة تشغيل داخلية وليست ميزة مستخدم نهائي",
    rollout: NO_ROLLOUT,
  },
  {
    id: "release_engineering_section",
    label: "قسم هندسة الإطلاق",
    type: "internal",
    description: "قسم Release Engineering داخل /app/system (Prompt 22)",
    rollout: NO_ROLLOUT,
  },
  {
    id: "consent_manager_ui",
    label: "واجهة مدير الموافقات",
    type: "development",
    description: "شاشة موافقة المستخدم الفعلية (لم تُبنَ بعد — المحرك الخلفي جاهز من Prompt 24)",
    rollout: NO_ROLLOUT,
  },
  {
    id: "premium_ad_free",
    label: "وضع Premium بلا إعلانات",
    type: "premium",
    description: "إخفاء كل أماكن الإعلانات لمستخدمي Premium (ads/premium.ts)",
    rollout: NO_ROLLOUT,
  },
  {
    id: "cloud_backup_sync",
    label: "مزامنة النسخ الاحتياطي السحابية",
    type: "disabled",
    description:
      "مزامنة تلقائية لملفات النسخ الاحتياطي (Google Drive/iCloud/إلخ) — Stubs فقط، غير مُفعَّلة عمداً",
    rollout: NO_ROLLOUT,
  },
];

export function getFeatureDef(id: string): FeatureFlagDef | undefined {
  return FEATURE_FLAGS.find((f) => f.id === id);
}
