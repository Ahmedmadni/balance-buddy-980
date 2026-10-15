import { describe, expect, test } from "bun:test";
import { validateLegacyBackup } from "./legacy-validate";

describe("v1 backup fail-closed import validation", () => {
  const tables = new Set(["wallets", "wallet_transactions", "profiles"]);
  const prefs = new Set(["rasd.localPrefs.v1"]);
  const valid = {
    meta: { app: "rasd", version: 1, scope: "full", exported_at: "2026-10-15T00:00:00.000Z",
      counts: { wallets: 1 } },
    data: { wallets: [{ id: "a" }] }, local: { "rasd.localPrefs.v1": { language: "ar" } },
  };
  const check = (x: unknown) => validateLegacyBackup(x, tables, prefs);
  test("accepts previous standard export shape", () => expect(check(valid).ok).toBe(true));
  test("rejects arbitrary DB table names", () => {
    const x = structuredClone(valid);
    Object.assign(x.data, { auth_users: [] });
    Object.assign(x.meta.counts, { auth_users: 0 });
    expect(check(x).ok).toBe(false);
  });
  test("rejects localStorage keys not owned by Rasd", () => {
    const x = structuredClone(valid);
    (x.local as Record<string, unknown>)["supabase.auth.token"] = { access_token: "forged" };
    expect(check(x).ok).toBe(false);
  });
  test("rejects inconsistent counts, null rows and unknown scope", () => {
    const x = structuredClone(valid);
    x.meta.counts.wallets = 200;
    expect(check(x).ok).toBe(false);
    const y = structuredClone(valid);
    y.data.wallets = [null] as unknown as typeof y.data.wallets;
    expect(check(y).ok).toBe(false);
    expect(check({...valid,meta:{...valid.meta,scope:"system"}}).ok).toBe(false);
  });
});
