import { describe, expect, test } from "bun:test";
import { Capacitor } from "@capacitor/core";
import { printCurrentReport, reportPrintBlocker } from "./native-print";

describe("native PDF/print entry", () => {
  test("Android printer is available only in a genuine native shell", () => {
    expect(typeof printCurrentReport).toBe("function");
    expect(typeof Capacitor.isNativePlatform).toBe("function");
    expect(typeof Capacitor.isPluginAvailable).toBe("function");
  });
  test("does not print a blank document outside report route", () => {
    expect(reportPrintBlocker({ reportVisible: false, reportStyleActive: false, privacyEnabled: false }))
      .toContain("لا توجد صفحة تقرير");
    expect(reportPrintBlocker({ reportVisible: true, reportStyleActive: false, privacyEnabled: false }))
      .toContain("لا توجد صفحة تقرير");
  });
  test("prevents accidental printing of blurred financial amounts", () => {
    expect(reportPrintBlocker({ reportVisible: true, reportStyleActive: true, privacyEnabled: true }))
      .toContain("وضع إخفاء الأرصدة");
  });
  test("allows intentional report printing with visible amounts", () => {
    expect(reportPrintBlocker({ reportVisible: true, reportStyleActive: true, privacyEnabled: false }))
      .toBeNull();
  });
});
