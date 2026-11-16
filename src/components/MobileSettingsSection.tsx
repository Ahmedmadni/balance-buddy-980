import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Smartphone,
  Tag,
  HardDrive,
  Bell,
  FolderDown,
  Stethoscope,
  ExternalLink,
  CheckCircle2, AlertTriangle, RefreshCw, Share2,
} from "lucide-react";
import { getPlatform, isNative } from "@/lib/mobile/platform";
import { APP_VERSION } from "@/lib/mobile/version";
import { createDeviceProviders, type PermissionStatus } from "@/lib/mobile/providers";
import { auditMobileCompatibility } from "@/lib/mobile/compatibility";
import { runAndroidSelfCheck, type NativeSelfCheckResult } from "@/lib/mobile/native-self-check";
import { exportFile } from "@/lib/mobile/share-export";
import { toast } from "sonner";

const PLATFORM_LABEL: Record<ReturnType<typeof getPlatform>, string> = {
  android: "أندرويد",
  ios: "iOS",
  web: "متصفح ويب",
};
const PERMISSION_LABEL: Record<PermissionStatus, string> = {
  granted: "مسموح",
  denied: "مرفوض",
  prompt: "لم يُطلب بعد",
  unsupported: "غير مدعوم",
};

function bytesToHuman(b: number | null): string {
  if (b === null) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

export function MobileSettingsSection() {
  const providers = createDeviceProviders();
  const native = isNative();
  const platform = getPlatform();

  const [storage, setStorage] = useState<{
    usedBytes: number | null;
    quotaBytes: number | null;
  } | null>(null);
  const [notifPermission, setNotifPermission] = useState<PermissionStatus | null>(null);
  const [checkingNative, setCheckingNative] = useState(false);
  const [testingShare, setTestingShare] = useState(false);
  const [nativeResult, setNativeResult] = useState<NativeSelfCheckResult | null>(null);

  useEffect(() => {
    providers.storage.getUsage().then(setStorage);
    providers.notifications.getPermissionStatus().then(setNotifPermission);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function checkNativeFeatures() {
    setCheckingNative(true);
    try {
      const result = await runAndroidSelfCheck();
      setNativeResult(result);
      if (result.checks.some((item) => item.status === "error")) {
        toast.warning("بعض وظائف Android تحتاج إصلاحا أو مراجعة");
      } else {
        toast.info("اكتمل الفحص المحلي؛ حفظ الملفات النهائي والإشعارات الفعلية يحتاجان تجربة على الهاتف");
      }
    } catch {
      toast.error("تعذر تشغيل الفحص المحلي على هذا الجهاز");
    } finally {
      setCheckingNative(false);
    }
  }

  async function tryNativeFileShare() {
    setTestingShare(true);
    try {
      const testText = "Rasd Android test file. No financial data.\\n";
      const outcome = await exportFile(
        new Blob([testText], { type: "text/plain;charset=utf-8" }),
        "rasd-android-device-check.txt",
      );
      toast.info(outcome === "share_sheet_opened"
        ? "اختر تطبيق الملفات أو Drive واحفظ الملف، ثم تحقق من وجوده خارج تطبيق رصد"
        : "بدأ تنزيل الملف التجريبي؛ تأكد من وجوده في جهازك");
    } catch {
      toast.error("فشل فتح مشاركة الملف التجريبي على Android");
    } finally {
      setTestingShare(false);
    }
  }

  const compat = auditMobileCompatibility();
  const unsupportedCount = compat.items.filter((i) => !i.supported).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <InfoCard
          icon={Smartphone}
          label="المنصة"
          value={`${PLATFORM_LABEL[platform]}${native ? " (تطبيق أصلي)" : ""}`}
        />
        <InfoCard icon={Tag} label="إصدار التطبيق" value={APP_VERSION} />
        <InfoCard
          icon={HardDrive}
          label="مساحة التخزين المستخدمة"
          value={
            storage
              ? `${bytesToHuman(storage.usedBytes)} من ${bytesToHuman(storage.quotaBytes)}`
              : "جارٍ الحساب..."
          }
        />
        <InfoCard
          icon={Bell}
          label="إذن الإشعارات"
          value={notifPermission ? PERMISSION_LABEL[notifPermission] : "جارٍ التحقق..."}
        />
      </div>

      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center gap-2 mb-1">
          <FolderDown className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-sm">مجلد التصدير</h3>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {native
            ? "يفتح رصد نافذة مشاركة Android عند التصدير. يجب اختيار تطبيق الملفات أو Drive وحفظ الملف بنفسك؛ النسخة المؤقتة داخل التطبيق ليست نسخة احتياطية دائمة."
            : "الملفات المُصدَّرة تُحفظ في مجلد التنزيلات الافتراضي للمتصفح، حسب إعدادات نظامك."}
        </p>
      </div>

      {native && (
        <div className="rounded-2xl border bg-card p-4 space-y-3">
          <div>
            <h3 className="font-semibold text-sm">فحص وظائف Android الفعلية</h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              يفحص ملفًا مؤقتًا، وإذن الإشعارات، وتسجيل إضافات الطباعة والمشاركة. لا يصل إلى بياناتك المالية ولا يطلب أذونات جديدة.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="outline" disabled={checkingNative || testingShare} onClick={() => void checkNativeFeatures()}>
              <RefreshCw className={`h-4 w-4 ${checkingNative ? "animate-spin" : ""}`} />
              {checkingNative ? "جارٍ الفحص..." : "فحص وظائف الهاتف"}
            </Button>
            <Button size="sm" variant="outline" disabled={checkingNative || testingShare} onClick={() => void tryNativeFileShare()}>
              <Share2 className="h-4 w-4" />
              {testingShare ? "فتح المشاركة..." : "تجربة حفظ ملف"}
            </Button>
          </div>
          {nativeResult && (
            <div className="space-y-2" role="status" aria-live="polite">
              {nativeResult.checks.map((result) => (
                <div key={result.id} className="flex gap-2 rounded-xl border p-2.5">
                  {result.status === "ok"
                    ? <CheckCircle2 aria-hidden="true" className="h-4 w-4 shrink-0 text-emerald-600 mt-0.5" />
                    : <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />}
                  <div className="min-w-0">
                    <p className="text-xs font-semibold">{result.label}</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{result.details}</p>
                  </div>
                </div>
              ))}
              <p className="text-[11px] text-muted-foreground">
                نجاح الفحص لا يثبت وصول التنبيهات في الخلفية أو حفظ PDF أو اكتمال تسجيل Google. هذه تحتاج اختبارًا يدويًا مستقلًا.
              </p>
            </div>
          )}
        </div>
      )}

      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Stethoscope className="h-4 w-4 text-primary" />
            <div>
              <h3 className="font-semibold text-sm">تشخيص التوافق</h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {unsupportedCount === 0
                  ? "كل ميزات الجهاز مدعومة"
                  : `${unsupportedCount} ميزة غير مؤكدة على هذا الجهاز/المتصفح`}
                <Badge
                  variant={unsupportedCount === 0 ? "secondary" : "outline"}
                  className="ms-2 text-[10px]"
                >
                  {compat.items.length - unsupportedCount}/{compat.items.length}
                </Badge>
              </p>
            </div>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/system">
              تفاصيل التشخيص <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>
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
