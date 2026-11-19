// Backup v2 — server-side export/restore via Supabase RPCs.
// No direct table writes; the DB functions handle everything transactionally.

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportFile } from "@/lib/mobile/share-export";
import { Capacitor } from "@capacitor/core";
import { clearNativeReminders, syncNativeReminders } from "@/lib/notifications/native-scheduler";
import { afterSuccessfulBackupRestore } from "@/lib/backup/post-restore";
import { decryptBackup, encryptBackup, isEncryptedBackup } from "@/lib/backup/encrypted-backup";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Download, Upload, ShieldAlert, CheckCircle2, RefreshCw, CloudDownload, FileWarning,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createAuditEntry } from "@/lib/system/audit";
import { countBackupV2Rows, isBackupJsonFile, validateBackupV2, type BackupV2 } from "@/lib/backup/v2-validation";

export function BackupV2Section() {
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [backupPassword, setBackupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const [legacyUnencrypted, setLegacyUnencrypted] = useState(false);
  const [restoreConfirmation, setRestoreConfirmation] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<BackupV2 | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const operationLock = useRef(false);

  const busy = exporting || restoring;

  async function doExport() {
    if (operationLock.current) return;
    if (backupPassword.length < 12) { toast.error("أدخل كلمة مرور مستقلة للنسخة من 12 حرفا على الأقل"); return; }
    if (backupPassword !== confirmPassword) { toast.error("كلمتا مرور النسخة غير متطابقتين"); return; }
    operationLock.current = true;
    setExporting(true);
    try {
      const { data, error } = await supabase.rpc("export_user_backup");
      if (error) throw error;
      const backup = validateBackupV2(data);
      if (!backup) {
        toast.error("تعذر إنشاء النسخة", { description: "الاستجابة الواردة ليست نسخة احتياطية صالحة (v2)." });
        return;
      }
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
      const encrypted = await encryptBackup(backup, backupPassword);
      const blob = new Blob([JSON.stringify(encrypted)], { type: "application/json" });
      const outcome = await exportFile(blob, `rasd-encrypted-backup-${stamp}.json`);
      createAuditEntry("backup", "إنشاء ملف نسخة مشفرة (v2)", { meta: { version: 2, encrypted: true } });
      setBackupPassword(""); setConfirmPassword("");
      if (outcome === "share_sheet_opened") {
        toast.info("اختر وجهة الحفظ من Android، ثم تأكد من وجود الملف خارج التطبيق");
      } else {
        toast.info("بدأ تنزيل الملف المشفر؛ تحقق من اكتماله في مجلد التنزيلات");
      }
    } catch {
      toast.error("فشل تنزيل النسخة الاحتياطية", { description: "تحقق من اتصالك وتسجيل الدخول ثم حاول مرة أخرى." });
    } finally {
      operationLock.current = false;
      setExporting(false);
    }
  }

  async function onFile(f: File) {
    if (operationLock.current) return;
    // Keep a corrupt/hostile file from allocating excessive memory in WebView.
    if (f.size > 50 * 1024 * 1024) {
      toast.error("الملف يتجاوز الحد الآمن للمعالجة (50 ميجابايت)");
      return;
    }
    if (!isBackupJsonFile(f.name)) {
      toast.error("ملف غير صالح", { description: "اختر ملفًا بامتداد JSON فقط." });
      return;
    }
    operationLock.current = true;
    try {
      const text = await f.text();
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        toast.error("ملف غير صالح", { description: "تعذر قراءة الملف — يجب أن يكون ملف JSON صالحاً." });
        return;
      }
      const encrypted = isEncryptedBackup(raw);
      if (encrypted && !restorePassword) {
        toast.error("أدخل كلمة مرور النسخة المستوردة قبل اختيار الملف");
        return;
      }
      const payload = isEncryptedBackup(raw) ? await decryptBackup(raw, restorePassword) : raw;
      const backup = validateBackupV2(payload);
      if (!backup) {
        toast.error("نسخة غير مدعومة", { description: "الملف ليس نسخة احتياطية صالحة من رصد (الإصدار 2)." });
        return;
      }
      setLegacyUnencrypted(!encrypted);
      setPendingBackup(backup);
      setRestoreConfirmation("");
      setConfirmOpen(true);
    } catch (err) {
      toast.error("تعذر فتح النسخة", { description: err instanceof Error ? err.message : "ملف غير صالح" });
    } finally {
      operationLock.current = false;
    }
  }

  async function doRestore() {
    if (!pendingBackup || operationLock.current || restoreConfirmation.trim() !== "استعادة") return;
    operationLock.current = true;
    setRestoring(true);
    try {
      const { error } = await supabase.rpc("restore_user_backup", { p_backup: pendingBackup as never });
      if (error) throw error;
      createAuditEntry("restore", "استعادة نسخة احتياطية (v2)", { meta: { version: 2 } });
      setConfirmOpen(false);
      setPendingBackup(null);
      setRestorePassword("");
      setRestoreConfirmation("");
    } catch {
      toast.error("فشلت الاستعادة", { description: "لم تكتمل الاستعادة. تحقق من اتصالك وحالة بياناتك قبل المحاولة مجددًا." });
      operationLock.current = false;
      setRestoring(false);
      return;
    }
    try {
      // The SQL RPC has already committed. A reminder, network or UI failure
      // is NOT a restore failure and must never lead to a second import.
      const after = await afterSuccessfulBackupRestore({
        native: Capacitor.isNativePlatform(),
        clearNativeReminders,
        refreshActiveViews: async () => {
          await qc.invalidateQueries({ refetchType: "none" });
          await qc.refetchQueries({ type: "active" }, { throwOnError: true });
        },
        syncNativeReminders: async () => {
          const { data, error } = await supabase.auth.getUser();
          if (error || !data.user) throw new Error("Active session required");
          await syncNativeReminders(data.user.id, { askPermission: false });
        },
      });
      if (!after.viewUpdated || !after.remindersCleared || !after.remindersSynced) {
        const issues = [
          !after.viewUpdated ? "لم تكتمل إعادة تحميل البيانات المعروضة." : "",
          (!after.remindersCleared || !after.remindersSynced) ?
            "لم يتم تأكيد تحديث تنبيهات Android؛ راجع الإشعارات عند عودة الاتصال." : "",
        ].filter(Boolean).join(" ");
        toast.warning("تمت استعادة البيانات، لكن يلزم التحقق من بعض وظائف الجهاز", {
          description: issues + " لا تكرر عملية الاستعادة.",
        });
      } else {
        toast.success("تمت الاستعادة بنجاح", {
          description: "تم تحديث البيانات ومراجعة جدول التنبيهات المحلي إذا كان مفعّلًا.",
        });
      }
    } finally {
      operationLock.current = false;
      setRestoring(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <CloudDownload className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold flex items-center gap-2">
            النسخ الاحتياطي v2 <Badge variant="secondary" className="text-[10px]">موصى به</Badge>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            نسخة خادمية كاملة من بياناتك المالية عبر الخادم — تصدير واستعادة آمنة
          </p>
        </div>
      </div>

      <Alert>
        <FileWarning className="h-4 w-4" />
        <AlertDescription className="text-xs">
          المرفقات والملفات المرفوعة غير مشمولة حاليًا في النسخة الاحتياطية.
        </AlertDescription>
      </Alert>

      <div className="space-y-2 rounded-xl border p-3">
        <p className="text-xs font-semibold">تشفير النسخة قبل التصدير (AES-256-GCM)</p>
        <p className="text-xs text-muted-foreground">اختر كلمة مرور مستقلة لا تقل عن 12 حرفا. لن يتم حفظها في التطبيق؛ فقدانها يعني تعذر استعادة النسخة.</p>
        <Input type="password" autoComplete="new-password" placeholder="كلمة مرور النسخة" aria-label="كلمة مرور النسخة" value={backupPassword} onChange={(e) => setBackupPassword(e.target.value)} />
        <Input type="password" autoComplete="new-password" placeholder="تأكيد كلمة المرور" aria-label="تأكيد كلمة مرور النسخة" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">لاستعادة ملف مشفر، أدخل كلمة مروره هنا قبل اختياره. يمكن استيراد ملفات v2 القديمة غير المشفرة مع تحذير.</p>
        <Input type="password" autoComplete="off" placeholder="كلمة مرور الملف المراد استعادته" aria-label="كلمة مرور ملف الاستعادة" value={restorePassword} onChange={(e) => setRestorePassword(e.target.value)} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button onClick={doExport} disabled={busy}>
          {exporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          تنزيل نسخة احتياطية
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy}>
          {restoring ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          استعادة نسخة احتياطية
        </Button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      {/* Destructive confirmation */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(v) => {
          if (!v && !restoring) { setConfirmOpen(false); setPendingBackup(null); setRestoreConfirmation(""); }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-warning" /> تأكيد الاستعادة
            </DialogTitle>
            <DialogDescription className="sr-only">تأكيد استبدال البيانات الحالية بالنسخة الاحتياطية</DialogDescription>
          </DialogHeader>

          {legacyUnencrypted && <Alert variant="destructive"><FileWarning className="h-4 w-4" /><AlertDescription className="text-xs">هذا الملف غير مشفر. تجنب مشاركته، وبعد الاستعادة أنشئ نسخة مشفرة جديدة.</AlertDescription></Alert>}
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="text-xs leading-relaxed">
              سيتم استبدال بياناتك المالية الحالية بالكامل بمحتوى النسخة الاحتياطية المحددة.
              هذه العملية لا يمكن التراجع عنها.
              {pendingBackup?.exported_at && (
                <>
                  <br />
                  تاريخ النسخة: {new Date(pendingBackup.exported_at).toLocaleString("ar")}
                </>
              )}
            </AlertDescription>
          </Alert>

          {pendingBackup && (
            <div className="rounded-xl border p-3 text-xs space-y-1">
              <p className="font-semibold">
                محتوى الملف: {countBackupV2Rows(pendingBackup).toLocaleString("ar-SA")} سجل في {Object.keys(pendingBackup.data).length} مجموعة بيانات
              </p>
              <p className="text-muted-foreground">
                محافظ: {pendingBackup.data.wallets.length}، ديون: {pendingBackup.data.person_ledger.length}، مصروفات: {pendingBackup.data.expenses.length}، استثمارات: {pendingBackup.data.investments.length}.
              </p>
              {countBackupV2Rows(pendingBackup) === 0 && (
                <p className="font-semibold text-destructive">
                  تحذير: النسخة تحتوي على صفر سجلات مالية. الاستعادة ستزيل السجلات الحالية المشمولة في النسخ الاحتياطي.
                </p>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            ملاحظة: المرفقات والملفات المرفوعة غير مشمولة حاليًا في النسخة الاحتياطية.
          </p>

          <div className="space-y-2">
            <label htmlFor="restore-confirmation" className="text-xs font-medium">
              لتأكيد استبدال البيانات اكتب كلمة «استعادة»:
            </label>
            <Input
              id="restore-confirmation"
              autoComplete="off"
              placeholder="استعادة"
              value={restoreConfirmation}
              onChange={(e) => setRestoreConfirmation(e.target.value)}
              disabled={restoring}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingBackup(null); setRestoreConfirmation(""); }} disabled={restoring}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={doRestore} disabled={restoring || restoreConfirmation.trim() !== "استعادة"}>
              {restoring ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {restoring ? "جارٍ الاستعادة…" : "تأكيد الاستبدال والاستعادة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
