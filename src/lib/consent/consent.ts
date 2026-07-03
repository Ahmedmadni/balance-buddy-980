// =============================================================
// PART 4 (Prompt 24) — Local Consent Manager
// -------------------------------------------------------------
// Stores a single consent record in localStorage — no network call, no
// third-party Consent Management Platform (CMP) SDK, no server-side
// record. Default posture is opt-out (every category starts `false`)
// so nothing is ever inferred as consented, matching GDPR's "no
// pre-ticked boxes" principle and CCPA/Saudi PDPL's opt-in expectations
// for non-essential processing.
// =============================================================

export type ConsentCategory = "analytics" | "ads" | "personalization" | "diagnostics";

export interface ConsentRecord {
  version: number;
  bannerShown: boolean;
  updatedAt: string | null;
  categories: Record<ConsentCategory, boolean>;
}

const KEY = "rasd.consent.v1";
const VERSION = 1;

export const CONSENT_CATEGORIES: ConsentCategory[] = [
  "analytics",
  "ads",
  "personalization",
  "diagnostics",
];

export const CONSENT_CATEGORY_LABEL: Record<ConsentCategory, string> = {
  analytics: "التحليلات",
  ads: "الإعلانات",
  personalization: "التخصيص",
  diagnostics: "التشخيص",
};

export const CONSENT_CATEGORY_DESCRIPTION: Record<ConsentCategory, string> = {
  analytics:
    "احتساب مؤشرات الرؤى المالية محلياً من بياناتك (لا يُرسَل أي شيء لطرف ثالث حتى بلا موافقة — هذا الخيار احترازي فقط)",
  ads: "عرض إعلانات AdSense/AdMob عند تفعيلها مستقبلاً (لا إعلانات حقيقية تُحمَّل في هذا الإصدار بغضّ النظر عن هذا الخيار)",
  personalization: "تخصيص محتوى أو تلميحات بناءً على استخدامك للتطبيق",
  diagnostics: "تسجيل تشخيصات محلية (سجل الأخطاء، تدقيق النظام) لمساعدتك على تتبّع مشاكل التطبيق",
};

const DEFAULT_RECORD: ConsentRecord = {
  version: VERSION,
  bannerShown: false,
  updatedAt: null,
  categories: { analytics: false, ads: false, personalization: false, diagnostics: false },
};

export function loadConsent(): ConsentRecord {
  if (typeof localStorage === "undefined")
    return { ...DEFAULT_RECORD, categories: { ...DEFAULT_RECORD.categories } };
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULT_RECORD, categories: { ...DEFAULT_RECORD.categories } };
    const parsed = JSON.parse(raw);
    return {
      version: typeof parsed.version === "number" ? parsed.version : VERSION,
      bannerShown: !!parsed.bannerShown,
      updatedAt: typeof parsed.updatedAt === "string" ? parsed.updatedAt : null,
      categories: { ...DEFAULT_RECORD.categories, ...(parsed.categories ?? {}) },
    };
  } catch {
    return { ...DEFAULT_RECORD, categories: { ...DEFAULT_RECORD.categories } };
  }
}

function persist(record: ConsentRecord) {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    /* quota — best effort */
  }
}

/** Merges the given category choices into the stored record and marks the banner as shown. */
export function saveConsent(choices: Partial<Record<ConsentCategory, boolean>>): ConsentRecord {
  const current = loadConsent();
  const next: ConsentRecord = {
    version: VERSION,
    bannerShown: true,
    updatedAt: new Date().toISOString(),
    categories: { ...current.categories, ...choices },
  };
  persist(next);
  return next;
}

export function hasConsent(category: ConsentCategory): boolean {
  return loadConsent().categories[category] === true;
}

/** Sets every category back to false but keeps the record (user was asked, declined everything). */
export function withdrawAllConsent(): ConsentRecord {
  return saveConsent({ analytics: false, ads: false, personalization: false, diagnostics: false });
}

/** Fully clears the record, as if the user had never been asked. */
export function resetConsent(): void {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(KEY);
}
