import { describe, expect, test } from "bun:test";
import { personLedgerErrorMessage } from "./person-ledger";
import { personLedgerWalletKind } from "./wallet-sync";

describe("person ledger command contract", () => {
  test.each([
    ["lend", "withdraw"],
    ["pay", "withdraw"],
    ["borrow", "deposit"],
    ["collect", "deposit"],
  ])("maps %s to the existing wallet direction %s", (kind, expected) => {
    expect(personLedgerWalletKind(kind)).toBe(expected);
  });

  test.each([
    ["PERSON_LEDGER_INVALID_WALLET", "المحفظة غير صالحة"],
    ["PERSON_LEDGER_NOT_FOUND", "الحركة غير موجودة"],
    ["PERSON_LEDGER_UNAUTHENTICATED", "ليس لديك صلاحية لتنفيذ هذه العملية"],
    ["PERSON_LEDGER_INVALID_CONTACT", "جهة الاتصال غير صالحة"],
    ["unexpected database detail", "تعذر حفظ الحركة"],
  ])("maps RPC errors without exposing raw PostgreSQL text", (message, expected) => {
    expect(personLedgerErrorMessage({ message })).toBe(expected);
  });
});
