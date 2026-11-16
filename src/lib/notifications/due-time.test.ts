import { describe, test, expect } from "bun:test";
import { parseDueDate, plannedReminderTime } from "./due-time";

const quiet = { enabled: true, start: "22:00", end: "07:00" };

describe("Android financial reminder timestamps", () => {
  test("parses calendar-only dates as local dates without timezone shifts", () => {
    const date = parseDueDate("2026-11-17")!;
    expect([date.getFullYear(), date.getMonth(), date.getDate(), date.getHours()]).toEqual([2026, 10, 17, 0]);
    expect(parseDueDate("2026-02-30")).toBeNull();
  });
  test("schedules date-only due dates at 9 AM local", () => {
    const date = plannedReminderTime("2026-11-17", quiet, "high")!;
    expect([date.getDate(), date.getHours(), date.getMinutes()]).toEqual([17, 9, 0]);
  });
  test("keeps explicit times rather than silently shifting to 9 AM", () => {
    const date = plannedReminderTime("2026-11-17T13:25:00", quiet, "normal")!;
    expect([date.getDate(), date.getHours(), date.getMinutes()]).toEqual([17, 13, 25]);
  });
  test("overnight quiet hours move an event forward to the next morning", () => {
    const date = plannedReminderTime("2026-11-17T23:30:00", quiet, "high")!;
    expect([date.getDate(), date.getHours(), date.getMinutes()]).toEqual([18, 7, 0]);
  });
  test("critical events keep their exact time", () => {
    const date = plannedReminderTime("2026-11-17T23:30:00", quiet, "critical")!;
    expect([date.getDate(), date.getHours()]).toEqual([17, 23]);
  });
});
