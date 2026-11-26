import { parseVaultFile, unlockWithPassword, unlockWithRecoveryCode, type RasdVaultFile, type OpenedVault } from "./crypto";
import { walletBalanceMinor } from "./ledger";
import { commitVaultFiles, inspectVaultFiles, type VaultFiles } from "./vault-transaction";

export type BackupCredential = { kind: "password" | "recovery"; secret: string };
export type BackupSummary = { wallets: number; entries: number; debts: number; balanceMinor: number; currency: "SAR" };
export type BackupPreview = { fingerprint: string; summary: BackupSummary };
export interface RestoreSafetyCopy {
  read(): Promise<string | null>;
  write(encrypted: string): Promise<void>;
}

const serialize = (file: RasdVaultFile) => JSON.stringify(parseVaultFile(JSON.stringify(file)));
async function fingerprint(file: RasdVaultFile): Promise<string> {
  const bytes = new TextEncoder().encode(serialize(file));
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)), n => n.toString(16).padStart(2,"0")).join("");
}
function authenticate(file: RasdVaultFile, credential: BackupCredential): Promise<OpenedVault> {
  if (credential.kind === "password") return unlockWithPassword(file, credential.secret);
  if (credential.kind === "recovery") return unlockWithRecoveryCode(file, credential.secret);
  throw new Error("وسيلة تحقق غير مدعومة.");
}
function summarize(opened: OpenedVault): BackupSummary {
  const {ledger} = opened;
  return {
    wallets: ledger.wallets.length,
    entries: ledger.entries.length,
    debts: ledger.debts.length,
    balanceMinor: ledger.wallets.reduce((sum,w) => sum + walletBalanceMinor(w,ledger.entries),0),
    currency: "SAR",
  };
}

/** Preview checks encryption integrity, not just JSON structure. Retain only
 * the fingerprint and summary; do not keep an unlocked backup key in the UI. */
export async function previewEncryptedBackup(file: RasdVaultFile, credential: BackupCredential): Promise<BackupPreview> {
  const snapshot = parseVaultFile(serialize(file));
  const opened = await authenticate(snapshot,credential);
  try {
    return { fingerprint: await fingerprint(snapshot), summary: summarize(opened) };
  } finally { opened.keyBytes.fill(0); }
}

export interface RestoreRequest {
  backup: RasdVaultFile;
  preview: BackupPreview;
  credential: BackupCredential;
  expectedCurrent: RasdVaultFile | null;
  currentMaster: string;
  confirmation: string;
  stillAuthorized: () => boolean;
  revokeShortcuts: () => Promise<void>;
}

/** Must execute within the same exclusive device-store transaction as normal
 * writes. Existing vault ownership is verified even from an unlocked shortcut
 * session. A pre-restore encrypted copy is distinct from rolling previous.
 * No existing safety copy is silently overwritten: export it first in the
 * subsequent UI, then explicitly retire it before another replacement. */
export async function restoreVerifiedBackup(io: VaultFiles, safety: RestoreSafetyCopy, request: RestoreRequest): Promise<OpenedVault> {
  const backup = parseVaultFile(serialize(request.backup));
  const expected = request.expectedCurrent ? serialize(request.expectedCurrent) : null;
  const requireAuthorization = () => {
    if (!request.stillAuthorized()) throw new Error("انتهت جلسة الاستعادة؛ أعد الفحص.");
  };
  requireAuthorization();
  if (request.confirmation.trim() !== "استبدال")
    throw new Error("اكتب «استبدال» لتأكيد الاستعادة بعد المعاينة.");
  if (await fingerprint(backup) !== request.preview.fingerprint)
    throw new Error("تغيّرت النسخة بعد المعاينة. افحصها مجددًا.");
  const inspection = await inspectVaultFiles(io);
  if (expected === null ? inspection.kind !== "empty" :
    inspection.kind !== "ready" || serialize(inspection.file) !== expected)
    throw new Error("تغيّرت الخزنة الحالية أو توجد عملية حفظ معلقة. لن تُستبدل البيانات.");
  let restored: OpenedVault | undefined;
  let committed = false;
  try {
    if (inspection.kind === "ready") {
      const authenticated = await unlockWithPassword(inspection.file,request.currentMaster);
      authenticated.keyBytes.fill(0);
    }
    restored = await authenticate(backup,request.credential);
    requireAuthorization();
    if (inspection.kind === "ready") {
      const original = serialize(inspection.file);
      const existingSafety = await safety.read();
      if (existingSafety !== null && existingSafety !== original)
        throw new Error("توجد نسخة أمان سابقة؛ صدّرها وحررها صراحة قبل استعادة جديدة.");
      if (existingSafety === null) await safety.write(original);
      if (await safety.read() !== original)
        throw new Error("لم يكتمل حفظ نسخة الأمان. لن تُستبدل الخزنة.");
    }
    requireAuthorization();
    await request.revokeShortcuts();
    requireAuthorization();
    await commitVaultFiles(io,backup);
    // Caller must independently fence UI adoption after the durable commit.
    committed = true;
    return restored;
  } finally {
    if (!committed) restored?.keyBytes.fill(0);
  }
}
