// =============================================================
// Ad Placement Registry — the single source of truth for every ad
// placement in the app (id, label, visual format, where it lives).
// -------------------------------------------------------------
// ad-config.ts (network IDs per placement) and AdSlot.tsx (rendering)
// both key off AD_PLACEMENTS/AdPlacement from here instead of each
// keeping their own placement list — add a new placement ONLY here.
// =============================================================

export type AdFormat = "banner" | "rectangle" | "interstitial" | "reward" | "native";

export type AdPlacement =
  | "dashboard_top"
  | "dashboard_bottom"
  | "transactions_inline"
  | "reports_bottom"
  | "assets_list_bottom"
  | "asset_details_bottom"
  | "people_bottom"
  | "zakat_bottom"
  | "settings_banner";

export interface AdPlacementDef {
  id: AdPlacement;
  label: string; // Arabic display label, used in diagnostics/settings UI
  format: AdFormat;
  route: string; // where this placement renders, for documentation/diagnostics only
  description: string;
}

export const AD_PLACEMENTS: AdPlacementDef[] = [
  {
    id: "dashboard_top",
    label: "أعلى لوحة التحكم",
    format: "banner",
    route: "/app",
    description: "شريط إعلاني أعلى الصفحة الرئيسية",
  },
  {
    id: "dashboard_bottom",
    label: "أسفل لوحة التحكم",
    format: "rectangle",
    route: "/app",
    description: "مربع إعلاني أسفل الصفحة الرئيسية",
  },
  {
    id: "transactions_inline",
    label: "داخل قائمة العمليات",
    format: "native",
    route: "/app/transactions",
    description: "إعلان مدمج بين عناصر قائمة العمليات",
  },
  {
    id: "reports_bottom",
    label: "أسفل التقارير",
    format: "rectangle",
    route: "/app/reports",
    description: "مربع إعلاني أسفل صفحة التقارير",
  },
  {
    id: "assets_list_bottom",
    label: "أسفل قائمة الأصول",
    format: "banner",
    route: "/app/investments",
    description: "شريط إعلاني أسفل قائمة الأصول والاستثمارات",
  },
  {
    id: "asset_details_bottom",
    label: "أسفل تفاصيل الأصل",
    format: "rectangle",
    route: "/app/investments",
    description: "مربع إعلاني في لوحة تفاصيل الأصل",
  },
  {
    id: "people_bottom",
    label: "أسفل صفحة الأشخاص",
    format: "banner",
    route: "/app/people",
    description: "شريط إعلاني أسفل صفحة الديون/الأشخاص",
  },
  {
    id: "zakat_bottom",
    label: "أسفل حاسبة الزكاة",
    format: "banner",
    route: "/app/zakat",
    description: "شريط إعلاني أسفل صفحة الزكاة",
  },
  {
    id: "settings_banner",
    label: "شريط الإعدادات",
    format: "banner",
    route: "/app/settings",
    description: "شريط إعلاني داخل صفحة الإعدادات",
  },
];

export const AD_PLACEMENT_IDS: AdPlacement[] = AD_PLACEMENTS.map((p) => p.id);

export const PLACEMENT_FORMAT: Record<AdPlacement, AdFormat> = Object.fromEntries(
  AD_PLACEMENTS.map((p) => [p.id, p.format]),
) as Record<AdPlacement, AdFormat>;

export function getPlacementDef(id: AdPlacement): AdPlacementDef {
  const def = AD_PLACEMENTS.find((p) => p.id === id);
  if (!def) throw new Error(`Unknown ad placement: ${id}`);
  return def;
}
