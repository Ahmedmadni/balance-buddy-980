import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import {
  Info,
  Hammer,
  FileDown,
  ExternalLink,
  MessageSquarePlus,
  Star,
  Bug,
  Lightbulb,
  HelpCircle,
} from "lucide-react";
import { toast } from "sonner";
import { APP_VERSION } from "@/lib/mobile/version";
import { getPlatform, isNative } from "@/lib/mobile/platform";
import { buildDiagnosticReport, downloadDiagnosticReport } from "@/lib/system/recovery";
import {
  submitBetaFeedback,
  loadBetaFeedback,
  FEEDBACK_TYPE_LABEL,
  type FeedbackType,
} from "@/lib/ux/feedback";
import { createAuditEntry } from "@/lib/system/audit";
import { captureApplicationError } from "@/lib/system/errors";
import { recordDialogOpened, recordDialogSaved } from "@/lib/beta/session";

const PLATFORM_LABEL: Record<ReturnType<typeof getPlatform>, string> = {
  android: "أندرويد",
  ios: "iOS",
  web: "ويب",
};

export function HelpSection() {
  const [exporting, setExporting] = useState(false);
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const feedbackCount = loadBetaFeedback().length;

  async function exportDiagnostics() {
    setExporting(true);
    try {
      const report = await buildDiagnosticReport();
      downloadDiagnosticReport(report);
      toast.success("تم تصدير تقرير التشخيص");
    } catch (e) {
      captureApplicationError(e, "runtime", { scope: "help_export_diagnostics" });
      toast.error("فشل التصدير");
    } finally {
      setExporting(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard icon={Info} label="إصدار التطبيق" value={APP_VERSION} />
        <InfoCard
          icon={Hammer}
          label="معلومات البناء"
          value={`${PLATFORM_LABEL[getPlatform()]}${isNative() ? " · تطبيق أصلي" : " · متصفح"}`}
        />
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        <ActionRow
          icon={FileDown}
          title="تصدير تقرير تشخيصي"
          desc="ملف JSON يشمل الصحة وسلامة البيانات والأداء"
          busy={exporting}
          onClick={exportDiagnostics}
          buttonLabel="تصدير"
        />
        <ActionRow
          icon={ExternalLink}
          title="فتح لوحة تشخيص النظام"
          desc="الصحة، الأداء، سلامة البيانات، الإعلانات، الجهاز"
          buttonLabel="فتح"
          asLink="/app/system"
        />
        <ActionRow
          icon={MessageSquarePlus}
          title="إرسال ملاحظة"
          desc={
            feedbackCount > 0
              ? `${feedbackCount} ملاحظة محفوظة محلياً على هذا الجهاز`
              : "بلاغ خطأ، اقتراح، سؤال، أو تقييم"
          }
          buttonLabel="إرسال"
          onClick={() => setFeedbackOpen(true)}
        />
      </div>

      <div className="rounded-2xl border bg-amber-50/40 dark:bg-amber-950/10 p-3 text-[11px] text-amber-800 dark:text-amber-200 flex gap-2">
        <HelpCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          الملاحظات تُحفظ على جهازك فقط ولا تُرسَل لأي خادم — استخدم "تصدير تقرير تشخيصي" لمشاركتها
          يدوياً إن احتجت.
        </span>
      </div>

      <FeedbackDialog open={feedbackOpen} onOpenChange={setFeedbackOpen} />
    </div>
  );
}

function InfoCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl border bg-card p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-sm font-bold">{value}</div>
    </div>
  );
}

function ActionRow({
  icon: Icon,
  title,
  desc,
  buttonLabel,
  busy,
  onClick,
  asLink,
}: {
  icon: any;
  title: string;
  desc: string;
  buttonLabel: string;
  busy?: boolean;
  onClick?: () => void;
  asLink?: string;
}) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-card p-3.5">
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{desc}</div>
      </div>
      {asLink ? (
        <Button asChild size="sm" variant="outline">
          <Link to={asLink}>{buttonLabel}</Link>
        </Button>
      ) : (
        <Button size="sm" variant="outline" disabled={busy} onClick={onClick}>
          {busy ? "..." : buttonLabel}
        </Button>
      )}
    </div>
  );
}

const TYPE_ICON: Record<FeedbackType, any> = {
  bug: Bug,
  suggestion: Lightbulb,
  question: HelpCircle,
  rating: Star,
};

function FeedbackDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [type, setType] = useState<FeedbackType>("suggestion");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState(5);

  useEffect(() => {
    if (open) recordDialogOpened("beta_feedback");
  }, [open]);

  function submit() {
    if (!message.trim() && type !== "rating") {
      toast.error("اكتب رسالة أولاً");
      return;
    }
    submitBetaFeedback(type, message.trim(), { rating: type === "rating" ? rating : undefined });
    createAuditEntry("export", `إرسال ملاحظة تجريبية (${FEEDBACK_TYPE_LABEL[type]})`);
    recordDialogSaved("beta_feedback");
    toast.success("شكراً — تم حفظ ملاحظتك محلياً");
    setMessage("");
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageSquarePlus className="h-5 w-5" /> إرسال ملاحظة
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">النوع</Label>
            <Select value={type} onValueChange={(v: FeedbackType) => setType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(FEEDBACK_TYPE_LABEL) as FeedbackType[]).map((t) => {
                  const Icon = TYPE_ICON[t];
                  return (
                    <SelectItem key={t} value={t}>
                      <span className="flex items-center gap-2">
                        <Icon className="h-3.5 w-3.5" /> {FEEDBACK_TYPE_LABEL[t]}
                      </span>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
          {type === "rating" && (
            <div>
              <Label className="text-xs">التقييم (1-5)</Label>
              <div className="flex gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(n)}
                    aria-label={`${n} نجوم`}
                  >
                    <Star
                      className={`h-6 w-6 ${n <= rating ? "fill-warning text-warning" : "text-muted-foreground"}`}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}
          <div>
            <Label className="text-xs">{type === "rating" ? "تعليق (اختياري)" : "الرسالة"}</Label>
            <Textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              rows={4}
              placeholder="اكتب هنا..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button onClick={submit}>إرسال</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
