import { describe, expect, test } from "bun:test";
import { compareNativeReminderState } from "./native-reconcile";

describe("Android notification recovery", () => {
  const reminder = { key: "user:event:2026-11-17", when: new Date("2026-11-17T08:00:00Z") };
  test("does not reschedule an existing matching OS alarm", () => {
    const r = compareNativeReminderState({ "600000123": reminder.key }, new Map([[600000123, reminder]]), new Set([600000123]));
    expect(r).toEqual({ toSchedule: [], toCancel: [] });
  });
  test("recovers a lost alarm even if localStorage still claims it exists", () => {
    const r = compareNativeReminderState({ "600000123": reminder.key }, new Map([[600000123, reminder]]), new Set());
    expect(r.toSchedule.map(([id]) => id)).toEqual([600000123]);
    expect(r.toCancel).toEqual([]);
  });
  test("cancels obsolete alarms without cancelling ID reuse", () => {
    const updated = { ...reminder, key: "user:revised" };
    const r = compareNativeReminderState(
      { "600000123": "user:old", "600000124": "user:obsolete" },
      new Map([[600000123, updated]]),
      new Set([600000123, 600000124]));
    expect(r.toSchedule.map(([id]) => id)).toEqual([600000123]);
    expect(r.toCancel).toEqual([600000124]);
  });
  test("ignores stale persisted IDs that are no longer present on the OS", () => {
    const r = compareNativeReminderState({ "600000123": reminder.key }, new Map(), new Set());
    expect(r).toEqual({ toSchedule: [], toCancel: [] });
  });
});
