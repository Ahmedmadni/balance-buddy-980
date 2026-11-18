import { describe, expect, test } from "bun:test";
import { buildReportDateRange, isInReportDateRange } from "./date-range";

describe("financial report calendar period boundaries", () => {
  test("includes all timestamps of the selected final day", () => {
    const r = buildReportDateRange("2026-11-01", "2026-11-18")!;
    expect(r).toEqual({ fromInclusive: "2026-11-01", toExclusive: "2026-11-19" });
    expect(isInReportDateRange("2026-11-18T23:59:59.999Z", r)).toBe(true);
    expect(isInReportDateRange("2026-11-19T00:00:00Z", r)).toBe(false);
  });
  test("single-day report includes its full day", () => {
    const r = buildReportDateRange("2026-11-18", "2026-11-18")!;
    expect(isInReportDateRange("2026-11-18T00:00:00Z", r)).toBe(true);
    expect(isInReportDateRange("2026-11-17T23:59:59Z", r)).toBe(false);
  });
  test("crosses leap days, month ends and year ends correctly", () => {
    expect(buildReportDateRange("2024-02-28", "2024-02-29")?.toExclusive).toBe("2024-03-01");
    expect(buildReportDateRange("2026-12-01", "2026-12-31")?.toExclusive).toBe("2027-01-01");
    expect(buildReportDateRange("2026-04-01", "2026-04-30")?.toExclusive).toBe("2026-05-01");
  });
  test("rejects inverted, incomplete and impossible periods", () => {
    expect(buildReportDateRange("2026-11-18", "2026-11-01")).toBeNull();
    expect(buildReportDateRange("", "2026-11-18")).toBeNull();
    expect(buildReportDateRange("2026-02-30", "2026-03-01")).toBeNull();
    expect(buildReportDateRange("2026-11-18T12:00:00", "2026-11-18")).toBeNull();
  });
  test("detects transactions belonging to this period, including date-only values", () => {
    const r = buildReportDateRange("2026-11-01", "2026-11-18")!;
    expect(isInReportDateRange("2026-11-01", r)).toBe(true);
    expect(isInReportDateRange("2026-11-18T23:00:00+03:00", r)).toBe(true);
    expect(isInReportDateRange("2026-11-19", r)).toBe(false);
    expect(isInReportDateRange(null, r)).toBe(false);
  });
});
