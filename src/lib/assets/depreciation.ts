// Depreciation Engine — calculation only (no journal entries, no balance impact).

export type DepreciationMethod = "straight_line" | "double_declining" | "units_of_production";

export interface DepreciationProfile {
  id?: string;
  investment_id?: string;
  method: DepreciationMethod;
  useful_life_months: number;
  salvage_value: number;
  start_date: string; // ISO date
  is_active?: boolean;
  units_total?: number | null;
  units_consumed?: number | null;
}

export interface DepreciationResult {
  method: DepreciationMethod;
  cost: number;
  salvage: number;
  useful_life_months: number;
  elapsed_months: number;
  remaining_life_months: number;
  monthly_depreciation: number;
  annual_depreciation: number;
  accumulated_depreciation: number;
  book_value: number;
  depreciation_percentage: number; // 0..100
  fully_depreciated: boolean;
}

export interface ScheduleRow {
  month: number;          // 1-based month index
  period: string;         // YYYY-MM
  monthly: number;
  accumulated: number;
  book_value: number;
}

const n = (v: any) => Number(v ?? 0) || 0;

function monthsBetween(from: Date, to: Date): number {
  const months = (to.getFullYear() - from.getFullYear()) * 12 + (to.getMonth() - from.getMonth());
  // Add partial month fraction
  const dayFraction = (to.getDate() - from.getDate()) / 30;
  return Math.max(0, months + dayFraction);
}

function addMonths(d: Date, m: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + m);
  return x;
}

function fmtPeriod(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

/**
 * Compute depreciation metrics for an asset given a profile.
 * - cost: original cost / base value
 * - asOf: reference date (defaults to today)
 */
export function computeDepreciation(
  profile: DepreciationProfile,
  cost: number,
  asOf: Date = new Date()
): DepreciationResult {
  const c = n(cost);
  const salvage = Math.min(n(profile.salvage_value), c);
  const life = Math.max(1, Math.floor(profile.useful_life_months));
  const start = new Date(profile.start_date);
  const elapsedRaw = monthsBetween(start, asOf);
  const elapsed = Math.max(0, Math.min(life, elapsedRaw));
  const remaining = Math.max(0, life - elapsed);
  const depreciableBase = Math.max(0, c - salvage);

  let monthly = 0;
  let annual = 0;
  let accumulated = 0;

  switch (profile.method) {
    case "straight_line": {
      monthly = depreciableBase / life;
      annual = monthly * 12;
      accumulated = Math.min(depreciableBase, monthly * elapsed);
      break;
    }
    case "double_declining": {
      // DDB: rate = 2 / life (in months). Iterate month-by-month, never below salvage.
      const rate = 2 / life;
      let bv = c;
      const elapsedFloor = Math.floor(elapsed);
      for (let i = 0; i < elapsedFloor; i++) {
        const dep = Math.max(0, Math.min(bv * rate, bv - salvage));
        accumulated += dep;
        bv -= dep;
        if (bv <= salvage) break;
      }
      // Current month "monthly_depreciation" is the next period's depreciation
      monthly = Math.max(0, Math.min(bv * rate, bv - salvage));
      annual = monthly * 12; // indicative; DDB declines over time
      break;
    }
    case "units_of_production": {
      const total = Math.max(0, n(profile.units_total));
      const used = Math.max(0, n(profile.units_consumed));
      if (total > 0) {
        const perUnit = depreciableBase / total;
        accumulated = Math.min(depreciableBase, perUnit * used);
        // Monthly is not strictly meaningful; estimate from elapsed if any usage
        monthly = elapsed > 0 ? accumulated / Math.max(1, elapsed) : 0;
        annual = monthly * 12;
      }
      break;
    }
  }

  accumulated = Math.min(accumulated, depreciableBase);
  const bookValue = Math.max(salvage, c - accumulated);
  const pct = depreciableBase > 0 ? (accumulated / depreciableBase) * 100 : 0;

  return {
    method: profile.method,
    cost: c,
    salvage,
    useful_life_months: life,
    elapsed_months: Number(elapsed.toFixed(2)),
    remaining_life_months: Number(remaining.toFixed(2)),
    monthly_depreciation: monthly,
    annual_depreciation: annual,
    accumulated_depreciation: accumulated,
    book_value: bookValue,
    depreciation_percentage: Math.min(100, Math.max(0, pct)),
    fully_depreciated: accumulated >= depreciableBase - 0.005,
  };
}

/**
 * Generate a month-by-month depreciation schedule for the entire useful life.
 * Returns at most `limit` rows (default = useful_life_months).
 */
export function buildDepreciationSchedule(
  profile: DepreciationProfile,
  cost: number,
  limit?: number
): ScheduleRow[] {
  const c = n(cost);
  const salvage = Math.min(n(profile.salvage_value), c);
  const life = Math.max(1, Math.floor(profile.useful_life_months));
  const start = new Date(profile.start_date);
  const depreciableBase = Math.max(0, c - salvage);
  const rows: ScheduleRow[] = [];
  const max = Math.min(life, limit ?? life);

  if (profile.method === "straight_line") {
    const monthly = depreciableBase / life;
    let acc = 0;
    for (let i = 1; i <= max; i++) {
      acc = Math.min(depreciableBase, acc + monthly);
      rows.push({
        month: i,
        period: fmtPeriod(addMonths(start, i - 1)),
        monthly,
        accumulated: acc,
        book_value: Math.max(salvage, c - acc),
      });
    }
  } else if (profile.method === "double_declining") {
    const rate = 2 / life;
    let bv = c;
    let acc = 0;
    for (let i = 1; i <= max; i++) {
      const dep = Math.max(0, Math.min(bv * rate, bv - salvage));
      acc += dep;
      bv -= dep;
      rows.push({
        month: i,
        period: fmtPeriod(addMonths(start, i - 1)),
        monthly: dep,
        accumulated: acc,
        book_value: Math.max(salvage, bv),
      });
      if (bv <= salvage) break;
    }
  } else {
    // units_of_production — no time-based schedule; emit a single summary row.
    const total = Math.max(0, n(profile.units_total));
    const used = Math.max(0, n(profile.units_consumed));
    const perUnit = total > 0 ? depreciableBase / total : 0;
    const acc = Math.min(depreciableBase, perUnit * used);
    rows.push({
      month: 1,
      period: fmtPeriod(start),
      monthly: acc,
      accumulated: acc,
      book_value: Math.max(salvage, c - acc),
    });
  }
  return rows;
}

export const DEPRECIATION_METHODS: { value: DepreciationMethod; label: string; hint: string }[] = [
  { value: "straight_line", label: "القسط الثابت (Straight Line)", hint: "(التكلفة − القيمة التخريدية) ÷ العمر الإنتاجي" },
  { value: "double_declining", label: "المتناقص المضاعف (DDB)", hint: "معدل سنوي = 2 ÷ العمر — يهبط أسرع في البداية" },
  { value: "units_of_production", label: "وحدات الإنتاج", hint: "حسب الاستخدام الفعلي (كم/ساعة/وحدة)" },
];
