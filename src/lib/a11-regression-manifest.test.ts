import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const suites = {
  A01: [
    "supabase/tests/person_ledger_rpc.sql",
    ["'lend'", "'borrow'", "collect", "'pay'", "duplicate mirror"],
  ],
  A02: [
    "supabase/tests/investment_transaction_rpc.sql",
    ["affects_wallet", "sale", "sold_amount", "duplicate wallet mirror"],
  ],
  A03: [
    "supabase/tests/wallet_transfer_rpc.sql",
    ["transfer_out", "transfer_in", "same-wallet", "incompatible currency"],
  ],
  A04: ["supabase/tests/derived_transactions.sql", ["INSERT", "UPDATE", "DELETE", "source_kind"]],
  A05_A09_A10: [
    "supabase/tests/ownership_delete_uniqueness.sql",
    ["cross-user", "SET NULL", "CASCADE", "duplicate market valuation", "duplicate depreciation"],
  ],
} as const;

const schemaParityMigrations = {
  A03_A05_A09_A10: [
    "supabase/migrations/20260902000000_schema_parity_a03_a05_a09_a10.sql",
    [
      "mutate_wallet_transfer",
      "transactions: owner select",
      "debt_payments_user_debt_fkey",
      "ON DELETE SET NULL (wallet_id)",
      "asset_market_values_user_investment_date_uidx",
      "depreciation_profiles_user_investment_uidx",
    ],
  ],
  A06: [
    "supabase/migrations/20260903000000_backup_restore_v2_schema_parity.sql",
    ["export_user_backup", "restore_user_backup", "Authentication required"],
  ],
} as const;

describe("A11 database regression manifest", () => {
  for (const [phase, [file, markers]] of Object.entries(suites)) {
    test(`${phase} is transaction-scoped and contains its required assertions`, () => {
      const sql = readFileSync(resolve(file), "utf8");
      expect(sql).toMatch(/^\s*BEGIN;/im);
      expect(sql).toMatch(/^\s*ROLLBACK;/im);
      for (const marker of markers) expect(sql.toLowerCase()).toContain(marker.toLowerCase());
    });
  }

  for (const [phase, [file, markers]] of Object.entries(schemaParityMigrations)) {
    test(`${phase} production-audited schema definition is checked in`, () => {
      const sql = readFileSync(resolve(file), "utf8");
      for (const marker of markers) expect(sql.toLowerCase()).toContain(marker.toLowerCase());
    });
  }
});
