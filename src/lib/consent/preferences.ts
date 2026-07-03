// =============================================================
// PART 2 — Consent preferences: UI-facing adapter
// -------------------------------------------------------------
// Maps the 5 categories the consent UI shows (Essential, Analytics,
// Ads, Notifications, Personalization) onto the real state each one
// actually controls, reusing what already exists instead of inventing
// a second store:
//   - Essential: always on, not stored, not toggleable (matches every
//     real consent UI's "necessary" category).
//   - Analytics / Ads / Personalization: Prompt 24's consent.ts
//     (loadConsent/saveConsent) — unchanged.
//   - Notifications: the real notification settings toggle
//     (notifications/config.ts) — reused directly rather than
//     duplicating an on/off flag in a second place.
// =============================================================
import { loadConsent, saveConsent, type ConsentCategory } from "./consent";
import { loadNotificationSettings, saveNotificationSettings } from "@/lib/notifications/config";

export type PreferenceCategory =
  | "essential"
  | "analytics"
  | "ads"
  | "notifications"
  | "personalization";

export interface PreferenceItem {
  id: PreferenceCategory;
  label: string;
  description: string;
  enabled: boolean;
  editable: boolean;
}

export const PREFERENCE_LABEL: Record<PreferenceCategory, string> = {
  essential: "أساسية",
  analytics: "التحليلات",
  ads: "الإعلانات",
  notifications: "الإشعارات",
  personalization: "التخصيص",
};

export const PREFERENCE_DESCRIPTION: Record<PreferenceCategory, string> = {
  essential: "تسجيل الدخول وتخزين بياناتك المالية — لا يمكن تعطيلها لأن التطبيق لا يعمل بدونها",
  analytics:
    "احتساب مؤشرات الرؤى المالية محلياً من بياناتك — لا يُرسَل أي شيء لطرف ثالث حتى بلا هذه الموافقة",
  ads: "عرض إعلانات AdSense/AdMob عند تفعيلها مستقبلاً",
  notifications: "تذكيرات الديون والأحداث القادمة (محلية على جهازك)",
  personalization: "تخصيص محتوى أو تلميحات بناءً على استخدامك للتطبيق",
};

export function loadPreferences(): PreferenceItem[] {
  const consent = loadConsent();
  const notifSettings = loadNotificationSettings();

  return [
    {
      id: "essential",
      label: PREFERENCE_LABEL.essential,
      description: PREFERENCE_DESCRIPTION.essential,
      enabled: true,
      editable: false,
    },
    {
      id: "analytics",
      label: PREFERENCE_LABEL.analytics,
      description: PREFERENCE_DESCRIPTION.analytics,
      enabled: consent.categories.analytics,
      editable: true,
    },
    {
      id: "ads",
      label: PREFERENCE_LABEL.ads,
      description: PREFERENCE_DESCRIPTION.ads,
      enabled: consent.categories.ads,
      editable: true,
    },
    {
      id: "notifications",
      label: PREFERENCE_LABEL.notifications,
      description: PREFERENCE_DESCRIPTION.notifications,
      enabled: notifSettings.enabled,
      editable: true,
    },
    {
      id: "personalization",
      label: PREFERENCE_LABEL.personalization,
      description: PREFERENCE_DESCRIPTION.personalization,
      enabled: consent.categories.personalization,
      editable: true,
    },
  ];
}

/** Saves a full set of preference choices in one go (banner "accept all"/"reject all" or the preferences dialog). */
export function savePreferences(choices: Partial<Record<PreferenceCategory, boolean>>): void {
  const consentPatch: Partial<Record<ConsentCategory, boolean>> = {};
  if ("analytics" in choices) consentPatch.analytics = choices.analytics;
  if ("ads" in choices) consentPatch.ads = choices.ads;
  if ("personalization" in choices) consentPatch.personalization = choices.personalization;
  if (Object.keys(consentPatch).length > 0) saveConsent(consentPatch);

  if ("notifications" in choices) {
    const current = loadNotificationSettings();
    saveNotificationSettings({ ...current, enabled: !!choices.notifications });
  }
}

export function acceptAllPreferences(): void {
  savePreferences({ analytics: true, ads: true, notifications: true, personalization: true });
}

export function rejectAllPreferences(): void {
  savePreferences({ analytics: false, ads: false, personalization: false });
  // Notifications intentionally left untouched by "reject all" — it's a
  // functional feature (debt/event reminders), not a tracking category,
  // so it isn't forced off by a privacy-only reject-all action.
}
