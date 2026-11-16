import { Capacitor } from "@capacitor/core";
import { Directory, Encoding, Filesystem } from "@capacitor/filesystem";
import { LocalNotifications } from "@capacitor/local-notifications";

/**
 * Non-destructive diagnostic. No sign-in, permission requests, sharing,
 * printing, or financial user data. Any test file is removed in finally.
 */
export interface NativeCheck {
  id: string;
  label: string;
  status: "ok" | "attention" | "error";
  details: string;
}
export interface NativeSelfCheckResult {
  platform: string;
  checkedAt: string;
  checks: NativeCheck[];
}

export async function runAndroidSelfCheck(): Promise<NativeSelfCheckResult> {
  const platform = Capacitor.getPlatform();
  const checks: NativeCheck[] = [];
  const add = (id: string, label: string, status: NativeCheck["status"], details: string) =>
    checks.push({ id, label, status, details });
  if (!Capacitor.isNativePlatform() || platform !== "android") {
    add("platform", "نسخة Android", "attention", "هذا الفحص مخصص لتطبيق Android المثبت، وليس الموقع في المتصفح");
    return { platform, checkedAt: new Date().toISOString(), checks };
  }
  add("platform", "غلاف Android", "ok", "تم التعرف على تطبيق Android الأصلي");

  if (!Capacitor.isPluginAvailable("Filesystem")) {
    add("filesystem", "قراءة وكتابة الملفات", "error", "إضافة Filesystem غير مسجلة في هذا APK");
  } else {
    const path = `rasd-selfcheck-${crypto.randomUUID()}.txt`;
    try {
      const value = "rasd-android-native-self-check";
      await Filesystem.writeFile({ path, directory: Directory.Cache, encoding: Encoding.UTF8, data: value });
      const read = await Filesystem.readFile({ path, directory: Directory.Cache, encoding: Encoding.UTF8 });
      if (read.data !== value) {
        add("filesystem", "قراءة وكتابة الملفات", "error", "القيمة المقروءة مختلفة عن الملف المؤقت المكتوب");
      } else {
        add("filesystem", "قراءة وكتابة الملفات", "ok", "نجح إنشاء ملف تجريبي وقراءته في ذاكرة التخزين المؤقت");
      }
    } catch {
      add("filesystem", "قراءة وكتابة الملفات", "error", "تعذر إنشاء أو قراءة ملف تجريبي داخل Android");
    } finally {
      try { await Filesystem.deleteFile({ path, directory: Directory.Cache }); } catch { /* best effort */ }
    }
  }

  add(
    "share", "مشاركة وحفظ الملفات",
    Capacitor.isPluginAvailable("Share") ? "ok" : "error",
    Capacitor.isPluginAvailable("Share")
      ? "إضافة المشاركة موجودة؛ يلزم اختيار ملف وتجربة حفظه خارج التطبيق للتأكد عمليًا"
      : "إضافة Android Share غير متاحة",
  );
  add(
    "printer", "طباعة PDF",
    Capacitor.isPluginAvailable("RasdPrinter") ? "ok" : "error",
    Capacitor.isPluginAvailable("RasdPrinter")
      ? "جسر الطباعة مسجل؛ يلزم تجربة «حفظ كملف PDF» على الهاتف"
      : "جسر الطباعة غير موجود في نسخة APK المثبتة",
  );
  if (!Capacitor.isPluginAvailable("LocalNotifications")) {
    add("notifications", "التذكيرات", "error", "إضافة إشعارات Android المحلية غير متاحة");
  } else {
    try {
      const permission = await LocalNotifications.checkPermissions();
      if (permission.display === "granted") {
        const pending = await LocalNotifications.getPending();
        add("notifications", "التذكيرات", "ok",
          `الإذن متاح؛ لدى النظام ${pending.notifications.length} تنبيه مجدول. لا يضمن هذا وقت التسليم`);
      } else {
        add("notifications", "التذكيرات", "attention",
          "إذن الإشعارات غير مسموح حاليًا؛ فعّله من إعدادات الإشعارات عند الحاجة");
      }
    } catch {
      add("notifications", "التذكيرات", "error", "فشل استعلام حالة إذن الإشعارات من Android");
    }
  }

  add(
    "app", "دورة حياة التطبيق والعودة",
    Capacitor.isPluginAvailable("App") ? "ok" : "error",
    Capacitor.isPluginAvailable("App")
      ? "إضافة التطبيق الأصلية مسجلة؛ اختبار العودة من الخلفية يُجرى عمليًا"
      : "إضافة App غير متاحة في APK",
  );
  add(
    "network", "الاتصال بخدمة رصد",
    "attention",
    "تعتمد العمليات المالية على الإنترنت؛ هذا الفحص لا يختبر الاتصال بالخادم أو تسجيل الدخول",
  );

  return { platform, checkedAt: new Date().toISOString(), checks };
}
