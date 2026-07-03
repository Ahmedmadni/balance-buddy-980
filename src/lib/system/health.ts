// =============================================================
// Health Check Engine — runSystemHealthCheck()
// -------------------------------------------------------------
// Read-only diagnostics across 4 sections: Database, Financial Engine,
// Assets, Events. Every check is a SELECT (mostly head:true / count
// only) — nothing here writes, alters a trigger, or touches RLS.
// =============================================================
import { supabase } from "@/integrations/supabase/client";
import { reconcileWallets, checkTransactionSync } from "./shared";

export type HealthStatus = "ok" | "warning" | "error";

export interface HealthCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface HealthCheckSection {
  name: string;
  status: HealthStatus;
  items: HealthCheckItem[];
}

export interface SystemHealthReport {
  status: HealthStatus;
  database: HealthCheckSection;
  financialEngine: HealthCheckSection;
  assets: HealthCheckSection;
  events: HealthCheckSection;
  generatedAt: string;
}

const REQUIRED_TABLES = [
  "profiles",
  "wallets",
  "wallet_transactions",
  "wallet_tx_categories",
  "categories",
  "expenses",
  "expense_allocations",
  "recurring_expenses",
  "contacts",
  "person_ledger",
  "projects",
  "investments",
  "investment_transactions",
  "asset_market_values",
  "depreciation_profiles",
  "zakat_settings",
  "zakat_records",
  "exchange_rates",
  "system_events",
  "attachments",
  "transactions",
] as const;

function worst(a: HealthStatus, b: HealthStatus): HealthStatus {
  const rank: Record<HealthStatus, number> = { ok: 0, warning: 1, error: 2 };
  return rank[b] > rank[a] ? b : a;
}

function sectionOf(name: string, items: HealthCheckItem[]): HealthCheckSection {
  const status = items.reduce<HealthStatus>((acc, i) => worst(acc, i.status), "ok");
  return { name, status, items };
}

// ----- Database -----
async function checkDatabase(): Promise<HealthCheckSection> {
  const items: HealthCheckItem[] = [];
  const results = await Promise.all(
    REQUIRED_TABLES.map(async (table) => {
      const { error } = await supabase.from(table).select("*", { count: "exact", head: true });
      return { table, error };
    }),
  );
  for (const { table, error } of results) {
    items.push({
      id: `table:${table}`,
      label: `جدول ${table}`,
      status: error ? "error" : "ok",
      detail: error ? error.message : "متاح ويستجيب",
    });
  }
  return sectionOf("قاعدة البيانات", items);
}

// ----- Financial Engine -----
async function checkFinancialEngine(): Promise<HealthCheckSection> {
  const items: HealthCheckItem[] = [];

  const wallets = await reconcileWallets();
  const mismatched = wallets.filter((w) => !w.matches);
  items.push({
    id: "wallets:reconciliation",
    label: "تطابق المحافظ مع كشف الحساب",
    status: mismatched.length === 0 ? "ok" : "error",
    detail:
      mismatched.length === 0
        ? `${wallets.length} محفظة متطابقة`
        : `${mismatched.length} محفظة غير متطابقة: ${mismatched.map((w) => w.name).join("، ")}`,
  });

  const sync = await checkTransactionSync();
  for (const s of sync) {
    items.push({
      id: `sync:${s.table}`,
      label: `مزامنة ${s.table} ↔ transactions`,
      status: s.matches ? "ok" : "error",
      detail: s.matches
        ? `${s.sourceCount} سجل متطابق`
        : `${s.sourceCount} في المصدر مقابل ${s.mirroredCount} في transactions`,
    });
  }

  return sectionOf("محرك العمليات المالية", items);
}

// ----- Assets -----
interface AssetHealthRow {
  id: string;
  name: string;
  parent_investment_id: string | null;
  current_value: number | null;
  status: string;
}
interface MarketValueRow {
  investment_id: string;
}
interface DepreciationHealthRow {
  investment_id: string;
  useful_life_months: number;
  salvage_value: number;
  start_date: string | null;
  is_active: boolean;
}

