// =============================================================
// Mobile Platform Audit + Offline Readiness.
// -------------------------------------------------------------
// Pure capability probes — checks whether an API/feature exists and is
// usable on this device, never requests a permission or loads an SDK.
// Reuses collectPerformanceMetrics() / loadNotificationLog() /
// loadLastBackup() instead of re-measuring storage or re-reading state.
// =============================================================
import { getPlatform, isNative, getCapacitorPlugin } from "./platform";
import { collectPerformanceMetrics } from "@/lib/system/performance";
import { loadNotificationLog } from "@/lib/notifications/store";
import { loadNotificationSettings } from "@/lib/notifications/config";
import { loadLastBackup } from "@/lib/backup/engine";

export interface CompatibilityItem {
  id: string;
  label: string;
  supported: boolean;
  detail: string;
}

export interface MobileCompatibilityReport {
  platform: ReturnType<typeof getPlatform>;
  isNative: boolean;
  items: CompatibilityItem[];
  generatedAt: string;
}

function probe(
  id: string,
  label: string,
  fn: () => boolean,
  okDetail: string,
  failDetail: string,
): CompatibilityItem {
  let supported = false;
  try {
    supported = fn();
  } catch {
    supported = false;
  }
  return { id, label, supported, detail: supported ? okDetail : failDetail };
}

export function auditMobileCompatibility(): MobileCompatibilityReport {
  const items: CompatibilityItem[] = [];

  items.push(
    probe(
      "local_storage",
      "localStorage",
      () => {
        const k = "__rasd_probe__";
        localStorage.setItem(k, "1");
        localStorage.removeItem(k);
        return true;
      },
      "متاح ويقبل الكتابة",
      "غير متاح أو محظور (وضع خاص / حصة ممتلئة)",
    ),
  );

  items.push(
    probe(
      "indexeddb",
      "IndexedDB",
      () => typeof indexedDB !== "undefined",
      "متاح",
      "غير مدعوم في هذا المتصفح/WebView",
    ),
  );

  items.push(
    probe(
      "file_export",
      "تصدير الملفات (Blob + تنزيل)",
      () => typeof Blob !== "undefined" && "download" in document.createElement("a"),
      "مدعوم — يُستخدم فعلياً في محرك النسخ الاحتياطي",
      "غير مدعوم — التصدير المحلي لن يعمل",
    ),
  );

  items.push(
    probe(
      "file_import",
      "استيراد الملفات (File/FileReader)",
      () => typeof File !== "undefined" && typeof FileReader !== "undefined",
      "مدعوم",
      "غير مدعوم — استيراد النسخ الاحتياطي لن يعمل",
    ),
  );

  items.push(
    probe(
      "notifications",
      "الإشعارات",
      () =>
        isNative()
          ? !!getCapacitorPlugin("LocalNotifications")
          : typeof Notification !== "undefined",
      isNative() ? "متاح عبر Capacitor LocalNotifications" : "متاح عبر Web Notifications API",
      isNative()
        ? "حزمة @capacitor/local-notifications غير مثبّتة في هذا البناء"
        : "غير مدعوم في هذا المتصفح",
    ),
  );

  items.push(
    probe(
      "camera",
      "صلاحية الكاميرا",
      () => (isNative() ? !!getCapacitorPlugin("Camera") : !!navigator.mediaDevices?.getUserMedia),
      "الواجهة البرمجية متاحة (لم يُطلب الإذن بعد)",
      "لا توجد واجهة كاميرا متاحة على هذا الجهاز/البناء",
    ),
  );

  items.push(
    probe(
      "storage_permission",
      "صلاحية التخزين الدائم",
      () => typeof navigator !== "undefined" && !!navigator.storage?.persist,
      "متاح — يمكن طلب navigator.storage.persist()",
      "غير مدعوم في هذا المتصفح",
    ),
  );

  items.push(
    probe(
      "deep_links",
      "الروابط العميقة (Deep Links)",
      () => (isNative() ? !!getCapacitorPlugin("App") : typeof window !== "undefined"),
      isNative()
        ? "متاح عبر Capacitor App plugin (appUrlOpen)"
        : "التوجيه القياسي عبر الرابط (TanStack Router)",
      "حزمة @capacitor/app غير مسجّلة في هذا البناء",
    ),
  );

  items.push(
    probe(
      "share",
      "مشاركة (Share API)",
      () => typeof navigator !== "undefined" && typeof navigator.share === "function",
      "متاح — navigator.share()",
      "غير مدعوم — استخدم زر التنزيل كبديل",
    ),
  );

  return {
    platform: getPlatform(),
    isNative: isNative(),
    items,
    generatedAt: new Date().toISOString(),
  };
}

export interface OfflineCapabilities {
  cachedDataAvailable: boolean;
  cachedQueryCount: number;
  indexedDbUsageBytes: number | null;
  backupAvailable: boolean;
  lastBackupAt: string | null;
  pendingNotifications: number;
  unsyncedOperations: number; // always 0 in this app — no offline write queue exists
  ready: boolean;
}

/**
 * `queryCache` is optional: pass the app's TanStack QueryClient's cache
 * (`queryClient.getQueryCache().getAll().length`) from a component if you
 * want the real in-memory count; without it we just report backup/
 * notification/storage state, which don't need a live QueryClient.
 */
export async function checkOfflineCapabilities(cachedQueryCount = 0): Promise<OfflineCapabilities> {
  const perf = await collectPerformanceMetrics();
  const lastBackup = await loadLastBackup();
  const notifSettings = loadNotificationSettings();
  const notifLog = loadNotificationLog();
  const pendingNotifications = notifSettings.enabled
    ? notifLog.filter((n) => n.status === "skipped").length
    : 0;

  return {
    cachedDataAvailable: cachedQueryCount > 0,
    cachedQueryCount,
    indexedDbUsageBytes: perf.storageEstimate.usageBytes,
    backupAvailable: !!lastBackup,
    lastBackupAt: lastBackup?.meta.exported_at ?? null,
    pendingNotifications,
    // رصد لا يكتب أي عملية أثناء عدم الاتصال — كل الكتابة تمر مباشرة عبر Supabase.
    // هذا الحقل موجود ليعكس تلك الحقيقة صراحة، وليس لأنه يوجد طابور مزامنة فعلي.
    unsyncedOperations: 0,
    ready: !!lastBackup, // الحد الأدنى لـ"جاهزية عدم الاتصال" هنا هو وجود نسخة احتياطية حديثة
  };
}
