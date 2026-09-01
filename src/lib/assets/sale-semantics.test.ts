import { describe, expect, test } from "bun:test";
import { computeAssetMetrics, resolveAssetSale, type AssetTx } from "./calculator";
import { combinePerformance, computeInvestmentPerformance } from "./performance";
import { computeAssetZakat } from "./zakat-asset";

const baseAsset = {
  id: "asset",
  name: "أصل",
  currency: "SAR",
  base_value: 100_000,
  current_value: 120_000,
  status: "active",
  acquired_at: "2025-01-01",
};

const saleTx = (amount: number, happened_at = "2026-01-01"): AssetTx => ({
  tx_class: "sale",
  kind: "withdraw",
  amount,
  happened_at,
});

describe("canonical full-sale semantics", () => {
  test.each([
    [120_000, 20_000],
    [80_000, -20_000],
    [0, -100_000],
  ])("unsold market value %p has unrealized result %p", (currentValue, expected) => {
    const metrics = computeAssetMetrics({ ...baseAsset, current_value: currentValue }, []);
    expect(metrics.sold).toBe(false);
    expect(metrics.realizedPnl).toBe(0);
    expect(metrics.unrealizedPnl).toBe(expected);
  });

  test.each([
    [120_000, 20_000],
    [80_000, -20_000],
    [100_000, 0],
    [0, -100_000],
  ])("sold_amount %p produces realized result %p", (soldAmount, expected) => {
    const metrics = computeAssetMetrics({ ...baseAsset, status: "sold", sold_amount: soldAmount }, []);
    expect(metrics.sold).toBe(true);
    expect(metrics.saleProceeds).toBe(soldAmount);
    expect(metrics.marketValue).toBe(0);
    expect(metrics.unrealizedPnl).toBe(0);
    expect(metrics.realizedPnl).toBe(expected);
    expect(metrics.totalPnl).toBe(expected);
  });

  test("old market data cannot create unrealized return after sale", () => {
    const result = computeInvestmentPerformance({
      asset: { ...baseAsset, status: "sold", sold_amount: 110_000, sold_at: "2026-01-01" },
      txs: [],
      marketValues: [{ valuation_date: "2025-12-31", market_value: 250_000 }],
    });
    expect(result.marketValue).toBe(0);
    expect(result.unrealizedGain).toBe(0);
    expect(result.realizedGain).toBe(10_000);
  });

  test("old current_value cannot create unrealized return after sale", () => {
    const metrics = computeAssetMetrics({ ...baseAsset, status: "sold", sold_amount: 90_000, current_value: 999_999 }, []);
    expect(metrics.marketValue).toBe(0);
    expect(metrics.unrealizedPnl).toBe(0);
    expect(metrics.realizedPnl).toBe(-10_000);
  });

  test("sale proceeds are counted once when snapshot and transaction both exist", () => {
    const txs = [saleTx(120_000)];
    const metrics = computeAssetMetrics({ ...baseAsset, status: "sold", sold_amount: 120_000 }, txs);
    expect(metrics.saleProceeds).toBe(120_000);
    expect(metrics.realizedPnl).toBe(20_000);
    expect(metrics.netCashflow).toBe(120_000);
    expect(metrics.totalPnl).toBe(20_000);
  });

  test("sale transaction is the proceeds fallback when sold_amount is missing", () => {
    const metrics = computeAssetMetrics(baseAsset, [saleTx(115_000)]);
    expect(metrics.sold).toBe(true);
    expect(metrics.saleProceeds).toBe(115_000);
    expect(metrics.realizedPnl).toBe(15_000);
    expect(metrics.unrealizedPnl).toBe(0);
  });

  test("explicit zero snapshot overrides a non-zero sale transaction", () => {
    const sale = resolveAssetSale({ status: "sold", sold_amount: 0 }, [saleTx(120_000)], 100_000);
    expect(sale.saleProceeds).toBe(0);
    expect(sale.realizedGain).toBe(-100_000);
  });

  test.each([
    [80_000, 10_000],
    [60_000, -10_000],
  ])("depreciated book value produces the correct realized result for sale %p", (proceeds, expected) => {
    const result = computeInvestmentPerformance({
      asset: { ...baseAsset, status: "sold", sold_amount: proceeds, sold_at: "2026-01-01" },
      txs: [],
      asOf: new Date("2030-01-01T00:00:00Z"),
      depreciationProfile: {
        method: "straight_line",
        useful_life_months: 40,
        salvage_value: 0,
        start_date: "2025-01-01",
      },
    });
    expect(result.bookValue).toBe(70_000);
    expect(result.realizedGain).toBe(expected);
    expect(result.unrealizedGain).toBe(0);
  });

  test("ROI uses return rather than raw proceeds", () => {
    const result = computeInvestmentPerformance({
      asset: { ...baseAsset, status: "sold", sold_amount: 120_000 },
      txs: [{ tx_class: "income", amount: 5_000 }],
    });
    expect(result.realizedGain).toBe(20_000);
    expect(result.totalReturn).toBe(25_000);
    expect(result.roi).toBe(0.25);
  });

  test("calculator and performance agree without depreciation", () => {
    const asset = { ...baseAsset, status: "sold", sold_amount: 120_000 };
    const txs = [{ tx_class: "income", amount: 5_000 } satisfies AssetTx];
    const metrics = computeAssetMetrics(asset, txs);
    const performance = computeInvestmentPerformance({ asset, txs });
    expect(performance.saleProceeds).toBe(metrics.saleProceeds);
    expect(performance.realizedGain).toBe(metrics.realizedPnl);
    expect(performance.unrealizedGain).toBe(metrics.unrealizedPnl);
    expect(performance.totalReturn).toBe(metrics.totalPnl);
  });

  test("sold component aggregation has realized return but no unrealized return", () => {
    const soldChild = computeInvestmentPerformance({
      asset: { ...baseAsset, id: "child-sold", status: "sold", sold_amount: 120_000 },
      txs: [],
    });
    const activeChild = computeInvestmentPerformance({
      asset: { ...baseAsset, id: "child-active", current_value: 110_000 },
      txs: [],
    });
    const combined = combinePerformance([soldChild, activeChild]);
    expect(combined?.realizedGain).toBe(20_000);
    expect(combined?.unrealizedGain).toBe(10_000);
    expect(combined?.marketValue).toBe(110_000);
    expect(combined?.sold).toBe(false);
  });

  test("sold parent regression has no market exposure", () => {
    const parent = computeInvestmentPerformance({
      asset: { ...baseAsset, id: "parent", status: "sold", sold_amount: 95_000 },
      txs: [],
    });
    expect(parent.sold).toBe(true);
    expect(parent.marketValue).toBe(0);
    expect(parent.unrealizedGain).toBe(0);
    expect(parent.realizedGain).toBe(-5_000);
  });

  test("sold asset has no remaining zakat asset exposure", () => {
    const result = computeAssetZakat({
      asset: {
        ...baseAsset,
        status: "sold",
        sold_amount: 120_000,
        ownership_pct: 100,
        meta: { zakat: { is_zakatable: true, method: "book_value" } },
      },
      txs: [],
    });
    expect(result.marketValue).toBe(0);
    expect(result.zakatableValue).toBe(0);
    expect(result.zakatAmount).toBe(0);
  });
});
