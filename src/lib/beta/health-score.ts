// =============================================================
// PART 6 — calculateBetaHealth()
// -------------------------------------------------------------
// 6 weighted categories summing to 100, each reusing an existing
// engine's real output — same closure pattern as
// ux/readiness-score.ts's calculateReleaseReadiness().
// =============================================================
import { runSystemHealthCheck } from "@/lib/system/health";
import { auditAccessibility } from "@/lib/ux/accessibility";
import { getBetaSessionStats } from "./session";
import { getBetaUserChecklist } from "./checklist";
import { loadBetaFeedback } from "@/lib/ux/feedback";

export interface BetaHealthCategory {
  id: string;
  label: string;
  weight: number;
  score: number;
  contribution: number;
  detail: string;
}

export interface BetaHealthReport {
  categories: BetaHealthCategory[];
  totalScore: number; // "Beta Health Score XX/100"
  label: string;
  generatedAt: string;
}

function healthLabel(score: number): string {
  if (score >= 80) return "صحة Beta ممتازة";
  if (score >= 55) return "صحة Beta مقبولة — تحتاج متابعة";
  return "صحة Beta ضعيفة — راجع نقاط الاحتكاك والتغطية";
}

export async function calculateBetaHealth(): Promise<BetaHealthReport> {
  const categories: BetaHealthCategory[] = [];
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

  // 1. Usage (15) — session count from the local tracker (no external analytics)
  const stats = getBetaSessionStats();
  const usageScore = Math.min(100, stats.totalSessions * 10);
  add(
    "usage",
    "الاستخدام",
    15,
    usageScore,
    `${stats.totalSessions} جلسة مسجَّلة محلياً — متوسط ${Math.round(stats.averageSessionDurationMs / 1000)} ثانية/جلسة`,
  );

  // 2. Completion (20) — reuses Beta User Checklist
  const checklist = await getBetaUserChecklist();
  add(
    "completion",
    "إتمام قائمة المختبر",
    20,
    checklist.completionPercent,
    `${checklist.items.filter((i) => i.done).length}/${checklist.items.length} بند مكتمل`,
  );

  // 3. Stability (20) — reuses System Health Engine
  const health = await runSystemHealthCheck();
  const stabilityScore = health.status === "ok" ? 100 : health.status === "warning" ? 60 : 20;
  add("stability", "الاستقرار", 20, stabilityScore, `فحص النظام: ${health.status}`);

  // 4. Feedback (15) — reuses the Beta Feedback log
  const feedback = loadBetaFeedback();
  const ratings = feedback.filter((f) => f.type === "rating" && typeof f.rating === "number");
  const bugCount = feedback.filter((f) => f.type === "bug").length;
  let feedbackScore: number;
  let feedbackDetail: string;
  if (ratings.length > 0) {
    const avg = ratings.reduce((s, f) => s + (f.rating ?? 0), 0) / ratings.length;
    feedbackScore = (avg / 5) * 100;
    feedbackDetail = `متوسط تقييم ${avg.toFixed(1)}/5 من ${ratings.length} تقييم`;
  } else if (feedback.length === 0) {
    feedbackScore = 70; // neutral default — no signal yet either way
    feedbackDetail = "لا توجد ملاحظات محلية بعد";
  } else {
    feedbackScore = Math.max(20, 100 - bugCount * 15);
    feedbackDetail = `${bugCount} بلاغ خطأ من أصل ${feedback.length} ملاحظة، بلا تقييمات نجوم بعد`;
  }
  add("feedback", "الملاحظات", 15, feedbackScore, feedbackDetail);

  // 5. Accessibility (15) — reuses this session's Accessibility Audit
  const a11y = auditAccessibility();
  add(
    "accessibility",
    "إتاحة الوصول",
    15,
    a11y.score,
    `${a11y.items.filter((i) => i.status === "ok").length}/${a11y.items.length} فحص ناجح`,
  );

  // 6. Mobile Usage (15) — % of tracked local sessions on native/mobile-width
  add(
    "mobile_usage",
    "استخدام الجوال",
    15,
    stats.totalSessions > 0 ? stats.mobileSessionsPercent : 50,
    stats.totalSessions > 0
      ? `${stats.mobileSessionsPercent}% من الجلسات على جوال/تطبيق أصلي`
      : "لا توجد جلسات مسجَّلة بعد لقياس نسبة استخدام الجوال",
  );

  const totalScore = Math.round(categories.reduce((s, c) => s + c.contribution, 0));
  return {
    categories,
    totalScore,
    label: healthLabel(totalScore),
    generatedAt: new Date().toISOString(),
  };
}
