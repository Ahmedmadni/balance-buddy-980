import { describe, expect, test } from "bun:test";
import { dailySummaryDecision } from "./daily-summary";

describe("Android overdue summary once per local calendar day", () => {
  const current = "user-A:overdue:2026-11-16";
  test("first overdue summary can be scheduled", () => {
    expect(dailySummaryDecision(current, undefined, {}, new Set())).toEqual({
      shouldCreate: true, keepPendingId: null,
    });
  });
  test("subsequent checks do not reschedule already delivered notifications", () => {
    expect(dailySummaryDecision(current, current, {}, new Set())).toEqual({
      shouldCreate: false, keepPendingId: null,
    });
  });
  test("existing pending summary is retained without rescheduling", () => {
    expect(dailySummaryDecision(current, current, { "600000001": current }, new Set([600000001]))).toEqual({
      shouldCreate: false, keepPendingId: 600000001,
    });
  });
  test("new calendar date allows a new summary", () => {
    expect(dailySummaryDecision("user-A:overdue:2026-11-17", current, {}, new Set())).toEqual({
      shouldCreate: true, keepPendingId: null,
    });
  });
  test("user change is independent of the previous user's daily summary", () => {
    expect(dailySummaryDecision("user-B:overdue:2026-11-16", current, {}, new Set())).toEqual({
      shouldCreate: true, keepPendingId: null,
    });
  });
});
