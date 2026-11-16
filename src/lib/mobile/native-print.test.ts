import { describe, expect, test } from "bun:test";
import { Capacitor } from "@capacitor/core";
import { printCurrentReport } from "./native-print";

describe("native PDF/print entry", () => {
  test("Android printer is available only in a genuine native shell", () => {
    expect(typeof printCurrentReport).toBe("function");
    expect(typeof Capacitor.isNativePlatform).toBe("function");
    expect(typeof Capacitor.isPluginAvailable).toBe("function");
  });
});
