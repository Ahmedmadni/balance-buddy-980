// =============================================================
// Financial Insights — pure calculators.
// -------------------------------------------------------------
// Every function here takes already-fetched rows and returns a derived
// metric. No Supabase calls, no side effects — mirrors the split already
// used in src/lib/assets/ (calculator.ts pure vs engine.ts fetch+compose).
// Reuses src/lib/wallet-balance.ts and src/lib/assets/calculator.ts as the
// single source of truth for balances / asset metrics instead of
// recomputing them differently here.
// =============================================================
import { computeWalletBalance } from "@/lib/wallet-balance";
import { kindSign } from "@/components/PersonTxForm";
import { computeAssetMetrics, type AssetTx } from "@/lib/assets/calculator";
import { computeDepreciation, type DepreciationProfile } from "@/lib/assets/depreciation";
import type {
  CurrencyMap,
  WealthSummary,
  CashFlow,
  CashFlowTrendPoint,
  InvestmentAnalytics,
  AssetAnalytics,
  DebtAnalytics,
  DebtParty,
  RankedAsset,
} from "./types";

function add(map: CurrencyMap, currency: string, amount: number) {
  map[currency] = (map[currency] ?? 0) + amount;
}

// ----- Wealth Summary -----
export interface WalletRow {
  id: string;
  opening_balance: number;
  currency: string;
}
export interface WalletTxRow {
  wallet_id: string;
  kind: string;
  amount: number;
}
export interface ExpenseRow {
  wallet_id: string | null;
  amount: number;
}
export interface InvestmentRow {
  id: string;
  name: string;
  currency: string;
  status: string;
  base_value?: number | null;
  principal?: number | null;
  current_value?: number;
  sold_amount?: number | null;
}
export interface InvestmentTxRow extends AssetTx {
  investment_id: string;
}

export function calcTotalCash(
  wallets: WalletRow[],
  walletTxs: WalletTxRow[],
  expenses: ExpenseRow[],
): CurrencyMap {
  const txByWallet = new Map<string, WalletTxRow[]>();
  for (const t of walletTxs) {
    const a = txByWallet.get(t.wallet_id) ?? [];
    a.push(t);
    txByWallet.set(t.wallet_id, a);
  }
  const expByWallet = new Map<string, ExpenseRow[]>();
  for (const e of expenses) {
    if (!e.wallet_id) continue;
    const a = expByWallet.get(e.wallet_id) ?? [];
    a.push(e);
    expByWallet.set(e.wallet_id, a);
  }

  const totals: CurrencyMap = {};
  for (const w of wallets) {
    const bal = computeWalletBalance(
      Number(w.opening_balance),
      txByWallet.get(w.id) ?? [],
      expByWallet.get(w.id) ?? [],
    );
    add(totals, w.currency, bal);
  }
  return totals;
}

function assetMetricsByInvestment(investments: InvestmentRow[], invTxs: InvestmentTxRow[]) {
  const txByInv = new Map<string, InvestmentTxRow[]>();
  for (const t of invTxs) {
    const a = txByInv.get(t.investment_id) ?? [];
    a.push(t);
    txByInv.set(t.investment_id, a);
  }
  return investments.map((inv) => ({
    inv,
    metrics: computeAssetMetrics(inv, txByInv.get(inv.id) ?? []),
  }));
}

export function calcTotalAssets(
  investments: InvestmentRow[],
  invTxs: InvestmentTxRow[],
): CurrencyMap {
  const totals: CurrencyMap = {};
  for (const { inv, metrics } of assetMetricsByInvestment(investments, invTxs)) {
    if (inv.status === "archived") continue;
    add(totals, inv.currency, metrics.marketValue);
  }
  return totals;
}

export function calcWealthSummary(opts: {
  wallets: WalletRow[];
  walletTxs: WalletTxRow[];
  expenses: ExpenseRow[];
  investments: InvestmentRow[];
  invTxs: InvestmentTxRow[];
  totalPayable: CurrencyMap;
}): WealthSummary {
  const totalCash = calcTotalCash(opts.wallets, opts.walletTxs, opts.expenses);
  const totalAssets = calcTotalAssets(opts.investments, opts.invTxs);
  const netWorth: CurrencyMap = {};
  for (const c of new Set([
    ...Object.keys(totalCash),
    ...Object.keys(totalAssets),
    ...Object.keys(opts.totalPayable),
  ])) {
    netWorth[c] = (totalCash[c] ?? 0) + (totalAssets[c] ?? 0) - (opts.totalPayable[c] ?? 0);
  }
  return { totalAssets, totalCash, totalDebt: opts.totalPayable, netWorth };
}

