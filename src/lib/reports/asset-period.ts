import type { AssetTx } from "@/lib/assets/calculator";
import { computeAssetMetrics } from "@/lib/assets/calculator";
import type { ReportDateRange } from "./date-range";
import { isInReportDateRange } from "./date-range";

/**
 * The asset's balance sheet value and historical P&L are cumulative snapshots.
 * Operating flows shown for a report interval must be calculated separately.
 * A report-period filter must never erase historical capital expenditure from
 * the asset's current book value.
 */
export function summarizeAssetForReport<
  A extends Parameters<typeof computeAssetMetrics>[0],
>(asset: A, allTransactions: AssetTx[], range: ReportDateRange) {
  const snapshot = computeAssetMetrics(asset, allTransactions);
  const periodTxs = allTransactions.filter((t) => isInReportDateRange(t.happened_at, range));
  const period = computeAssetMetrics(
    { base_value: 0, principal: 0, current_value: 0, status: "active", sold_amount: null },
    periodTxs,
  );
  return {
    snapshot,
    flows: {
      capex: period.capex,
      capitalContribution: period.capitalContribution,
      opex: period.opex,
      income: period.income,
    },
  };
}
