import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { runSystemHealthCheck, type HealthStatus } from "@/lib/system/health";
import { validateFinancialIntegrity } from "@/lib/system/integrity";
import { collectPerformanceMetrics } from "@/lib/system/performance";
import { loadNotificationLog } from "@/lib/notifications/store";
import { loadNotificationSettings } from "@/lib/notifications/config";
import { getPlatform, isNative } from "@/lib/mobile/platform";
import { auditMobileCompatibility, checkOfflineCapabilities } from "@/lib/mobile/compatibility";
import { cn } from "@/lib/utils";
import {
  ShieldCheck,
  AlertTriangle,
  XCircle,
  CheckCircle2,
  Database,
  Wallet as WalletIcon,
  Package,
  Bell,
  Gauge,
  HardDrive,
  Cpu,
  Bug,
  Lightbulb,
  RefreshCw,
  Smartphone,
  WifiOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/_authenticated/app/system")({
  head: () => ({ meta: [{ title: "تشخيص النظام — رصد" }] }),
  component: SystemPage,
});

function STATUS_ICON(status: HealthStatus) {
  if (status === "ok") return <CheckCircle2 className="h-4 w-4 text-success" />;
  if (status === "warning") return <AlertTriangle className="h-4 w-4 text-warning" />;
  return <XCircle className="h-4 w-4 text-destructive" />;
}
const STATUS_TONE: Record<HealthStatus, string> = {
  ok: "border-success/30 bg-success/5",
  warning: "border-warning/30 bg-warning/5",
  error: "border-destructive/30 bg-destructive/5",
};

