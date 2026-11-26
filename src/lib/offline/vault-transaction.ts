import { parseVaultFile, type RasdVaultFile } from "./crypto";

/**
 * Injectable file-level transaction coordinator. This has NO secret key and
 * must never label a structurally valid envelope "authenticated"; the UI
 * verifies an encryption key/password before restoring a candidate.
 */
export type VaultFileName = "primary" | "previous" | "pending";
export type VaultCandidate = { source: VaultFileName; file: RasdVaultFile };
export interface VaultFiles {
  read(name: VaultFileName): Promise<string | null>;
  write(name: VaultFileName, text: string): Promise<void>;
  remove(name: VaultFileName): Promise<void>;
}
export type VaultInspection =
  | { kind: "empty" }
  | { kind: "ready"; file: RasdVaultFile }
  | { kind: "recovery_required"; candidates: VaultCandidate[]; damagedPrimary: boolean }
  | { kind: "damaged" };

function parseCandidate(text: string | null): RasdVaultFile | null {
  if (text === null) return null;
  try { return parseVaultFile(text); } catch { return null; }
}

/**
 * An interrupted write MUST NEVER be interpreted as a newly empty vault.
 * If pending differs from primary, the owner chooses which of the
 * successfully DECRYPTABLE snapshots to retain (there is no auto-rollback).
 */
export async function inspectVaultFiles(io: VaultFiles): Promise<VaultInspection> {
  const primaryText = await io.read("primary");
  const pendingText = await io.read("pending");
  const previousText = await io.read("previous");
  const primary = parseCandidate(primaryText);
  const pending = parseCandidate(pendingText);
  const previous = parseCandidate(previousText);
  if (primary && (pendingText === null || pendingText === primaryText)) {
    return { kind: "ready", file: primary };
  }
  if (primaryText === null && pendingText === null && previousText === null)
    return { kind: "empty" };
  const candidates: VaultCandidate[] = [];
  if (primary) candidates.push({ source: "primary", file: primary });
  if (pending) candidates.push({ source: "pending", file: pending });
  if (previous) candidates.push({ source: "previous", file: previous });
  if (!candidates.length) return { kind: "damaged" };
  return {
    kind: "recovery_required",
    candidates,
    damagedPrimary: primaryText !== null && !primary,
  };
}

/**
 * Verify a staged write before touching committed data. Keep a verified
 * previous snapshot before any write that might truncate the primary file.
 *
 * This is NOT a SQLite transaction or fsync guarantee. File operations in
 * Capacitor are not globally atomic; the recovery UI handles interrupted
 * writes. A matching leftover draft means the commit already finished.
 */
export async function commitVaultFiles(io: VaultFiles, file: RasdVaultFile): Promise<void> {
  const serialized = JSON.stringify(parseVaultFile(JSON.stringify(file)));
  const primaryText = await io.read("primary");
  const pendingText = await io.read("pending");
  if (pendingText !== null && pendingText !== primaryText) {
    throw new Error("توجد عملية حفظ غير مكتملة. أعد تشغيل رصد وافحص النسخة المعلقة قبل أي تعديل.");
  }
  if (primaryText === null && await io.read("previous") !== null) {
    throw new Error("ملف الخزنة الرئيسي مفقود وتوجد نسخة سابقة. افحص الاسترداد قبل أي حفظ.");
  }
  if (primaryText !== null && !parseCandidate(primaryText)) {
    throw new Error("ملف الخزنة الرئيسي غير سليم. أوقف الحفظ وافحص النسخة السابقة.");
  }

  await io.write("pending", serialized);
  if (await io.read("pending") !== serialized) {
    throw new Error("لم ينجح التحقق من ملف الحفظ المؤقت.");
  }

  if (primaryText !== null) {
    await io.write("previous", primaryText);
    if (await io.read("previous") !== primaryText)
      throw new Error("لم ينجح التحقق من نسخة الأمان السابقة. لم تتغير الخزنة الرئيسية.");
  }
  await io.write("primary", serialized);
  if (await io.read("primary") !== serialized)
    throw new Error("لم يكتمل الحفظ الرئيسي؛ توجد نسخة مؤقتة أو سابقة للاسترداد.");
  // Failure to delete is nonfatal: inspection knows a byte-identical draft
  // cannot represent a different later transaction.
  try { await io.remove("pending"); } catch { /* resolved on next commit */ }
}

/**
 * Only called AFTER unlockWithPassword/unlockWithRecoveryCode successfully
 * decrypted the chosen candidate, and the owner confirmed the rollback.
 * Snapshot equality prevents overwriting a concurrent newer save.
 */
export async function promoteVaultCandidate(
  io: VaultFiles,
  source: VaultFileName,
  chosen: RasdVaultFile,
): Promise<void> {
  const expected = JSON.stringify(parseVaultFile(JSON.stringify(chosen)));
  const actual = await io.read(source);
  if (actual === null || JSON.stringify(parseVaultFile(actual)) !== expected) {
    throw new Error("تغيّر ملف الاستعادة أثناء المراجعة. أعد الفحص ولا تكتب فوق البيانات.");
  }
  // Crucial: do NOT rewrite 'previous' during recovery. It may be the
  // ONLY surviving good copy after a truncated primary. Preserve it.
  // When the owner chooses primary itself, the verified original must not
  // be rewritten: a partial write could destroy the only surviving copy.
  if (source !== "primary") {
    await io.write("primary", expected);
    if (await io.read("primary") !== expected)
      throw new Error("فشل اعتماد الملف المستعاد. احتفظ بنسخة الاسترداد الأصلية.");
  }
  // After explicit choice, an unselected pending draft must not cause a
  // second recovery prompt. A failed deletion is safe but will re-prompt.
  try { await io.remove("pending"); } catch { /* re-inspection will prompt */ }
}
