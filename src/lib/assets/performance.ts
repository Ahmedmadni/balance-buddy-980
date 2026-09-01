// Investment Performance Engine — analytical, read-only.
// Combines base/current value, asset_market_values, depreciation_profiles,
// and investment_transactions to compute return metrics.
// Does NOT modify transactions, balances, or accounting state.

import { computeAssetMetrics, resolveAssetSale, resolveMarketValue, type AssetTx } from "./calculator";
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
    sold_at?: string | null;
    realized_pnl?: any;
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
  saleProceeds: number;          // proceeds, not profit
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

export function computeInvestmentPerformance(input: PerformanceInput): InvestmentPerformance {
  const { asset, txs, marketValues, depreciationProfile, asOf = new Date() } = input;
  const base = computeAssetMetrics(asset, txs);

  const investmentCost = base.baseValue + base.capex + base.capitalContribution;
  const operatingProfit = base.income - base.opex;

  // A completed sale freezes depreciation at the sale date when one is known.
  const preliminarySale = resolveAssetSale(asset, txs, 0);
  const depreciationAsOf = preliminarySale.saleDate ? new Date(preliminarySale.saleDate) : asOf;

  // Depreciation
  let accumulatedDepreciation = 0;
  if (depreciationProfile && depreciationProfile.useful_life_months > 0) {
    const dep = computeDepreciation(depreciationProfile, investmentCost, depreciationAsOf);
    accumulatedDepreciation = dep.accumulated_depreciation;
  }
  const bookValue = Math.max(0, investmentCost - accumulatedDepreciation);

  // Market value: latest history point, else current_value, else book value
  const sale = resolveAssetSale(asset, txs, bookValue);
  const marketValue = sale.sold ? 0 : resolveMarketValue(asset.current_value, bookValue, marketValues);
  const sold = sale.sold;
  const unrealizedGain = sold ? 0 : marketValue - bookValue;
  const realizedGain = sale.realizedGain;
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

  const expectedSaleGain = sold ? realizedGain : marketValue - bookValue;
  const ifSoldToday = {
    marketValue: sold ? sale.saleProceeds : marketValue,
    bookValue,
    expectedSaleGain,
    operatingProfit,
    totalReturn: sold ? totalReturn : operatingProfit + expectedSaleGain,
  };

  return {
    currency: asset.currency,
    investmentCost,
    capex: base.capex,
    capitalContribution: base.capitalContribution,
    opex: base.opex,
    income: base.income,
    operatingProfit,
    saleProceeds: sale.saleProceeds,
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
  const saleProceeds = sum("saleProceeds");
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
    saleProceeds,
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
      marketValue: compat.reduce((total, item) => total + item.ifSoldToday.marketValue, 0),
      bookValue,
      expectedSaleGain: compat.reduce((total, item) => total + item.ifSoldToday.expectedSaleGain, 0),
      operatingProfit,
      totalReturn: compat.reduce((total, item) => total + item.ifSoldToday.totalReturn, 0),
    },
    sold: compat.every((i) => i.sold),
    hasDepreciation: accumulatedDepreciation > 0,
    hasMarketHistory: compat.some((i) => i.hasMarketHistory),
  };
}
