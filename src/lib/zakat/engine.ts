// Smart Zakat Engine — core utilities
// Pure functions (no React, no Supabase) — easy to unit test.

export type ZakatSettings = {
  annual_date_type: "hijri" | "gregorian";
  annual_date_value: string; // "DD-MM"
  base_currency: string;
  nisab_method: "gold" | "silver";
  gold_jewelry_opinion: "zakat" | "no_zakat";
  nisab_gold_grams: number;
  nisab_silver_grams: number;
  gold_gram_price?: number | null;
  silver_gram_price?: number | null;
  last_haul_start_date?: string | null;
  first_nisab_reached_at?: string | null;
};

export type AssetPurpose =
  | "personal_use" // غير زكوي
  | "savings"      // ادخار → زكوي
  | "investment"   // استثمار → زكوي
  | "trade"        // عروض تجارة → زكوي بالقيمة السوقية
  | "rental"       // عقار مؤجر → الأصل غير زكوي
  | "resale"       // عقار للبيع → زكوي
  | "speculation"  // مضاربة → زكوي
  | "long_term";   // استثمار طويل → زكوي

export const PURPOSE_LABELS: Record<AssetPurpose, string> = {
  personal_use: "استخدام شخصي / زينة",
  savings: "ادخار",
  investment: "استثمار",
  trade: "تجارة / عروض",
  rental: "تأجير",
  resale: "للبيع",
  speculation: "مضاربة",
  long_term: "استثمار طويل الأجل",
};

// Decide zakat eligibility from asset type + purpose + user's jewelry opinion.
export function classifyAsset(asset: {
  type: string;
  purpose?: AssetPurpose | string | null;
  meta?: any;
}, settings: Pick<ZakatSettings, "gold_jewelry_opinion">): { isZakatable: boolean; reason: string } {
  const p = (asset.purpose ?? "") as AssetPurpose;

  if (asset.type === "gold") {
    const goldType = asset.meta?.gold_type;
    if (p === "personal_use" || goldType === "jewelry") {
      const zakat = settings.gold_jewelry_opinion === "zakat";
      return { isZakatable: zakat, reason: zakat ? "ذهب ملبوس (رأي وجوب الزكاة)" : "ذهب ملبوس — لا زكاة عليه" };
    }
    return { isZakatable: true, reason: "ذهب للادخار/الاستثمار" };
  }

  if (asset.type === "real_estate") {
    if (p === "resale" || p === "trade") return { isZakatable: true, reason: "عقار للبيع/التجارة" };
    return { isZakatable: false, reason: p === "rental" ? "عقار مؤجر — الإيجارات فقط زكوية" : "عقار شخصي" };
  }

  if (asset.type === "car") {
    if (p === "resale" || p === "trade") return { isZakatable: true, reason: "سيارة للبيع/التجارة" };
    return { isZakatable: false, reason: p === "rental" ? "سيارة مؤجرة — الإيجارات فقط زكوية" : "سيارة للاستخدام الشخصي" };
  }

  if (asset.type === "stocks" || asset.type === "crypto" || asset.type === "fund" || asset.type === "trade") {
    return { isZakatable: true, reason: "أصل زكوي" };
  }

  if (p === "personal_use") return { isZakatable: false, reason: "للاستخدام الشخصي" };
  return { isZakatable: true, reason: "أصل مالي زكوي" };
}

// Hijri ↔ Gregorian helpers using Intl
export function toHijri(date: Date): { y: number; m: number; d: number } {
  const fmt = new Intl.DateTimeFormat("en-u-ca-islamic-umalqura", { year: "numeric", month: "numeric", day: "numeric" });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value || "0");
  return { y: get("year"), m: get("month"), d: get("day") };
}

// Compute next annual zakat date based on settings
export function nextZakatDate(settings: Pick<ZakatSettings, "annual_date_type" | "annual_date_value">, today = new Date()): Date {
  const [dStr, mStr] = (settings.annual_date_value || "01-01").split("-");
  const d = parseInt(dStr) || 1;
  const m = parseInt(mStr) || 1;

  if (settings.annual_date_type === "gregorian") {
    const yr = today.getFullYear();
    let candidate = new Date(yr, m - 1, d);
    if (candidate.getTime() < today.getTime()) candidate = new Date(yr + 1, m - 1, d);
    return candidate;
  }
  // Hijri: approximate by iterating days from today (cheap & accurate enough)
  // Find next gregorian date whose hijri equals (m, d)
  const start = new Date(today);
  for (let i = 0; i < 400; i++) {
    const cand = new Date(start);
    cand.setDate(start.getDate() + i);
    const h = toHijri(cand);
    if (h.m === m && h.d === d) return cand;
  }
  return start;
}

// Haul status: tracks whether the wealth crossed nisab and how long ago
export function computeHaulStatus(args: {
  settings: ZakatSettings;
  currentWealthBase: number;
  nisabBase: number;
  today?: Date;
}): {
  reachesNisab: boolean;
  haulStart: string | null;
  haulComplete: boolean;
  daysRemaining: number;
  nextZakatDate: Date;
} {
  const today = args.today ?? new Date();
  const reachesNisab = args.currentWealthBase >= args.nisabBase;
  const haulStart = args.settings.last_haul_start_date || args.settings.first_nisab_reached_at || null;
  let haulComplete = false;
  let daysRemaining = 0;
  if (haulStart) {
    const start = new Date(haulStart);
    // Hijri year ≈ 354.367 days
    const haulMs = 354.367 * 86400 * 1000;
    const elapsed = today.getTime() - start.getTime();
    haulComplete = elapsed >= haulMs;
    daysRemaining = Math.max(0, Math.ceil((haulMs - elapsed) / (86400 * 1000)));
  }
  return {
    reachesNisab,
    haulStart,
    haulComplete,
    daysRemaining,
    nextZakatDate: nextZakatDate(args.settings, today),
  };
}

// Pre-compute validation: returns list of missing items
export function validateBeforeCompute(args: {
  settings?: ZakatSettings | null;
  assets: Array<{ id: string; name: string; type: string; purpose?: any; acquired_at?: any; currency: string }>;
  usedCurrencies: string[];
  rates: Record<string, number>;
}): string[] {
  const missing: string[] = [];
  if (!args.settings) {
    missing.push("لم يتم إعداد تاريخ الزكاة السنوي والعملة الأساسية بعد.");
    return missing;
  }
  if (!args.settings.annual_date_value) missing.push("حدد تاريخ الزكاة السنوي.");
  if (!args.settings.base_currency) missing.push("حدد العملة الأساسية.");
  for (const a of args.assets) {
    if (!a.purpose) missing.push(`الأصل "${a.name}" بدون تحديد الغرض من التملك.`);
    if (!a.acquired_at) missing.push(`الأصل "${a.name}" بدون تاريخ تملك.`);
  }
  for (const c of args.usedCurrencies) {
    if (c === args.settings.base_currency) continue;
    if (!args.rates[c]) missing.push(`سعر صرف العملة ${c} مفقود.`);
  }
  return missing;
}
