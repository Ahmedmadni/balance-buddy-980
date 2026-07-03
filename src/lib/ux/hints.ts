// =============================================================
// PART 2 — getContextualHints()
// -------------------------------------------------------------
// Real, data-driven suggestions (not static copy) — reads actual counts
// from Supabase plus the existing local settings stores (notifications,
// backup) to decide which onboarding nudges are still relevant. Never
// forces an action; the caller decides how/whether to display these.
// =============================================================
import { supabase } from "@/integrations/supabase/client";
import { loadLastBackup } from "@/lib/backup/engine";
import { loadNotificationSettings } from "@/lib/notifications/config";

export type HintPriority = "low" | "normal" | "high";

export interface ContextualHint {
  id: string;
  title: string;
  description: string;
  actionLabel: string;
  actionTo: string;
  priority: HintPriority;
}

export async function getContextualHints(): Promise<ContextualHint[]> {
  const [walletsRes, investmentsRes, zakatRecordsRes] = await Promise.all([
    supabase.from("wallets").select("*", { count: "exact", head: true }),
    supabase.from("investments").select("*", { count: "exact", head: true }),
    supabase.from("zakat_records").select("*", { count: "exact", head: true }),
  ]);
  const lastBackup = await loadLastBackup();
  const notifSettings = loadNotificationSettings();

  const hints: ContextualHint[] = [];

  if (!walletsRes.count) {
    hints.push({
      id: "add_wallet",
      title: "أضف أول محفظة",
      description:
        "المحافظ هي أساس تتبّع أموالك في رصد — أضف حسابك البنكي أو محفظتك النقدية لتبدأ.",
      actionLabel: "إضافة محفظة",
      actionTo: "/app/wallets",
      priority: "high",
    });
  }

  if (!investmentsRes.count) {
    hints.push({
      id: "add_asset",
      title: "أضف أول أصل",
      description: "سجّل سيارة أو عقاراً أو استثماراً لمتابعة قيمته وعوائده وزكاته في مكان واحد.",
      actionLabel: "إضافة أصل",
      actionTo: "/app/investments",
      priority: "normal",
    });
  }

  if (!lastBackup) {
    hints.push({
      id: "enable_backup",
      title: "فعّل النسخ الاحتياطي",
      description: "لا توجد نسخة احتياطية محفوظة محلياً بعد — صدّر نسخة الآن لحماية بياناتك.",
      actionLabel: "فتح النسخ الاحتياطي",
      actionTo: "/app/settings",
      priority: "high",
    });
  }

  if (!zakatRecordsRes.count) {
    hints.push({
      id: "review_zakat",
      title: "راجع الزكاة",
      description: "لم تُحتسب الزكاة بعد — افتح الحاسبة لمعرفة وعائك الزكوي الحالي.",
      actionLabel: "فتح حاسبة الزكاة",
      actionTo: "/app/zakat",
      priority: "normal",
    });
  }

  if (!notifSettings.enabled) {
    hints.push({
      id: "setup_notifications",
      title: "أكمل إعدادات الإشعارات",
      description: "فعّل الإشعارات لتصلك تذكيرات الديون والأحداث القادمة تلقائياً.",
      actionLabel: "فتح إعدادات الإشعارات",
      actionTo: "/app/settings",
      priority: "low",
    });
  }

  const rank: Record<HintPriority, number> = { high: 0, normal: 1, low: 2 };
  return hints.sort((a, b) => rank[a.priority] - rank[b.priority]);
}
