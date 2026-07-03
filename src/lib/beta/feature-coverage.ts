// =============================================================
// PART 3 — auditFeatureCoverage()
// -------------------------------------------------------------
// For each of the 10 feature areas: "Covered" when real usage data
// exists (a Supabase row, an enabled setting, a saved backup), else
// "Untested" when the page was opened in a local session but no data
// exists yet, else "Never Used". Reports/Insights have no dedicated
// data table of their own (they're computed views), so their signal
// is page-visit only — documented per item below.
// =============================================================
import { supabase } from "@/integrations/supabase/client";
import { loadLastBackup } from "@/lib/backup/engine";
import { loadNotificationSettings } from "@/lib/notifications/config";
import { getBetaSessionStats } from "./session";

export type FeatureCoverageStatus = "covered" | "untested" | "never_used";

export interface FeatureCoverageItem {
  id: string;
  label: string;
  status: FeatureCoverageStatus;
  detail: string;
}

export interface FeatureCoverageReport {
  items: FeatureCoverageItem[];
  coveredCount: number;
  untestedCount: number;
  neverUsedCount: number;
  generatedAt: string;
}

interface InvestmentTypeRow {
  asset_kind: string | null;
  type: string | null;
}

const FINANCIAL_TYPES = new Set(["stocks", "crypto", "fund", "trade"]);

function statusFor(hasData: boolean, hasVisit: boolean): FeatureCoverageStatus {
  if (hasData) return "covered";
  if (hasVisit) return "untested";
  return "never_used";
}

export async function auditFeatureCoverage(): Promise<FeatureCoverageReport> {
  const [walletsRes, expensesRes, debtRes, investmentsRes] = await Promise.all([
    supabase.from("wallets").select("*", { count: "exact", head: true }),
    supabase.from("expenses").select("*", { count: "exact", head: true }),
    supabase.from("person_ledger").select("*", { count: "exact", head: true }),
    supabase.from("investments").select("asset_kind,type").is("parent_investment_id", null),
  ]);
  const zakatRes = await supabase.from("zakat_records").select("*", { count: "exact", head: true });
  const lastBackup = await loadLastBackup();
  const notifSettings = loadNotificationSettings();

  const investmentRows = (investmentsRes.data ?? []) as InvestmentTypeRow[];
  const effectiveTypes = investmentRows.map((r) => r.asset_kind || r.type || "custom");
  const hasFinancialInvestment = effectiveTypes.some((t) => FINANCIAL_TYPES.has(t));
  const hasPhysicalAsset = effectiveTypes.some((t) => !FINANCIAL_TYPES.has(t));

  const visitedPaths = getBetaSessionStats().pagesVisited.map((p) => p.path);
  const visited = (prefix: string) => visitedPaths.some((p) => p.startsWith(prefix));

  const items: FeatureCoverageItem[] = [
    {
      id: "wallets",
      label: "المحافظ",
      status: statusFor((walletsRes.count ?? 0) > 0, visited("/app/wallets")),
      detail: `${walletsRes.count ?? 0} محفظة`,
    },
    {
      id: "expenses",
      label: "المصاريف",
      status: statusFor((expensesRes.count ?? 0) > 0, visited("/app/expenses")),
      detail: `${expensesRes.count ?? 0} مصروف`,
    },
    {
      id: "debts",
      label: "الديون",
      status: statusFor((debtRes.count ?? 0) > 0, visited("/app/people")),
      detail: `${debtRes.count ?? 0} حركة دين`,
    },
    {
      id: "investments",
      label: "الاستثمارات (مالية)",
      status: statusFor(hasFinancialInvestment, visited("/app/investments")),
      detail: hasFinancialInvestment
        ? "توجد أصول مالية (أسهم/عملات رقمية/صناديق/تداول)"
        : "لا توجد أصول مالية بعد",
    },
    {
      id: "assets",
      label: "الأصول (عينية)",
      status: statusFor(hasPhysicalAsset, visited("/app/investments")),
      detail: hasPhysicalAsset ? "توجد أصول عينية (عقار/سيارة/ذهب/مخصص)" : "لا توجد أصول عينية بعد",
    },
    {
      id: "zakat",
      label: "الزكاة",
      status: statusFor((zakatRes.count ?? 0) > 0, visited("/app/zakat")),
      detail: `${zakatRes.count ?? 0} سجل زكاة محفوظ`,
    },
    {
      id: "reports",
      label: "التقارير",
      status: statusFor(false, visited("/app/reports")),
      detail: "لا يوجد جدول بيانات مخصص (صفحة محسوبة) — الإشارة الوحيدة هي فتح الصفحة",
    },
    {
      id: "notifications",
      label: "الإشعارات",
      status: statusFor(notifSettings.enabled, visited("/app/settings")),
      detail: notifSettings.enabled ? "مفعّلة في الإعدادات" : "غير مفعّلة",
    },
    {
      id: "backup",
      label: "النسخ الاحتياطي",
      status: statusFor(!!lastBackup, visited("/app/settings")),
      detail: lastBackup ? `آخر نسخة بتاريخ ${lastBackup.meta.exported_at}` : "لا توجد نسخة بعد",
    },
    {
      id: "insights",
      label: "الرؤى المالية",
      status: statusFor(false, visited("/app/insights")),
      detail: "صفحة محسوبة بلا جدول بيانات مخصص — الإشارة الوحيدة هي فتح الصفحة",
    },
  ];

  return {
    items,
    coveredCount: items.filter((i) => i.status === "covered").length,
    untestedCount: items.filter((i) => i.status === "untested").length,
    neverUsedCount: items.filter((i) => i.status === "never_used").length,
    generatedAt: new Date().toISOString(),
  };
}
