// =============================================================
// computeFinancialInsights() — read-only analytics aggregator.
// -------------------------------------------------------------
// Fetches from wallets, transactions, expenses, person_ledger,
// investments, investment_transactions, asset_market_values,
// depreciation_profiles, zakat_records/zakat_settings and system_events
// (via the existing computeUpcomingEvents), then hands the raw rows to
// the pure calculators in calculator.ts. Never writes anything, never
// creates a new event/table/route — purely a view over existing data,
// same spirit as src/lib/events/engine.ts and src/lib/backup/engine.ts.
// =============================================================
import { supabase } from "@/integrations/supabase/client";
import { computeUpcomingEvents } from "@/lib/events/engine";
import { nextZakatDate, type ZakatSettings } from "@/lib/zakat/engine";
import {
  calcWealthSummary,
  calcCashFlow,
  calcCashFlowTrend,
  calcInvestmentAnalytics,
  calcAssetAnalytics,
  calcDebtAnalytics,
  type InvestmentTxRow,
  type DepreciationProfileRow,
} from "./calculator";
import type { FinancialInsights, ZakatAnalytics, ReminderAnalytics } from "./types";

export async function computeFinancialInsights(): Promise<FinancialInsights> {
  const now = new Date();
  const monthPrefix = now.toISOString().slice(0, 7);

  const [
    walletsRes,
    walletTxRes,
    expensesRes,
    transactionsRes,
    ledgerRes,
    investmentsRes,
    invTxRes,
    marketValuesRes,
    depreciationRes,
    zakatRecordRes,
    zakatSettingsRes,
    upcoming,
  ] = await Promise.all([
    supabase.from("wallets").select("id,opening_balance,currency").eq("is_archived", false),
    supabase.from("wallet_transactions").select("wallet_id,kind,amount"),
    supabase.from("expenses").select("wallet_id,amount"),
    supabase.from("transactions").select("type,amount,currency,happened_at"),
    supabase
      .from("person_ledger")
      .select("contact_id,contact_name,kind,amount,currency,settled_at"),
    supabase
      .from("investments")
      .select("id,name,currency,status,base_value,principal,current_value,sold_amount"),
    supabase.from("investment_transactions").select("investment_id,tx_class,kind,amount"),
    supabase.from("asset_market_values").select("investment_id,valuation_date,market_value"),
    supabase
      .from("depreciation_profiles")
      .select("investment_id,method,useful_life_months,salvage_value,start_date,is_active"),
    supabase
      .from("zakat_records")
      .select("base_amount,currency,rate,calculated_at")
      .order("calculated_at", { ascending: false })
      .limit(1),
    supabase.from("zakat_settings").select("annual_date_type,annual_date_value").maybeSingle(),
    computeUpcomingEvents({ horizonDays: 365 }),
  ]);

  const investments = investmentsRes.data ?? [];
  const invTxs = (invTxRes.data ?? []) as InvestmentTxRow[];
  const ledger = ledgerRes.data ?? [];

  const debts = calcDebtAnalytics(ledger);

  const wealth = calcWealthSummary({
    wallets: walletsRes.data ?? [],
    walletTxs: walletTxRes.data ?? [],
    expenses: expensesRes.data ?? [],
    investments,
    invTxs,
    totalPayable: debts.totalPayable,
  });

  const cashFlow = calcCashFlow(transactionsRes.data ?? [], monthPrefix);
  const cashFlowTrend = calcCashFlowTrend(transactionsRes.data ?? [], 6, monthPrefix);
  const investmentAnalytics = calcInvestmentAnalytics(investments, invTxs);
  const assetAnalytics = calcAssetAnalytics(
    investments,
    invTxs,
    marketValuesRes.data ?? [],
    (depreciationRes.data ?? []) as DepreciationProfileRow[],
  );

  const lastZakat = (zakatRecordRes.data ?? [])[0] ?? null;
  const zakat: ZakatAnalytics = {
    zakatPot: lastZakat ? { [lastZakat.currency]: Number(lastZakat.base_amount) } : {},
    zakatDue: lastZakat
      ? { [lastZakat.currency]: Number(lastZakat.base_amount) * Number(lastZakat.rate) }
      : {},
    nextHaulDate: zakatSettingsRes.data
      ? nextZakatDate(
          zakatSettingsRes.data as Pick<ZakatSettings, "annual_date_type" | "annual_date_value">,
        ).toISOString()
      : null,
    lastCalculatedAt: lastZakat?.calculated_at ?? null,
  };

  const reminders: ReminderAnalytics = {
    overdue: upcoming.overdue.length,
    thisWeek: upcoming.this_week.length,
    thisMonth: upcoming.this_month.length,
  };

  return {
    wealth,
    cashFlow,
    cashFlowTrend,
    investments: investmentAnalytics,
    assets: assetAnalytics,
    debts,
    zakat,
    reminders,
    generatedAt: now.toISOString(),
  };
}
