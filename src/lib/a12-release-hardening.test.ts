import { describe, expect, test } from "bun:test";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import packageJson from "../../package.json";

describe("A12 release hardening", () => {
  test("uses the patched official SheetJS release", () => {
    expect(packageJson.dependencies.xlsx).toContain("xlsx-0.20.3.tgz");
  });

  test("keeps the Capacitor CLI out of production dependencies", () => {
    expect("@capacitor/cli" in packageJson.dependencies).toBe(false);
    expect(packageJson.devDependencies["@capacitor/cli"]).toBe("8.4.3");
  });

  test("CI enforces repository lint and production audit", () => {
    const workflow = readFileSync(resolve(".github/workflows/a11-regression.yml"), "utf8");
    expect(workflow).toContain("bun run lint");
    expect(workflow).toContain("bun run audit:prod");
    expect(workflow).toContain("supabase db reset --local");
  });

  test("keeps the service-role credential server-only", () => {
    const serverClient = readFileSync(
      resolve("src/integrations/supabase/client.server.ts"),
      "utf8",
    );
    const envPath = resolve(".env");
    const trackedEnv = existsSync(envPath) ? readFileSync(envPath, "utf8") : "";

    expect(serverClient).toContain("process.env.SUPABASE_SERVICE_ROLE_KEY");
    expect(serverClient).not.toContain("import.meta.env.VITE_SUPABASE_SERVICE_ROLE_KEY");
    expect(trackedEnv).not.toContain("SERVICE_ROLE");
  });

  test("runs the database security hardening regression", () => {
    const runner = readFileSync(resolve("scripts/run-db-regression.mjs"), "utf8");
    const sql = readFileSync(resolve("supabase/tests/security_hardening.sql"), "utf8");

    expect(runner).toContain("supabase/tests/security_hardening.sql");
    expect(sql).toContain("relrowsecurity");
    expect(sql).toContain("has_function_privilege");
    expect(sql).toContain("has_table_privilege");
    expect(sql).toMatch(/^BEGIN;/m);
    expect(sql).toMatch(/^ROLLBACK;/m);
  });
});