function bytesToHuman(b: number | null | undefined): string {
  if (b === null || b === undefined) return "—";
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / (1024 * 1024)).toFixed(2)} MB`;
}

const PLATFORM_LABEL: Record<ReturnType<typeof getPlatform>, string> = {
  android: "أندرويد",
  ios: "iOS",
  web: "ويب",
};

function detectOsLabel(): string {
  if (typeof navigator === "undefined") return "—";
  const ua = navigator.userAgent || "";
  if (/android/i.test(ua)) return "Android";
  if (/iphone|ipad|ipod/i.test(ua)) return "iOS";
  if (/windows/i.test(ua)) return "Windows";
  if (/mac os/i.test(ua)) return "macOS";
  if (/linux/i.test(ua)) return "Linux";
  return "غير معروف";
}

function memoryEstimate(): string {
  const mem = (performance as unknown as { memory?: { usedJSHeapSize: number; jsHeapSizeLimit: number } }).memory;
  if (!mem) return "غير متاح في هذا المتصفح/WebView";
  return `${bytesToHuman(mem.usedJSHeapSize)} من ${bytesToHuman(mem.jsHeapSizeLimit)}`;
}

function SystemPage() {
  const qc = useQueryClient();

  const health = useQuery({ queryKey: ["system-health"], queryFn: runSystemHealthCheck });
  const integrity = useQuery({
    queryKey: ["system-integrity"],
    queryFn: validateFinancialIntegrity,
  });
  const perf = useQuery({ queryKey: ["system-performance"], queryFn: collectPerformanceMetrics });
  const offline = useQuery({
    queryKey: ["system-offline"],
    queryFn: () => checkOfflineCapabilities(qc.getQueryCache().getAll().length),
  });

  const mobileCompat = auditMobileCompatibility();
  const compatById = (id: string) => mobileCompat.items.find((i) => i.id === id);

  const notifSettings = loadNotificationSettings();
  const notifLog = loadNotificationLog();
  const failedNotifs = notifLog.filter((n) => n.status === "failed").length;

  const cachedQueries = qc.getQueryCache().getAll().length;

  const recommendations: string[] = [];
  if (health.data?.status === "error")
    recommendations.push(
      "يوجد خطأ حرج في الفحص الصحي — راجع قسم Health أدناه، ثم شغّل «Verify Database» من الإعدادات > النظام.",
    );
  if ((integrity.data?.errors.length ?? 0) > 0)
    recommendations.push(
      "توجد أخطاء سلامة بيانات مالية — راجع قسم Integrity قبل الاعتماد على الأرقام في التقارير.",
    );
  if (failedNotifs > 0)
    recommendations.push(`${failedNotifs} إشعار فشل إرساله — راجع مركز الإشعارات في صفحة الأحداث.`);
  if ((perf.data?.localStorageUsageBytes ?? 0) > 4 * 1024 * 1024)
    recommendations.push(
      "مساحة localStorage تقترب من الحد الشائع (5MB) — فكّر بتصدير نسخة احتياطية ومسح السجلات القديمة.",
    );
  if (recommendations.length === 0)
    recommendations.push("لا توجد توصيات حالياً — كل الفحوصات ضمن الحدود الطبيعية.");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[image:var(--gradient-primary)] text-white shadow-[var(--shadow-elegant)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">تشخيص النظام</h1>
            <p className="text-xs text-muted-foreground">
              لوحة Beta Diagnostics — قراءة فقط، لا تغيّر أي بيانات
            </p>
          </div>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/app/settings">أدوات الاستعادة (Settings)</Link>
        </Button>
      </div>

      {/* Health */}
      <Section title="الصحة العامة (Health)" icon={Database}>
        {health.isLoading ? (
          <SkeletonRows />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <HealthCard
              icon={Database}
              label="قاعدة البيانات"
              status={health.data!.database.status}
              items={health.data!.database.items}
            />
            <HealthCard
              icon={WalletIcon}
              label="محرك العمليات المالية"
              status={health.data!.financialEngine.status}
              items={health.data!.financialEngine.items}
            />
            <HealthCard
              icon={Package}
              label="الأصول"
              status={health.data!.assets.status}
              items={health.data!.assets.items}
            />
            <HealthCard
              icon={Bell}
              label="الأحداث"
              status={health.data!.events.status}
              items={health.data!.events.items}
            />
            <HealthCard
              icon={Bell}
              label="الإشعارات"
              status={!notifSettings.enabled ? "warning" : failedNotifs > 0 ? "warning" : "ok"}
              items={[
                {
                  id: "n1",
                  label: "الحالة",
                  status: notifSettings.enabled ? "ok" : "warning",
                  detail: notifSettings.enabled ? "مفعّلة" : "معطّلة",
                },
                {
                  id: "n2",
                  label: "إشعارات فاشلة",
                  status: failedNotifs > 0 ? "warning" : "ok",
                  detail: `${failedNotifs} من ${notifLog.length}`,
                },
              ]}
            />
          </div>
        )}
      </Section>

      {/* Performance */}
      <Section title="الأداء (Performance)" icon={Gauge}>
        {perf.isLoading ? (
          <SkeletonRows />
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard icon={Cpu} label="استعلامات مخزّنة (Cache)" value={String(cachedQueries)} />
            <MetricCard
              icon={HardDrive}
              label="مساحة localStorage"
              value={bytesToHuman(perf.data!.localStorageUsageBytes)}
            />
            <MetricCard
              icon={HardDrive}
              label="تقدير IndexedDB + ذاكرة مؤقتة"
              value={bytesToHuman(perf.data!.storageEstimate.usageBytes)}
            />
            <MetricCard
              icon={HardDrive}
              label="حجم آخر نسخة احتياطية"
              value={bytesToHuman(perf.data!.lastBackupSizeBytes)}
            />
            <MetricCard
              icon={Bell}
              label="عدد الإشعارات المسجّلة"
              value={String(perf.data!.notificationCount)}
            />
            <MetricCard
              icon={Bell}
              label="عدد الأحداث القادمة"
              value={String(perf.data!.eventCount)}
            />
            {perf.data!.queryDurations.map((q) => (
              <MetricCard
                key={q.label}
                icon={Gauge}
                label={`مدة ${q.label}`}
                value={`${q.ms.toFixed(0)} ms`}
              />
            ))}
          </div>
        )}
      </Section>

      {/* Mobile Diagnostics */}
      <Section title="تشخيص الجهاز (Mobile Diagnostics)" icon={Smartphone}>
        <div className="grid gap-4 lg:grid-cols-2">
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">الجهاز</div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <MetricCard icon={Smartphone} label="المنصة" value={`${PLATFORM_LABEL[mobileCompat.platform]}${mobileCompat.isNative ? " (أصلي)" : ""}`} />
              <MetricCard icon={Smartphone} label="نظام التشغيل" value={detectOsLabel()} />
              <MetricCard icon={Smartphone} label="بيئة التشغيل" value={isNative() ? "Capacitor WebView" : "متصفح ويب"} />
              <MetricCard icon={HardDrive} label="التخزين (IndexedDB وذاكرة مؤقتة)" value={bytesToHuman(perf.data?.storageEstimate.usageBytes)} />
              <MetricCard icon={Cpu} label="تقدير الذاكرة (JS Heap)" value={memoryEstimate()} />
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">ميزات الجهاز (Mobile Features)</div>
            <ul className="space-y-1.5">
              {[
                { id: "notifications", label: "الإشعارات" },
                { id: "file_export", label: "نظام الملفات (تصدير/استيراد)" },
                { id: "share", label: "المشاركة (Share API)" },
                { id: "deep_links", label: "الروابط العميقة (Deep Links)" },
              ].map((f) => {
                const item = compatById(f.id);
                return (
                  <li key={f.id} className="flex items-center justify-between gap-2 rounded-xl border bg-card/50 p-2.5 text-xs">
                    <span>{f.label}</span>
                    <span className={cn("flex items-center gap-1.5 font-medium", item?.supported ? "text-success" : "text-muted-foreground")}>
                      {item?.supported ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
                      {item?.detail ?? "—"}
                    </span>
                  </li>
                );
              })}
              <li className="flex items-center justify-between gap-2 rounded-xl border bg-card/50 p-2.5 text-xs">
                <span className="flex items-center gap-1.5"><WifiOff className="h-3.5 w-3.5" /> وضع عدم الاتصال (Offline)</span>
                <span className={cn("flex items-center gap-1.5 font-medium", offline.data?.ready ? "text-success" : "text-warning")}>
                  {offline.data?.ready ? <CheckCircle2 className="h-3.5 w-3.5" /> : <AlertTriangle className="h-3.5 w-3.5" />}
                  {offline.isLoading ? "جارٍ التحقق..." : offline.data?.ready ? "جاهز (توجد نسخة احتياطية محلية)" : "لا توجد نسخة احتياطية محلية بعد"}
                </span>
              </li>
            </ul>
          </div>
        </div>
      </Section>

      {/* Integrity */}
      <Section title="سلامة البيانات (Integrity)" icon={Bug}>
        {integrity.isLoading ? (
          <SkeletonRows />
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold">
              {integrity.data!.valid ? (
                <CheckCircle2 className="h-4 w-4 text-success" />
              ) : (
                <XCircle className="h-4 w-4 text-destructive" />
              )}
              {integrity.data!.valid
                ? "لا توجد أخطاء سلامة بيانات"
                : `${integrity.data!.errors.length} خطأ`}
              {integrity.data!.warnings.length > 0 && (
                <span className="text-warning font-normal">
                  · {integrity.data!.warnings.length} تحذير
                </span>
              )}
            </div>
            {integrity.data!.errors.length > 0 && (
              <ul className="space-y-1">
                {integrity.data!.errors.map((e, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-2.5 text-xs"
                  >
                    <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" /> {e}
                  </li>
                ))}
              </ul>
            )}
            {integrity.data!.warnings.length > 0 && (
              <ul className="space-y-1">
                {integrity.data!.warnings.map((w, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/5 p-2.5 text-xs"
                  >
                    <AlertTriangle className="h-3.5 w-3.5 text-warning shrink-0 mt-0.5" /> {w}
                  </li>
                ))}
              </ul>
            )}
            <div className="rounded-xl border bg-muted/30 p-3 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                <Lightbulb className="h-3.5 w-3.5" /> توصيات
              </div>
              {recommendations.map((r, i) => (
                <div key={i} className="text-xs text-muted-foreground">
                  • {r}
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            qc.invalidateQueries({ queryKey: ["system-health"] });
            qc.invalidateQueries({ queryKey: ["system-integrity"] });
            qc.invalidateQueries({ queryKey: ["system-performance"] });
            qc.invalidateQueries({ queryKey: ["system-offline"] });
          }}
        >
          <RefreshCw className="h-4 w-4 ml-1" /> إعادة الفحص
        </Button>
      </div>
    </div>
  );
}

function Section({
  title,
  icon: Icon,
  children,
}: {
  title: string;
  icon: any;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-4 w-4 text-primary" />
        <h2 className="text-base font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function HealthCard({
  icon: Icon,
  label,
  status,
  items,
}: {
  icon: any;
  label: string;
  status: HealthStatus;
  items: { id: string; label: string; status: HealthStatus; detail: string }[];
}) {
  return (
    <div className={cn("rounded-2xl border p-3.5 space-y-2", STATUS_TONE[status])}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Icon className="h-4 w-4" /> {label}
        </div>
        {STATUS_ICON(status)}
      </div>
      <ul className="space-y-1">
        {items.map((it) => (
          <li key={it.id} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
            <span className="shrink-0 mt-0.5">{STATUS_ICON(it.status)}</span>
            <span>
              <span className="text-foreground/80">{it.label}:</span> {it.detail}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function MetricCard({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-muted/40 dark:bg-muted/20 p-3.5">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}

function SkeletonRows() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-28 animate-pulse rounded-2xl bg-muted" />
      ))}
    </div>
  );
}
