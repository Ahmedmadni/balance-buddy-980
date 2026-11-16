import { describe, expect, test } from "bun:test";
import { calculatePinDelay, getRetryMs } from "./pin-throttle";

describe("PIN UI rate limit", () => {
  test("locks after 5 failed attempts with capped exponential delay", () => {
    expect(calculatePinDelay(4)).toBe(0);
    expect(calculatePinDelay(5)).toBe(30_000);
    expect(calculatePinDelay(8)).toBe(60_000);
    expect(calculatePinDelay(100)).toBe(300_000);
  });
  test("unlocks at or after the deadline", () => {
    expect(getRetryMs({ failures: 5, blockedUntil: 123_000 }, 120_000)).toBe(3000);
    expect(getRetryMs({ failures: 5, blockedUntil: 123_000 }, 123_000)).toBe(0);
  });
});
