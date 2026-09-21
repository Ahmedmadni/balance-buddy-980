import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const productionProjectRefs = new Set(["tbwogguzpygnbkjmoeeh"]);
const defaultTests = [
  "supabase/tests/person_ledger_rpc.sql",
  "supabase/tests/investment_transaction_rpc.sql",
  "supabase/tests/wallet_transfer_rpc.sql",
  "supabase/tests/derived_transactions.sql",
  "supabase/tests/ownership_delete_uniqueness.sql",
  "supabase/tests/backup_restore_v2.sql",
];

function fail(message) {
  console.error(`A11 database tests refused: ${message}`);
  process.exit(1);
}

const rawUrl = process.env.RASD_TEST_DATABASE_URL;
if (!rawUrl) fail("RASD_TEST_DATABASE_URL is required.");

let databaseUrl;
try {
  databaseUrl = new URL(rawUrl);
} catch {
  fail("RASD_TEST_DATABASE_URL is not a valid URL.");
}

if (!["postgres:", "postgresql:"].includes(databaseUrl.protocol)) {
  fail("only postgres:// or postgresql:// URLs are accepted.");
}

const host = databaseUrl.hostname.toLowerCase();
for (const ref of productionProjectRefs) {
  if (host.includes(ref) || rawUrl.includes(ref))
    fail(`the configured URL matches production project ${ref}.`);
}

const localHosts = new Set(["localhost", "127.0.0.1", "::1"]);
if (!localHosts.has(host) && process.env.RASD_CONFIRM_NON_PRODUCTION !== "1") {
  fail(
    "remote databases require RASD_CONFIRM_NON_PRODUCTION=1 after independently verifying the target is disposable.",
  );
}

const files = process.argv.slice(2).length ? process.argv.slice(2) : defaultTests;
for (const file of files) {
  const absolute = resolve(file);
  if (!existsSync(absolute)) fail(`test file not found: ${file}`);
  const sql = readFileSync(absolute, "utf8");
  if (!/^\s*BEGIN;/im.test(sql) || !/^\s*ROLLBACK;/im.test(sql)) {
    fail(`${file} must be transaction-scoped with BEGIN and ROLLBACK.`);
  }
}

execFileSync(
  "psql",
  [rawUrl, "-v", "ON_ERROR_STOP=1", "-X", "-c", "select current_database(), current_user;"],
  {
    stdio: "inherit",
  },
);

for (const file of files) {
  console.log(`\n[A11] ${file}`);
  execFileSync("psql", [rawUrl, "-v", "ON_ERROR_STOP=1", "-X", "-f", resolve(file)], {
    stdio: "inherit",
  });
}
