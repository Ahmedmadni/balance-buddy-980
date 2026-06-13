export const CURRENCIES = [
  { code: "SAR", name: "ريال سعودي", symbol: "ر.س" },
  { code: "AED", name: "درهم إماراتي", symbol: "د.إ" },
  { code: "EGP", name: "جنيه مصري", symbol: "ج.م" },
  { code: "USD", name: "دولار أمريكي", symbol: "$" },
  { code: "EUR", name: "يورو", symbol: "€" },
  { code: "KWD", name: "دينار كويتي", symbol: "د.ك" },
  { code: "QAR", name: "ريال قطري", symbol: "ر.ق" },
  { code: "BHD", name: "دينار بحريني", symbol: "د.ب" },
  { code: "OMR", name: "ريال عماني", symbol: "ر.ع" },
  { code: "JOD", name: "دينار أردني", symbol: "د.أ" },
  { code: "TRY", name: "ليرة تركية", symbol: "₺" },
  { code: "GBP", name: "جنيه إسترليني", symbol: "£" },
];

export function formatMoney(amount: number | string, currency = "SAR") {
  const n = typeof amount === "string" ? parseFloat(amount) : amount;
  const c = CURRENCIES.find((x) => x.code === currency);
  const formatted = new Intl.NumberFormat("ar", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n || 0);
  return `${formatted} ${c?.symbol ?? currency}`;
}

export function formatDate(d: string | Date | null | undefined) {
  if (!d) return "—";
  const date = typeof d === "string" ? new Date(d) : d;
  return new Intl.DateTimeFormat("ar", { year: "numeric", month: "long", day: "numeric" }).format(date);
}

export function todayISO() {
  return new Date().toISOString().slice(0, 10);
}
