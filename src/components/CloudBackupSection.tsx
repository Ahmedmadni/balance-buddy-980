// Encrypted backups in a private, owner-scoped Supabase Storage bucket.
// No password ever leaves this component except as the local WebCrypto input.
import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Cloud, Download, LockKeyhole, RefreshCw, RotateCcw, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { encryptRasdBackup, decryptRasdBackup } from "@/lib/backup/encrypted-v2";
import { isRasdBackupV2 } from "@/lib/backup/v2-validate";
import {
  deleteCloudBackup, downloadEncryptedCloudBackup, listCloudBackups,
  uploadEncryptedCloudBackup, type CloudBackupInfo,
} from "@/lib/backup/cloud-storage";

type Mode = "restore" | "delete" | null;

function humanSize(bytes: number | null) {
  return bytes === null ? "الحجم غير متاح" : `${(bytes / 1024 / 1024).toFixed(2)} MB`;
}
function cloudError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  if (/bucket not found|not found|404/i.test(message)) {
    return "لم يتم إنشاء مساحة النسخ السحابية بعد. يجب تطبيق ترحيل قاعدة البيانات على المشروع الصحيح.";
  }
  return message;
}
export function CloudBackupSection() {
  const queryClient = useQueryClient();
  const [items, setItems] = useState<CloudBackupInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(false);
  const [error, setError] = useState("");
  const [working, setWorking] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [selected, setSelected] = useState<CloudBackupInfo | null>(null);
  const [mode, setMode] = useState<Mode>(null);
  const [restorePassword, setRestorePassword] = useState("");
  const [confirmation, setConfirmation] = useState("");

  async function refresh() {
    setLoading(true);
    try {
      const result = await listCloudBackups();
      setItems(result);
      setConfigured(true);
      setError("");
    } catch (e) {
      setConfigured(false);
      setError(cloudError(e));
    } finally { setLoading(false); }
  }
  useEffect(() => { void refresh(); }, []);

  async function saveEncryptedToCloud() {
    if (working) return;
    if (newPassword.length < 12 || newPassword !== confirmPassword) {
      toast.error("أدخل كلمة مرور من 12 حرفاً على الأقل، وتأكد من تطابقها");
      return;
    }
    setWorking(true);
    try {
      const { data, error: exportError } = await supabase.rpc("export_user_backup");
      if (exportError) throw exportError;
      if (!isRasdBackupV2(data)) throw new Error("استجابة تصدير البيانات غير مكتملة");
      // The financial data is encrypted locally, before it is uploaded.
      const encrypted = await encryptRasdBackup(data, newPassword);
      await uploadEncryptedCloudBackup(encrypted);
      toast.success("تم إنشاء نسخة مشفرة في التخزين السحابي الخاص بك");
      setNewPassword("");
      setConfirmPassword("");
      await refresh();
    } catch (e) {
      toast.error("تعذر حفظ النسخة السحابية", { description: cloudError(e) });
    } finally { setWorking(false); }
  }

  function closeDialog() {
    if (working) return;
    setMode(null);
    setSelected(null);
    setRestorePassword("");
    setConfirmation("");
  }
  async function restoreSelected() {
    if (working || !selected || mode !== "restore") return;
    if (confirmation !== "استعادة") {
      toast.error("اكتب استعادة لتأكيد استبدال بيانات حسابك الحالية");
      return;
    }
    setWorking(true);
    try {
      const encrypted = await downloadEncryptedCloudBackup(selected.name);
      const payload = await decryptRasdBackup(encrypted, restorePassword);
      if (!isRasdBackupV2(payload)) throw new Error("النسخة بعد فك التشفير غير مكتملة");
      const { error: restoreError } = await supabase.rpc("restore_user_backup", { p_backup: payload as never });
      if (restoreError) throw restoreError;
      await queryClient.invalidateQueries();
      toast.success("تم استرجاع البيانات من النسخة السحابية");
      setWorking(false);
      closeDialog();
    } catch (e) {
      toast.error("تعذر استعادة النسخة", { description: cloudError(e) });
      setWorking(false);
    }
  }
  async function removeSelected() {
    if (working || !selected || mode !== "delete") return;
    if (confirmation !== "حذف") {
      toast.error("اكتب حذف لتأكيد الإزالة");
      return;
    }
    setWorking(true);
    try {
      await deleteCloudBackup(selected.name);
      toast.success("تم حذف ملف النسخة المحدد");
      setWorking(false);
      closeDialog();
      await refresh();
    } catch (e) {
      toast.error("تعذر حذف النسخة", { description: cloudError(e) });
      setWorking(false);
    }
  }
  async function downloadSelected(info: CloudBackupInfo) {
    if (working) return;
    setWorking(true);
    try {
      const backup = await downloadEncryptedCloudBackup(info.name);
      const url = URL.createObjectURL(new Blob([JSON.stringify(backup)], { type: "application/json" }));
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = info.name;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast.success("تم تجهيز ملف النسخة المشفرة للتنزيل");
    } catch (e) {
      toast.error("تعذر تنزيل الملف", { description: cloudError(e) });
    } finally { setWorking(false); }
  }

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary shrink-0">
            <Cloud className="h-5 w-5" />
          </div>
          <div>
            <h3 className="font-semibold">النسخ السحابية المشفرة</h3>
            <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
              حفظ نسخ مالية مشفرة داخل مساحة خاصة في Supabase Storage، يمكن الوصول إليها من أجهزتك بعد تسجيل الدخول.
            </p>
          </div>
        </div>
        <Button size="icon" variant="outline" aria-label="تحديث قائمة النسخ" onClick={() => void refresh()} disabled={working || loading}>
          <RefreshCw className={loading ? "h-4 w-4 animate-spin" : "h-4 w-4"} />
        </Button>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">
        كل نسخة محمية بكلمة مرور مستقلة لا تُرسل إلى الخادم أو تُحفظ في إعدادات التطبيق.
        هذه الميزة لا ترتبط بحساب Google Drive، ولا تنسخ الملفات المرفقة حالياً، ولا تعمل بجدولة تلقائية.
      </p>
      {error && <p role="alert" className="text-sm text-destructive bg-destructive/10 rounded-lg p-3">{error}</p>}

      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="rasd-cloud-new-secret">كلمة مرور النسخة الجديدة</label>
        <Input id="rasd-cloud-new-secret" type="password" autoComplete="new-password" placeholder="12 حرفاً على الأقل"
          value={newPassword} onChange={e => setNewPassword(e.target.value)} />
        <Input type="password" autoComplete="new-password" aria-label="تأكيد كلمة مرور النسخة" placeholder="تأكيد كلمة المرور"
          value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)} />
        <Button onClick={() => void saveEncryptedToCloud()} disabled={working || loading || !configured}>
          {working ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />} إنشاء نسخة سحابية مشفرة
        </Button>
      </div>

      <div className="border-t pt-4 space-y-2">
        <div className="flex justify-between items-center gap-2">
          <h4 className="font-medium text-sm">النسخ المحفوظة</h4>
          <span className="text-xs text-muted-foreground">{loading ? "جارٍ التحقق…" : configured ? `${items.length} نسخة` : "غير متاح"}</span>
        </div>
        {!loading && configured && items.length === 0 && (
          <p className="text-xs text-muted-foreground">لا توجد نسخ سحابية بعد.</p>
        )}
        <div className="max-h-72 overflow-y-auto space-y-2">
          {items.map(info => (
            <div key={info.name} className="flex items-center justify-between gap-2 rounded-xl border p-3">
              <div className="min-w-0">
                <p className="text-xs font-medium">
                  {info.createdAt ? new Date(info.createdAt).toLocaleString("ar-SA") : "نسخة مشفرة"}
                </p>
                <p className="text-xs text-muted-foreground">{humanSize(info.bytes)}</p>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <Button size="icon" variant="ghost" disabled={working} aria-label="تنزيل الملف المشفر"
                  onClick={() => void downloadSelected(info)}><Download className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" disabled={working} aria-label="استعادة النسخة"
                  onClick={() => { setSelected(info); setMode("restore"); }}><RotateCcw className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" disabled={working} aria-label="حذف النسخة"
                  onClick={() => { setSelected(info); setMode("delete"); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
              </div>
            </div>
          ))}
        </div>
      </div>
      <Dialog open={mode !== null} onOpenChange={open => { if (!open) closeDialog(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{mode === "restore" ? "استعادة النسخة السحابية" : "حذف النسخة السحابية"}</DialogTitle>
            <DialogDescription>
              {mode === "restore"
                ? "ستُستبدل بياناتك المالية الحالية. احتفظ بنسخة منفصلة قبل المتابعة."
                : "سيتم حذف الملف المحدد فقط من التخزين السحابي، وليس سجلاتك المالية."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            {mode === "restore" && (
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-muted-foreground"><LockKeyhole className="h-4 w-4" />كلمة مرور النسخة المشفرة</div>
                <Input type="password" autoComplete="off" value={restorePassword}
                  onChange={e => setRestorePassword(e.target.value)} placeholder="كلمة مرور النسخة" />
              </div>
            )}
            <Input value={confirmation} onChange={e => setConfirmation(e.target.value)}
              placeholder={mode === "restore" ? "اكتب: استعادة" : "اكتب: حذف"} />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={working} onClick={closeDialog}>إلغاء</Button>
            {mode === "restore"
              ? <Button disabled={working} variant="destructive" onClick={() => void restoreSelected()}>تأكيد الاستعادة</Button>
              : <Button disabled={working} variant="destructive" onClick={() => void removeSelected()}>حذف النسخة</Button>}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
