import { describe, expect, test } from "bun:test";
import { computeAssetMetrics, resolveMarketValue } from "./calculator";
import { combinePerformance, computeInvestmentPerformance } from "./performance";
import { computeAssetZakat } from "./zakat-asset";

const asset = {
  id: "asset-1",
  name: "أصل مختبَر",
  currency: "SAR",
  base_value: 80_000,
  current_value: 0 as unknown,
  status: "active",
  ownership_pct: 100,
  meta: { zakat: { is_zakatable: true, method: "market_value" } },
};

describe("canonical market-value fallback", () => {
  test.each([
    [0, 0],
    ["0", 0],
    [null, 80_000],
    [undefined, 80_000],
    ["", 80_000],
    [125_000, 125_000],
    [-500, -500],
  ])("resolves current_value %p to %p", (currentValue, expected) => {
    expect(resolveMarketValue(currentValue, 80_000)).toBe(expected);
  });

  test("calculator preserves zero and reports the full unrealized loss", () => {
    const result = computeAssetMetrics({ ...asset, current_value: 0 }, []);
    expect(result.marketValue).toBe(0);
    expect(result.unrealizedPnl).toBe(-80_000);
  });

  test("calculator preserves a string zero", () => {
    expect(computeAssetMetrics({ ...asset, current_value: "0" }, []).marketValue).toBe(0);
  });

  test("performance prefers the latest valid historical zero", () => {
    const result = computeInvestmentPerformance({
      asset: { ...asset, current_value: 120_000 },
      txs: [],
      marketValues: [
        { valuation_date: "2026-07-01", market_value: 90_000 },
        { valuation_date: "2026-08-01", market_value: 0 },
      ],
    });
    expect(result.marketValue).toBe(0);
    expect(result.unrealizedGain).toBe(-80_000);
  });

  test("performance falls back only when history and current value are missing", () => {
    const result = computeInvestmentPerformance({
      asset: { ...asset, current_value: undefined },
      txs: [],
      marketValues: [],
    });
    expect(result.marketValue).toBe(80_000);
  });

  test("zakat market mode preserves a latest historical zero", () => {
    const result = computeAssetZakat({
      asset: { ...asset, current_value: 120_000 },
      txs: [],
      marketValues: [{ valuation_date: "2026-08-01", market_value: "0" }],
    });
    expect(result.marketValue).toBe(0);
    expect(result.zakatableValue).toBe(0);
    expect(result.zakatAmount).toBe(0);
  });

  test("invalid latest history is skipped in favor of the latest valid point", () => {
    expect(resolveMarketValue(120_000, 80_000, [
      { valuation_date: "2026-07-01", market_value: 0 },
      { valuation_date: "2026-08-01", market_value: "not-a-number" },
    ])).toBe(0);
  });

  test("sold-asset behavior remains unchanged while preserving zero", () => {
    const result = computeInvestmentPerformance({
      asset: { ...asset, status: "sold", sold_amount: 70_000, current_value: 0 },
      txs: [],
    });
    expect(result.marketValue).toBe(0);
    expect(result.unrealizedGain).toBe(0);
    expect(result.realizedGain).toBe(-10_000);
  });

  test("depreciation does not turn an explicit market zero into book value", () => {
    const result = computeInvestmentPerformance({
      asset: { ...asset, current_value: 0 },
      txs: [],
      asOf: new Date("2026-08-01T00:00:00Z"),
      depreciationProfile: {
        method: "straight_line",
        useful_life_months: 120,
        salvage_value: 0,
        start_date: "2025-08-01",
      },
    });
    expect(result.bookValue).toBeLessThan(80_000);
    expect(result.marketValue).toBe(0);
    expect(result.unrealizedGain).toBe(-result.bookValue);
  });

  test("combined performance includes zero-valued components without fallback", () => {
    const zero = computeInvestmentPerformance({ asset: { ...asset, current_value: 0 }, txs: [] });
    const positive = computeInvestmentPerformance({
      asset: { ...asset, id: "asset-2", current_value: 20_000 },
      txs: [],
    });
    const combined = combinePerformance([zero, positive]);
    expect(combined?.marketValue).toBe(20_000);
    expect(combined?.investmentCost).toBe(160_000);
  });
});
