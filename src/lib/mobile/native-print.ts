import { Capacitor, registerPlugin } from "@capacitor/core";

interface NativePrinterPlugin {
  printPage(options: { name: string }): Promise<void>;
}

const nativePrinter = registerPlugin<NativePrinterPlugin>("RasdPrinter");

/**
 * Android PrintManager supports the system "Save as PDF" destination.
 * A successful return means the Android print sheet opened, not that the user
 * saved a PDF; the user must explicitly pick a printer or file destination.
 */
export async function printCurrentReport(name: string): Promise<void> {
  if (Capacitor.isNativePlatform()) {
    if (!Capacitor.isPluginAvailable("RasdPrinter")) {
      throw new Error("طباعة Android غير متاحة في هذه النسخة. حدّث APK.");
    }
    await nativePrinter.printPage({ name: name.slice(0, 90) });
    return;
  }
  window.print();
}
