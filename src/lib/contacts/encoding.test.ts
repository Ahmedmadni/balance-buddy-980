import { describe, expect, test } from "bun:test";
import {
  decodeImportedContactName,
  isEncodedContactName,
  normalizeImportedContactName,
} from "./encoding";

describe("contact name decoding", () => {
  test("plain Arabic is unchanged", () => {
    expect(normalizeImportedContactName("محمد عبدالله")).toBe("محمد عبدالله");
  });

  test("quoted-printable Arabic decodes correctly", () => {
    expect(decodeImportedContactName("=D8=A3=D8=AD=D9=85=D8=AF")).toBe("أحمد");
  });

  test("mixed Arabic/Latin decodes correctly", () => {
    expect(decodeImportedContactName("=D8=A3=D8=AD=D9=85=D8=AF Ali")).toBe("أحمد Ali");
  });

  test("malformed input does not crash and falls back to the original", () => {
    expect(() => decodeImportedContactName("=ZZ=D8notreal")).not.toThrow();
    expect(() => normalizeImportedContactName("=")).not.toThrow();
    expect(() => normalizeImportedContactName(undefined)).not.toThrow();
    expect(normalizeImportedContactName(undefined)).toBe("");
  });

  test("normal text containing '=' is not corrupted", () => {
    expect(isEncodedContactName("A=B")).toBe(false);
    expect(normalizeImportedContactName("A=B")).toBe("A=B");
  });

  test("decoding is idempotent — a name already decoded is unaffected by a second pass", () => {
    const once = decodeImportedContactName("=D8=A3=D8=AD=D9=85=D8=AF");
    const twice = decodeImportedContactName(once);
    expect(twice).toBe(once);
    expect(normalizeImportedContactName(once)).toBe(once);
  });

  test("soft line breaks and trailing '=' from vCard folding are stripped", () => {
    expect(decodeImportedContactName("=D8=A3=D8=AD=D9=85=D8=AF=\r\n")).toBe("أحمد");
  });
});
