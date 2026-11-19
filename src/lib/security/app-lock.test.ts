import { describe, expect, test } from "bun:test";
import { hashPin, isValidPin, setPin, verifyPin, loadLock, disableLock, getPinRetryMs } from "./app-lock";

describe("app lock PIN", () => {
  test("PIN must be 4-8 digits", () => {
    expect(isValidPin("123")).toBe(false);
    expect(isValidPin("1234")).toBe(true);
    expect(isValidPin("12345678")).toBe(true);
    expect(isValidPin("123456789")).toBe(false);
    expect(isValidPin("12a4")).toBe(false);
  });
  test("hash is deterministic per salt and differs for different PINs", async () => {
    const salt = "00112233445566778899aabbccddeeff";
    expect(await hashPin("1234", salt)).toBe(await hashPin("1234", salt));
    expect(await hashPin("1234", salt)).not.toBe(await hashPin("4321", salt));
  });
  test("rejects malformed salt without attempting derivation", async () => {
    await expect(hashPin("1234", "invalid")).rejects.toThrow("بيانات رمز القفل غير صالحة");
  });
  test("stores only a derived PIN locally and throttles after five failed attempts", async () => {
    const previous = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
    const values = new Map<string, string>();
    Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    } });
    try {
      await setPin("4826", false);
      expect(loadLock()?.hash).toHaveLength(64);
      expect(loadLock()?.salt).toHaveLength(32);
      expect(loadLock()).not.toHaveProperty("pin");
      expect(await verifyPin("4826")).toBe(true);
      for (let i = 0; i < 5; i++) expect(await verifyPin("0000")).toBe(false);
      expect(getPinRetryMs()).toBeGreaterThan(0);
      expect(await verifyPin("4826")).toBe(false);
      disableLock();
      expect(loadLock()).toBeNull();
      expect(values.size).toBe(0);
    } finally {
      if (previous) Object.defineProperty(globalThis, "localStorage", previous);
      else Reflect.deleteProperty(globalThis, "localStorage");
    }
  });
});
