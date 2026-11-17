import { describe, expect, test } from "bun:test";
import { createAsyncSerialQueue } from "./async-serial-queue";

describe("Android reminders operation order", () => {
  test("clear scheduled after sync never runs before the pending sync finishes", async () => {
    const enqueue = createAsyncSerialQueue();
    const events: string[] = [];
    let release!: () => void;
    const block = new Promise<void>((resolve) => { release = resolve; });
    const sync = enqueue(async () => {
      events.push("sync-start");
      await block;
      events.push("sync-end");
    });
    const clear = enqueue(async () => { events.push("clear"); });
    await Promise.resolve();
    expect(events).toEqual(["sync-start"]);
    release();
    await Promise.all([sync, clear]);
    expect(events).toEqual(["sync-start", "sync-end", "clear"]);
  });
  test("another queued sync cannot get ahead of logout cancellation", async () => {
    const enqueue = createAsyncSerialQueue();
    const events: string[] = [];
    const tasks = [
      enqueue(async () => { events.push("sync-old"); }),
      enqueue(async () => { events.push("clear"); }),
      enqueue(async () => { events.push("sync-new"); }),
    ];
    await Promise.all(tasks);
    expect(events).toEqual(["sync-old", "clear", "sync-new"]);
  });
  test("queue continues after plugin schedule rejection", async () => {
    const enqueue = createAsyncSerialQueue();
    await expect(enqueue(async () => { throw new Error("Android plugin failed"); })).rejects.toThrow();
    const result = await enqueue(async () => "cleanup completed");
    expect(result).toBe("cleanup completed");
  });
});
