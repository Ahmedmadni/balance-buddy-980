// Depreciation defaults & eligibility helpers.
// Pure — no side effects. Consumed by DepreciationTab (auto-fill) and
// investments list (hide tab / show badge) to link depreciation to the
// correct asset kinds (real estate, cars, equipment, furniture, custom).

import type { DepreciationMethod } from "./depreciation";

// Asset types that are eligible for depreciation.
// Financial holdings (stocks/gold/crypto/funds) revalue via market — no depreciation.
const DEPRECIABLE_TYPES = new Set([
  "car",
  "real_estate",
  "business",
  "other",
  "equipment",
  "furniture",
  "device",
  "custom",
]);

export function isDepreciable(type?: string | null): boolean {
  if (!type) return false;
  return DEPRECIABLE_TYPES.has(type);
}

export interface DepreciationDefaults {
  method: DepreciationMethod;
  useful_life_months: number;
  salvage_ratio: number; // 0..1 of cost
}

// Sensible starting values per asset type. The user can always override
// them in DepreciationTab — this only pre-fills the form when the asset
// has no profile yet.
export function defaultsFor(type?: string | null): DepreciationDefaults {
  switch (type) {
    case "car":
      return { method: "straight_line", useful_life_months: 60, salvage_ratio: 0.15 };
    case "real_estate":
      // Only the building depreciates in accounting practice; we default to
      // 30y / 10% salvage but the user can raise/lower it.
      return { method: "straight_line", useful_life_months: 360, salvage_ratio: 0.30 };
    case "business":
      return { method: "straight_line", useful_life_months: 120, salvage_ratio: 0.10 };
    case "equipment":
      return { method: "straight_line", useful_life_months: 84, salvage_ratio: 0.10 };
    case "furniture":
      return { method: "straight_line", useful_life_months: 120, salvage_ratio: 0.05 };
    case "device":
      return { method: "straight_line", useful_life_months: 36, salvage_ratio: 0.05 };
    default:
      return { method: "straight_line", useful_life_months: 60, salvage_ratio: 0.10 };
  }
}
