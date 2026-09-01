import { describe, expect, test } from "bun:test";
import { isExpenseWalletTx, isMirroredWalletTx } from "./classify";

const OUTFLOW = new Set(["withdraw", "send"]);

describe("wallet transaction expense classification", () => {
  test("a normal expense-style withdrawal counts as an expense", () => {
    expect(isExpenseWalletTx("withdraw", null, OUTFLOW)).toBe(true);
  });

  test("a debt lend (person_ledger mirror) does NOT count as an expense", () => {
    expect(isExpenseWalletTx("withdraw", "person_ledger", OUTFLOW)).toBe(false);
  });

  test("a debt borrow repayment mirror does NOT count as an expense", () => {
    expect(isExpenseWalletTx("withdraw", "person_ledger", OUTFLOW)).toBe(false);
  });

  test("an investment capex mirror does NOT count as an expense", () => {
    expect(isExpenseWalletTx("withdraw", "investment_transactions", OUTFLOW)).toBe(false);
  });

  test("a zakat payment mirror does NOT count as an expense", () => {
    expect(isExpenseWalletTx("withdraw", "zakat_records", OUTFLOW)).toBe(false);
  });

  test("a non-outflow kind is never an expense regardless of source", () => {
    expect(isExpenseWalletTx("deposit", null, OUTFLOW)).toBe(false);
    expect(isExpenseWalletTx("transfer_out", null, OUTFLOW)).toBe(false);
  });

  test("isMirroredWalletTx recognizes exactly the three mirrored source kinds", () => {
    expect(isMirroredWalletTx("person_ledger")).toBe(true);
    expect(isMirroredWalletTx("investment_transactions")).toBe(true);
    expect(isMirroredWalletTx("zakat_records")).toBe(true);
    expect(isMirroredWalletTx(null)).toBe(false);
    expect(isMirroredWalletTx(undefined)).toBe(false);
    expect(isMirroredWalletTx("something_else")).toBe(false);
  });
});
