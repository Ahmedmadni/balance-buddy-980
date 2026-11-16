import { describe, expect, test } from "bun:test";
import { isWithinQuietHours } from "./config";

describe("quiet hour policies for due date reminders", () => {
  test("wraps midnight without leaking during the quiet period", () => {
    const quiet = { enabled: true, start: "22:00", end: "07:00" };
    expect(isWithinQuietHours(quiet, new Date(2026, 10, 16, 23, 0))).toBe(true);
    expect(isWithinQuietHours(quiet, new Date(2026, 10, 17, 9, 0))).toBe(false);
  });
});
