/**
 * Read a data set without Supabase's default per-request row limit.
 *
 * This is a defensive helper for the *legacy* v1 export. The v2 export RPC
 * remains the recommended snapshot-consistent backup mechanism.
 * Every page must report the same exact total and return precisely the
 * expected number of records or the entire export is aborted.
 */
export interface BackupPage<T> {
  data: T[] | null;
  count: number | null;
  error?: { message: string } | null;
}

export const BACKUP_PAGE_SIZE = 500;

export async function readAllBackupRows<T>(
  fetchPage: (start: number, end: number) => PromiseLike<BackupPage<T>>,
  tableName: string,
  pageSize = BACKUP_PAGE_SIZE,
): Promise<T[]> {
  if (!Number.isSafeInteger(pageSize) || pageSize < 1 || pageSize > 1000) {
    throw new Error("حجم صفحة النسخ غير صالح");
  }

  let expectedTotal: number | null = null;
  const all: T[] = [];

  // Range endpoints are inclusive (Supabase/PostgREST).
  for (let start = 0; ; start += pageSize) {
    const page = await fetchPage(start, start + pageSize - 1);
    if (page.error) {
      throw new Error(`تعذر نسخ جدول ${tableName}: ${page.error.message}`);
    }
    if (page.count === null || !Number.isSafeInteger(page.count) || page.count < 0) {
      throw new Error(`تعذر التحقق من عدد سجلات جدول ${tableName}`);
    }
    if (expectedTotal === null) expectedTotal = page.count;
    if (page.count !== expectedTotal) {
      throw new Error(`تغير عدد السجلات أثناء نسخ جدول ${tableName}، حاول مجدداً`);
    }
    const required = Math.min(pageSize, expectedTotal - start);
    if (!Array.isArray(page.data) || page.data.length !== required) {
      throw new Error(`نسخة جدول ${tableName} غير مكتملة، تم إلغاء التصدير`);
    }
    all.push(...page.data);
    if (all.length === expectedTotal) return all;
  }
}
