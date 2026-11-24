import { describe, expect, test } from "bun:test";
import {
  beginNativeGoogleQuarantine,
  clearNativeGoogleQuarantine,
  hasNativeGoogleQuarantine,
  NATIVE_GOOGLE_QUARANTINE_KEY,
} from "./native-google-quarantine";

function storage() {
  const map = new Map<string, string>();
  return {
    getItem: (key: string) => map.get(key) ?? null,
    setItem: (key: string, value: string) => { map.set(key, value); },
    removeItem: (key: string) => { map.delete(key); },
  };
}

describe("Rasd native Google session quarantine", () => {
  test("the marker survives a WebView restart and contains no token", () => {
    const store = storage();
    expect(beginNativeGoogleQuarantine(store)).toBe(true);
    // Simulate a brand-new client reading the same durable browser storage.
    expect(hasNativeGoogleQuarantine(store)).toBe(true);
    expect(store.getItem(NATIVE_GOOGLE_QUARANTINE_KEY)).toBe("1");
    expect(clearNativeGoogleQuarantine(store)).toBe(true);
    expect(hasNativeGoogleQuarantine(store)).toBe(false);
  });

  test("an inaccessible storage cannot prove a session safe", () => {
    const blocked = {
      getItem: (_key: string): string | null => { throw new Error("blocked"); },
      setItem: (_key: string, _value: string): void => { throw new Error("blocked"); },
      removeItem: (_key: string): void => { throw new Error("blocked"); },
    };
    expect(beginNativeGoogleQuarantine(blocked)).toBe(false);
    expect(hasNativeGoogleQuarantine(blocked)).toBe(true);
    expect(clearNativeGoogleQuarantine(blocked)).toBe(false);
  });

  test("failed clear must not acknowledge quarantine release", () => {
    const store = storage();
    expect(beginNativeGoogleQuarantine(store)).toBe(true);
    const failsRemoval = {
      getItem: store.getItem,
      setItem: store.setItem,
      removeItem: (_key: string) => { throw new Error("disk error"); },
    };
    expect(clearNativeGoogleQuarantine(failsRemoval)).toBe(false);
    expect(hasNativeGoogleQuarantine(store)).toBe(true);
  });
});
