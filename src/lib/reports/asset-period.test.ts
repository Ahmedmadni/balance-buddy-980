import { describe, expect, test } from "bun:test";
import { summarizeAssetForReport } from "./asset-period";
import { buildReportDateRange } from "./date-range";

describe("asset report cumulative book value vs period activity", () => {
  test("historic capex remains in the book value even if outside selected month", () => {
    const a = { base_value: 1000, current_value: 1900, status: "active" };
    const entries = [
      { tx_class: "capex", amount: 500, happened_at: "2026-09-10T09:00:00Z" },
      { tx_class: "opex", amount: 20, happened_at: "2026-11-18T23:59:59Z" },
      { tx_class: "income", amount: 100, happened_at: "2026-11-01T01:00:00Z" },
    ];
    const report = summarizeAssetForReport(a, entries, buildReportDateRange("2026-11-01", "2026-11-18")!);
    expect(report.snapshot.bookValue).toBe(1500);
    expect(report.snapshot.totalPnl).toBe(480);
    expect(report.flows).toEqual({ capex: 0, capitalContribution: 0, opex: 20, income: 100 });
  });
  test("period capex is shown while current asset book value uses full history", () => {
    const result = summarizeAssetForReport(
      { base_value: 2000, current_value: 2300, status: "active" },
      [
        { tx_class: "capex", amount: 100, happened_at: "2026-10-12" },
        { tx_class: "capex", amount: 200, happened_at: "2026-11-18" },
      ],
      buildReportDateRange("2026-11-18", "2026-11-18")!,
    );
    expect(result.snapshot.bookValue).toBe(2300);
    expect(result.flows.capex).toBe(200);
  });
});
