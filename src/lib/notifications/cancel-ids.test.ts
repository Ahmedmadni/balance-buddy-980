import { describe, expect, test } from "bun:test";
import { nativeReminderIdsToCancel } from "./cancel-ids";

describe("Android logout clears only Rasd notification IDs", () => {
  test("cancels OS reminders when WebView plan was erased", () => {
    expect(nativeReminderIdsToCancel({}, [
      { id: 600000123, extra: { rasd: true } },
      { id: 600000125, extra: { rasd: true } },
    ])).toEqual([600000123, 600000125]);
  });
  test("preserves unrelated app notifications", () => {
    expect(nativeReminderIdsToCancel({ "600000124": "user:event" }, [
      { id: 600000125, extra: { rasd: false } },
      { id: 600000126, extra: { other: true } },
      { id: 600000127 },
      { id: 600000128, extra: { rasd: true } },
    ])).toEqual([600000124, 600000128]);
  });
  test("rejects invalid or out-of-range IDs and deduplicates", () => {
    expect(nativeReminderIdsToCancel({
      "600000122": "x", "NaN": "corrupt", "0": "corrupt",
      "1000000000": "corrupt",
    }, [{ id: 600000122, extra: { rasd: true } }, { id: 42, extra: { rasd: true } }])).toEqual([600000122]);
  });
});
