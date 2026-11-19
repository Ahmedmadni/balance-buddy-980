import { Capacitor, registerPlugin } from "@capacitor/core";

interface NativePrinterPlugin {
  printPage(options: { name: string }): Promise<void>;
}

const nativePrinter = registerPlugin<NativePrinterPlugin>("RasdPrinter");

export function reportPrintBlocker(state: {
  reportVisible: boolean;
  reportStyleActive: boolean;
  privacyEnabled: boolean;
}): string | null {
  if (!state.reportVisible || !state.reportStyleActive) {
    return "لا توجد صفحة تقرير جاهزة للطباعة. افتح التقارير ثم أعد المحاولة.";
  }
  if (state.privacyEnabled) {
    return "وضع إخفاء الأرصدة مفعل. أوقف وضع الخصوصية قبل طباعة التقرير حتى لا تظهر الأرقام مشوشة.";
  }
  return null;
}


/**
 * Android PrintManager supports the system "Save as PDF" destination.
 * A successful return means the Android print sheet opened, not that the user
 * saved a PDF; the user must explicitly pick a printer or file destination.
 */
export async function printCurrentReport(name: string): Promise<void> {
  if (typeof document === "undefined") {
    throw new Error("طباعة التقارير متاحة داخل التطبيق فقط");
  }
  const blocker = reportPrintBlocker({
    reportVisible: !!document.getElementById("rasd-report-print"),
    reportStyleActive: document.documentElement.classList.contains("rasd-report-page"),
    privacyEnabled: document.documentElement.classList.contains("privacy-on"),
  });
  if (blocker) throw new Error(blocker);
  if (Capacitor.isNativePlatform()) {
    if (!Capacitor.isPluginAvailable("RasdPrinter")) {
      throw new Error("طباعة Android غير متاحة في هذه النسخة. حدّث APK.");
    }
    await nativePrinter.printPage({ name: name.slice(0, 90) });
    return;
  }
  window.print();
}
