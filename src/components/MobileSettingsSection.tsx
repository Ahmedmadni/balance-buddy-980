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
} from "lucide-react";
import { getPlatform, isNative } from "@/lib/mobile/platform";
import { APP_VERSION } from "@/lib/mobile/version";
import { createDeviceProviders, type PermissionStatus } from "@/lib/mobile/providers";
import { auditMobileCompatibility } from "@/lib/mobile/compatibility";

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

  useEffect(() => {
    providers.storage.getUsage().then(setStorage);
    providers.notifications.getPermissionStatus().then(setNotifPermission);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            ? "الملفات المُصدَّرة (نسخ احتياطية، تقارير) تُحفظ في مجلد التنزيلات الافتراضي للجهاز — لا يوجد مسار مخصص من داخل التطبيق حالياً."
            : "الملفات المُصدَّرة تُحفظ في مجلد التنزيلات الافتراضي للمتصفح، حسب إعدادات نظامك."}
        </p>
      </div>

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