async function checkAssets(): Promise<HealthCheckSection> {
  const items: HealthCheckItem[] = [];
  const [invRes, mvRes, depRes] = await Promise.all([
    supabase.from("investments").select("id,name,parent_investment_id,current_value,status"),
    supabase.from("asset_market_values").select("investment_id"),
    supabase
      .from("depreciation_profiles")
      .select("investment_id,useful_life_months,salvage_value,start_date,is_active"),
  ]);
  const investments = (invRes.data ?? []) as AssetHealthRow[];
  const invIds = new Set(investments.map((i) => i.id));

  const orphanComponents = investments.filter(
    (i) => i.parent_investment_id && !invIds.has(i.parent_investment_id),
  );
  items.push({
    id: "assets:orphan-components",
    label: "مكونات يتيمة",
    status: orphanComponents.length === 0 ? "ok" : "warning",
    detail:
      orphanComponents.length === 0
        ? "لا توجد مكونات بلا أصل أب"
        : `${orphanComponents.length} مكوّن يشير لأصل أب غير موجود`,
  });

  const hasMarketValue = new Set((mvRes.data ?? []).map((m: MarketValueRow) => m.investment_id));
  const missingValuation = investments.filter(
    (i) => i.status !== "archived" && !hasMarketValue.has(i.id) && !(Number(i.current_value) > 0),
  );
  items.push({
    id: "assets:missing-valuation",
    label: "تقييمات سوقية مفقودة",
    status: missingValuation.length === 0 ? "ok" : "warning",
    detail:
      missingValuation.length === 0
        ? "كل الأصول لديها قيمة سوقية أو سجل تقييم"
        : `${missingValuation.length} أصل بلا current_value ولا سجل تقييم`,
  });

  const depRows = (depRes.data ?? []) as DepreciationHealthRow[];
  const orphanDep = depRows.filter((d) => !invIds.has(d.investment_id));
  const incompleteDep = depRows.filter(
    (d) => d.is_active && (!d.start_date || !d.useful_life_months || d.useful_life_months <= 0),
  );
  items.push({
    id: "assets:depreciation",
    label: "ملفات إهلاك غير مكتملة",
    status: orphanDep.length === 0 && incompleteDep.length === 0 ? "ok" : "warning",
    detail:
      orphanDep.length === 0 && incompleteDep.length === 0
        ? "كل ملفات الإهلاك سليمة"
        : `${orphanDep.length} ملف يتيم، ${incompleteDep.length} ملف ناقص البيانات`,
  });

  return sectionOf("الأصول", items);
}

// ----- Events -----
interface SystemEventHealthRow {
  id: string;
  title: string;
  event_type: string;
  entity_id: string | null;
  due_date: string;
  status: string;
}

async function checkEvents(): Promise<HealthCheckSection> {
  const items: HealthCheckItem[] = [];
  const { data } = await supabase
    .from("system_events")
    .select("id,title,event_type,entity_id,due_date,status");
  const events = (data ?? []) as SystemEventHealthRow[];

  const ninetyDaysAgo = new Date();
  ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
  const expired = events.filter(
    (e) => e.status === "pending" && new Date(e.due_date) < ninetyDaysAgo,
  );
  items.push({
    id: "events:expired",
    label: "أحداث منتهية بلا معالجة",
    status: expired.length === 0 ? "ok" : "warning",
    detail:
      expired.length === 0
        ? "لا توجد أحداث متأخرة أكثر من 90 يوماً"
        : `${expired.length} حدث متأخر > 90 يوماً`,
  });

  const seen = new Map<string, number>();
  for (const e of events) {
    const key = `${e.title}|${e.event_type}|${e.entity_id ?? ""}|${e.due_date}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
  }
  const duplicateGroups = [...seen.values()].filter((c) => c > 1).length;
  items.push({
    id: "events:duplicates",
    label: "أحداث مكررة",
    status: duplicateGroups === 0 ? "ok" : "warning",
    detail:
      duplicateGroups === 0
        ? "لا يوجد تكرار"
        : `${duplicateGroups} مجموعة أحداث مكررة (نفس العنوان/التاريخ/الكيان)`,
  });

  return sectionOf("الأحداث", items);
}

export async function runSystemHealthCheck(): Promise<SystemHealthReport> {
  const [database, financialEngine, assets, events] = await Promise.all([
    checkDatabase(),
    checkFinancialEngine(),
    checkAssets(),
    checkEvents(),
  ]);
  const status = [database, financialEngine, assets, events].reduce<HealthStatus>(
    (acc, s) => worst(acc, s.status),
    "ok",
  );
  return {
    status,
    database,
    financialEngine,
    assets,
    events,
    generatedAt: new Date().toISOString(),
  };
}
