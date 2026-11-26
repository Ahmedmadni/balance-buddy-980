import { describe, expect, test } from "bun:test";
import { appendPatternNode, validAppCredential, supportsAppLockPlatform, probeAppLock, enrollAppLock, removeAppLock } from "./app-lock";
import { createVault } from "./crypto";

describe("Independent app lock credentials", () => {
  test("PIN length, ASCII digits and obvious sequential or repeated values", () => {
    for (const weak of ["12345","123456","012345","987654","111111","123456789012","١٢٣٤٥٦","12ab56"])
      expect(validAppCredential("pin", weak)).toBe(false);
    expect(validAppCredential("pin", "620481")).toBe(true);
    expect(validAppCredential("pin", "062048191735")).toBe(true);
  });
  test("grid adds skipped midpoint and does not repeat nodes", () => {
    expect(appendPatternNode("1",3)).toBe("123");
    expect(appendPatternNode("1",9)).toBe("159");
    expect(appendPatternNode("7",1)).toBe("741");
    expect(appendPatternNode("123",2)).toBe("123");
    expect(appendPatternNode("214",6)).toBe("21456");
    expect(() => appendPatternNode("",0)).toThrow();
    expect(() => appendPatternNode("11",2)).toThrow();
  });
  test("canonical six-node minimum and no skipped or repeated nodes", () => {
    expect(validAppCredential("pattern","123654")).toBe(true);
    expect(validAppCredential("pattern","123654789")).toBe(true);
    for (const invalid of ["12345","136547","1236541","1236540","abcdef"])
      expect(validAppCredential("pattern",invalid)).toBe(false);
  });
  test("browser never enables an unprotected fallback", async () => {
    expect(supportsAppLockPlatform()).toBe(false);
    const vault = await createVault("Master-password-CI-only-2026");
    expect(await probeAppLock(vault.file,"pin")).toEqual({enabled:false,blocked:false});
    await expect(enrollAppLock(vault.file,"pin","620481","620481","Master-password-CI-only-2026",()=>true)).rejects.toThrow();
    await expect(removeAppLock(vault.file,"pin","Master-password-CI-only-2026",()=>true)).rejects.toThrow();
    vault.keyBytes.fill(0);
  }, 120000);
});
