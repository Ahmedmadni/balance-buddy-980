import { describe, expect, test } from "bun:test";
import { computeWalletBalance } from "./wallet-balance";

describe("computeWalletBalance — debt cash effect", () => {
  test("a lend (withdraw) still reduces the wallet balance even though it is not an expense", () => {
    // Wallet opening 1000, lend 500 -> balance 500 (Prompt Part 8 example).
    const bal = computeWalletBalance(1000, [{ kind: "withdraw", amount: 500 }], []);
    expect(bal).toBe(500);
  });

  test("a lend plus a real expense both reduce the balance", () => {
    const bal = computeWalletBalance(1000, [{ kind: "withdraw", amount: 500 }], [{ amount: 100 }]);
    expect(bal).toBe(400);
  });

  test("a collect (deposit) increases the wallet balance", () => {
    const bal = computeWalletBalance(500, [{ kind: "deposit", amount: 200 }], []);
    expect(bal).toBe(700);
  });
});
