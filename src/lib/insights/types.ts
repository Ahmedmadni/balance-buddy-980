// =============================================================
// Financial Insights — shared types.
// -------------------------------------------------------------
// Every monetary figure is a CurrencyMap (per-currency breakdown), the
// same convention already used across the dashboard/reports/zakat pages
// (see app.index.tsx KpiCard, app.reports.tsx totals) — no cross-currency
// conversion is introduced here.
// =============================================================

export type CurrencyMap = Record<string, number>;

export interface WealthSummary {
  totalAssets: CurrencyMap; // market value of active/non-archived investments
  totalCash: CurrencyMap; // sum of wallet balances
  totalDebt: CurrencyMap; // money the user owes (payables)
  netWorth: CurrencyMap; // totalCash + totalAssets − totalDebt
}

export interface CashFlow {
  monthlyIncome: CurrencyMap;
  monthlyExpense: CurrencyMap;
  netCashFlow: CurrencyMap;
  savingsRate: Record<string, number>; // % = netCashFlow / income, per currency
}

export interface RankedAsset {
  id: string;
  name: string;
  currency: string;
  value: number; // meaning depends on the ranking (roi %, pnl, value, depreciation, drop)
}

export interface InvestmentAnalytics {
  totalInvested: CurrencyMap; // sum of book value (base + capex)
  totalReturn: CurrencyMap; // sum of total P&L (income − opex + realized/unrealized)
  bestAsset: RankedAsset | null; // by ROI %
  worstAsset: RankedAsset | null; // by ROI %
  avgROI: number | null; // simple average ROI % across assets with a book value
}

export interface AssetAnalytics {
  topByValue: RankedAsset | null;
  topByProfit: RankedAsset | null;
  mostDepreciated: RankedAsset | null; // largest accumulated depreciation
  biggestValueDrop: RankedAsset | null; // largest negative change between the two latest market valuations
}

export interface DebtParty {
  contactId: string;
  name: string;
  amount: number;
  currency: string;
}

export interface DebtAnalytics {
  totalReceivable: CurrencyMap; // مستحق لي
  totalPayable: CurrencyMap; // مستحق عليّ
  biggestDebtor: DebtParty | null; // largest single receivable
  biggestCreditor: DebtParty | null; // largest single payable
}

export interface ZakatAnalytics {
  zakatPot: CurrencyMap; // last calculated base_amount, from zakat_records
  zakatDue: CurrencyMap; // last calculated zakat amount (base_amount × rate)
  nextHaulDate: string | null; // ISO date, from zakat_settings via nextZakatDate()
  lastCalculatedAt: string | null;
}

export interface ReminderAnalytics {
  overdue: number;
  thisWeek: number;
  thisMonth: number;
}

export interface CashFlowTrendPoint {
  month: string; // "YYYY-MM"
  income: number;
  expense: number;
  net: number;
}

export interface FinancialInsights {
  wealth: WealthSummary;
  cashFlow: CashFlow;
  cashFlowTrend: Record<string, CashFlowTrendPoint[]>; // per currency, oldest → newest
  investments: InvestmentAnalytics;
  assets: AssetAnalytics;
  debts: DebtAnalytics;
  zakat: ZakatAnalytics;
  reminders: ReminderAnalytics;
  generatedAt: string;
}
