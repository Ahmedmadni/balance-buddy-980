// Unified Asset financial calculator
// Pure functions — easy to unit test.

export type AssetTxClass = "capex" | "opex" | "income" | "adjustment" | "personal_benefit" | "sale";

export type AssetTx = {
  tx_class?: AssetTxClass | string | null;
  kind?: string | null;
  amount: number | string;
};

export type AssetMetrics = {
  baseValue: number;
  capex: number;
  opex: number;
  income: number;
  personalBenefit: number;
  netCashflow: number;     // income − opex − capex
  bookValue: number;       // base + capex
  marketValue: number;     // current_value (or bookValue if missing)
  unrealizedPnl: number;   // marketValue − bookValue
  realizedPnl: number;     // sale proceeds − bookValue (if sold)
  totalPnl: number;        // unrealized + realized + income − opex
};

function n(v: any): number {
  const x = typeof v === "string" ? parseFloat(v) : Number(v);
  return Number.isFinite(x) ? x : 0;
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
  let capex = 0, opex = 0, income = 0, personalBenefit = 0, saleProceeds = 0;
  for (const t of txs) {
    const c = classOf(t);
    const a = n(t.amount);
    if (c === "capex") capex += a;
    else if (c === "opex") opex += a;
    else if (c === "income") income += a;
    else if (c === "personal_benefit") personalBenefit += a;
    else if (c === "sale") saleProceeds += a;
  }
  const bookValue = baseValue + capex;
  const marketValue = n(asset.current_value) || bookValue;
  const unrealizedPnl = marketValue - bookValue;
  const sold = asset.status === "sold" || n(asset.sold_amount) > 0 || saleProceeds > 0;
  const realizedPnl = sold ? (n(asset.sold_amount) || saleProceeds) - bookValue : 0;
  const netCashflow = income - opex - capex + (sold ? (n(asset.sold_amount) || saleProceeds) : 0);
  const totalPnl = unrealizedPnl + realizedPnl + income - opex;
  return { baseValue, capex, opex, income, personalBenefit, netCashflow, bookValue, marketValue, unrealizedPnl, realizedPnl, totalPnl };
}

export const TX_CLASS_META: Record<AssetTxClass, { label: string; short: string; sign: "+" | "−" | "="; color: string; description: string }> = {
  capex: { label: "مصروف رأسمالي", short: "CapEx", sign: "−", color: "text-blue-600", description: "تحسينات تُضاف لقيمة الأصل" },
  opex: { label: "مصروف تشغيلي", short: "OpEx", sign: "−", color: "text-amber-600", description: "صيانة/تأمين — مصروف شهري" },
  income: { label: "دخل / إيراد", short: "Income", sign: "+", color: "text-success", description: "إيجار/عوائد — يضاف للدخل" },
  adjustment: { label: "تعديل قيمة", short: "Adj", sign: "=", color: "text-muted-foreground", description: "إعادة تقييم القيمة السوقية" },
  personal_benefit: { label: "منفعة شخصية", short: "Benefit", sign: "=", color: "text-violet-600", description: "استخدام شخصي — تحليلي فقط" },
  sale: { label: "بيع الأصل", short: "Sale", sign: "+", color: "text-success", description: "إغلاق الأصل بمبلغ البيع" },
};
