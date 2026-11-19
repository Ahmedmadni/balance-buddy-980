/**
 * Historical v1 archive inspector. No destructive SQL actions and no new
 * plaintext financial backups: new backups/restores must use v2 above.
 */
import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileWarning, FileSearch, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { inspectLegacyBackup, type LegacyInspection } from "@/lib/backup/legacy-inspection";
import { clearLastBackup } from "@/lib/backup/engine";

const SCOPE_LABEL: Record<LegacyInspection["scope"], string> = {
  full: "نسخة قديمة كاملة", financial: "البيانات المالية",
  assets: "الأصول", reports: "التقارير",
};

export function BackupRestoreSection() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [inspection, setInspection] = useState<LegacyInspection | null>(null);
  const [clearOpen, setClearOpen] = useState(false);
  const [clearing, setClearing] = useState(false);

  async function inspectFile(file: File) {
    setInspection(null);
    if (!/\.json$/i.test(file.name) || file.size > 50 * 1024 * 1024) {
      toast.error("اختر ملف JSON لا يتجاوز 50 ميجابايت");
      return;
    }
    try {
      const parsed: unknown = JSON.parse(await file.text());
      const summary = inspectLegacyBackup(parsed);
      if (!summary) {
        toast.error("هذا الملف ليس أرشيف رصد v1 صالحًا للمعاينة");
        return;
      }
      setInspection(summary);
    } catch {
      toast.error("تعذرت قراءة الأرشيف القديم");
    }
  }

  async function removeLocalCopy() {
    if (clearing) return;
    setClearing(true);
    try {
      await clearLastBackup();
      toast.success("تم مسح النسخة القديمة المخزنة محليًا داخل التطبيق");
      setClearOpen(false);
    } catch {
      toast.warning("تعذر التأكد من مسح جميع النسخ المحلية القديمة", {
        description: "تحقق من مساحة تخزين التطبيق وأعد المحاولة؛ لم تتغير بيانات حسابك على الخادم.",
      });
    } finally {
      setClearing(false);
    }
  }

  return (
    <section className="rounded-2xl border bg-card p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2 font-semibold text-sm">
        <FileWarning aria-hidden="true" className="h-4 w-4 text-amber-600" />
        أرشيف النسخ القديمة v1 — معاينة فقط
      </div>
      <Alert>
        <FileWarning className="h-4 w-4" />
        <AlertDescription className="text-xs leading-relaxed">
          لم تعد أداة v1 تسمح بإنشاء نسخ غير مشفرة أو استعادتها، لأن الاستعادة
          القديمة قد تنجح جزئيًا وتترك بيانات غير مكتملة. استخدم v2 المشفر أعلاه
          للنسخ الجديدة والاستعادة. يمكنك فقط فحص عدد السجلات في ملفات v1 السابقة
          دون تحميل أي بيانات منها إلى قاعدة الحساب.
        </AlertDescription>
      </Alert>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={() => inputRef.current?.click()}>
          <FileSearch aria-hidden="true" className="h-4 w-4" />
          فحص ملف v1 سابق
        </Button>
        <Button variant="outline" size="sm" onClick={() => setClearOpen(true)}>
          <Trash2 aria-hidden="true" className="h-4 w-4" />
          مسح النسخة المحلية القديمة
        </Button>
      </div>
      <input
        ref={inputRef} type="file" accept="application/json,.json"
        className="hidden"
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void inspectFile(file);
          event.target.value = "";
        }}
      />
      {inspection && (
        <div className="space-y-1 rounded-xl border p-3 text-xs" role="status">
          <p className="font-semibold">فحص أرشيف: {SCOPE_LABEL[inspection.scope]}</p>
          <p>تاريخ النسخة: {new Date(inspection.exportedAt).toLocaleString("ar-SA")}</p>
          <p>الجداول: {inspection.tables} — السجلات: {inspection.records}</p>
          {inspection.warnings.length > 0 && (
            <p className="text-destructive">
              يوجد اختلاف في محتويات الملف: {inspection.warnings.join("، ")}
            </p>
          )}
          <p className="text-muted-foreground">
            هذه معاينة فقط ولا تؤكد قابلية الاستعادة. لم يتم تعديل أي سجل مالي.
          </p>
        </div>
      )}
      <p className="text-xs text-muted-foreground">
        المسح المحلي يزيل النسخة المؤقتة المخزنة داخل التطبيق فقط، ولا يحذف أي
        ملفات سبق حفظها في «التنزيلات» أو Drive، ولا يغيّر قاعدة البيانات المالية.
      </p>
      <Dialog open={clearOpen} onOpenChange={(open) => { if (!clearing) setClearOpen(open); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>مسح التخزين المحلي القديم؟</DialogTitle>
            <DialogDescription>
              سيتم حذف أي نسخة v1 محفوظة داخل متصفح التطبيق أو التخزين المحلي.
              لن تُمس بياناتك المالية الموجودة على الخادم أو ملفاتك الخارجية.
              لا تُجرِ هذا المسح إذا كان هذا هو الملف الوحيد المتبقي لديك.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setClearOpen(false)} disabled={clearing}>إلغاء</Button>
            <Button variant="destructive" onClick={() => void removeLocalCopy()} disabled={clearing}>
              {clearing ? "جارٍ المسح..." : "تأكيد المسح المحلي"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
