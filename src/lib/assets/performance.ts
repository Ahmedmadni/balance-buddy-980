// Investment Performance Engine — analytical, read-only.
// Combines base/current value, asset_market_values, depreciation_profiles,
// and investment_transactions to compute return metrics.
// Does NOT modify transactions, balances, or accounting state.

import { computeAssetMetrics, type AssetTx } from "./calculator";
import { computeDepreciation, type DepreciationProfile } from "./depreciation";

export interface MarketValuePoint {
  valuation_date: string;
  market_value: number | string;
  currency?: string | null;
}

export interface PerformanceInput {
  asset: {
    id: string;
    base_value?: any;
    principal?: any;
    current_value?: any;
    sold_amount?: any;
    status?: string;
    acquired_at?: string | null;
    start_date?: string | null;
    currency: string;
  };
  txs: AssetTx[];
  marketValues?: MarketValuePoint[];
  depreciationProfile?: DepreciationProfile | null;
  asOf?: Date;
}

export interface InvestmentPerformance {
  currency: string;
  // Cost & value
  investmentCost: number;        // base + capex + capitalContribution
  capex: number;
  capitalContribution: number;
  opex: number;
  income: number;
  operatingProfit: number;       // income − opex
  accumulatedDepreciation: number;
  bookValue: number;             // investmentCost − accumulated_depreciation
  marketValue: number;           // last market value (or current_value fallback)
  // Returns
  unrealizedGain: number;        // marketValue − bookValue
  realizedGain: number;          // sale proceeds − bookValue (when sold)
  totalReturn: number;           // operatingProfit + realized + unrealized
  roi: number;                   // totalReturn / investmentCost (ratio, 0..1)
  annualizedReturn: number | null; // (1+roi)^(1/years) − 1 if years known
  holdingYears: number | null;
  // Sale projection
  ifSoldToday: {
    marketValue: number;
    bookValue: number;
    expectedSaleGain: number;    // marketValue − bookValue
    operatingProfit: number;
    totalReturn: number;         // operatingProfit + expectedSaleGain + realized (already-booked sales)
  };
  // Diagnostics
  sold: boolean;
  hasDepreciation: boolean;
  hasMarketHistory: boolean;
}

const n = (v: any) => {
  const x = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(x) ? x : 0;
};

function lastMarketValue(points?: MarketValuePoint[]): number | null {
  if (!points || points.length === 0) return null;
  const sorted = [...points].sort((a, b) => String(a.valuation_date).localeCompare(String(b.valuation_date)));
  return n(sorted[sorted.length - 1].market_value);
}

export function computeInvestmentPerformance(input: PerformanceInput): InvestmentPerformance {
  const { asset, txs, marketValues, depreciationProfile, asOf = new Date() } = input;
  const base = computeAssetMetrics(asset, txs);

  const investmentCost = base.baseValue + base.capex + base.capitalContribution;
  const operatingProfit = base.income - base.opex;

  // Depreciation
  let accumulatedDepreciation = 0;
  if (depreciationProfile && depreciationProfile.useful_life_months > 0) {
    const dep = computeDepreciation(depreciationProfile, investmentCost, asOf);
    accumulatedDepreciation = dep.accumulated_depreciation;
  }
  const bookValue = Math.max(0, investmentCost - accumulatedDepreciation);

  // Market value: latest history point, else current_value, else book value
  const mv = lastMarketValue(marketValues);
  const marketValue = mv !== null ? mv : (n(asset.current_value) || bookValue);

  const sold = asset.status === "sold" || n(asset.sold_amount) > 0;
  const unrealizedGain = sold ? 0 : marketValue - bookValue;
  const realizedGain = sold ? (n(asset.sold_amount) || 0) - bookValue : 0;
  const totalReturn = operatingProfit + realizedGain + unrealizedGain;
  const roi = investmentCost > 0 ? totalReturn / investmentCost : 0;

  // Holding period (years) from acquisition date
  let holdingYears: number | null = null;
  const startStr = asset.acquired_at ?? asset.start_date ?? null;
  if (startStr) {
    const start = new Date(startStr).getTime();
    const end = asOf.getTime();
    if (Number.isFinite(start) && end > start) {
      holdingYears = (end - start) / (365.25 * 24 * 3600 * 1000);
    }
  }
  let annualizedReturn: number | null = null;
  if (holdingYears && holdingYears > 0 && investmentCost > 0) {
    const factor = 1 + roi;
    annualizedReturn = factor > 0 ? Math.pow(factor, 1 / holdingYears) - 1 : null;
  }

  const expectedSaleGain = marketValue - bookValue;
  const ifSoldToday = {
    marketValue,
    bookValue,
    expectedSaleGain,
    operatingProfit,
    totalReturn: operatingProfit + expectedSaleGain + (sold ? realizedGain : 0),
  };

  return {
    currency: asset.currency,
    investmentCost,
    capex: base.capex,
    capitalContribution: base.capitalContribution,
    opex: base.opex,
    income: base.income,
    operatingProfit,
    accumulatedDepreciation,
    bookValue,
    marketValue,
    unrealizedGain,
    realizedGain,
    totalReturn,
    roi,
    annualizedReturn,
    holdingYears,
    ifSoldToday,
    sold,
    hasDepreciation: accumulatedDepreciation > 0,
    hasMarketHistory: !!(marketValues && marketValues.length > 0),
  };
}

/**
 * Combine multiple performance snapshots (e.g. parent + components).
 * Currencies must match; mixed currencies return the first currency and skip incompatible rows.
 */
export function combinePerformance(items: InvestmentPerformance[]): InvestmentPerformance | null {
  if (items.length === 0) return null;
  const cur = items[0].currency;
  const compat = items.filter((i) => i.currency === cur);
  const sum = (k: keyof InvestmentPerformance) =>
    compat.reduce((a, b) => a + (Number(b[k]) || 0), 0);

  const investmentCost = sum("investmentCost");
  const operatingProfit = sum("operatingProfit");
  const accumulatedDepreciation = sum("accumulatedDepreciation");
  const bookValue = sum("bookValue");
  const marketValue = sum("marketValue");
  const unrealizedGain = sum("unrealizedGain");
  const realizedGain = sum("realizedGain");
  const totalReturn = operatingProfit + unrealizedGain + realizedGain;
  const roi = investmentCost > 0 ? totalReturn / investmentCost : 0;

  // Weighted annualized return by investment cost (when available)
  const weighted = compat.filter((i) => i.annualizedReturn !== null && i.investmentCost > 0);
  const wSum = weighted.reduce((a, b) => a + b.investmentCost, 0);
  const annualizedReturn = wSum > 0
    ? weighted.reduce((a, b) => a + (b.annualizedReturn as number) * b.investmentCost, 0) / wSum
    : null;

  return {
    currency: cur,
    investmentCost,
    capex: sum("capex"),
    capitalContribution: sum("capitalContribution"),
    opex: sum("opex"),
    income: sum("income"),
    operatingProfit,
    accumulatedDepreciation,
    bookValue,
    marketValue,
    unrealizedGain,
    realizedGain,
    totalReturn,
    roi,
    annualizedReturn,
    holdingYears: null,
    ifSoldToday: {
      marketValue,
      bookValue,
      expectedSaleGain: marketValue - bookValue,
      operatingProfit,
      totalReturn: operatingProfit + (marketValue - bookValue) + realizedGain,
    },
    sold: false,
    hasDepreciation: accumulatedDepreciation > 0,
    hasMarketHistory: compat.some((i) => i.hasMarketHistory),
  };
}
