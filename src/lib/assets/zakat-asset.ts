// Asset Zakat Engine — analytical, read-only.
// Computes zakat for unified assets (investments + components) using:
//   - asset.meta.zakat settings (is_zakatable, method, custom_value, scope)
//   - asset_market_values (latest)
//   - depreciation_profiles (for book value)
//   - investment_transactions (for capex history → book value)
// Does NOT modify transactions, balances, triggers, or v_account_statement.
// Does NOT post any accounting entries.

import { computeAssetMetrics, resolveMarketValue, type AssetTx } from "./calculator";
import { computeDepreciation, type DepreciationProfile } from "./depreciation";
import { classifyAsset } from "@/lib/zakat/engine";

export type AssetZakatMethod = "market_value" | "book_value" | "custom_value" | "excluded";
export type AssetZakatScope = "asset_only" | "components_only" | "both";
export type AssetZakatMode = "conservative" | "market_based";

export interface AssetZakatSettings {
  is_zakatable: boolean;
  method: AssetZakatMethod;
  custom_value?: number | null;
  scope?: AssetZakatScope;
}

export interface MarketValuePoint {
  valuation_date: string;
  market_value: number | string;
}

export interface AssetZakatInput {
  asset: any; // investment row
  txs: AssetTx[];
  marketValues?: MarketValuePoint[];
  depreciationProfile?: DepreciationProfile | null;
  mode?: AssetZakatMode;            // global preference, may override method
  rate?: number;                    // default 0.025
  jewelryOpinion?: "zakat" | "no_zakat";
  asOf?: Date;
}

export interface AssetZakatResult {
  assetId: string;
  assetName: string;
  currency: string;
  isZakatable: boolean;
  reason: string;
  method: AssetZakatMethod;
  effectiveMethod: AssetZakatMethod; // after mode override
  zakatableValue: number;
  rate: number;
  zakatAmount: number;
  marketValue: number;
  bookValue: number;
}

const n = (v: any) => {
  const x = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(x) ? x : 0;
};

/** Read zakat settings for an asset (from meta.zakat), with smart defaults. */
export function readAssetZakatSettings(
  asset: any,
  jewelryOpinion: "zakat" | "no_zakat" = "no_zakat",
): AssetZakatSettings {
  const raw = (asset?.meta && (asset.meta as any).zakat) || null;
  if (raw && typeof raw === "object") {
    return {
      is_zakatable: raw.is_zakatable !== false,
      method: (raw.method as AssetZakatMethod) || "market_value",
      custom_value: raw.custom_value != null ? Number(raw.custom_value) : null,
      scope: (raw.scope as AssetZakatScope) || "both",
    };
  }
  // Smart default from classifyAsset (kind + purpose)
  const cls = classifyAsset(
    { type: asset?.asset_kind || asset?.type, purpose: asset?.purpose, meta: asset?.meta },
    { gold_jewelry_opinion: jewelryOpinion },
  );
  return {
    is_zakatable: cls.isZakatable,
    method: "market_value",
    custom_value: null,
    scope: "both",
  };
}

export function computeAssetZakat(input: AssetZakatInput): AssetZakatResult {
  const {
    asset,
    txs,
    marketValues,
    depreciationProfile,
    mode = "market_based",
    rate = 0.025,
    jewelryOpinion = "no_zakat",
    asOf = new Date(),
  } = input;

  const settings = readAssetZakatSettings(asset, jewelryOpinion);
  const metrics = computeAssetMetrics(asset, txs);

  // Book value with depreciation when profile exists
  const investmentCost = metrics.bookValue; // base + capex
  let bookValue = investmentCost;
  if (depreciationProfile && depreciationProfile.useful_life_months > 0) {
    const dep = computeDepreciation(depreciationProfile, investmentCost, asOf);
    bookValue = Math.max(0, investmentCost - dep.accumulated_depreciation);
  }

  const marketValue = metrics.sold ? 0 : resolveMarketValue(asset.current_value, bookValue, marketValues);

  const ownership = (n(asset.ownership_pct) || 100) / 100;

  // Effective method: mode can override the user method (except 'excluded')
  let effectiveMethod: AssetZakatMethod = settings.method;
  if (settings.is_zakatable && settings.method !== "excluded" && settings.method !== "custom_value") {
    effectiveMethod = mode === "conservative" ? "book_value" : "market_value";
    // honor explicitly chosen method if user set it different from defaults
    if (settings.method === "book_value" || settings.method === "market_value") {
      effectiveMethod = settings.method === "book_value" && mode === "market_based"
        ? "book_value"
        : settings.method === "market_value" && mode === "conservative"
          ? "book_value"
          : settings.method;
    }
  }

  let zakatableValue = 0;
  // A fully sold asset has no remaining asset exposure. Any received proceeds
  // belong to the wallet/cash calculation and must not be counted here again.
  if (!metrics.sold && settings.is_zakatable && settings.method !== "excluded") {
    if (effectiveMethod === "custom_value") zakatableValue = n(settings.custom_value);
    else if (effectiveMethod === "book_value") zakatableValue = bookValue * ownership;
    else zakatableValue = marketValue * ownership;
  }
  zakatableValue = Math.max(0, zakatableValue);

  const zakatAmount = settings.is_zakatable ? zakatableValue * rate : 0;
  const cls = classifyAsset(
    { type: asset?.asset_kind || asset?.type, purpose: asset?.purpose, meta: asset?.meta },
    { gold_jewelry_opinion: jewelryOpinion },
  );

  return {
    assetId: asset.id,
    assetName: asset.name,
    currency: asset.currency,
    isZakatable: settings.is_zakatable,
    reason: cls.reason,
    method: settings.method,
    effectiveMethod,
    zakatableValue,
    rate,
    zakatAmount,
    marketValue,
    bookValue,
  };
}

export function sumZakat(items: AssetZakatResult[]): Record<string, { value: number; zakat: number }> {
  const acc: Record<string, { value: number; zakat: number }> = {};
  for (const r of items) {
    const s = (acc[r.currency] ??= { value: 0, zakat: 0 });
    s.value += r.zakatableValue;
    s.zakat += r.zakatAmount;
  }
  return acc;
}

export const METHOD_LABEL: Record<AssetZakatMethod, string> = {
  market_value: "القيمة السوقية",
  book_value: "القيمة الدفترية",
  custom_value: "قيمة مخصّصة",
  excluded: "مستثناة",
};

export const SCOPE_LABEL: Record<AssetZakatScope, string> = {
  asset_only: "الأصل فقط",
  components_only: "المكونات فقط",
  both: "الأصل والمكونات",
};
