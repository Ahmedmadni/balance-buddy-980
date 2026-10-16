// Pure, fail-closed validation for legacy unencrypted v1 backup files.
// The newer v2 RPC/restore remains the recommended transactional route.
const SCOPES = new Set(["full", "financial", "assets", "reports"]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function validateLegacyBackup(
  value: unknown,
  allowedTables: ReadonlySet<string>,
  allowedPreferences: ReadonlySet<string>,
): { ok: true } | { ok: false; error: string } {
  if (!isRecord(value)) return { ok: false, error: "ملف JSON غير صالح" };
  if (!isRecord(value.meta) || value.meta.app !== "rasd" || value.meta.version !== 1) {
    return { ok: false, error: "الملف ليس نسخة رصد قديمة معتمدة (v1)" };
  }
  if (!SCOPES.has(String(value.meta.scope))) return { ok: false, error: "نطاق النسخة غير معروف" };
  if (typeof value.meta.exported_at !== "string" || !Number.isFinite(Date.parse(value.meta.exported_at))) {
    return { ok: false, error: "تاريخ النسخة غير صالح" };
  }
  if (value.meta.user_id !== undefined
      && (typeof value.meta.user_id !== "string" ||
          !/^[0-9a-f-]{36}$/i.test(value.meta.user_id))) {
    return { ok: false, error: "معرّف مالك النسخة غير صالح" };
  }
  if (!isRecord(value.data) || !isRecord(value.meta.counts)) {
    return { ok: false, error: "مجموعات بيانات النسخة أو أعدادها غير صالحة" };
  }
  const keys = Object.keys(value.data);
  if (keys.length === 0) return { ok: false, error: "ملف النسخة لا يحتوي على جداول" };
  for (const table of keys) {
    if (!allowedTables.has(table)) {
      return { ok: false, error: `جدول غير مصرح باستيراده: ${table}` };
    }
    const rows = value.data[table];
    if (!Array.isArray(rows) || !rows.every(isRecord)) {
      return { ok: false, error: `بيانات الجدول ${table} غير صالحة` };
    }
    if (value.meta.counts[table] !== rows.length) {
      return { ok: false, error: `عدد السجلات لا يطابق الملف في الجدول ${table}` };
    }
  }
  if (value.local !== undefined) {
    if (!isRecord(value.local)) return { ok: false, error: "إعدادات الجهاز غير صالحة" };
    for (const key of Object.keys(value.local)) {
      if (!allowedPreferences.has(key)) {
        return { ok: false, error: `مفتاح إعدادات غير مسموح: ${key}` };
      }
    }
  }
  return { ok: true };
}
