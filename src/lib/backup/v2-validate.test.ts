import { describe, expect, test } from "bun:test";
import { isRasdBackupV2, RASD_V2_COLLECTIONS } from "./v2-validate";
describe("strict v2 backup validation", () => {
 const base = { format: "rasd-backup", version: 2, data: Object.fromEntries(RASD_V2_COLLECTIONS.map(k=>[k,[]])) };
 test("complete backup accepted", () => expect(isRasdBackupV2(base)).toBe(true));
 test("partial backup rejected", () => {
   const partial = structuredClone(base);
   delete (partial.data as Record<string,unknown>).wallets;
   expect(isRasdBackupV2(partial)).toBe(false);
 });
 test("rejects user_id injection and malformed records before restore", () => {
   const badUserId = structuredClone(base);
   (badUserId.data as Record<string,unknown>).wallets = [{ user_id: "another-user", id: 3 }];
   expect(isRasdBackupV2(badUserId)).toBe(false);
   const malformed = structuredClone(base);
   (malformed.data as Record<string,unknown>).wallets = [null, "oops"];
   expect(isRasdBackupV2(malformed)).toBe(false);
 });
 test("derived/source-inconsistent keys rejected", () => expect(isRasdBackupV2({
   ...base, data: { ...base.data, transactions: [] },
 })).toBe(false));
});
