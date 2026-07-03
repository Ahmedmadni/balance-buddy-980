// =============================================================
// PART 2 (Prompt 24) — verifyBackupIntegrity()
// -------------------------------------------------------------
// Pure, read-only verification of a BackupBundle (freshly exported or
// loaded from a file) — never writes anything, never touches Supabase.
// Checksum uses SubtleCrypto (SHA-256) when available (secure contexts
// only — HTTPS/localhost, which is how this app is actually deployed),
// falling back to a simple non-cryptographic hash otherwise so the
// function never throws in an insecure context.
// =============================================================
import type { BackupBundle } from "./engine";

export interface BackupIntegrityStatistics {
  tableCount: number;
  totalRecords: number;
  localKeyCount: number;
  sizeBytes: number;
  checksum: string;
  schemaVersion: number | null;
}

export interface BackupIntegrityReport {
  valid: boolean;
  score: number; // 0-100 compatibility score
  warnings: string[];
  errors: string[];
  statistics: BackupIntegrityStatistics;
}

async function sha256Hex(text: string): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    // Insecure context (no SubtleCrypto) — simple non-cryptographic fallback
    // so this never throws; still deterministic for change detection.
    let h = 0;
    for (let i = 0; i < text.length; i++) {
      h = (h << 5) - h + text.charCodeAt(i);
      h |= 0;
    }
    return `fallback-${(h >>> 0).toString(16)}`;
  }
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function verifyBackupIntegrity(
  bundle: BackupBundle | null | undefined,
): Promise<BackupIntegrityReport> {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!bundle || typeof bundle !== "object") {
    return {
      valid: false,
      score: 0,
      errors: ["الملف غير صالح أو فارغ"],
      warnings: [],
      statistics: {
        tableCount: 0,
        totalRecords: 0,
        localKeyCount: 0,
        sizeBytes: 0,
        checksum: "",
        schemaVersion: null,
      },
    };
  }

  // Schema version check.
  if (bundle.meta?.app !== "rasd")
    errors.push('meta.app ليس "rasd" — الملف ليس نسخة احتياطية من رصد');
  const schemaVersion = typeof bundle.meta?.version === "number" ? bundle.meta.version : null;
  if (schemaVersion !== 1)
    warnings.push(`إصدار مخطط غير معروف: ${schemaVersion ?? "غير موجود"} (المتوقع: 1)`);

  // Record counts vs. declared counts — detect missing/corrupted sections.
  const counts = bundle.meta?.counts ?? {};
  const data = bundle.data ?? {};
  const missingSections: string[] = [];
  const corruptedSections: string[] = [];
  let totalRecords = 0;

  for (const [table, declaredCount] of Object.entries(counts)) {
    const rows = data[table];
    if (!Array.isArray(rows)) {
      missingSections.push(table);
      continue;
    }
    totalRecords += rows.length;
    if (rows.length !== declaredCount) {
      corruptedSections.push(`${table} (معلَن: ${declaredCount}، فعلي: ${rows.length})`);
    }
  }
  for (const table of Object.keys(data)) {
    if (!(table in counts)) warnings.push(`قسم غير متوقّع في البيانات: ${table}`);
  }

  if (missingSections.length > 0) errors.push(`أقسام مفقودة: ${missingSections.join("، ")}`);
  if (corruptedSections.length > 0)
    errors.push(`أقسام بعدد صفوف غير متطابق: ${corruptedSections.join("، ")}`);

  const localKeyCount = bundle.local ? Object.keys(bundle.local).length : 0;
  if (localKeyCount === 0) warnings.push("لا توجد بيانات تفضيلات محلية (local) في هذه النسخة");

  const serialized = JSON.stringify(bundle);
  const sizeBytes = new Blob([serialized]).size;
  const checksum = await sha256Hex(serialized);

  let score = 100;
  score -= errors.length * 25;
  score -= warnings.length * 5;
  score = Math.max(0, Math.min(100, score));

  return {
    valid: errors.length === 0,
    score,
    warnings,
    errors,
    statistics: {
      tableCount: Object.keys(data).length,
      totalRecords,
      localKeyCount,
      sizeBytes,
      checksum,
      schemaVersion,
    },
  };
}
