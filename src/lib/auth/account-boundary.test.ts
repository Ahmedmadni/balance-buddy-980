import { describe, expect, test } from "bun:test";
import { shouldClearFinancialCache } from "./account-boundary";

describe("account isolation for cached financial queries", () => {
  test("direct account A to B switch invalidates financial data", () => {
    expect(shouldClearFinancialCache("SIGNED_IN", "account-A", "account-B")).toBe(true);
  });
  test("an explicit sign-out always purges financial data", () => {
    expect(shouldClearFinancialCache("SIGNED_OUT", "account-A", null)).toBe(true);
  });
  test("same-account reauthentication does not unnecessarily clear reports", () => {
    expect(shouldClearFinancialCache("SIGNED_IN", "account-A", "account-A")).toBe(false);
  });
  test("initial login has no previous account's cache", () => {
    expect(shouldClearFinancialCache("SIGNED_IN", null, "account-A")).toBe(false);
  });
  test("session refresh and profile update do not clear query data", () => {
    expect(shouldClearFinancialCache("TOKEN_REFRESHED", "account-A", "account-A")).toBe(false);
    expect(shouldClearFinancialCache("USER_UPDATED", "account-A", "account-A")).toBe(false);
  });
});