// ----- Cash Flow -----
export interface TransactionRow {
  type: string;
  amount: number;
  currency: string;
  happened_at: string;
}

export function calcCashFlow(transactions: TransactionRow[], monthPrefix: string): CashFlow {
  const monthlyIncome: CurrencyMap = {};
  const monthlyExpense: CurrencyMap = {};
  for (const t of transactions) {
    if (!t.happened_at.startsWith(monthPrefix)) continue;
    if (t.type === "income") add(monthlyIncome, t.currency, Number(t.amount));
    else if (t.type === "expense") add(monthlyExpense, t.currency, Number(t.amount));
  }
  const netCashFlow: CurrencyMap = {};
  const savingsRate: Record<string, number> = {};
  for (const c of new Set([...Object.keys(monthlyIncome), ...Object.keys(monthlyExpense)])) {
    const inc = monthlyIncome[c] ?? 0;
    const exp = monthlyExpense[c] ?? 0;
    netCashFlow[c] = inc - exp;
    if (inc > 0) savingsRate[c] = (netCashFlow[c] / inc) * 100;
  }
  return { monthlyIncome, monthlyExpense, netCashFlow, savingsRate };
}

/** Historical (already-elapsed) monthly income/expense/net per currency — no projection. */
export function calcCashFlowTrend(
  transactions: TransactionRow[],
  months: number,
  endMonth: string, // "YYYY-MM"
): Record<string, CashFlowTrendPoint[]> {
  const [endY, endM] = endMonth.split("-").map(Number);
  const monthKeys: string[] = [];
  for (let i = months - 1; i >= 0; i--) {
    const d = new Date(endY, endM - 1 - i, 1);
    monthKeys.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }

  const byCurrency = new Map<string, Map<string, { income: number; expense: number }>>();
  for (const t of transactions) {
    const month = t.happened_at.slice(0, 7);
    if (!monthKeys.includes(month)) continue;
    if (t.type !== "income" && t.type !== "expense") continue;
    const perMonth = byCurrency.get(t.currency) ?? new Map();
    const bucket = perMonth.get(month) ?? { income: 0, expense: 0 };
    if (t.type === "income") bucket.income += Number(t.amount);
    else bucket.expense += Number(t.amount);
    perMonth.set(month, bucket);
    byCurrency.set(t.currency, perMonth);
  }

  const result: Record<string, CashFlowTrendPoint[]> = {};
  for (const [currency, perMonth] of byCurrency) {
    result[currency] = monthKeys.map((month) => {
      const b = perMonth.get(month) ?? { income: 0, expense: 0 };
      return { month, income: b.income, expense: b.expense, net: b.income - b.expense };
    });
  }
  return result;
}

// ----- Investment / Asset Analytics -----
export function calcInvestmentAnalytics(
  investments: InvestmentRow[],
  invTxs: InvestmentTxRow[],
): InvestmentAnalytics {
  const rows = assetMetricsByInvestment(investments, invTxs).filter(
    (r) => r.inv.status !== "archived",
  );

  const totalInvested: CurrencyMap = {};
  const totalReturn: CurrencyMap = {};
  const roiRanked: RankedAsset[] = [];
  for (const { inv, metrics } of rows) {
    add(totalInvested, inv.currency, metrics.bookValue);
    add(totalReturn, inv.currency, metrics.totalPnl);
    if (metrics.bookValue > 0) {
      const roi = (metrics.totalPnl / metrics.bookValue) * 100;
      roiRanked.push({ id: inv.id, name: inv.name, currency: inv.currency, value: roi });
    }
  }
  roiRanked.sort((a, b) => b.value - a.value);
  const bestAsset = roiRanked[0] ?? null;
  const worstAsset = roiRanked.length > 0 ? roiRanked[roiRanked.length - 1] : null;
  const avgROI =
    roiRanked.length > 0 ? roiRanked.reduce((s, r) => s + r.value, 0) / roiRanked.length : null;

  return { totalInvested, totalReturn, bestAsset, worstAsset, avgROI };
}

export interface MarketValueRow {
  investment_id: string;
  valuation_date: string;
  market_value: number;
}
export interface DepreciationProfileRow extends DepreciationProfile {
  investment_id: string;
}

