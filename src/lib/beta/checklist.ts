// =============================================================
// PART 1 — getBetaUserChecklist()
// -------------------------------------------------------------
// 8 onboarding milestones. Data-existence checks are real Supabase
// counts (read-only, same head:true convention as ux/hints.ts);
// "opened X page" checks reuse the local session tracker instead of
// re-implementing page-visit tracking.
// =============================================================
import { supabase } from "@/integrations/supabase/client";
import { loadLastBackup } from "@/lib/backup/engine";
import { getBetaSessionStats } from "./session";

export interface BetaChecklistItem {
  id: string;
  label: string;
  done: boolean;
  detail: string;
}

export interface BetaUserChecklistReport {
  items: BetaChecklistItem[];
  completionPercent: number; // "Beta Completion %"
  generatedAt: string;
}

export async function getBetaUserChecklist(): Promise<BetaUserChecklistReport> {
  const [walletsRes, txRes, invRes, debtRes] = await Promise.all([
    supabase.from("wallets").select("*", { count: "exact", head: true }),
    supabase.from("wallet_transactions").select("*", { count: "exact", head: true }),
    supabase.from("investments").select("*", { count: "exact", head: true }),
    supabase.from("person_ledger").select("*", { count: "exact", head: true }),
  ]);
  const lastBackup = await loadLastBackup();
  const visitedPaths = getBetaSessionStats().pagesVisited.map((p) => p.path);
  const visited = (prefix: string) => visitedPaths.some((p) => p.startsWith(prefix));

  const items: BetaChecklistItem[] = [
    {
      id: "add_wallet",
      label: "إضافة محفظة",
      done: (walletsRes.count ?? 0) > 0,
      detail: `${walletsRes.count ?? 0} محفظة`,
    },
    {
      id: "add_transaction",
      label: "إضافة عملية",
      done: (txRes.count ?? 0) > 0,
      detail: `${txRes.count ?? 0} عملية محفظة`,
    },
    {
      id: "add_asset",
      label: "إضافة أصل",
      done: (invRes.count ?? 0) > 0,
      detail: `${invRes.count ?? 0} أصل/استثمار`,
    },
    {
      id: "add_debt",
      label: "إضافة دين",
      done: (debtRes.count ?? 0) > 0,
      detail: `${debtRes.count ?? 0} حركة دين`,
    },
    {
      id: "create_backup",
      label: "إنشاء نسخة احتياطية",
      done: !!lastBackup,
      detail: lastBackup ? `آخر نسخة بتاريخ ${lastBackup.meta.exported_at}` : "لا توجد نسخة بعد",
    },
    {
      id: "open_zakat",
      label: "فتح صفحة الزكاة",
      done: visited("/app/zakat"),
      detail: visited("/app/zakat") ? "تمت الزيارة في جلسة محلية" : "لم تُفتح بعد",
    },
    {
      id: "open_insights",
      label: "فتح صفحة الرؤى",
      done: visited("/app/insights"),
      detail: visited("/app/insights") ? "تمت الزيارة في جلسة محلية" : "لم تُفتح بعد",
    },
    {
      id: "review_settings",
      label: "مراجعة الإعدادات",
      done: visited("/app/settings"),
      detail: visited("/app/settings") ? "تمت الزيارة في جلسة محلية" : "لم تُفتح بعد",
    },
  ];

  const completionPercent =
    items.length > 0 ? Math.round((items.filter((i) => i.done).length / items.length) * 100) : 0;

  return { items, completionPercent, generatedAt: new Date().toISOString() };
}
