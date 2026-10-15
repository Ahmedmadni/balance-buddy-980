// Backup v2 — server-side export/restore via Supabase RPCs.
// No direct table writes; the DB functions handle everything transactionally.

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
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
import { isRasdBackupV2 } from "@/lib/backup/v2-validate";

export function BackupV2Section() {
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<BackupV2 | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const busy = exporting || restoring;

  async function doExport() {
    setExporting(true);
    try {
      const { data, error } = await supabase.rpc("export_user_backup");
      if (error) throw error;
      const backup = isRasdBackupV2(data);
      if (!backup) {
        toast.error("تعذر إنشاء النسخة", { description: "الاستجابة الواردة ليست نسخة احتياطية صالحة (v2)." });
        return;
      }
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `rasd-backup-${stamp}.json`;
      a.click();
      URL.revokeObjectURL(url);
      createAuditEntry("backup", "تنزيل نسخة احتياطية (v2)", { meta: { version: 2 } });
      toast.success("تم تنزيل النسخة الاحتياطية");
    } catch (e: any) {
      toast.error("فشل تنزيل النسخة الاحتياطية", { description: e?.message ?? "حدث خطأ غير متوقع" });
    } finally {
      setExporting(false);
    }
  }

  async function onFile(f: File) {
    try {
      const text = await f.text();
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        toast.error("ملف غير صالح", { description: "تعذر قراءة الملف — يجب أن يكون ملف JSON صالحاً." });
        return;
      }
      const backup = isRasdBackupV2(raw);
      if (!backup) {
        toast.error("نسخة غير مدعومة", { description: "الملف ليس نسخة احتياطية صالحة من رصد (الإصدار 2)." });
        return;
      }
      setPendingBackup(backup);
      setConfirmOpen(true);
    } catch {
      toast.error("خطأ في القراءة", { description: "تعذر فتح الملف المحدد." });
    }
  }

  async function doRestore() {
    if (!pendingBackup || restoring) return;
    setRestoring(true);
    try {
      const { error } = await supabase.rpc("restore_user_backup", { p_backup: pendingBackup as never });
      if (error) throw error;
      createAuditEntry("restore", "استعادة نسخة احتياطية (v2)", { meta: { version: 2 } });
      await qc.invalidateQueries();
      await qc.refetchQueries();
      toast.success("تمت الاستعادة بنجاح", { description: "تم تحديث جميع البيانات من النسخة الاحتياطية." });
      setConfirmOpen(false);
      setPendingBackup(null);
    } catch (e: any) {
      toast.error("فشلت الاستعادة", { description: "بقيت بياناتك الحالية كما هي دون تغيير. " + (e?.message ?? "") });
    } finally {
      setRestoring(false);
    }
  }

  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4">
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
          if (!v && !restoring) { setConfirmOpen(false); setPendingBackup(null); }
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-warning" /> تأكيد الاستعادة
            </DialogTitle>
            <DialogDescription className="sr-only">تأكيد استبدال البيانات الحالية بالنسخة الاحتياطية</DialogDescription>
          </DialogHeader>

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

          <p className="text-xs text-muted-foreground">
            ملاحظة: المرفقات والملفات المرفوعة غير مشمولة حاليًا في النسخة الاحتياطية.
          </p>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => { setConfirmOpen(false); setPendingBackup(null); }} disabled={restoring}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={doRestore} disabled={restoring}>
              {restoring ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {restoring ? "جارٍ الاستعادة…" : "تأكيد الاستبدال والاستعادة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
