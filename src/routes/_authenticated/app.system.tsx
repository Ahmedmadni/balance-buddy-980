import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { runSystemHealthCheck, type HealthStatus } from "@/lib/system/health";
import { validateFinancialIntegrity } from "@/lib/system/integrity";
import { collectPerformanceMetrics } from "@/lib/system/performance";
import { loadNotificationLog } from "@/lib/notifications/store";
import { loadNotificationSettings } from "@/lib/notifications/config";
import { getPlatform, isNative } from "@/lib/mobile/platform";
import { auditMobileCompatibility, checkOfflineCapabilities } from "@/lib/mobile/compatibility";
import { useAds } from "@/lib/ads/ad-context";
import { auditAdsConfiguration } from "@/lib/ads/audit";
import { evaluateAdVisibility } from "@/lib/ads/rules";
import { validatePremiumExperience } from "@/lib/ads/premium";
import { simulateAdRevenue, DEFAULT_REVENUE_ASSUMPTIONS, type RevenueSimulationInput } from "@/lib/ads/simulation";
import { AD_PLACEMENTS } from "@/lib/ads/placements";
import { calculateReleaseReadiness } from "@/lib/ux/readiness-score";
import { auditEmptyStates, type EmptyStateQuality } from "@/lib/ux/empty-states";
import { auditQuickActions } from "@/lib/ux/quick-actions";
import { auditAccessibility } from "@/lib/ux/accessibility";
import { auditResponsiveLayouts } from "@/lib/ux/responsive";
import { getContextualHints } from "@/lib/ux/hints";
import { getBetaUserChecklist } from "@/lib/beta/checklist";
import { auditFeatureCoverage, type FeatureCoverageStatus } from "@/lib/beta/feature-coverage";
import { detectUserFriction } from "@/lib/beta/friction";
import { calculateBetaHealth } from "@/lib/beta/health-score";
import { detectReleaseBlockers } from "@/lib/beta/release-blockers";
import { BetaFeedbackDashboard } from "@/components/BetaFeedbackDashboard";
import { auditAppMetadata } from "@/lib/release/metadata-audit";
import { auditAndroidRelease } from "@/lib/release/android-audit";
import { auditIOSRelease } from "@/lib/release/ios-audit";
import { auditPWA } from "@/lib/release/pwa-audit";
import { generateStoreAssetsChecklist, type StoreAssetStatus } from "@/lib/release/store-assets";
import { auditCompliance } from "@/lib/release/compliance-audit";
import { auditProductionEnvironment } from "@/lib/release/production-audit";
import { generateLaunchChecklist } from "@/lib/release/launch-checklist";
import { generatePrivacyPolicy } from "@/lib/compliance/privacy-policy";
import { generateTermsOfService } from "@/lib/compliance/terms-of-service";
import { auditUserDataExport } from "@/lib/compliance/data-export-audit";
import { generateDeletionPlan } from "@/lib/compliance/data-deletion-plan";
import { auditConsentReadiness } from "@/lib/compliance/consent-readiness";
import { auditProductionConfig } from "@/lib/compliance/production-config-audit";
import { auditDisasterRecovery } from "@/lib/compliance/disaster-recovery-audit";
import { formatMoney } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
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
  Megaphone,
  Coins,
  Award,
  LayoutGrid,
  Monitor,
  FlaskConical,
  ListChecks,
  MessageSquareWarning,
  ShieldAlert,
  MousePointerClick,
  Rocket,
  Apple,
  Globe,
  Scale,
  Server,
  Image,
  FileText,
  Trash2,
  UserCheck,
  Settings2,
  LifeBuoy,
  Download,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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

