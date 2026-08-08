// =============================================================
// Contacts service — delete + name repair
// -------------------------------------------------------------
// Root cause of the "Bad Request" on delete: a single PostgREST
// request with `.in("id", [...])` for a large selection builds a URL
// containing every UUID. With a few dozen imported contacts the query
// string exceeds the gateway limit and the request is rejected with
// HTTP 400 before it ever reaches Postgres (RLS and the foreign keys
// are fine — every FK to contacts is ON DELETE SET NULL).
//
// Fix: validate ids, delete in small chunks, and map errors to clear
// Arabic messages instead of surfacing "Bad Request".
// =============================================================
import { supabase } from "@/integrations/supabase/client";
import { decodeImportedContactName, isEncodedContactName } from "./encoding";

const UUID_RE = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const CHUNK = 25;

export function isValidContactId(id: unknown): id is string {
  return typeof id === "string" && UUID_RE.test(id);
}

/** Turns a Supabase/network error into a clear Arabic message (details stay in console). */
export function mapContactError(e: any): string {
  if (import.meta.env.DEV) console.error("[contacts]", e);
  const code = e?.code ?? "";
  const msg = String(e?.message ?? "");
  if (code === "42501" || /row-level security|permission/i.test(msg))
    return "لا تملك صلاحية على جهة الاتصال هذه.";
  if (code === "23503" || /foreign key/i.test(msg))
    return "جهة الاتصال مرتبطة بسجلات أخرى ولا يمكن حذفها الآن.";
  if (code === "22P02" || /invalid input syntax/i.test(msg))
    return "معرّف جهة الاتصال غير صالح.";
  if (/failed to fetch|network/i.test(msg))
    return "تعذّر الاتصال بالخادم. تحقّق من الشبكة وحاول مجدداً.";
  if (/PGRST116|not found/i.test(msg) || code === "PGRST116")
    return "جهة الاتصال غير موجودة (ربما حُذفت مسبقاً).";
  return "تعذّر حذف جهة الاتصال. حاول مرة أخرى.";
}

export interface DeleteContactsResult {
  deleted: number;
  invalid: number;
  failed: number;
  firstError?: string;
}

/** Deletes contacts in safe chunks. Never throws for a partial failure. */
export async function deleteContacts(ids: string[]): Promise<DeleteContactsResult> {
  const valid = Array.from(new Set(ids.filter(isValidContactId)));
  const invalid = new Set(ids).size - valid.length;
  let deleted = 0;
  let failed = 0;
  let firstError: string | undefined;

  for (let i = 0; i < valid.length; i += CHUNK) {
    const batch = valid.slice(i, i + CHUNK);
    try {
      const { error, count } = await supabase
        .from("contacts")
        .delete({ count: "exact" })
        .in("id", batch);
      if (error) throw error;
      deleted += count ?? 0;
      failed += batch.length - (count ?? 0);
    } catch (e: any) {
      failed += batch.length;
      firstError ??= mapContactError(e);
    }
  }

  return { deleted, invalid, failed, firstError };
}

/**
 * Repairs contact names that were stored quoted-printable-encoded.
 * Only rows that actually match the mangled pattern are updated —
 * correct Arabic/English names are never touched.
 */
export async function repairEncodedContactNames(): Promise<{ fixed: number; scanned: number }> {
  const { data, error } = await supabase.from("contacts").select("id,name");
  if (error) throw error;
  const rows = (data ?? []) as { id: string; name: string }[];
  const broken = rows.filter((r) => isEncodedContactName(r.name));

  let fixed = 0;
  for (const r of broken) {
    const name = decodeImportedContactName(r.name);
    if (!name || name === r.name) continue;
    const { error: upErr } = await supabase.from("contacts").update({ name }).eq("id", r.id);
    if (!upErr) fixed++;
  }
  return { fixed, scanned: rows.length };
}
