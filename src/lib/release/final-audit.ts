// =============================================================
// PART 7 (Prompt 24) — runFinalProductionAudit()
// -------------------------------------------------------------
// The capstone: 9 weighted categories summing to 100, each reusing a
// real existing engine's output — nothing here recomputes financial,
// backup, ads, compliance, mobile, PWA, accessibility, or beta logic.
// =============================================================
import { validateFinancialIntegrity } from "@/lib/system/integrity";
import { loadLastBackup } from "@/lib/backup/engine";
import { verifyBackupIntegrity } from "@/lib/backup/integrity";
import { loadNotificationSettings } from "@/lib/notifications/config";
import { auditAdsConfiguration } from "@/lib/ads/audit";
import { auditCompliance } from "@/lib/release/compliance-audit";
import { auditMobileCompatibility } from "@/lib/mobile/compatibility";
import { auditAndroidRelease } from "@/lib/release/android-audit";
import { auditIOSRelease } from "@/lib/release/ios-audit";
import { auditPWA } from "@/lib/release/pwa-audit";
import { auditAccessibility } from "@/lib/ux/accessibility";
import { getBetaUserChecklist } from "@/lib/beta/checklist";
import { detectReleaseBlockers } from "@/lib/beta/release-blockers";

export interface FinalAuditCategory {
  id: string;
  label: string;
  weight: number;
  score: number;
  contribution: number;
  detail: string;
}

export interface FinalAuditReport {
  productionReady: boolean;
  score: number;
  categories: FinalAuditCategory[];
  blockers: string[];
  warnings: string[];
  recommendations: string[];
  generatedAt: string;
}

