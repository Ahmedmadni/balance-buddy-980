import { describe, expect, test } from "bun:test";
import { hashPin, isValidPin } from "./app-lock";

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
});
