import { describe, expect, it } from "bun:test";
import { readFileSync } from "node:fs";

describe("release safety gates", () => {
  it("runs cloud backup RLS policy SQL regression in standard DB suite", () => {
    const script = readFileSync("scripts/run-db-regression.mjs","utf8");
    expect(script).toContain('"supabase/tests/private_encrypted_backups.sql"');
  });
  it("blocks non-atomic destructive legacy v1 restore", () => {
    const engine = readFileSync("src/lib/backup/engine.ts","utf8");
    expect(engine).toContain('if (opts.mode === "replace")');
    expect(engine).not.toContain('.delete().not("id", "is", null)');
  });
  it("keeps the safer v2 transaction-level restore", () => {
    const v2=readFileSync("src/components/BackupV2Section.tsx","utf8");
    expect(v2).toContain('rpc("restore_user_backup"');
    expect(v2).toContain('isRasdBackupV2');
  });
});
