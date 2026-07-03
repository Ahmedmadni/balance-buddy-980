// =============================================================
// PART 4 — simulateAdRevenue()
// -------------------------------------------------------------
// Pure arithmetic over user-supplied (or default illustrative) inputs.
// No network call, no analytics SDK, no real user data — the numbers
// here are hypothetical "what if" estimates only, clearly labeled as
// such wherever they're displayed.
// =============================================================

export interface RevenueSimulationInput {
  dailyActiveUsers: number;
  impressionsPerUserPerDay: number;
  ctr: number; // click-through rate as a ratio, e.g. 0.01 = 1%
  eCPM: number; // effective cost per 1000 impressions
}

export interface RevenueSimulationResult {
  input: RevenueSimulationInput;
  dailyImpressions: number;
  dailyClicks: number;
  estimatedDailyRevenue: number;
  estimatedMonthlyRevenue: number;
}

export const DEFAULT_REVENUE_ASSUMPTIONS: RevenueSimulationInput = {
  dailyActiveUsers: 100,
  impressionsPerUserPerDay: 5,
  ctr: 0.01,
  eCPM: 1.5,
};

export function simulateAdRevenue(
  input: Partial<RevenueSimulationInput> = {},
): RevenueSimulationResult {
  const full: RevenueSimulationInput = { ...DEFAULT_REVENUE_ASSUMPTIONS, ...input };
  const dailyImpressions =
    Math.max(0, full.dailyActiveUsers) * Math.max(0, full.impressionsPerUserPerDay);
  const dailyClicks = dailyImpressions * Math.max(0, full.ctr);
  const estimatedDailyRevenue = (dailyImpressions / 1000) * Math.max(0, full.eCPM);
  const estimatedMonthlyRevenue = estimatedDailyRevenue * 30;
  return {
    input: full,
    dailyImpressions,
    dailyClicks,
    estimatedDailyRevenue,
    estimatedMonthlyRevenue,
  };
}
