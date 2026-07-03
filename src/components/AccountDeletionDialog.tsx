import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { AlertTriangle, CheckCircle2, XCircle, Download, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  generateDeletionExecutionPlan,
  validateDeletionReadiness,
  exportDeletionPackage,
  downloadDeletionPackage,
  type DeletionExecutionPlan,
  type DeletionReadinessReport,
} from "@/lib/account-deletion/flow";
import { recordDialogOpened, recordDialogSaved } from "@/lib/beta/session";
import { captureApplicationError } from "@/lib/system/errors";

const CONFIRM_TEXT = "حذف حسابي";

function bytesToHuman(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

export function AccountDeletionDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [plan, setPlan] = useState<DeletionExecutionPlan | null>(null);
  const [readiness, setReadiness] = useState<DeletionReadinessReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [confirmInput, setConfirmInput] = useState("");

  useEffect(() => {
    if (!open) return;
    recordDialogOpened("account_deletion");
    setLoading(true);
    Promise.all([generateDeletionExecutionPlan(), validateDeletionReadiness()])
      .then(([p, r]) => {
        setPlan(p);
        setReadiness(r);
      })
      .catch((e) => captureApplicationError(e, "runtime", { scope: "account_deletion_dialog" }))
      .finally(() => setLoading(false));
  }, [open]);

  useEffect(() => {
    if (!open) setConfirmInput("");
  }, [open]);

  async function handleExportPackage() {
    setExporting(true);
    try {
      const pkg = await exportDeletionPackage();
      downloadDeletionPackage(pkg);
      toast.success("تم تصدير حزمة الحذف (نسخة احتياطية كاملة + خطة الحذف)");
    } catch (e) {
      captureApplicationError(e, "runtime", { scope: "account_deletion_export" });
      toast.error("فشل التصدير");
    } finally {
      setExporting(false);
    }
  }

  function handleAcknowledge() {
    recordDialogSaved("account_deletion");
    toast.info("لم يُنفَّذ أي حذف — هذه معاينة فقط. تواصل مع الدعم لطلب حذف حسابك فعلياً.");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <Trash2 className="h-5 w-5" /> حذف الحساب والبيانات
          </DialogTitle>
        </DialogHeader>

        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive flex gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>
            هذه معاينة فقط — <b>لا يوجد حذف فعلي</b> في هذا الإصدار من التطبيق. الحذف الحقيقي يحتاج
            صلاحية إدارية (service_role) على الخادم غير متاحة من هنا، ويجب طلبه عبر الدعم.
          </span>
        </div>

        {loading || !plan || !readiness ? (
          <div className="py-6 text-center text-sm text-muted-foreground">جارٍ تجهيز الخطة...</div>
        ) : (
          <div className="space-y-4">
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">ماذا سيتأثر</div>
              <div className="grid grid-cols-2 gap-2">
                <Stat label="جداول متأثرة" value={String(plan.tablesAffected)} />
                <Stat label="حجم متوقّع" value={bytesToHuman(plan.estimatedDataSizeBytes)} />
                <Stat label="زمن تقديري" value={`${plan.estimatedDurationSeconds} ثانية`} />
                <Stat label="خطوات" value={String(plan.steps.length)} />
              </div>
            </div>

            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">خطوات الخطة</div>
              <ol className="space-y-1.5">
                {plan.steps.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-start gap-2 rounded-xl border bg-card/50 p-2.5 text-xs"
                  >
                    <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                      {s.order}
                    </span>
                    <span>
                      <span className="font-semibold">{s.label}</span>
                      <span className="block text-muted-foreground mt-0.5">{s.detail}</span>
                    </span>
                  </li>
                ))}
              </ol>
            </div>

            {plan.nonDeletableFromClient.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-2">
                  بيانات لا يمكن حذفها من هنا
                </div>
                <ul className="space-y-1">
                  {plan.nonDeletableFromClient.map((d, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-2.5 text-xs"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" /> {d}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {plan.recoveryWarnings.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-2">
                  تحذيرات الاسترجاع
                </div>
                <ul className="space-y-1">
                  {plan.recoveryWarnings.map((w, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-2.5 text-xs"
                    >
                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" /> {w}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">جاهزية الحذف</div>
              <ul className="space-y-1">
                {readiness.checks.map((c) => (
                  <li
                    key={c.id}
                    className="flex items-start gap-2 rounded-xl border bg-card/50 p-2.5 text-xs"
                  >
                    {c.ready ? (
                      <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" />
                    )}
                    <span>
                      <span className="font-semibold">{c.label}:</span> {c.detail}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <Button
              variant="outline"
              className="w-full"
              disabled={exporting}
              onClick={handleExportPackage}
            >
              <Download className="h-4 w-4" />{" "}
              {exporting ? "جارٍ التصدير..." : "تصدير حزمة الحذف (نسخة احتياطية + الخطة)"}
            </Button>

            <div>
              <Label className="text-xs">
                اكتب "{CONFIRM_TEXT}" لتأكيد أنك اطّلعت على الخطة أعلاه (لا يُنفَّذ أي حذف فعلي)
              </Label>
              <Input
                value={confirmInput}
                onChange={(e) => setConfirmInput(e.target.value)}
                placeholder={CONFIRM_TEXT}
                className="mt-1"
                dir="rtl"
              />
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
          <Button
            variant="destructive"
            disabled={confirmInput.trim() !== CONFIRM_TEXT || loading}
            onClick={handleAcknowledge}
          >
            تأكيد الاطّلاع
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-muted/40 dark:bg-muted/20 p-2.5">
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm font-bold tabular-nums">{value}</div>
    </div>
  );
}
