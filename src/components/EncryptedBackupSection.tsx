// Export and restore v2 data as an AES-GCM encrypted portable file.
// Cloud sync and attachment export are deliberately not claimed here.
import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Download, LockKeyhole, Upload, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { encryptRasdBackup, decryptRasdBackup, isEncryptedRasdBackup } from "@/lib/backup/encrypted-v2";

type Action = "export" | "restore" | null;
function isV2(value: unknown): value is { format: "rasd-backup"; version: 2; data: Record<string, unknown> } {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const v = value as Record<string, unknown>;
  return v.format === "rasd-backup" && v.version === 2
    && typeof v.data === "object" && v.data !== null && !Array.isArray(v.data);
}
export function EncryptedBackupSection() {
  const qc = useQueryClient();
  const fileInput = useRef<HTMLInputElement>(null);
  const [action, setAction] = useState<Action>(null);
  const [password, setPassword] = useState("");
  const [passwordConfirm, setPasswordConfirm] = useState("");
  const [confirmRestore, setConfirmRestore] = useState("");
  const [encryptedFile, setEncryptedFile] = useState<unknown>(null);
  const [working, setWorking] = useState(false);

  function reset() {
    setAction(null);
    setPassword("");
    setPasswordConfirm("");
    setConfirmRestore("");
    setEncryptedFile(null);
  }
  async function chooseEncryptedFile(f: File) {
    try {
      if (f.size > 100 * 1024 * 1024) throw new Error("الملف أكبر من الحد المقبول (100 MB)");
      const raw: unknown = JSON.parse(await f.text());
      if (!isEncryptedRasdBackup(raw)) throw new Error("الملف ليس نسخة رصد مشفرة مدعومة");
      setEncryptedFile(raw);
      setAction("restore");
    } catch (e) {
      toast.error("تعذر فتح النسخة", { description: e instanceof Error ? e.message : "ملف غير صالح" });
    }
  }
  async function execute() {
    if (!action || working) return;
    if (action === "export" && (password.length < 12 || password !== passwordConfirm)) {
      toast.error("أدخل كلمة مرور من 12 حرفاً على الأقل وتأكد من تطابقها");
      return;
    }
    if (action === "restore" && confirmRestore !== "استعادة") {
      toast.error("اكتب كلمة استعادة لتأكيد استبدال البيانات الحالية");
      return;
    }
    setWorking(true);
    try {
      if (action === "export") {
        const { data, error } = await supabase.rpc("export_user_backup");
        if (error) throw error;
        if (!isV2(data)) throw new Error("نتيجة النسخ من الخادم غير صالحة");
        const envelope = await encryptRasdBackup(data, password);
        const file = new Blob([JSON.stringify(envelope)], { type: "application/json" });
        const url = URL.createObjectURL(file);
        const anchor = document.createElement("a");
        anchor.href = url;
        anchor.download = `rasd-secure-backup-${new Date().toISOString().slice(0, 10)}.json`;
        document.body.appendChild(anchor);
        anchor.click();
        anchor.remove();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        toast.success("تم تجهيز النسخة المشفرة وحفظها عبر تنزيل المتصفح");
      } else {
        const payload = await decryptRasdBackup(encryptedFile, password);
        if (!isV2(payload)) throw new Error("النسخة بعد فك التشفير ليست نسخة v2 صالحة");
        const { error } = await supabase.rpc("restore_user_backup", { p_backup: payload as never });
        if (error) throw error;
        await qc.invalidateQueries();
        toast.success("تمت استعادة النسخة المشفرة بنجاح");
      }
      reset();
    } catch (error) {
      toast.error("لم تكتمل العملية", { description: error instanceof Error ? error.message : "تعذر تنفيذ العملية" });
    } finally {
      setWorking(false);
    }
  }
  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4">
      <div className="flex items-center gap-2">
        <LockKeyhole className="h-5 w-5 text-primary" />
        <div>
          <h3 className="font-semibold">نسخة محلية مشفرة (AES-256-GCM)</h3>
          <p className="text-xs text-muted-foreground">حماية ملف النسخة v2 بكلمة مرور قبل تنزيله. احفظ كلمة المرور خارج الجهاز؛ لا يمكن استعادتها من رصد.</p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">تحتاج اتصالاً بالخادم لإنشاء النسخة أو استعادتها. المرفقات غير مدرجة حالياً. النسخ التلقائي إلى Google Drive غير مفعّل.</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => { reset(); setAction("export"); }} variant="outline">
          <Download className="h-4 w-4" /> تنزيل نسخة مشفرة
        </Button>
        <Button onClick={() => fileInput.current?.click()} variant="outline">
          <Upload className="h-4 w-4" /> استعادة ملف مشفر
        </Button>
      </div>
      <input ref={fileInput} type="file" accept=".json,application/json" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void chooseEncryptedFile(f); e.target.value = ""; }} />
      <Dialog open={action !== null} onOpenChange={(open) => { if (!open && !working) reset(); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{action === "export" ? "حماية النسخة الجديدة" : "استعادة نسخة مشفرة"}</DialogTitle>
            <DialogDescription>
              {action === "export"
                ? "أدخل كلمة مرور طويلة ومختلفة عن كلمة حسابك. فقدانها يعني عدم إمكانية فك تشفير الملف."
                : "سيتم استبدال بياناتك الحالية بعد فك التشفير. تأكد من وجود نسخة احتياطية حديثة أولاً."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input type="password" autoComplete="new-password" placeholder="كلمة مرور النسخة" value={password} onChange={e => setPassword(e.target.value)} />
            {action === "export" && (
              <Input type="password" autoComplete="new-password" placeholder="تأكيد كلمة المرور" value={passwordConfirm} onChange={e => setPasswordConfirm(e.target.value)} />
            )}
            {action === "restore" && (
              <Input placeholder="اكتب: استعادة" value={confirmRestore} onChange={e => setConfirmRestore(e.target.value)} />
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={reset} disabled={working}>إلغاء</Button>
            <Button onClick={() => void execute()} disabled={working}>
              {working && <RefreshCw className="h-4 w-4 animate-spin" />}
              {action === "export" ? "تشفير وتنزيل" : "تأكيد الاستعادة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
