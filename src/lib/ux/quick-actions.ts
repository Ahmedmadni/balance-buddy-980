// =============================================================
// PART 3 — auditQuickActions()
// -------------------------------------------------------------
// STATIC audit: encodes the actual navigation paths in the app (the
// dashboard's QuickActionsRow tiles, src/components/dashboard/
// QuickActionsRow.tsx, plus the sidebar/bottom-nav in
// src/routes/_authenticated/route.tsx) and counts taps from "anywhere
// in the app" — verified against the real route files, not assumed:
// wallets/expenses/people DO read a `?new=` search param to auto-open
// their add dialog (useSearch({ strict:false })), investments does NOT.
// =============================================================

export interface QuickActionAudit {
  id: string;
  label: string;
  taps: number;
  path: string;
  withinLimit: boolean; // taps <= 2
}

const RAW_ACTIONS: { id: string; label: string; taps: number; path: string }[] = [
  {
    id: "expense",
    label: "إضافة مصروف",
    taps: 2,
    path: 'الرئيسية (تنقّل سفلي) ← بلاطة "مصروف" (يفتح النموذج مباشرة عبر ?new=1)',
  },
  {
    id: "income",
    label: "إضافة دخل",
    taps: 2,
    path: 'الرئيسية ← بلاطة "دخل" (يفتح النموذج مباشرة عبر ?new=income)',
  },
  {
    id: "transfer",
    label: "تحويل بين محافظ",
    taps: 2,
    path: 'الرئيسية ← بلاطة "تحويل" (يفتح النموذج مباشرة عبر ?new=transfer)',
  },
  {
    id: "debt",
    label: "دين / تحصيل",
    taps: 2,
    path: 'الرئيسية ← بلاطة "دين / تحصيل" (يفتح النموذج مباشرة عبر ?new=1)',
  },
  {
    id: "invest",
    label: "إضافة أصل/استثمار",
    taps: 3,
    path: 'الرئيسية ← بلاطة "استثمار" ← زر "+ استثمار" (الصفحة لا تقرأ ?new= بعد فتحها)',
  },
  { id: "zakat_open", label: "فتح حاسبة الزكاة", taps: 2, path: 'الرئيسية ← بلاطة "الزكاة"' },
  {
    id: "new_event",
    label: "إضافة حدث/تذكير",
    taps: 3,
    path: 'قائمة التنقّل (☰ على الجوال) ← "الأحداث" ← زر "+ حدث جديد" (غير موجودة في التنقّل السفلي)',
  },
  {
    id: "backup_export",
    label: "تصدير نسخة احتياطية",
    taps: 4,
    path: 'قائمة التنقّل (☰) ← الإعدادات ← تبويب "النسخ الاحتياطي" ← زر التصدير',
  },
];

export interface QuickActionsAuditReport {
  actions: QuickActionAudit[];
  withinLimitCount: number;
  exceedingCount: number;
  score: number; // % of actions within the 2-tap limit
  generatedAt: string;
}

export function auditQuickActions(): QuickActionsAuditReport {
  const actions: QuickActionAudit[] = RAW_ACTIONS.map((a) => ({ ...a, withinLimit: a.taps <= 2 }));
  const withinLimitCount = actions.filter((a) => a.withinLimit).length;
  const exceedingCount = actions.length - withinLimitCount;
  const score = actions.length > 0 ? Math.round((withinLimitCount / actions.length) * 100) : 0;
  return {
    actions,
    withinLimitCount,
    exceedingCount,
    score,
    generatedAt: new Date().toISOString(),
  };
}
