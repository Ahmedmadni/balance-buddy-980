// Unified Asset financial calculator
// Pure functions — easy to unit test.

export type AssetTxClass = "capex" | "opex" | "income" | "adjustment" | "personal_benefit" | "sale" | "capital_contribution";

export type AssetTx = {
  tx_class?: AssetTxClass | string | null;
  kind?: string | null;
  amount: number | string;
};

export type AssetMetrics = {
  baseValue: number;
  capex: number;
  capitalContribution: number; // new capital injected into the asset — NOT a capex expense
  opex: number;
  income: number;
  personalBenefit: number;
  netCashflow: number;     // income − opex − capex − capitalContribution
  bookValue: number;       // base + capex + capitalContribution
  marketValue: number;     // current_value (or bookValue if missing)
  unrealizedPnl: number;   // marketValue − bookValue
  realizedPnl: number;     // sale proceeds − bookValue (if sold)
  totalPnl: number;        // unrealized + realized + income − opex
};

function n(v: any): number {
  const x = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(x) ? x : 0;
}

/** Parse an optional financial value without confusing a valid zero with absence. */
export function optionalFinancialNumber(value: unknown): number | null {
  if (value === null || value === undefined) return null;
  if (typeof value === "string" && value.trim() === "") return null;
  const parsed = typeof value === "string" ? Number(value.trim()) : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export type DatedMarketValue = {
  valuation_date: string;
  market_value: unknown;
};

/** Return the latest finite history value. A recorded zero is valid. */
export function latestMarketValue(points?: DatedMarketValue[]): number | null {
  if (!points?.length) return null;
  const valid = points
    .map((point) => ({ point, value: optionalFinancialNumber(point.market_value) }))
    .filter((entry): entry is { point: DatedMarketValue; value: number } => entry.value !== null)
    .sort((a, b) => String(a.point.valuation_date).localeCompare(String(b.point.valuation_date)));
  return valid.length ? valid[valid.length - 1].value : null;
}

/** History first, then an explicitly present current value, then book value. */
export function resolveMarketValue(
  currentValue: unknown,
  bookValue: number,
  history?: DatedMarketValue[],
): number {
  const historical = latestMarketValue(history);
  if (historical !== null) return historical;
  return optionalFinancialNumber(currentValue) ?? bookValue;
}

function classOf(tx: AssetTx): AssetTxClass {
  if (tx.tx_class) return tx.tx_class as AssetTxClass;
  // Fallback for legacy rows without tx_class
  switch (tx.kind) {
    case "capital_add":
    case "principal":
    case "contribute":
      return "capex";
    case "return":
      return "income";
    case "withdraw":
    case "capital_withdraw":
      return "sale";
    case "revaluation":
      return "adjustment";
    default:
      return "capex";
  }
}

export function computeAssetMetrics(
  asset: { base_value?: any; principal?: any; current_value?: any; sold_amount?: any; status?: string },
  txs: AssetTx[],
): AssetMetrics {
  const baseValue = n(asset.base_value ?? asset.principal);
  let capex = 0, capitalContribution = 0, opex = 0, income = 0, personalBenefit = 0, saleProceeds = 0;
  for (const t of txs) {
    const c = classOf(t);
    const a = n(t.amount);
    if (c === "capex") capex += a;
    else if (c === "capital_contribution") capitalContribution += a;
    else if (c === "opex") opex += a;
    else if (c === "income") income += a;
    else if (c === "personal_benefit") personalBenefit += a;
    else if (c === "sale") saleProceeds += a;
  }
  const bookValue = baseValue + capex + capitalContribution;
  const marketValue = resolveMarketValue(asset.current_value, bookValue);
  const unrealizedPnl = marketValue - bookValue;
  const sold = asset.status === "sold" || n(asset.sold_amount) > 0 || saleProceeds > 0;
  const realizedPnl = sold ? (n(asset.sold_amount) || saleProceeds) - bookValue : 0;
  const netCashflow = income - opex - capex - capitalContribution + (sold ? (n(asset.sold_amount) || saleProceeds) : 0);
  const totalPnl = unrealizedPnl + realizedPnl + income - opex;
  return { baseValue, capex, capitalContribution, opex, income, personalBenefit, netCashflow, bookValue, marketValue, unrealizedPnl, realizedPnl, totalPnl };
}

export const TX_CLASS_META: Record<AssetTxClass, { label: string; short: string; sign: "+" | "−" | "="; color: string; description: string }> = {
  capex: { label: "مصروف رأسمالي", short: "CapEx", sign: "−", color: "text-blue-600", description: "تحسينات تُضاف لقيمة الأصل" },
  opex: { label: "مصروف تشغيلي", short: "OpEx", sign: "−", color: "text-amber-600", description: "صيانة/تأمين — مصروف شهري" },
  income: { label: "دخل / إيراد", short: "Income", sign: "+", color: "text-success", description: "إيجار/عوائد — يضاف للدخل" },
  adjustment: { label: "تعديل قيمة", short: "Adj", sign: "=", color: "text-muted-foreground", description: "إعادة تقييم القيمة السوقية" },
  personal_benefit: { label: "منفعة شخصية", short: "Benefit", sign: "=", color: "text-violet-600", description: "استخدام شخصي — تحليلي فقط" },
  sale: { label: "بيع الأصل", short: "Sale", sign: "+", color: "text-success", description: "إغلاق الأصل بمبلغ البيع" },
  capital_contribution: { label: "زيادة رأس المال", short: "Capital", sign: "−", color: "text-indigo-600", description: "زيادة رأس المال المستثمر في الأصل — إضافة استثمار جديدة، وليست مصروفاً رأسمالياً" },
};
