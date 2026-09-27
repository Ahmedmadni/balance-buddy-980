import { describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";

const edgeFunction = readFileSync("supabase/functions/delete-account/index.ts", "utf8");
const dialog = readFileSync("src/components/AccountDeletionDialog.tsx", "utf8");
const clientRequest = readFileSync("src/lib/account-deletion/request.ts", "utf8");
const supabaseConfig = readFileSync("supabase/config.toml", "utf8");

describe("A13 account deletion hardening", () => {
  test("keeps the service role inside the Edge Function", () => {
    expect(edgeFunction).toContain('requiredEnv("SUPABASE_SERVICE_ROLE_KEY")');
    expect(clientRequest).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
    expect(dialog).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
  });

  test("requires JWT, explicit confirmation, and provider-aware reauthentication", () => {
    expect(edgeFunction).toContain("bearerToken(request)");
    expect(edgeFunction).toContain("auth.getUser(token)");
    expect(edgeFunction).toContain("signInWithPassword");
    expect(edgeFunction).toContain("recent_oauth_sign_in_required");
    expect(edgeFunction).toContain("user.last_sign_in_at");
    expect(edgeFunction).toContain("confirmation_mismatch");
    expect(edgeFunction).toContain("reauthentication_failed");
    expect(dialog).toContain('type="password"');
    expect(dialog).toContain('prompt: "login"');
  });

  test("deletes storage, user rows, profile, and Auth in that order", () => {
    const storage = edgeFunction.indexOf("deleteStorageFiles(admin, user.id)");
    const rows = edgeFunction.indexOf("for (const table of USER_TABLES)");
    const profile = edgeFunction.indexOf('.from("profiles").delete()');
    const auth = edgeFunction.indexOf("auth.admin.deleteUser(user.id)");

    expect(storage).toBeGreaterThan(0);
    expect(rows).toBeGreaterThan(storage);
    expect(profile).toBeGreaterThan(rows);
    expect(auth).toBeGreaterThan(profile);
  });

  test("enables platform JWT verification and clears local data after success", () => {
    expect(supabaseConfig).toContain("[functions.delete-account]");
    expect(supabaseConfig).toContain("verify_jwt = true");
    expect(clientRequest).toContain('signOut({ scope: "local" })');
    expect(clientRequest).toContain("LOCAL_STORAGE_KEYS");
  });
});
