// =============================================================
// PART 4 — auditBackupEncryption()
// -------------------------------------------------------------
// Read-only, never touches backup/engine.ts. STATIC facts verified by
// reading that file directly (2026-07-04) — it explicitly documents
// itself as "no encryption, no compression" (see its top-of-file
// comment). This module only reports that honestly; it does not add
// encryption (that would be a Backup Engine change, forbidden this
// prompt).
// =============================================================
import { loadLastBackup } from "@/lib/backup/engine";
import type { HealthStatus } from "@/lib/system/health";

export interface BackupEncryptionCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface BackupEncryptionAudit {
  items: BackupEncryptionCheckItem[];
  score: number;
  generatedAt: string;
}

export async function auditBackupEncryption(): Promise<BackupEncryptionAudit> {
  const lastBackup = await loadLastBackup();

  const items: BackupEncryptionCheckItem[] = [
    {
      id: "encryption_enabled",
      label: "Encryption Enabled",
      status: "error",
      detail:
        "لا تشفير على الإطلاق — backup/engine.ts موثَّق صراحة بأنه بلا تشفير ولا ضغط، تصدير JSON/CSV/XLSX نصي صِرف",
    },
    {
      id: "algorithm",
      label: "Algorithm",
      status: "error",
      detail: "لا خوارزمية تشفير مستخدمة (لا AES-GCM ولا أي بديل) — غير قابل للتطبيق حتى تُضاف",
    },
    {
      id: "key_management",
      label: "Key Management",
      status: "error",
      detail:
        "لا مفتاح تشفير، لا اشتقاق مفتاح من كلمة مرور (PBKDF2/Argon2) — لا بنية إدارة مفاتيح موجودة",
    },
    {
      id: "export_protection",
      label: "Export Protection",
      status: "warning",
      detail: lastBackup
        ? "الملف المُصدَّر (downloadJSON/downloadCSVZip/downloadXLSX) نص عادي يعتمد أمانه بالكامل على مكان حفظه على جهاز المستخدم"
        : "لا نسخة احتياطية محلية بعد لتقييمها",
    },
    {
      id: "restore_protection",
      label: "Restore Protection",
      status: "warning",
      detail:
        "importUserData()/planImport() يتحققان من صحة بنية الملف (validateBundle) لكن لا توقيع رقمي أو تحقق تكامل تشفيري لمصدر الملف",
    },
  ];

  const okCount = items.filter((i) => i.status === "ok").length;
  return {
    items,
    score: Math.round((okCount / items.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
