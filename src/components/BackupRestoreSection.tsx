// Backup / Restore UI — lives inside Settings.
// Local, manual only. No scheduled backups, no cloud sync, no encryption.

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Download, Upload, Database, FileJson, FileSpreadsheet, FileText,
  Cloud, ShieldAlert, CheckCircle2, HardDrive, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import {
  exportUserData, downloadJSON, downloadCSVZip, downloadXLSX,
  validateBundle, planImport, importUserData, loadLastBackup, clearLegacyPlaintextBackup,
  CLOUD_PROVIDERS,
  type BackupScope, type BackupBundle, type ImportMode, type ImportPlan,
} from "@/lib/backup/engine";
import { createAuditEntry } from "@/lib/system/audit";
import { captureApplicationError } from "@/lib/system/errors";

const SCOPE_LABEL: Record<BackupScope, string> = {
  full: "نسخة كاملة",
  financial: "البيانات المالية",
  assets: "الأصول فقط",
  reports: "التقارير فقط",
};

export function BackupRestoreSection() {
  const [scope, setScope] = useState<BackupScope>("full");
  const [busy, setBusy] = useState<null | "json" | "csv" | "xlsx">(null);
  const [lastBundle, setLastBundle] = useState<BackupBundle | null>(null);
  const [legacyCacheFound, setLegacyCacheFound] = useState(false);
  const [sessionExportAt, setSessionExportAt] = useState<string | null>(null);
  const [confirmClearLegacy, setConfirmClearLegacy] = useState(false);
  const [clearingLegacy, setClearingLegacy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [importBundle, setImportBundle] = useState<BackupBundle | null>(null);
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [mode, setMode] = useState<ImportMode>("merge");
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    let active = true;
    void loadLastBackup().then(b => {
      if (active && b) { setLastBundle(b); setLegacyCacheFound(true); }
    }).catch(() => {});
    return () => { active = false; };
  }, []);

  async function doExport(fmt: "json" | "csv" | "xlsx") {
    setBusy(fmt);
    try {
      const b = await exportUserData(scope);
      if (fmt === "json") downloadJSON(b);
      else if (fmt === "csv") downloadCSVZip(b);
      else downloadXLSX(b);
      setLastBundle(b);
      setSessionExportAt(b.meta.exported_at);
      createAuditEntry("backup", `تصدير نسخة احتياطية (${SCOPE_LABEL[scope]}, ${fmt.toUpperCase()})`, {
        meta: { scope, format: fmt, rows: sumRows(b) },
      });
      toast.success("تم التصدير", { description: `${SCOPE_LABEL[scope]} — ${sumRows(b)} سجل` });
    } catch (e: any) {
      captureApplicationError(e, "backup", { scope, fmt });
      toast.error("فشل التصدير", { description: e.message });
    } finally { setBusy(null); }
  }

  async function onFile(f: File) {
    try {
      if (f.size > 100 * 1024 * 1024) {
        toast.error("النسخة أكبر من حد الاستيراد الآمن (100 MB)");
        return;
      }
      const text = await f.text();
      const raw = JSON.parse(text);
      const v = validateBundle(raw);
      if (!v.ok) { toast.error("ملف غير صالح", { description: v.error }); return; }
      setImportBundle(v.bundle);
      const p = await planImport(v.bundle);
      setPlan(p);
      setMode("merge");
      setConfirming(true);
    } catch (e: any) {
      toast.error("خطأ في القراءة", { description: e.message });
    }
  }

  async function doImport() {
    if (!importBundle) return;
    setRunning(true);
    try {
      const r = await importUserData(importBundle, { mode });
      const total = Object.values(r.inserted).reduce((s, n) => s + n, 0);
      createAuditEntry("restore", `استعادة بيانات (${SCOPE_LABEL[importBundle.meta.scope]}, وضع: ${mode})`, {
        meta: { scope: importBundle.meta.scope, mode, rows: total, errors: r.errors.length },
      });
      if (r.errors.length) {
        toast.warning("اكتمل مع أخطاء", { description: `${total} سجل — ${r.errors.length} خطأ` });
      } else {
        toast.success("تمت الاستعادة", { description: `${total} سجل` });
      }
      setConfirming(false);
      setImportBundle(null); setPlan(null);
    } catch (e: any) {
      captureApplicationError(e, "backup", { scope: importBundle?.meta.scope, mode });
      toast.error("فشل الاستيراد", { description: e.message });
    } finally { setRunning(false); }
  }

  return (
    <div className="space-y-5">
      {/* Export */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
            <Download className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">تصدير نسخة احتياطية</h3>
            <p className="text-xs text-muted-foreground mt-0.5">تنزيل يدوي غير مشفر — لا تشارك الملف لأنه قد يحتوي على بيانات مالية حساسة</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <div>
            <label className="text-xs text-muted-foreground mb-1.5 block">نطاق التصدير</label>
            <Select value={scope} onValueChange={(v: any) => setScope(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="full">نسخة كاملة (كل شيء)</SelectItem>
                <SelectItem value="financial">البيانات المالية</SelectItem>
                <SelectItem value="assets">الأصول فقط</SelectItem>
                <SelectItem value="reports">التقارير فقط</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-2 sm:grid-cols-3 mt-4">
          <Button variant="outline" onClick={() => doExport("json")} disabled={!!busy} className="justify-start">
            <FileJson className="h-4 w-4" /> JSON — نسخة كاملة
          </Button>
          <Button variant="outline" onClick={() => doExport("csv")} disabled={!!busy} className="justify-start">
            <FileText className="h-4 w-4" /> CSV — للتقارير
          </Button>
          <Button variant="outline" onClick={() => doExport("xlsx")} disabled={!!busy} className="justify-start">
            <FileSpreadsheet className="h-4 w-4" /> Excel — خارجي
          </Button>
        </div>

        {lastBundle && (
          <div className="mt-4 flex items-center gap-2 text-xs text-muted-foreground border-t pt-3">
            <HardDrive className="h-3.5 w-3.5" />
            {sessionExportAt ? "آخر تصدير في هذه الجلسة" : "نسخة غير مشفرة مخزنة سابقاً في المتصفح"}: {new Date(lastBundle.meta.exported_at).toLocaleString("ar")}
            <Badge variant="secondary" className="ms-auto">{sumRows(lastBundle)} سجل</Badge>
          </div>
        )}
        {legacyCacheFound && (
          <Button variant="outline" size="sm" className="mt-3 text-destructive"
            onClick={() => setConfirmClearLegacy(true)}>
            <ShieldAlert className="h-4 w-4" /> حذف النسخة المالية القديمة المخزنة في المتصفح
          </Button>
        )}
      </div>

      {/* Import */}
      <div className="rounded-2xl border bg-card p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-warning/10 text-warning">
            <Upload className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold">استعادة / استيراد</h3>
            <p className="text-xs text-muted-foreground mt-0.5">ارفع ملف JSON صادر من رصد لمعاينته قبل الاستعادة</p>
          </div>
        </div>

        <Alert className="mb-3">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription className="text-xs">
            سيتم عرض معاينة للتغييرات قبل تنفيذها. لن نستبدل أي بيانات دون تأكيدك.
          </AlertDescription>
        </Alert>

        <input
          ref={fileRef} type="file" accept="application/json" className="hidden"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) onFile(f); e.target.value = ""; }}
        />
        <Button onClick={() => fileRef.current?.click()} className="w-full sm:w-auto">
          <Upload className="h-4 w-4" /> اختيار ملف نسخة احتياطية
        </Button>
      </div>

      {/* Cloud placeholder */}
      <div className="rounded-2xl border bg-card p-5 opacity-70">
        <div className="flex items-center gap-3 mb-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-muted text-muted-foreground">
            <Cloud className="h-5 w-5" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold flex items-center gap-2">
              مزامنة سحابية <Badge variant="outline" className="text-[10px]">قريباً</Badge>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">مهيّأ للتكامل المستقبلي — غير مفعّل حالياً</p>
          </div>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">
          {CLOUD_PROVIDERS.map(p => (
            <Button key={p.id} variant="outline" size="sm" disabled className="justify-start">
              <Cloud className="h-3.5 w-3.5" /> {p.label}
            </Button>
          ))}
        </div>
      </div>

      <Dialog open={confirmClearLegacy} onOpenChange={open => { if (!clearingLegacy) setConfirmClearLegacy(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>حذف النسخة المحلية غير المشفرة</DialogTitle>
            <DialogDescription>
              سيتم إزالة النسخة المالية القديمة المخزنة داخل المتصفح فقط.
              لا يؤثر ذلك على سجلات حسابك أو الملفات التي نزّلتها سابقاً.
              احتفظ بملف مشفر منفصل إذا كنت تحتاج النسخة.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" disabled={clearingLegacy}
              onClick={() => setConfirmClearLegacy(false)}>إلغاء</Button>
            <Button variant="destructive" disabled={clearingLegacy}
              onClick={async () => {
                if (clearingLegacy) return;
                setClearingLegacy(true);
                try {
                  await clearLegacyPlaintextBackup();
                  setLegacyCacheFound(false);
                  if (!sessionExportAt) setLastBundle(null);
                  setConfirmClearLegacy(false);
                  toast.success("تم مسح النسخة القديمة المخزنة في المتصفح");
                } catch (error) {
                  toast.error("تعذر إتمام المسح", { description: error instanceof Error ? error.message : "خطأ غير معروف" });
                } finally { setClearingLegacy(false); }
              }}>حذف النسخة القديمة</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import preview dialog */}
      <Dialog open={confirming} onOpenChange={(v) => { if (!v) { setConfirming(false); setImportBundle(null); setPlan(null); } }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Database className="h-5 w-5" /> معاينة الاستيراد</DialogTitle>
            <DialogDescription>
              {importBundle && (
                <>نسخة: {SCOPE_LABEL[importBundle.meta.scope]} — بتاريخ {new Date(importBundle.meta.exported_at).toLocaleString("ar")}</>
              )}
            </DialogDescription>
          </DialogHeader>

          {plan && (
            <>
              <div className="rounded-xl border overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr><th className="text-start p-2">الجدول</th><th className="p-2">وارد</th><th className="p-2">موجود</th><th className="p-2">جديد</th><th className="p-2">تكرار</th></tr>
                  </thead>
                  <tbody>
                    {plan.entries.map(e => (
                      <tr key={e.table} className="border-t">
                        <td className="p-2 font-medium">{e.table}</td>
                        <td className="p-2 text-center tabular-nums">{e.incoming}</td>
                        <td className="p-2 text-center tabular-nums text-muted-foreground">{e.existing}</td>
                        <td className="p-2 text-center tabular-nums text-success">{e.new_rows}</td>
                        <td className="p-2 text-center">
                          {e.skipped_reason ? <Badge variant="outline" className="text-[10px]">{e.skipped_reason}</Badge>
                            : e.duplicates > 0 ? <span className="tabular-nums text-warning">{e.duplicates}</span> : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {plan.warnings.length > 0 && (
                <Alert variant="destructive"><AlertDescription className="text-xs">{plan.warnings.join(" · ")}</AlertDescription></Alert>
              )}

              <div>
                <label className="text-xs text-muted-foreground mb-1.5 block">وضع الاستيراد</label>
                <Select value={mode} onValueChange={(v: any) => setMode(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="preview">معاينة فقط — بدون تنفيذ</SelectItem>
                    <SelectItem value="merge">دمج — تحديث المتطابق وإضافة الجديد</SelectItem>
                    {/* Client-side v1 replace disabled: non-atomic multi-table DELETE. */}
                  </SelectContent>
                </Select>
                <Alert className="mt-2">
                  <ShieldAlert className="h-4 w-4" />
                  <AlertDescription className="text-xs">
                    تم إيقاف الاستبدال الكامل من ملفات v1 لأنه يستخدم عمليات غير ذرية وقد يسبب فقدان بيانات.
                    استخدم استعادة النسخ v2 بدلاً منه. وضع الدمج القديم قد يكتمل جزئياً،
                    لذا يُوصى بحفظ نسخة مشفرة قبل استخدامه.
                  </AlertDescription>
                </Alert>
              </div>
            </>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setConfirming(false)}>إلغاء</Button>
            <Button onClick={doImport} disabled={running || (mode !== "preview" && !plan?.valid)}>
              {running ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {mode === "preview" ? "إغلاق" : mode === "replace" ? "تأكيد الاستبدال" : "تنفيذ الدمج"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function sumRows(b: BackupBundle) {
  return Object.values(b.meta.counts).reduce((s, n) => s + n, 0);
}