function downloadText(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
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

  const { prefs: adPrefs, platform: adPlatform } = useAds();
  const adsAudit = auditAdsConfiguration();
  const premiumCheck = validatePremiumExperience(adPrefs);
  const placementVisibility = AD_PLACEMENTS.map((p) => ({
    def: p,
    visibility: evaluateAdVisibility({ placement: p.id, prefs: adPrefs, platform: adPlatform }),
  }));
  const enabledPlacements = placementVisibility.filter((p) => p.visibility.visible && p.visibility.reason === "eligible");
  const previewPlacements = placementVisibility.filter((p) => p.visibility.visible && p.visibility.reason === "placeholder_preview");
  const hiddenPlacements = placementVisibility.filter((p) => !p.visibility.visible);

  const [revenueInput, setRevenueInput] = useState<RevenueSimulationInput>(DEFAULT_REVENUE_ASSUMPTIONS);
  const revenue = simulateAdRevenue(revenueInput);

  const notifSettings = loadNotificationSettings();
  const notifLog = loadNotificationLog();
  const failedNotifs = notifLog.filter((n) => n.status === "failed").length;

  const cachedQueries = qc.getQueryCache().getAll().length;

  const readiness = useQuery({ queryKey: ["ux-readiness"], queryFn: calculateReleaseReadiness });
  const hints = useQuery({ queryKey: ["ux-hints"], queryFn: getContextualHints });
  const emptyStates = auditEmptyStates();
  const quickActions = auditQuickActions();
  const a11y = auditAccessibility();
  const responsive = auditResponsiveLayouts();

  const betaChecklist = useQuery({ queryKey: ["beta-checklist"], queryFn: getBetaUserChecklist });
  const featureCoverage = useQuery({ queryKey: ["beta-coverage"], queryFn: auditFeatureCoverage });
  const betaHealth = useQuery({ queryKey: ["beta-health"], queryFn: calculateBetaHealth });
  const releaseBlockers = useQuery({ queryKey: ["beta-blockers"], queryFn: detectReleaseBlockers });
  const friction = detectUserFriction();

  const metadataAudit = auditAppMetadata();
  const androidAudit = auditAndroidRelease();
  const iosAudit = auditIOSRelease();
  const pwaAudit = useQuery({ queryKey: ["release-pwa"], queryFn: auditPWA });
  const storeAssets = generateStoreAssetsChecklist();
  const complianceAudit = useQuery({ queryKey: ["release-compliance"], queryFn: auditCompliance });
  const prodEnvAudit = useQuery({ queryKey: ["release-prod-env"], queryFn: auditProductionEnvironment });
  const launchChecklist = useQuery({ queryKey: ["release-launch"], queryFn: generateLaunchChecklist });

  const privacyPolicy = generatePrivacyPolicy();
  const termsOfService = generateTermsOfService();
  const dataExportAudit = auditUserDataExport();
  const deletionPlan = useQuery({ queryKey: ["compliance-deletion-plan"], queryFn: generateDeletionPlan });
  const consentReadiness = useQuery({ queryKey: ["compliance-consent"], queryFn: auditConsentReadiness });
  const productionConfig = useQuery({ queryKey: ["compliance-prod-config"], queryFn: auditProductionConfig });
  const disasterRecovery = useQuery({ queryKey: ["compliance-disaster-recovery"], queryFn: auditDisasterRecovery });
  const [legalDoc, setLegalDoc] = useState<"privacy" | "terms" | null>(null);

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

      {/* Release Readiness */}
      <Section title="جاهزية الإطلاق التجريبي (Release Readiness)" icon={Award}>
        {readiness.isLoading ? (
          <SkeletonRows />
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-4 rounded-2xl border bg-muted/30 p-4">
              <div className="text-4xl font-black tabular-nums text-primary">
                {readiness.data!.totalScore}
              </div>
              <div>
                <div className="text-sm font-bold">RC Score: {readiness.data!.totalScore}/100</div>
                <div className="text-xs text-muted-foreground">{readiness.data!.label}</div>
              </div>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              {readiness.data!.categories.map((c) => (
                <div key={c.id} className="rounded-2xl border bg-card p-3.5 space-y-1.5">
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>{c.label}</span>
                    <span className="tabular-nums text-muted-foreground">{c.score}/100</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div className="h-full bg-primary" style={{ width: `${c.score}%` }} />
                  </div>
                  <div className="text-[10px] text-muted-foreground">{c.detail}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </Section>

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

      {/* Ads */}
      <Section title="حالة الإعلانات (Ads Status)" icon={Megaphone}>
        <div className="space-y-5">
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">الحالة العامة</div>
            <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              <MetricCard icon={Megaphone} label="AdSense (Web) جاهز" value={adsAudit.web.configured ? "نعم" : "لا — placeholder"} />
              <MetricCard icon={Smartphone} label="AdMob (Android) جاهز" value={adsAudit.android.configured ? "نعم" : "لا — placeholder"} />
              <MetricCard icon={Smartphone} label="AdMob (iOS) جاهز" value={adsAudit.ios.configured ? "نعم" : "لا — placeholder"} />
              <MetricCard icon={Bug} label="وضع الاختبار (Test Mode)" value={adPrefs.testMode ? "مفعّل" : "معطّل"} />
              <MetricCard icon={ShieldCheck} label="وضع Premium" value={adPrefs.premium ? "مفعّل" : "معطّل"} />
            </div>
            {!premiumCheck.valid && adPrefs.premium && (
              <div className="mt-2 flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-2.5 text-xs">
                <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                مستخدم Premium لكن فحص تجربة Premium لم يمرّ بالكامل — راجع validatePremiumExperience().
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              الأماكن الإعلانية ({AD_PLACEMENTS.length}) — على منصة {adPlatform}
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <MetricCard icon={CheckCircle2} label="مفعّلة (Enabled)" value={String(enabledPlacements.length)} />
              <MetricCard icon={AlertTriangle} label="معاينة فقط (Disabled)" value={String(previewPlacements.length)} />
              <MetricCard icon={XCircle} label="مخفية (Hidden)" value={String(hiddenPlacements.length)} />
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              محاكاة الإيرادات (Simulation) — تقدير افتراضي، لا اتصال بأي خدمة خارجية
            </div>
            <div className="grid gap-2.5 sm:grid-cols-4 mb-3">
              <div>
                <Label className="text-[11px]">مستخدمون نشطون يومياً</Label>
                <Input type="number" min={0} value={revenueInput.dailyActiveUsers} onChange={(e) => setRevenueInput((r) => ({ ...r, dailyActiveUsers: Math.max(0, Number(e.target.value) || 0) }))} className="h-8" dir="ltr" />
              </div>
              <div>
                <Label className="text-[11px]">ظهور/مستخدم/يوم</Label>
                <Input type="number" min={0} value={revenueInput.impressionsPerUserPerDay} onChange={(e) => setRevenueInput((r) => ({ ...r, impressionsPerUserPerDay: Math.max(0, Number(e.target.value) || 0) }))} className="h-8" dir="ltr" />
              </div>
              <div>
                <Label className="text-[11px]">CTR (%)</Label>
                <Input type="number" min={0} step={0.1} value={revenueInput.ctr * 100} onChange={(e) => setRevenueInput((r) => ({ ...r, ctr: Math.max(0, Number(e.target.value) || 0) / 100 }))} className="h-8" dir="ltr" />
              </div>
              <div>
                <Label className="text-[11px]">eCPM ($)</Label>
                <Input type="number" min={0} step={0.1} value={revenueInput.eCPM} onChange={(e) => setRevenueInput((r) => ({ ...r, eCPM: Math.max(0, Number(e.target.value) || 0) }))} className="h-8" dir="ltr" />
              </div>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <MetricCard icon={Gauge} label="ظهور يومي متوقع" value={revenue.dailyImpressions.toLocaleString("ar")} />
              <MetricCard icon={Coins} label="إيراد يومي تقديري" value={formatMoney(revenue.estimatedDailyRevenue, "USD")} />
              <MetricCard icon={Coins} label="إيراد شهري تقديري" value={formatMoney(revenue.estimatedMonthlyRevenue, "USD")} />
            </div>
          </div>
        </div>
      </Section>

      {/* UX & Accessibility */}
      <Section title="تجربة المستخدم وإمكانية الوصول (UX & Accessibility)" icon={LayoutGrid}>
        <div className="space-y-5">
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              الحالات الفارغة (Empty States) — {emptyStates.score}/100 · {emptyStates.completeCount}{" "}
              كاملة، {emptyStates.partialCount} جزئية، {emptyStates.missingCount} مفقودة
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {emptyStates.pages.map((p) => (
                <div key={p.id} className="rounded-xl border bg-card/50 p-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{p.label}</span>
                    <QualityBadge quality={p.quality} />
                  </div>
                  <div className="text-[11px] text-muted-foreground">{p.note}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              الإجراءات السريعة (Quick Actions ≤ ضغطتين) — {quickActions.score}/100
            </div>
            <ul className="space-y-1.5">
              {quickActions.actions.map((a) => (
                <li
                  key={a.id}
                  className="flex items-center justify-between gap-2 rounded-xl border bg-card/50 p-2.5 text-xs"
                >
                  <span>
                    {a.label} — <span className="text-muted-foreground">{a.path}</span>
                  </span>
                  <span
                    className={cn(
                      "flex items-center gap-1.5 font-medium shrink-0",
                      a.withinLimit ? "text-success" : "text-warning",
                    )}
                  >
                    {a.withinLimit ? (
                      <CheckCircle2 className="h-3.5 w-3.5" />
                    ) : (
                      <AlertTriangle className="h-3.5 w-3.5" />
                    )}
                    {a.taps} ضغطات
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              إمكانية الوصول (Accessibility) — {a11y.score}/100
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {a11y.items.map((it) => (
                <div
                  key={it.id}
                  className={cn(
                    "rounded-xl border p-2.5 text-xs space-y-1",
                    it.status === "ok"
                      ? "border-success/30 bg-success/5"
                      : it.status === "warning"
                        ? "border-warning/30 bg-warning/5"
                        : "border-destructive/30 bg-destructive/5",
                  )}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{it.label}</span>
                    {STATUS_ICON(it.status)}
                  </div>
                  <div className="text-[11px] text-muted-foreground">{it.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              التجاوب (Responsive) — {responsive.score}/100
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <MetricCard
                icon={Monitor}
                label="حجم الشاشة الحالي"
                value={`${responsive.currentViewport.width}×${responsive.currentViewport.height} (${responsive.currentViewport.category})`}
              />
              <MetricCard
                icon={CheckCircle2}
                label="Viewport Meta (foldables/notch)"
                value={responsive.viewportMetaOk ? "صحيح" : "ناقص"}
              />
              <MetricCard
                icon={LayoutGrid}
                label="استخدام Breakpoints"
                value={responsive.breakpointUsage.map((b) => `${b.prefix}:${b.fileCount}`).join(" · ")}
              />
            </div>
          </div>

          {hints.data && hints.data.length > 0 && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">
                تلميحات سياقية نشطة الآن (Contextual Hints)
              </div>
              <ul className="space-y-1.5">
                {hints.data.map((h) => (
                  <li
                    key={h.id}
                    className="flex items-start gap-2 rounded-xl border bg-card/50 p-2.5 text-xs"
                  >
                    <Lightbulb className="h-3.5 w-3.5 text-primary shrink-0 mt-0.5" />
                    <span>
                      <span className="font-semibold">{h.title}:</span> {h.description}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </Section>

      {/* Beta Operations */}
      <Section title="عمليات الاختبار المغلق (Beta Operations)" icon={FlaskConical}>
        <div className="space-y-5">
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <ListChecks className="h-3.5 w-3.5" /> إتمام قائمة المختبر (Beta Completion) —{" "}
              {betaChecklist.data ? `${betaChecklist.data.completionPercent}%` : "..."}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {betaChecklist.data?.items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "flex items-center justify-between gap-2 rounded-xl border p-2.5 text-xs",
                    item.done ? "border-success/30 bg-success/5" : "border-border bg-card/50",
                  )}
                >
                  <span>{item.label}</span>
                  {item.done ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0" />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              تغطية الميزات (Feature Coverage)
              {featureCoverage.data
                ? ` — ${featureCoverage.data.coveredCount} مغطاة، ${featureCoverage.data.untestedCount} غير مختبرة، ${featureCoverage.data.neverUsedCount} لم تُستخدم`
                : ""}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
              {featureCoverage.data?.items.map((item) => (
                <div key={item.id} className="rounded-xl border bg-card/50 p-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{item.label}</span>
                    <CoverageBadge status={item.status} />
                  </div>
                  <div className="text-[11px] text-muted-foreground">{item.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">صحة Beta (Beta Health Score)</div>
            {betaHealth.isLoading ? (
              <SkeletonRows />
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-4 rounded-2xl border bg-muted/30 p-4">
                  <div className="text-4xl font-black tabular-nums text-primary">
                    {betaHealth.data!.totalScore}
                  </div>
                  <div>
                    <div className="text-sm font-bold">
                      Beta Health Score: {betaHealth.data!.totalScore}/100
                    </div>
                    <div className="text-xs text-muted-foreground">{betaHealth.data!.label}</div>
                  </div>
                </div>
                <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                  {betaHealth.data!.categories.map((c) => (
                    <div key={c.id} className="rounded-2xl border bg-card p-3.5 space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-semibold">
                        <span>{c.label}</span>
                        <span className="tabular-nums text-muted-foreground">{c.score}/100</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                        <div className="h-full bg-primary" style={{ width: `${c.score}%` }} />
                      </div>
                      <div className="text-[10px] text-muted-foreground">{c.detail}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <ShieldAlert className="h-3.5 w-3.5" /> عوائق الإطلاق (Release Blockers)
              {releaseBlockers.data ? ` — ${releaseBlockers.data.blockingCount} عائق نشط` : ""}
            </div>
            <ul className="space-y-1.5">
              {releaseBlockers.data?.blockers.map((b) => (
                <li
                  key={b.id}
                  className={cn(
                    "flex items-start gap-2 rounded-xl border p-2.5 text-xs",
                    b.blocking ? "border-destructive/30 bg-destructive/5" : "border-success/30 bg-success/5",
                  )}
                >
                  {b.blocking ? (
                    <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 className="h-3.5 w-3.5 text-success shrink-0 mt-0.5" />
                  )}
                  <span>
                    <span className="font-semibold">{b.label}:</span> {b.detail}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              ملخص الملاحظات (Feedback Summary)
            </div>
            <BetaFeedbackDashboard />
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <MousePointerClick className="h-3.5 w-3.5" /> نقاط الاحتكاك (Friction Points) —{" "}
              {friction.signals.length} إشارة
            </div>
            {friction.signals.length === 0 ? (
              <div className="rounded-xl border border-dashed p-3 text-center text-xs text-muted-foreground">
                لا توجد إشارات احتكاك مسجَّلة بعد
              </div>
            ) : (
              <ul className="space-y-1.5">
                {friction.signals.map((s) => (
                  <li
                    key={s.id}
                    className={cn(
                      "flex items-start gap-2 rounded-xl border p-2.5 text-xs",
                      s.severity === "high"
                        ? "border-destructive/30 bg-destructive/5"
                        : "border-warning/30 bg-warning/5",
                    )}
                  >
                    <MessageSquareWarning className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                    <span>
                      <span className="font-semibold">{s.label}:</span> {s.detail}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </Section>

      {/* Release Engineering */}
      <Section title="هندسة الإطلاق وجاهزية المتاجر (Release Engineering)" icon={Rocket}>
        <div className="space-y-5">
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              قائمة مراحل الإطلاق (Launch Checklist)
            </div>
            {launchChecklist.isLoading ? (
              <SkeletonRows />
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {launchChecklist.data!.stages.map((s) => (
                    <div
                      key={s.id}
                      className={cn(
                        "rounded-full border px-3 py-1.5 text-xs font-semibold",
                        s.ready
                          ? "border-success/40 bg-success/10 text-success"
                          : "border-border bg-muted/40 text-muted-foreground",
                        launchChecklist.data!.currentStage === s.id && "ring-2 ring-primary",
                      )}
                    >
                      {s.label} {s.ready ? "✓" : ""}
                    </div>
                  ))}
                </div>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {launchChecklist.data!.stages.map((s) => (
                    <div key={s.id} className="rounded-xl border bg-card/50 p-2.5 text-xs space-y-1">
                      <div className="flex items-center justify-between font-semibold">
                        <span>{s.label}</span>
                        {s.ready ? (
                          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                        ) : (
                          <XCircle className="h-3.5 w-3.5 text-muted-foreground" />
                        )}
                      </div>
                      <ul className="space-y-0.5">
                        {s.requirements.map((r, i) => (
                          <li
                            key={i}
                            className="flex items-start gap-1.5 text-[11px] text-muted-foreground"
                          >
                            <span className="shrink-0 mt-0.5">
                              {r.met ? (
                                <CheckCircle2 className="h-3 w-3 text-success" />
                              ) : (
                                <XCircle className="h-3 w-3 text-muted-foreground" />
                              )}
                            </span>
                            <span>
                              {r.label} — {r.detail}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <PlatformReadinessCard
              icon={Smartphone}
              label="Android Ready"
              score={androidAudit.score}
              sub={`${androidAudit.readyCount}/${androidAudit.totalCount} فحص`}
            />
            <PlatformReadinessCard
              icon={Apple}
              label="iOS Ready"
              score={iosAudit.score}
              sub={`${iosAudit.readyCount}/${iosAudit.totalCount} فحص`}
            />
            <PlatformReadinessCard
              icon={Globe}
              label="PWA Ready"
              score={pwaAudit.data?.score ?? 0}
              sub={
                pwaAudit.data
                  ? pwaAudit.data.installable
                    ? "قابل للتثبيت"
                    : "غير قابل للتثبيت بعد"
                  : "..."
              }
            />
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              بيانات التطبيق الوصفية (App Metadata) — {metadataAudit.configuredCount}/
              {metadataAudit.totalCount}
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {metadataAudit.items.map((item) => (
                <div key={item.id} className="rounded-xl border bg-card/50 p-2.5 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold">{item.label}</span>
                    {STATUS_ICON(item.status)}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate" dir="ltr">
                    {item.value}
                  </div>
                  <div className="text-[10px] text-muted-foreground">{item.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" /> تدقيق Android — {androidAudit.score}/100
            </div>
            <CheckGrid items={androidAudit.items} />
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Apple className="h-3.5 w-3.5" /> تدقيق iOS — {iosAudit.score}/100
            </div>
            <CheckGrid items={iosAudit.items} />
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Globe className="h-3.5 w-3.5" /> تدقيق PWA
              {pwaAudit.data ? ` — ${pwaAudit.data.score}/100` : ""}
            </div>
            {pwaAudit.data ? <CheckGrid items={pwaAudit.data.items} /> : <SkeletonRows />}
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Image className="h-3.5 w-3.5" /> قائمة أصول المتجر (Store Assets)
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <StoreAssetGroupCard title="Android" group={storeAssets.android} />
              <StoreAssetGroupCard title="iOS" group={storeAssets.ios} />
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5" /> الامتثال والخصوصية (Compliance)
              {complianceAudit.data ? ` — ${complianceAudit.data.score}/100` : ""}
            </div>
            {complianceAudit.data ? <CheckGrid items={complianceAudit.data.items} /> : <SkeletonRows />}
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Server className="h-3.5 w-3.5" /> بيئة الإنتاج (Production Environment)
              {prodEnvAudit.data ? ` — ${prodEnvAudit.data.score}/100` : ""}
            </div>
            {prodEnvAudit.data ? <CheckGrid items={prodEnvAudit.data.items} /> : <SkeletonRows />}
          </div>
        </div>
      </Section>

      {/* Compliance Dashboard */}
      <Section title="الامتثال والخصوصية وجاهزية التعافي (Compliance)" icon={FileText}>
        <div className="space-y-5">
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">
              المستندات القانونية (مسودات تلقائية — تحتاج مراجعة قانونية قبل النشر)
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              <div className="flex items-start gap-3 rounded-2xl border bg-card p-3.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">سياسة الخصوصية</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {privacyPolicy.sections.length} أقسام — مبنية على Auth/Storage محلي/الإشعارات/الإعلانات/النسخ الاحتياطي/التحليلات
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setLegalDoc("privacy")}>
                    عرض
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadText("rasd-privacy-policy.md", privacyPolicy.markdown)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex items-start gap-3 rounded-2xl border bg-card p-3.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <FileText className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-semibold">شروط الاستخدام</div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    {termsOfService.sections.length} أقسام — الاستخدام المقبول/المسؤولية/النسخ الاحتياطي/الإعلانات/الاشتراكات
                  </div>
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <Button size="sm" variant="outline" onClick={() => setLegalDoc("terms")}>
                    عرض
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => downloadText("rasd-terms-of-service.md", termsOfService.markdown)}
                  >
                    <Download className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5" /> جاهزية الموافقات (Consent Readiness)
              {consentReadiness.data ? ` — ${consentReadiness.data.score}/100` : ""}
            </div>
            {consentReadiness.data ? <CheckGrid items={consentReadiness.data.items} /> : <SkeletonRows />}
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Download className="h-3.5 w-3.5" /> تدقيق تصدير بيانات المستخدم (Data Export)
              {` — ${dataExportAudit.score}/100`}
            </div>
            <CheckGrid items={dataExportAudit.items} />
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Trash2 className="h-3.5 w-3.5" /> خطة حذف البيانات (معاينة فقط — لا يُنفَّذ أي حذف)
            </div>
            {deletionPlan.data ? (
              <div className="grid gap-2 sm:grid-cols-3">
                <DeletionGroupCard
                  title="سيُحذف"
                  tone="destructive"
                  items={deletionPlan.data.items.filter((i) => i.category === "will_delete")}
                />
                <DeletionGroupCard
                  title="سيبقى"
                  tone="warning"
                  items={deletionPlan.data.items.filter((i) => i.category === "will_remain")}
                />
                <DeletionGroupCard
                  title="يحتاج تأكيداً"
                  tone="muted"
                  items={deletionPlan.data.items.filter((i) => i.category === "needs_confirmation")}
                />
              </div>
            ) : (
              <SkeletonRows />
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <LifeBuoy className="h-3.5 w-3.5" /> التعافي من الكوارث (Disaster Recovery)
              {disasterRecovery.data ? ` — ${disasterRecovery.data.score}/100` : ""}
            </div>
            {disasterRecovery.data ? <CheckGrid items={disasterRecovery.data.items} /> : <SkeletonRows />}
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Settings2 className="h-3.5 w-3.5" /> إعدادات الإنتاج (Production Config)
              {productionConfig.data ? ` — ${productionConfig.data.score}/100` : ""}
            </div>
            {productionConfig.data ? <CheckGrid items={productionConfig.data.items} /> : <SkeletonRows />}
          </div>
        </div>
      </Section>

      <Dialog open={legalDoc !== null} onOpenChange={(v) => !v && setLegalDoc(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{legalDoc === "privacy" ? "سياسة الخصوصية" : "شروط الاستخدام"}</DialogTitle>
          </DialogHeader>
          <pre className="whitespace-pre-wrap text-xs leading-relaxed" dir="rtl">
            {legalDoc === "privacy" ? privacyPolicy.markdown : legalDoc === "terms" ? termsOfService.markdown : ""}
          </pre>
        </DialogContent>
      </Dialog>

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
            qc.invalidateQueries({ queryKey: ["ux-readiness"] });
            qc.invalidateQueries({ queryKey: ["ux-hints"] });
            qc.invalidateQueries({ queryKey: ["beta-checklist"] });
            qc.invalidateQueries({ queryKey: ["beta-coverage"] });
            qc.invalidateQueries({ queryKey: ["beta-health"] });
            qc.invalidateQueries({ queryKey: ["beta-blockers"] });
            qc.invalidateQueries({ queryKey: ["release-pwa"] });
            qc.invalidateQueries({ queryKey: ["release-compliance"] });
            qc.invalidateQueries({ queryKey: ["release-prod-env"] });
            qc.invalidateQueries({ queryKey: ["release-launch"] });
            qc.invalidateQueries({ queryKey: ["compliance-deletion-plan"] });
            qc.invalidateQueries({ queryKey: ["compliance-consent"] });
            qc.invalidateQueries({ queryKey: ["compliance-prod-config"] });
            qc.invalidateQueries({ queryKey: ["compliance-disaster-recovery"] });
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

function QualityBadge({ quality }: { quality: EmptyStateQuality }) {
  const map: Record<EmptyStateQuality, { label: string; cls: string }> = {
    complete: { label: "كاملة", cls: "text-success" },
    partial: { label: "جزئية", cls: "text-warning" },
    missing: { label: "مفقودة", cls: "text-destructive" },
  };
  const m = map[quality];
  return <span className={cn("text-[10px] font-semibold", m.cls)}>{m.label}</span>;
}

function CoverageBadge({ status }: { status: FeatureCoverageStatus }) {
  const map: Record<FeatureCoverageStatus, { label: string; cls: string }> = {
    covered: { label: "مغطاة", cls: "text-success" },
    untested: { label: "غير مختبرة", cls: "text-warning" },
    never_used: { label: "لم تُستخدم", cls: "text-muted-foreground" },
  };
  const m = map[status];
  return <span className={cn("text-[10px] font-semibold", m.cls)}>{m.label}</span>;
}

function CheckGrid({
  items,
}: {
  items: { id: string; label: string; status: HealthStatus; detail: string }[];
}) {
  return (
    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => (
        <div key={item.id} className={cn("rounded-xl border p-2.5 text-xs space-y-1", STATUS_TONE[item.status])}>
          <div className="flex items-center justify-between">
            <span className="font-semibold">{item.label}</span>
            {STATUS_ICON(item.status)}
          </div>
          <div className="text-[11px] text-muted-foreground">{item.detail}</div>
        </div>
      ))}
    </div>
  );
}

function DeletionGroupCard({
  title,
  tone,
  items,
}: {
  title: string;
  tone: "destructive" | "warning" | "muted";
  items: { id: string; label: string; detail: string }[];
}) {
  const toneClass =
    tone === "destructive"
      ? "border-destructive/30 bg-destructive/5"
      : tone === "warning"
        ? "border-warning/30 bg-warning/5"
        : "border-border bg-muted/30";
  return (
    <div className={cn("rounded-2xl border p-3.5 space-y-2", toneClass)}>
      <div className="text-xs font-bold">
        {title} ({items.length})
      </div>
      <ul className="space-y-1.5">
        {items.map((item) => (
          <li key={item.id} className="text-[11px]">
            <div className="font-semibold">{item.label}</div>
            <div className="text-muted-foreground mt-0.5">{item.detail}</div>
          </li>
        ))}
      </ul>
    </div>
  );
}

function PlatformReadinessCard({
  icon: Icon,
  label,
  score,
  sub,
}: {
  icon: any;
  label: string;
  score: number;
  sub: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 space-y-1.5">
      <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <Icon className="h-4 w-4" /> {label}
      </div>
      <div className="text-3xl font-black tabular-nums text-primary">
        {score}
        <span className="text-sm text-muted-foreground">/100</span>
      </div>
      <div className="text-[11px] text-muted-foreground">{sub}</div>
    </div>
  );
}

function StoreAssetGroupCard({
  title,
  group,
}: {
  title: string;
  group: {
    items: { id: string; label: string; status: StoreAssetStatus; detail: string }[];
    readyCount: number;
    totalCount: number;
  };
}) {
  return (
    <div className="rounded-2xl border bg-card p-3.5 space-y-2">
      <div className="flex items-center justify-between text-xs font-semibold">
        <span>{title}</span>
        <span className="text-muted-foreground">
          {group.readyCount}/{group.totalCount}
        </span>
      </div>
      <ul className="space-y-1">
        {group.items.map((item) => (
          <li key={item.id} className="flex items-start gap-1.5 text-[11px]">
            <span className="shrink-0 mt-0.5">
              {item.status === "ready" ? (
                <CheckCircle2 className="h-3 w-3 text-success" />
              ) : (
                <XCircle className="h-3 w-3 text-muted-foreground" />
              )}
            </span>
            <span>
              <span className={item.status === "ready" ? "text-foreground" : "text-muted-foreground"}>
                {item.label}
              </span>{" "}
              — <span className="text-muted-foreground">{item.detail}</span>
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