export function calcAssetAnalytics(
  investments: InvestmentRow[],
  invTxs: InvestmentTxRow[],
  marketValues: MarketValueRow[],
  depreciationProfiles: DepreciationProfileRow[],
): AssetAnalytics {
  const rows = assetMetricsByInvestment(investments, invTxs).filter(
    (r) => r.inv.status !== "archived",
  );

  let topByValue: RankedAsset | null = null;
  let topByProfit: RankedAsset | null = null;
  for (const { inv, metrics } of rows) {
    if (!topByValue || metrics.marketValue > topByValue.value)
      topByValue = {
        id: inv.id,
        name: inv.name,
        currency: inv.currency,
        value: metrics.marketValue,
      };
    if (!topByProfit || metrics.totalPnl > topByProfit.value)
      topByProfit = { id: inv.id, name: inv.name, currency: inv.currency, value: metrics.totalPnl };
  }

  const invById = new Map(investments.map((i) => [i.id, i]));
  let mostDepreciated: RankedAsset | null = null;
  for (const p of depreciationProfiles) {
    if (!p.is_active) continue;
    const inv = invById.get(p.investment_id);
    if (!inv) continue;
    const metrics = rows.find((r) => r.inv.id === inv.id)?.metrics;
    const fallbackValue = Number(inv.current_value);
    const cost = metrics?.bookValue ?? (Number.isFinite(fallbackValue) ? fallbackValue : 0);
    const dep = computeDepreciation(p, cost);
    if (!mostDepreciated || dep.accumulated_depreciation > mostDepreciated.value) {
      mostDepreciated = {
        id: inv.id,
        name: inv.name,
        currency: inv.currency,
        value: dep.accumulated_depreciation,
      };
    }
  }

  const byInvestment = new Map<string, MarketValueRow[]>();
  for (const m of marketValues) {
    const a = byInvestment.get(m.investment_id) ?? [];
    a.push(m);
    byInvestment.set(m.investment_id, a);
  }
  let biggestValueDrop: RankedAsset | null = null;
  for (const [invId, points] of byInvestment) {
    if (points.length < 2) continue;
    const sorted = [...points].sort((a, b) => a.valuation_date.localeCompare(b.valuation_date));
    const latest = sorted[sorted.length - 1];
    const previous = sorted[sorted.length - 2];
    const drop = Number(previous.market_value) - Number(latest.market_value); // positive = value fell
    const inv = invById.get(invId);
    if (!inv) continue;
    if (drop > 0 && (!biggestValueDrop || drop > biggestValueDrop.value)) {
      biggestValueDrop = { id: inv.id, name: inv.name, currency: inv.currency, value: drop };
    }
  }

  return { topByValue, topByProfit, mostDepreciated, biggestValueDrop };
}

// ----- Debt Analytics -----
export interface LedgerRow {
  contact_id: string | null;
  contact_name: string;
  kind: string;
  amount: number;
  currency: string;
  settled_at: string | null;
}

export function calcDebtAnalytics(ledger: LedgerRow[]): DebtAnalytics {
  // net balance per (contact, currency): positive = they owe the user (receivable), negative = user owes them (payable)
  const byContact = new Map<string, { name: string; balances: CurrencyMap }>();
  for (const r of ledger) {
    if (!r.contact_id || r.settled_at) continue;
    const entry = byContact.get(r.contact_id) ?? { name: r.contact_name, balances: {} };
    entry.balances[r.currency] =
      (entry.balances[r.currency] ?? 0) + kindSign(r.kind) * Number(r.amount);
    byContact.set(r.contact_id, entry);
  }

  const totalReceivable: CurrencyMap = {};
  const totalPayable: CurrencyMap = {};
  let biggestDebtor: DebtParty | null = null;
  let biggestCreditor: DebtParty | null = null;

  for (const [contactId, { name, balances }] of byContact) {
    for (const [currency, amount] of Object.entries(balances)) {
      if (amount > 0.001) {
        add(totalReceivable, currency, amount);
        if (!biggestDebtor || amount > biggestDebtor.amount)
          biggestDebtor = { contactId, name, amount, currency };
      } else if (amount < -0.001) {
        const abs = Math.abs(amount);
        add(totalPayable, currency, abs);
        if (!biggestCreditor || abs > biggestCreditor.amount)
          biggestCreditor = { contactId, name, amount: abs, currency };
      }
    }
  }

  return { totalReceivable, totalPayable, biggestDebtor, biggestCreditor };
}