export async function runFinalProductionAudit(): Promise<FinalAuditReport> {
  const [integrity, lastBackup, compliance, pwa, betaChecklist, releaseBlockers] =
    await Promise.all([
      validateFinancialIntegrity(),
      loadLastBackup(),
      auditCompliance(),
      auditPWA(),
      getBetaUserChecklist(),
      detectReleaseBlockers(),
    ]);
  const notifSettings = loadNotificationSettings();
  const adsAudit = auditAdsConfiguration();
  const mobileCompat = auditMobileCompatibility();
  const android = auditAndroidRelease();
  const ios = auditIOSRelease();
  const a11y = auditAccessibility();

  const categories: FinalAuditCategory[] = [];
  const add = (id: string, label: string, weight: number, score: number, detail: string) => {
    const clamped = Math.max(0, Math.min(100, Math.round(score)));
    categories.push({
      id,
      label,
      weight,
      score: clamped,
      contribution: (clamped * weight) / 100,
      detail,
    });
  };

  // 1. Financial Integrity (20) — reuses Integrity Validator
  const integrityScore = integrity.valid
    ? 100
    : Math.max(0, 100 - integrity.errors.length * 20 - integrity.warnings.length * 5);
  add(
    "financial_integrity",
    "سلامة البيانات المالية",
    20,
    integrityScore,
    `${integrity.errors.length} خطأ، ${integrity.warnings.length} تحذير`,
  );

  // 2. Backup Readiness (10) — reuses Backup Engine + this Prompt's own verifyBackupIntegrity()
  let backupScore = 0;
  let backupDetail = "لا نسخة احتياطية محلية بعد";
  if (lastBackup) {
    const backupIntegrity = await verifyBackupIntegrity(lastBackup);
    backupScore = backupIntegrity.score;
    backupDetail = `آخر نسخة بتاريخ ${lastBackup.meta.exported_at} — سلامة الملف: ${backupIntegrity.score}/100`;
  }
  add("backup", "جاهزية النسخ الاحتياطي", 10, backupScore, backupDetail);

  // 3. Notifications (10) — reuses Notification Engine settings
  add(
    "notifications",
    "الإشعارات",
    10,
    notifSettings.enabled ? 100 : 40,
    notifSettings.enabled ? "المحرك مفعّل" : "معطّل من الإعدادات",
  );

  // 4. Ads Readiness (10) — reuses Ads Audit
  const anyAdsConfigured =
    adsAudit.web.configured || adsAudit.android.configured || adsAudit.ios.configured;
  add(
    "ads",
    "جاهزية الإعلانات",
    10,
    anyAdsConfigured ? 100 : 50,
    anyAdsConfigured
      ? "منصّة واحدة على الأقل بمعرّفات حقيقية"
      : "كل المعرّفات لا تزال placeholder — مقبول قبل الإطلاق الفعلي بالإعلانات",
  );

  // 5. Compliance (15) — reuses Release Audit's Compliance module
  add("compliance", "الامتثال", 15, compliance.score, `${compliance.score}/100`);

  // 6. Mobile (10) — average of Mobile/Android/iOS readiness
  const mobileUnsupported = mobileCompat.items.filter((i) => !i.supported).length;
  const mobileCompatScore = Math.round(
    ((mobileCompat.items.length - mobileUnsupported) / Math.max(1, mobileCompat.items.length)) *
      100,
  );
  const mobileScore = Math.round((mobileCompatScore + android.score + ios.score) / 3);
  add(
    "mobile",
    "الجاهزية للجوال",
    10,
    mobileScore,
    `التوافق: ${mobileCompatScore}/100 — Android: ${android.score}/100 — iOS: ${ios.score}/100`,
  );

  // 7. PWA (10) — reuses this session's PWA audit
  add(
    "pwa",
    "جاهزية PWA",
    10,
    pwa.score,
    pwa.installable ? "قابل للتثبيت" : "غير قابل للتثبيت بعد",
  );

  // 8. Accessibility (5) — reuses Accessibility Audit
  add("accessibility", "إتاحة الوصول", 5, a11y.score, `${a11y.score}/100`);

  // 9. Beta Completion (10) — reuses Beta Engine
  add(
    "beta_completion",
    "إتمام Beta",
    10,
    betaChecklist.completionPercent,
    `${betaChecklist.items.filter((i) => i.done).length}/${betaChecklist.items.length} بند مكتمل`,
  );

  // Blockers — reuses Beta Engine's Release Blockers, plus a hard financial-integrity gate.
  const blockers: string[] = [];
  if (integrity.errors.length > 0) {
    blockers.push(`سلامة مالية: ${integrity.errors.length} خطأ حرج يجب حله قبل أي إطلاق`);
  }
  for (const b of releaseBlockers.blockers) {
    if (b.blocking) blockers.push(`${b.label}: ${b.detail}`);
  }

  const warnings: string[] = [];
  if (!lastBackup) warnings.push("لا نسخة احتياطية محلية — يُنصح بإنشاء واحدة قبل المتابعة");
  if (!pwa.installable)
    warnings.push("PWA غير قابل للتثبيت (Service Worker غير مسجَّل في هذه الجلسة)");
  if (android.score < 100) warnings.push(`تدقيق Android غير مكتمل (${android.score}/100)`);
  if (ios.score < 100) warnings.push(`تدقيق iOS غير مكتمل (${ios.score}/100)`);
  if (compliance.score < 100) warnings.push(`الامتثال غير مكتمل (${compliance.score}/100)`);

  const recommendations: string[] = [];
  if (compliance.score < 100) {
    recommendations.push(
      "انشر الصفحات القانونية (/legal/*) على نطاقك الحقيقي واستبدل روابط Placeholder في src/lib/release/metadata-config.ts",
    );
  }
  if (backupScore < 100) {
    recommendations.push("أنشئ نسخة احتياطية جديدة وتحقق من سلامتها عبر verifyBackupIntegrity()");
  }
  if (!pwa.installable) {
    recommendations.push(
      "افتح أي صفحة في التطبيق ليُسجَّل Service Worker تلقائياً ويصبح PWA قابلاً للتثبيت",
    );
  }
  if (android.score < 100) {
    recommendations.push(
      "أضف منصّة Android الأصلية (bun run android:add) وعطّل Live Reload/allowMixedContent قبل بناء AAB للنشر",
    );
  }
  if (ios.score < 100) {
    recommendations.push("أضف منصّة iOS عند توفّر جهاز macOS وXcode وحساب Apple Developer");
  }
  if (recommendations.length === 0) {
    recommendations.push(
      "لا توصيات إضافية — راجع لوحتَي Compliance وRelease Engineering دورياً قبل كل إصدار",
    );
  }

  const totalScore = Math.round(categories.reduce((s, c) => s + c.contribution, 0));
  const productionReady = blockers.length === 0 && totalScore >= 90;

  return {
    productionReady,
    score: totalScore,
    categories,
    blockers,
    warnings,
    recommendations,
    generatedAt: new Date().toISOString(),
  };
}
