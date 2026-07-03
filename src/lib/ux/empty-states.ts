// =============================================================
// PART 1 — auditEmptyStates()
// -------------------------------------------------------------
// This is a STATIC code audit: empty-state quality (icon+message vs.
// bare text, presence of a call-to-action, presence of a short
// explanation) can't be measured from a running page in isolation, so
// the findings below were compiled by reading each route file directly
// (see .claude/PROGRESS.md for the session that produced them). Update
// this table by hand whenever one of these pages' empty state changes —
// this function reports what's recorded here, it doesn't re-scan files.
// =============================================================

export type EmptyStateQuality = "complete" | "partial" | "missing";

export interface PageEmptyStateAudit {
  id: string;
  label: string;
  route: string;
  hasEmptyState: boolean;
  hasCallToAction: boolean;
  hasExplanation: boolean;
  quality: EmptyStateQuality;
  note: string;
}

export const EMPTY_STATE_AUDIT_DATA: PageEmptyStateAudit[] = [
  {
    id: "dashboard",
    label: "لوحة التحكم",
    route: "/app",
    hasEmptyState: true,
    hasCallToAction: true,
    hasExplanation: false,
    quality: "partial",
    note: 'بطاقة المحافظ: رابط "أضف محفظتك الأولى" بلا شرح. بطاقة المصاريف: نص "لا توجد مصاريف بعد" بلا أيقونة ولا CTA.',
  },
  {
    id: "wallets",
    label: "المحافظ",
    route: "/app/wallets",
    hasEmptyState: true,
    hasCallToAction: true,
    hasExplanation: true,
    quality: "complete",
    note: 'كتلة كاملة (أيقونة + عنوان + وصف "لا توجد حسابات بعد")؛ زر الإضافة في الترويسة أعلى الصفحة وليس داخل الكتلة نفسها.',
  },
  {
    id: "transactions",
    label: "العمليات",
    route: "/app/transactions",
    hasEmptyState: false,
    hasCallToAction: false,
    hasExplanation: false,
    quality: "missing",
    note: 'نص مركزي "لا توجد عمليات في هذه الفترة" فقط — بلا أيقونة وبلا CTA مرتبط بالحالة.',
  },
  {
    id: "expenses",
    label: "المصاريف",
    route: "/app/expenses",
    hasEmptyState: true,
    hasCallToAction: false,
    hasExplanation: false,
    quality: "partial",
    note: 'نص "لا توجد مصاريف بعد" بحدود متقطعة، بلا أيقونة أو CTA داخل الكتلة (يوجد تحذير منفصل عند عدم وجود محافظ).',
  },
  {
    id: "people",
    label: "الأشخاص / الديون",
    route: "/app/people",
    hasEmptyState: true,
    hasCallToAction: true,
    hasExplanation: true,
    quality: "complete",
    note: 'التطبيق الأكمل: أيقونة + عنوان "لا يوجد أشخاص بعد" + وصف + زر "حركة جديدة".',
  },
  {
    id: "investments",
    label: "الأصول والاستثمارات",
    route: "/app/investments",
    hasEmptyState: true,
    hasCallToAction: false,
    hasExplanation: true,
    quality: "partial",
    note: 'أيقونة + عنوان "لا يوجد أصول بعد" + وصف، لكن بلا CTA داخل الكتلة (زر الإضافة في الترويسة منفصل).',
  },
  {
    id: "zakat",
    label: "الزكاة",
    route: "/app/zakat",
    hasEmptyState: false,
    hasCallToAction: false,
    hasExplanation: false,
    quality: "missing",
    note: "صفحة حاسبة/إعدادات بلا قائمة أساسية؛ قسم زكاة أصول الاستثمار يختفي تماماً (return null) عند عدم وجود عناصر بدل عرض رسالة.",
  },
  {
    id: "events",
    label: "الأحداث والتذكيرات",
    route: "/app/events",
    hasEmptyState: true,
    hasCallToAction: false,
    hasExplanation: false,
    quality: "partial",
    note: 'كتلة بحدود متقطعة مع أيقونة ونص "لا توجد أحداث في هذه الفترة"، بلا شرح إضافي وبلا CTA داخل الكتلة.',
  },
  {
    id: "insights",
    label: "الرؤى المالية",
    route: "/app/insights",
    hasEmptyState: false,
    hasCallToAction: false,
    hasExplanation: false,
    quality: "missing",
    note: 'لا يوجد فحص حالة فارغة على مستوى الصفحة؛ العناصر الفردية تعرض "0" بصمت بدل رسالة توضيحية.',
  },
];

export interface EmptyStatesAuditReport {
  pages: PageEmptyStateAudit[];
  completeCount: number;
  partialCount: number;
  missingCount: number;
  score: number; // 0-100, complete=1 partial=0.5 missing=0, averaged
  generatedAt: string;
}

const QUALITY_WEIGHT: Record<EmptyStateQuality, number> = { complete: 1, partial: 0.5, missing: 0 };

export function auditEmptyStates(): EmptyStatesAuditReport {
  const pages = EMPTY_STATE_AUDIT_DATA;
  const completeCount = pages.filter((p) => p.quality === "complete").length;
  const partialCount = pages.filter((p) => p.quality === "partial").length;
  const missingCount = pages.filter((p) => p.quality === "missing").length;
  const score =
    pages.length > 0
      ? Math.round((pages.reduce((s, p) => s + QUALITY_WEIGHT[p.quality], 0) / pages.length) * 100)
      : 0;
  return {
    pages,
    completeCount,
    partialCount,
    missingCount,
    score,
    generatedAt: new Date().toISOString(),
  };
}
