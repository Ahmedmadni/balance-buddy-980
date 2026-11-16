import { describe, expect, test } from "bun:test";
import { safeExportName } from "./share-export";

describe("financial file export safety", () => {
  test("preserves Arabic report filenames while stripping path separators", () => {
    expect(safeExportName("تقرير-المصاريف-2026.xlsx")).toBe("تقرير-المصاريف-2026.xlsx");
    expect(safeExportName("reports/2026\\assets.xlsx")).toBe("reports-2026-assets.xlsx");
  });
  test("rejects empty and traversal-only filenames", () => {
    expect(() => safeExportName("../")).not.toThrow();
    expect(() => safeExportName("...")).toThrow();
    expect(() => safeExportName("")).toThrow();
  });
  test("limits unsafe and overly long names", () => {
    const name = safeExportName("أ".repeat(300) + ":test?.json");
    expect(name.length).toBeLessThanOrEqual(120);
    expect(name.includes(":")).toBe(false);
  });
});
