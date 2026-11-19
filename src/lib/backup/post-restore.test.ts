import { describe, expect, test } from "bun:test";
import { afterSuccessfulBackupRestore } from "./post-restore";

describe("post-restore client synchronization", () => {
  test("Android clears old alarms, refreshes queries and schedules new reminders in order", async () => {
    const operations: string[] = [];
    const result = await afterSuccessfulBackupRestore({
      native: true,
      clearNativeReminders: async () => { operations.push("clear"); },
      refreshActiveViews: async () => { operations.push("refresh"); },
      syncNativeReminders: async () => { operations.push("sync"); },
    });
    expect(operations).toEqual(["clear", "refresh", "sync"]);
    expect(result).toEqual({ viewUpdated: true, remindersCleared: true, remindersSynced: true });
  });

  test("never schedules new alarms over unconfirmed stale alarms", async () => {
    const operations: string[] = [];
    const result = await afterSuccessfulBackupRestore({
      native: true,
      clearNativeReminders: async () => { operations.push("clear"); throw new Error("OS unavailable"); },
      refreshActiveViews: async () => { operations.push("refresh"); },
      syncNativeReminders: async () => { operations.push("sync"); },
    });
    expect(operations).toEqual(["clear", "refresh"]);
    expect(result).toEqual({ viewUpdated: true, remindersCleared: false, remindersSynced: false });
  });

  test("view refresh failures do not prevent a fresh device schedule", async () => {
    const operations: string[] = [];
    const result = await afterSuccessfulBackupRestore({
      native: true,
      clearNativeReminders: async () => { operations.push("clear"); },
      refreshActiveViews: async () => { operations.push("refresh"); throw new Error("network"); },
      syncNativeReminders: async () => { operations.push("sync"); },
    });
    expect(operations).toEqual(["clear", "refresh", "sync"]);
    expect(result).toEqual({ viewUpdated: false, remindersCleared: true, remindersSynced: true });
  });

  test("web restores never use Android native plugins", async () => {
    const result = await afterSuccessfulBackupRestore({
      native: false,
      clearNativeReminders: async () => { throw new Error("must not run"); },
      refreshActiveViews: async () => {},
      syncNativeReminders: async () => { throw new Error("must not run"); },
    });
    expect(result).toEqual({ viewUpdated: true, remindersCleared: true, remindersSynced: true });
  });
});
