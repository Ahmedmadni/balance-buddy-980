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
import { runFinalProductionAudit } from "@/lib/release/final-audit";
import { auditFeatureFlags } from "@/lib/features/audit";
import { auditCrashReporting } from "@/lib/crash/audit";
import { auditRemoteConfig } from "@/lib/remote-config/audit";
import { loadRemoteConfig } from "@/lib/remote-config/engine";
import { auditEmergencyMode } from "@/lib/emergency/audit";
import {
  enableMaintenanceMode,
  disableMaintenanceMode,
  disableAds,
  enableAds,
  disableNotifications,
  enableNotifications,
  disableBeta,
  enableBeta,
} from "@/lib/emergency/actions";
import { getCurrentReleaseChannel, auditReleaseChannel, RELEASE_CHANNEL_LABEL } from "@/lib/release/channels";
import { auditStoreReadiness } from "@/lib/release/store-readiness";
import { evaluateProductionGate } from "@/lib/release/production-gate";
import { auditAccountDeletion } from "@/lib/account-deletion/audit";
import { auditConsentManager } from "@/lib/consent/audit";
import { validateLegalLinks } from "@/lib/release/legal-links";
import { computeLaunchBlockers } from "@/lib/release/blockers";
import { generateReleaseCertificate } from "@/lib/release/certificate";
import { performFinalAudit } from "@/lib/release/final-check";
import { processPendingNotifications } from "@/lib/notifications/engine";
import { generateEnvironmentChecklist } from "@/lib/deployment/checklist";
import { auditAndroidProduction } from "@/lib/android/audit";
import { generateAndroidReleasePlan } from "@/lib/android/release";
import { auditIOSProduction } from "@/lib/ios/audit";
import { generateIOSReleasePlan } from "@/lib/ios/release";
import { generateStoreMetadata } from "@/lib/store/metadata";
import { auditSupportInfrastructure } from "@/lib/support/audit";
import { auditObservability } from "@/lib/monitoring/audit";
import { evaluateLaunchDecision } from "@/lib/release/go-no-go";
import { generateReleaseCandidate } from "@/lib/rc/certificate";
import { runFreezeVerification } from "@/lib/rc/freeze";
import { auditDependencies } from "@/lib/rc/dependencies";
import { auditSecurity } from "@/lib/rc/security";
import { certifyPerformance } from "@/lib/rc/performance";
import { generateProductionCertificate, CERTIFICATION_LABEL } from "@/lib/rc/production-certificate";
import { generateFinalReleaseReport } from "@/lib/rc/report";
import { evaluateFinalReleaseDecision } from "@/lib/rc/decision";
import { loadLastBackup } from "@/lib/backup/engine";
import { verifyBackupIntegrity } from "@/lib/backup/integrity";
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
  Flag,
  TrendingUp,
  ToggleLeft,
  AlertOctagon,
  Radio,
  Siren,
  GitBranch,
  Store,
  ShieldQuestion,
  BadgeCheck,
  FileCheck2,
  Compass,
  Mail,
  Target,
  Layers,
  Fingerprint,
  Lock,
  Zap,
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

  const finalAudit = useQuery({ queryKey: ["release-final-audit"], queryFn: runFinalProductionAudit });

  // ----- Prompt 25: Production Safety & Operations Layer -----
  const featureFlagsAudit = auditFeatureFlags();
  const crashAudit = auditCrashReporting();
  const remoteConfigQuery = useQuery({
    queryKey: ["remote-config"],
    queryFn: async () => {
      await loadRemoteConfig();
      return auditRemoteConfig();
    },
  });
  const notifHealth = useQuery({
    queryKey: ["notification-health"],
    queryFn: () => processPendingNotifications(),
  });
  const [emergencyState, setEmergencyState] = useState(() => auditEmergencyMode());
  function refreshEmergencyState() {
    setEmergencyState(auditEmergencyMode());
  }
  const releaseChannel = getCurrentReleaseChannel();
  const releaseChannelAudit = auditReleaseChannel();
  const storeReadiness = useQuery({ queryKey: ["store-readiness"], queryFn: auditStoreReadiness });
  const productionGate = useQuery({ queryKey: ["production-gate"], queryFn: evaluateProductionGate });
  const backupHealth = useQuery({
    queryKey: ["backup-health-ops"],
    queryFn: async () => {
      const bundle = await loadLastBackup();
      return bundle ? verifyBackupIntegrity(bundle) : null;
    },
  });

  // ----- Prompt 26: Launch Readiness Resolution Center -----
  const accountDeletionAudit = useQuery({
    queryKey: ["account-deletion-audit"],
    queryFn: auditAccountDeletion,
  });
  const consentManagerAudit = auditConsentManager();
  const legalLinks = validateLegalLinks();
  const launchBlockers = useQuery({ queryKey: ["launch-blockers"], queryFn: computeLaunchBlockers });
  const releaseCertificate = useQuery({
    queryKey: ["release-certificate"],
    queryFn: generateReleaseCertificate,
  });
  const finalAuditCheck = useQuery({ queryKey: ["final-audit-check"], queryFn: performFinalAudit });

  // ----- Prompt 27: Production Deployment, Store Operations & Launch Execution -----
  const environmentChecklist = generateEnvironmentChecklist();
  const androidProduction = auditAndroidProduction();
  const androidReleasePlan = generateAndroidReleasePlan();
  const iosProduction = auditIOSProduction();
  const iosReleasePlan = generateIOSReleasePlan();
  const storeMetadata = generateStoreMetadata();
  const supportInfraAudit = auditSupportInfrastructure();
  const observability = useQuery({ queryKey: ["monitoring-observability"], queryFn: auditObservability });
  const goNoGo = useQuery({ queryKey: ["release-go-no-go"], queryFn: evaluateLaunchDecision });

  // ----- Prompt 28: Release Candidate (RC1), Launch Freeze & Production Certification -----
  const releaseCandidate = generateReleaseCandidate();
  const freezeVerification = runFreezeVerification();
  const dependencyAudit = auditDependencies();
  const securityAudit = useQuery({ queryKey: ["rc-security"], queryFn: auditSecurity });
  const performanceCert = useQuery({ queryKey: ["rc-performance"], queryFn: certifyPerformance });
  const productionCertificate = useQuery({
    queryKey: ["rc-production-certificate"],
    queryFn: generateProductionCertificate,
  });
  const finalReleaseReport = useQuery({ queryKey: ["rc-final-report"], queryFn: generateFinalReleaseReport });
  const finalReleaseDecision = useQuery({
    queryKey: ["rc-final-decision"],
    queryFn: evaluateFinalReleaseDecision,
  });

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

      {/* Production Final Audit */}
      <Section title="التدقيق النهائي للإنتاج (Production Final Audit)" icon={Flag}>
        {finalAudit.isLoading ? (
          <SkeletonRows />
        ) : (
          <div className="space-y-5">
            <div
              className={cn(
                "flex items-center gap-4 rounded-2xl border p-4",
                finalAudit.data!.productionReady ? "border-success/30 bg-success/5" : "border-warning/30 bg-warning/5",
              )}
            >
              <div className="text-4xl font-black tabular-nums text-primary">
                {finalAudit.data!.score}
              </div>
              <div>
                <div className="text-sm font-bold flex items-center gap-2">
                  Production Score: {finalAudit.data!.score}/100
                  {finalAudit.data!.productionReady ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                      <CheckCircle2 className="h-3 w-3" /> جاهز للإنتاج
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
                      <AlertTriangle className="h-3 w-3" /> غير جاهز بعد
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {finalAudit.data!.blockers.length} عائق حرج، {finalAudit.data!.warnings.length} تحذير
                </div>
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              {finalAudit.data!.categories.map((c) => (
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

            {finalAudit.data!.blockers.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-2">
                  عوائق الإطلاق (Release Blockers)
                </div>
                <ul className="space-y-1.5">
                  {finalAudit.data!.blockers.map((b, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-2.5 text-xs"
                    >
                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" /> {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> الإجراءات المُوصى بها
              </div>
              <div className="rounded-xl border bg-muted/30 p-3 space-y-1.5">
                {finalAudit.data!.recommendations.map((r, i) => (
                  <div key={i} className="text-xs text-muted-foreground">
                    • {r}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* Production Operations (Prompt 25) */}
      <Section title="عمليات الإنتاج (Production Operations)" icon={Siren}>
        <div className="space-y-5">
          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <AlertOctagon className="h-3.5 w-3.5" /> حالة الأعطال (Crash Status) — المزوّد النشط: {crashAudit.activeProvider}
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <MetricCard icon={AlertOctagon} label="عدد الأخطاء" value={String(crashAudit.errorCount)} />
              <MetricCard icon={Gauge} label="معدل الأخطاء (24 ساعة)" value={String(crashAudit.errorRatePerDay)} />
              <MetricCard
                icon={AlertTriangle}
                label="آخر خطأ"
                value={crashAudit.lastError ? crashAudit.lastError.message.slice(0, 40) : "لا يوجد"}
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <ToggleLeft className="h-3.5 w-3.5" /> أعلام الميزات (Feature Flags)
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
              <MetricCard icon={ToggleLeft} label="عدد الميزات" value={String(featureFlagsAudit.total)} />
              <MetricCard icon={CheckCircle2} label="المفعلة" value={String(featureFlagsAudit.enabledCount)} />
              <MetricCard icon={XCircle} label="المعطلة" value={String(featureFlagsAudit.disabledCount)} />
              <MetricCard icon={FlaskConical} label="Beta" value={String(featureFlagsAudit.betaCount)} />
              <MetricCard icon={Award} label="Premium" value={String(featureFlagsAudit.premiumCount)} />
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Radio className="h-3.5 w-3.5" /> الإعدادات عن بُعد (Remote Config)
            </div>
            {remoteConfigQuery.data ? (
              <div className="grid gap-2.5 sm:grid-cols-3">
                <MetricCard
                  icon={CheckCircle2}
                  label="حالة التحميل"
                  value={remoteConfigQuery.data.loaded ? "محمَّل" : "لم يُحمَّل بعد"}
                />
                <MetricCard icon={Database} label="عدد المفاتيح" value={String(remoteConfigQuery.data.keyCount)} />
                <MetricCard
                  icon={RefreshCw}
                  label="آخر تحديث"
                  value={
                    remoteConfigQuery.data.lastUpdate
                      ? new Date(remoteConfigQuery.data.lastUpdate).toLocaleString("ar")
                      : "—"
                  }
                />
              </div>
            ) : (
              <SkeletonRows />
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <HardDrive className="h-3.5 w-3.5" /> سلامة النسخ الاحتياطي (Backup Health)
            </div>
            {backupHealth.isLoading ? (
              <SkeletonRows />
            ) : backupHealth.data ? (
              <div className="grid gap-2.5 sm:grid-cols-3">
                <MetricCard
                  icon={backupHealth.data.valid ? CheckCircle2 : XCircle}
                  label="الحالة"
                  value={backupHealth.data.valid ? "سليمة" : "بها أخطاء"}
                />
                <MetricCard icon={Gauge} label="درجة التوافق" value={`${backupHealth.data.score}/100`} />
                <MetricCard
                  icon={Database}
                  label="إجمالي السجلات"
                  value={String(backupHealth.data.statistics.totalRecords)}
                />
              </div>
            ) : (
              <div className="rounded-xl border border-dashed p-3 text-center text-xs text-muted-foreground">
                لا نسخة احتياطية محلية بعد
              </div>
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Bell className="h-3.5 w-3.5" /> سلامة الإشعارات (Notification Health)
            </div>
            {notifHealth.isLoading ? (
              <SkeletonRows />
            ) : notifHealth.data ? (
              <div className="grid gap-2.5 sm:grid-cols-4">
                <MetricCard icon={Bell} label="أحداث مفحوصة" value={String(notifHealth.data.scanned)} />
                <MetricCard icon={CheckCircle2} label="أُرسلت" value={String(notifHealth.data.sent)} />
                <MetricCard icon={AlertTriangle} label="تم تخطّيها" value={String(notifHealth.data.skipped)} />
                <MetricCard icon={XCircle} label="فشلت" value={String(notifHealth.data.failed)} />
              </div>
            ) : (
              <SkeletonRows />
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Siren className="h-3.5 w-3.5" /> وضع الطوارئ (Emergency Mode) — مفاتيح استشارية محلية فقط، لا
              تُعطّل المحرك المالي أو النسخ الاحتياطي أو المصادقة أبداً (لا دالة لذلك في هذا التطبيق)
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
              <EmergencyToggle
                label="وضع الصيانة"
                active={emergencyState.state.maintenanceMode}
                onEnable={enableMaintenanceMode}
                onDisable={disableMaintenanceMode}
                refresh={refreshEmergencyState}
              />
              <EmergencyToggle
                label="تعطيل الإعلانات"
                active={emergencyState.state.adsDisabled}
                onEnable={disableAds}
                onDisable={enableAds}
                refresh={refreshEmergencyState}
              />
              <EmergencyToggle
                label="تعطيل الإشعارات"
                active={emergencyState.state.notificationsDisabled}
                onEnable={disableNotifications}
                onDisable={enableNotifications}
                refresh={refreshEmergencyState}
              />
              <EmergencyToggle
                label="تعطيل ميزات Beta"
                active={emergencyState.state.betaDisabled}
                onEnable={disableBeta}
                onDisable={enableBeta}
                refresh={refreshEmergencyState}
              />
            </div>
          </div>
        </div>
      </Section>

      {/* Production Gate (Prompt 25) */}
      <Section title="بوابة الإنتاج (Production Gate)" icon={GitBranch}>
        {productionGate.isLoading ? (
          <SkeletonRows />
        ) : (
          <div className="space-y-5">
            <div
              className={cn(
                "flex items-center gap-4 rounded-2xl border p-4",
                productionGate.data!.productionReady
                  ? "border-success/30 bg-success/5"
                  : "border-warning/30 bg-warning/5",
              )}
            >
              <div className="text-4xl font-black tabular-nums text-primary">{productionGate.data!.score}</div>
              <div>
                <div className="text-sm font-bold flex items-center gap-2">
                  Production Gate Score: {productionGate.data!.score}/100
                  {productionGate.data!.productionReady ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-[10px] font-semibold text-success">
                      <CheckCircle2 className="h-3 w-3" /> البوابة مفتوحة
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-[10px] font-semibold text-warning">
                      <AlertTriangle className="h-3 w-3" /> البوابة مغلقة
                    </span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground">
                  {productionGate.data!.blockers.length} عائق حرج، {productionGate.data!.warnings.length} تحذير
                </div>
              </div>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
              <MetricCard icon={GitBranch} label="القناة الحالية (Release Channel)" value={RELEASE_CHANNEL_LABEL[releaseChannel]} />
              <MetricCard
                icon={Store}
                label="جاهزية المتاجر (Store Readiness)"
                value={storeReadiness.data ? `${storeReadiness.data.score}/100` : "..."}
              />
              <MetricCard
                icon={ShieldQuestion}
                label="حالة الامتثال (Compliance)"
                value={complianceAudit.data ? `${complianceAudit.data.score}/100` : "..."}
              />
            </div>

            <div className="rounded-xl border bg-card/50 p-2.5 text-xs text-muted-foreground">{releaseChannelAudit.detail}</div>

            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2">قائمة تدقيق البوابة (Checklist)</div>
              <CheckGrid items={productionGate.data!.checklist} />
            </div>

            {storeReadiness.data && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-2">تفصيل جاهزية المتاجر</div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border bg-card p-3.5 space-y-2">
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>Google Play</span>
                      <span className="text-muted-foreground">{storeReadiness.data.android.score}/100</span>
                    </div>
                    <CheckGrid items={storeReadiness.data.android.checks} />
                  </div>
                  <div className="rounded-2xl border bg-card p-3.5 space-y-2">
                    <div className="text-xs font-bold flex items-center justify-between">
                      <span>Apple App Store</span>
                      <span className="text-muted-foreground">{storeReadiness.data.ios.score}/100</span>
                    </div>
                    <CheckGrid items={storeReadiness.data.ios.checks} />
                  </div>
                </div>
              </div>
            )}

            {productionGate.data!.blockers.length > 0 && (
              <div>
                <div className="text-xs font-semibold text-muted-foreground mb-2">عوائق حرجة (Critical Blockers)</div>
                <ul className="space-y-1.5">
                  {productionGate.data!.blockers.map((b, i) => (
                    <li
                      key={i}
                      className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-2.5 text-xs"
                    >
                      <XCircle className="h-3.5 w-3.5 text-destructive shrink-0 mt-0.5" /> {b}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> التوصيات
              </div>
              <div className="rounded-xl border bg-muted/30 p-3 space-y-1.5">
                {productionGate.data!.recommendations.map((r, i) => (
                  <div key={i} className="text-xs text-muted-foreground">
                    • {r}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </Section>

      {/* Launch Readiness Resolution Center (Prompt 26) */}
      <Section title="Launch Readiness Resolution Center" icon={FileCheck2}>
        <div className="space-y-5">
          <div className="grid gap-2.5 sm:grid-cols-3">
            <MetricCard
              icon={AlertOctagon}
              label="عوائق الإطلاق غير المحلولة"
              value={launchBlockers.data ? `${launchBlockers.data.unresolvedCount} (${launchBlockers.data.criticalCount} حرِج)` : "..."}
            />
            <MetricCard
              icon={finalAuditCheck.data?.allPassed ? CheckCircle2 : AlertTriangle}
              label="التدقيق النهائي (Final Audit)"
              value={finalAuditCheck.data ? (finalAuditCheck.data.allPassed ? "ناجح بالكامل" : "يحتاج مراجعة") : "..."}
            />
            <MetricCard
              icon={BadgeCheck}
              label="Release Certificate"
              value={releaseCertificate.data ? `${releaseCertificate.data.final_score}/100` : "..."}
            />
          </div>

          <div>
            <div className="text-xs font-semibold text-destructive mb-2 flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5" /> Critical
            </div>
            <CheckGrid
              items={[
                {
                  id: "account_deletion",
                  label: "Account Deletion",
                  status: "error",
                  detail: accountDeletionAudit.data?.items.find((i) => i.id === "execution_capability")?.detail ?? "معاينة فقط — لا تنفيذ فعلي",
                },
                {
                  id: "legal_links",
                  label: "Legal Links",
                  status: legalLinks.checks.some((c) => c.status === "error") ? "error" : legalLinks.checks.some((c) => c.status === "warning") ? "warning" : "ok",
                  detail: `${legalLinks.score}/100 — ${legalLinks.checks.filter((c) => c.status === "ok").length}/${legalLinks.checks.length} رابط سليم`,
                },
                {
                  id: "consent",
                  label: "Consent",
                  status: consentManagerAudit.record.bannerShown ? "ok" : "warning",
                  detail: consentManagerAudit.record.bannerShown ? "المستخدم اتّخذ قراراً فعلياً عبر شاشة الموافقة" : "لم يُتَّخذ قرار بعد في هذه الجلسة",
                },
                {
                  id: "android",
                  label: "Android",
                  status: androidAudit.score === 100 ? "ok" : androidAudit.score >= 60 ? "warning" : "error",
                  detail: `${androidAudit.score}/100`,
                },
                {
                  id: "ios",
                  label: "iOS",
                  status: iosAudit.score === 100 ? "ok" : iosAudit.score >= 60 ? "warning" : "error",
                  detail: `${iosAudit.score}/100`,
                },
                {
                  id: "store_readiness",
                  label: "Store Readiness",
                  status: storeReadiness.data ? (storeReadiness.data.score === 100 ? "ok" : storeReadiness.data.score >= 60 ? "warning" : "error") : "warning",
                  detail: storeReadiness.data ? `${storeReadiness.data.score}/100` : "...",
                },
              ]}
            />
          </div>

          <div>
            <div className="text-xs font-semibold text-warning mb-2 flex items-center gap-1.5">
              <AlertTriangle className="h-3.5 w-3.5" /> Warning
            </div>
            <CheckGrid
              items={[
                {
                  id: "ads",
                  label: "Ads",
                  status: adsAudit.web.configured || adsAudit.android.configured || adsAudit.ios.configured ? "ok" : "warning",
                  detail: adsAudit.web.configured || adsAudit.android.configured || adsAudit.ios.configured ? "منصّة واحدة على الأقل بمعرّفات حقيقية" : "كل المعرّفات لا تزال placeholder",
                },
                {
                  id: "accessibility",
                  label: "Accessibility",
                  status: a11y.score >= 80 ? "ok" : a11y.score >= 60 ? "warning" : "error",
                  detail: `${a11y.score}/100`,
                },
                {
                  id: "empty_states",
                  label: "Empty States",
                  status: emptyStates.score >= 80 ? "ok" : emptyStates.score >= 50 ? "warning" : "error",
                  detail: `${emptyStates.score}/100`,
                },
                {
                  id: "backup_coverage",
                  label: "Backup Coverage",
                  status: dataExportAudit.score >= 80 ? "ok" : dataExportAudit.score >= 50 ? "warning" : "error",
                  detail: `${dataExportAudit.score}/100`,
                },
              ]}
            />
          </div>

          <div>
            <div className="text-xs font-semibold text-success mb-2 flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5" /> Passed
            </div>
            {releaseCertificate.data ? (
              <CheckGrid
                items={[
                  { id: "financial_engine", label: "Financial Engine", status: releaseCertificate.data.financial_engine.status, detail: releaseCertificate.data.financial_engine.detail },
                  { id: "investments", label: "Investments", status: releaseCertificate.data.investments.status, detail: releaseCertificate.data.investments.detail },
                  { id: "zakat", label: "Zakat", status: releaseCertificate.data.zakat.status, detail: releaseCertificate.data.zakat.detail },
                  { id: "analytics", label: "Analytics", status: releaseCertificate.data.analytics.status, detail: releaseCertificate.data.analytics.detail },
                  { id: "notifications", label: "Notifications", status: releaseCertificate.data.notifications.status, detail: releaseCertificate.data.notifications.detail },
                  { id: "backup", label: "Backup", status: releaseCertificate.data.backup.status, detail: releaseCertificate.data.backup.detail },
                ]}
              />
            ) : (
              <SkeletonRows />
            )}
          </div>
        </div>
      </Section>

      {/* Production Launch Center (Prompt 27) */}
      <Section title="Production Launch Center" icon={Compass}>
        <div className="space-y-5">
          <div
            className={cn(
              "flex items-center gap-4 rounded-2xl border p-4",
              goNoGo.data?.decision === "GO"
                ? "border-success/30 bg-success/5"
                : goNoGo.data?.decision === "BETA_ONLY"
                  ? "border-warning/30 bg-warning/5"
                  : "border-destructive/30 bg-destructive/5",
            )}
          >
            <div className="text-4xl font-black tabular-nums text-primary">
              {goNoGo.data ? goNoGo.data.score : "..."}
            </div>
            <div>
              <div className="text-sm font-bold flex items-center gap-2">
                Go / No-Go Score: {goNoGo.data ? `${goNoGo.data.score}/100` : "..."}
                {goNoGo.data && (
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
                      goNoGo.data.decision === "GO"
                        ? "bg-success/15 text-success"
                        : goNoGo.data.decision === "BETA_ONLY"
                          ? "bg-warning/15 text-warning"
                          : "bg-destructive/15 text-destructive",
                    )}
                  >
                    <Target className="h-3 w-3" /> {goNoGo.data.decision}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {goNoGo.data
                  ? `${goNoGo.data.blockers.length} عائق حرج، ${goNoGo.data.warnings.length} تحذير`
                  : "جارٍ التقييم..."}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Layers className="h-3.5 w-3.5" /> البنية التحتية (Infrastructure)
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl border bg-card p-3.5 space-y-2">
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>البيئة (Environment)</span>
                  <span className="text-muted-foreground">{environmentChecklist.score}/100</span>
                </div>
                <div className="text-[11px] text-muted-foreground">{environmentChecklist.environment}</div>
                <CheckGrid items={environmentChecklist.items} />
              </div>
              <div className="rounded-2xl border bg-card p-3.5 space-y-2">
                <div className="text-xs font-bold flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Mail className="h-3.5 w-3.5" /> الدعم (Support)
                  </span>
                  <span className="text-muted-foreground">{supportInfraAudit.score}/100</span>
                </div>
                <CheckGrid items={supportInfraAudit.items} />
              </div>
              <div className="rounded-2xl border bg-card p-3.5 space-y-2">
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>المراقبة (Monitoring)</span>
                  <span className="text-muted-foreground">
                    {observability.data ? `${observability.data.score}/100` : "..."}
                  </span>
                </div>
                {observability.data ? (
                  <CheckGrid
                    items={observability.data.categories.map((c) => ({
                      id: c.id,
                      label: c.label,
                      status: c.status,
                      detail: c.detail,
                    }))}
                  />
                ) : (
                  <SkeletonRows />
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Smartphone className="h-3.5 w-3.5" /> Android
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border bg-card p-3.5 space-y-2">
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>جاهزية الإصدار (Release Readiness)</span>
                  <span className="text-muted-foreground">{androidProduction.score}/100</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  خطة الإصدار: {androidReleasePlan.completedCount}/{androidReleasePlan.totalCount} خطوة مكتملة
                </div>
                <CheckGrid items={androidProduction.items} />
              </div>
              <div className="rounded-2xl border bg-card p-3.5 space-y-2">
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>جاهزية المتجر (Store Readiness)</span>
                  <span className="text-muted-foreground">
                    {storeMetadata.googlePlay.screenshotsReady ? "لقطات جاهزة" : "لا لقطات بعد"}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground space-y-1">
                  <div>العنوان: {storeMetadata.googlePlay.title}</div>
                  <div>الفئة: {storeMetadata.googlePlay.category}</div>
                  <div>
                    الوصف القصير ({storeMetadata.googlePlay.shortDescription.length}/80 حرفاً):{" "}
                    {storeMetadata.googlePlay.shortDescription}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Apple className="h-3.5 w-3.5" /> iOS
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border bg-card p-3.5 space-y-2">
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>جاهزية الإصدار (Release Readiness)</span>
                  <span className="text-muted-foreground">{iosProduction.score}/100</span>
                </div>
                <div className="text-[11px] text-muted-foreground">
                  خطة الإصدار: {iosReleasePlan.completedCount}/{iosReleasePlan.totalCount} خطوة مكتملة
                </div>
                <CheckGrid items={iosProduction.items} />
              </div>
              <div className="rounded-2xl border bg-card p-3.5 space-y-2">
                <div className="text-xs font-bold flex items-center justify-between">
                  <span>جاهزية المتجر (Store Readiness)</span>
                  <span className="text-muted-foreground">
                    {storeMetadata.appleAppStore.screenshotsReady ? "لقطات جاهزة" : "لا لقطات بعد"}
                  </span>
                </div>
                <div className="text-[11px] text-muted-foreground space-y-1">
                  <div>العنوان الفرعي: {storeMetadata.appleAppStore.subtitle}</div>
                  <div>الفئة: {storeMetadata.appleAppStore.category}</div>
                  <div dir="ltr" className="truncate">
                    Support: {storeMetadata.appleAppStore.supportUrl}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5" /> الامتثال (Compliance)
            </div>
            <CheckGrid
              items={[
                {
                  id: "privacy",
                  label: "Privacy",
                  status: legalLinks.checks.find((c) => c.id === "privacy")?.status ?? "warning",
                  detail: legalLinks.checks.find((c) => c.id === "privacy")?.detail ?? "...",
                },
                {
                  id: "consent",
                  label: "Consent",
                  status: consentManagerAudit.record.bannerShown ? "ok" : "warning",
                  detail: consentManagerAudit.record.bannerShown
                    ? "المستخدم اتّخذ قراراً فعلياً"
                    : "لم يُتَّخذ قرار بعد في هذه الجلسة",
                },
                {
                  id: "account_deletion",
                  label: "Account Deletion",
                  status: accountDeletionAudit.data
                    ? accountDeletionAudit.data.items.every((i) => i.status === "ok")
                      ? "ok"
                      : "warning"
                    : "warning",
                  detail: "خطة معاينة كاملة — لا تنفيذ فعلي بلا Edge Function مستقبلية",
                },
              ]}
            />
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Rocket className="h-3.5 w-3.5" /> الإنتاج (Production)
            </div>
            <div className="grid gap-2.5 sm:grid-cols-3">
              <MetricCard
                icon={Flag}
                label="النتيجة النهائية (Final Score)"
                value={goNoGo.data ? `${goNoGo.data.score}/100` : "..."}
              />
              <MetricCard
                icon={AlertOctagon}
                label="العوائق المتبقية (Remaining Blockers)"
                value={goNoGo.data ? String(goNoGo.data.blockers.length) : "..."}
              />
              <MetricCard
                icon={Target}
                label="جاهزية الإطلاق التقديرية"
                value={
                  goNoGo.data
                    ? goNoGo.data.decision === "GO"
                      ? "جاهز للإطلاق الفعلي"
                      : goNoGo.data.decision === "BETA_ONLY"
                        ? "جاهز لـ Beta فقط"
                        : "غير جاهز بعد"
                    : "..."
                }
              />
            </div>
          </div>

          {goNoGo.data && (
            <div>
              <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> التوصيات
              </div>
              <div className="rounded-xl border bg-muted/30 p-3 space-y-1.5">
                {goNoGo.data.recommendations.map((r, i) => (
                  <div key={i} className="text-xs text-muted-foreground">
                    • {r}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Section>

      {/* Release Candidate Certification (Prompt 28) */}
      <Section title="Release Candidate Certification" icon={Fingerprint}>
        <div className="space-y-5">
          <div
            className={cn(
              "flex items-center gap-4 rounded-2xl border p-4",
              finalReleaseDecision.data?.decision === "GO"
                ? "border-success/30 bg-success/5"
                : finalReleaseDecision.data?.decision === "BETA_ONLY"
                  ? "border-warning/30 bg-warning/5"
                  : "border-destructive/30 bg-destructive/5",
            )}
          >
            <div className="text-4xl font-black tabular-nums text-primary">
              {productionCertificate.data ? productionCertificate.data.final_score : "..."}
            </div>
            <div>
              <div className="text-sm font-bold flex items-center gap-2">
                Production Certificate:{" "}
                {productionCertificate.data ? `${productionCertificate.data.final_score}/100` : "..."}
                {productionCertificate.data && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                    {CERTIFICATION_LABEL[productionCertificate.data.certification]}
                  </span>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {finalReleaseDecision.data
                  ? `القرار النهائي: ${finalReleaseDecision.data.decision} (ثقة ${finalReleaseDecision.data.confidence})`
                  : "جارٍ التقييم..."}
              </div>
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">RC Information</div>
            <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
              <MetricCard icon={Fingerprint} label="Version" value={releaseCandidate.rc_version} />
              <MetricCard icon={Package} label="Build" value={releaseCandidate.build.build_id} />
              <MetricCard icon={GitBranch} label="Commit" value={releaseCandidate.build.git_commit} />
              <MetricCard
                icon={RefreshCw}
                label="Date"
                value={new Date(releaseCandidate.build.build_date).toLocaleString("ar")}
              />
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" /> Freeze Status —{" "}
              {freezeVerification.allPassed ? "كل المحركات مجمَّدة سليمة" : "يوجد خلل في التجميد"}
            </div>
            <CheckGrid items={freezeVerification.items} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border bg-card p-3.5 space-y-2">
              <div className="text-xs font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Lock className="h-3.5 w-3.5" /> Security
                </span>
                <span className="text-muted-foreground">
                  {securityAudit.data ? `${securityAudit.data.score}/100` : "..."}
                </span>
              </div>
              {securityAudit.data ? <CheckGrid items={securityAudit.data.items} /> : <SkeletonRows />}
            </div>
            <div className="rounded-2xl border bg-card p-3.5 space-y-2">
              <div className="text-xs font-bold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" /> Performance
                </span>
                <span className="text-muted-foreground">
                  {performanceCert.data ? `${performanceCert.data.score}/100` : "..."}
                </span>
              </div>
              {performanceCert.data ? (
                <div className="grid gap-2 sm:grid-cols-2 text-xs">
                  <MetricCard icon={Gauge} label="Health Score" value={`${performanceCert.data.healthScore}/100`} />
                  <MetricCard
                    icon={GitBranch}
                    label="Production Gate Score"
                    value={`${performanceCert.data.productionGateScore}/100`}
                  />
                  <MetricCard
                    icon={HardDrive}
                    label="localStorage"
                    value={bytesToHuman(performanceCert.data.localStorageUsageBytes)}
                  />
                  <MetricCard
                    icon={Gauge}
                    label="Insights Compute"
                    value={
                      performanceCert.data.insightsComputeMs !== null
                        ? `${performanceCert.data.insightsComputeMs.toFixed(0)} ms`
                        : "غير متاح (لا جلسة)"
                    }
                  />
                </div>
              ) : (
                <SkeletonRows />
              )}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2 flex items-center gap-1.5">
              <Package className="h-3.5 w-3.5" /> Dependency Audit — {dependencyAudit.dependencyCount} dependencies،{" "}
              {dependencyAudit.devDependencyCount} devDependencies، {dependencyAudit.vulnerabilities.high} high/
              {dependencyAudit.vulnerabilities.moderate} moderate/{dependencyAudit.vulnerabilities.low} low
            </div>
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {dependencyAudit.items.map((item) => (
                <div
                  key={item.id}
                  className={cn(
                    "rounded-xl border p-2.5 text-xs space-y-1",
                    item.risk === "safe"
                      ? "border-success/30 bg-success/5"
                      : item.risk === "warning"
                        ? "border-warning/30 bg-warning/5"
                        : "border-destructive/30 bg-destructive/5",
                  )}
                >
                  <div className="font-semibold">{item.label}</div>
                  <div className="text-[11px] text-muted-foreground">{item.detail}</div>
                </div>
              ))}
            </div>
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">Production Certificate — الأقسام</div>
            {productionCertificate.data ? (
              <CheckGrid
                items={[
                  { id: "architecture", label: "Architecture", status: productionCertificate.data.architecture.status, detail: productionCertificate.data.architecture.detail },
                  { id: "financial_engine", label: "Financial Engine", status: productionCertificate.data.financial_engine.status, detail: productionCertificate.data.financial_engine.detail },
                  { id: "investments", label: "Investments", status: productionCertificate.data.investments.status, detail: productionCertificate.data.investments.detail },
                  { id: "depreciation", label: "Depreciation", status: productionCertificate.data.depreciation.status, detail: productionCertificate.data.depreciation.detail },
                  { id: "zakat", label: "Zakat", status: productionCertificate.data.zakat.status, detail: productionCertificate.data.zakat.detail },
                  { id: "analytics", label: "Analytics", status: productionCertificate.data.analytics.status, detail: productionCertificate.data.analytics.detail },
                  { id: "notifications", label: "Notifications", status: productionCertificate.data.notifications.status, detail: productionCertificate.data.notifications.detail },
                  { id: "backups", label: "Backups", status: productionCertificate.data.backups.status, detail: productionCertificate.data.backups.detail },
                  { id: "compliance", label: "Compliance", status: productionCertificate.data.compliance.status, detail: productionCertificate.data.compliance.detail },
                  { id: "release", label: "Release", status: productionCertificate.data.release.status, detail: productionCertificate.data.release.detail },
                ]}
              />
            ) : (
              <SkeletonRows />
            )}
          </div>

          <div>
            <div className="text-xs font-semibold text-muted-foreground mb-2">Final Release Report</div>
            {finalReleaseReport.data ? (
              <div className="space-y-3">
                <div className="grid gap-2.5 sm:grid-cols-4">
                  <MetricCard icon={Rocket} label="Production" value={`${finalReleaseReport.data.productionReadinessScore}/100`} />
                  <MetricCard icon={FlaskConical} label="Beta" value={`${finalReleaseReport.data.betaReadinessScore}/100`} />
                  <MetricCard icon={Store} label="Store" value={`${finalReleaseReport.data.storeReadinessScore}/100`} />
                  <MetricCard icon={Scale} label="Compliance" value={`${finalReleaseReport.data.complianceReadinessScore}/100`} />
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border bg-card p-3.5 space-y-1.5">
                    <div className="text-xs font-bold">Technical Debt</div>
                    <ul className="space-y-1">
                      {finalReleaseReport.data.technicalDebt.map((t, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground">• {t}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border bg-card p-3.5 space-y-1.5">
                    <div className="text-xs font-bold">Known Limitations</div>
                    <ul className="space-y-1">
                      {finalReleaseReport.data.knownLimitations.map((t, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground">• {t}</li>
                      ))}
                    </ul>
                  </div>
                  <div className="rounded-2xl border bg-card p-3.5 space-y-1.5">
                    <div className="text-xs font-bold">Recommended Next Steps</div>
                    <ul className="space-y-1">
                      {finalReleaseReport.data.recommendedNextSteps.map((t, i) => (
                        <li key={i} className="text-[11px] text-muted-foreground">• {t}</li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            ) : (
              <SkeletonRows />
            )}
          </div>

          {finalReleaseDecision.data && (
            <div className="rounded-xl border bg-muted/30 p-3 space-y-1.5">
              <div className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5" /> التوصية النهائية
              </div>
              <div className="text-xs text-muted-foreground">{finalReleaseDecision.data.recommendation}</div>
              {finalReleaseDecision.data.blockers.length > 0 && (
                <ul className="space-y-1 pt-1">
                  {finalReleaseDecision.data.blockers.map((b, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs text-destructive">
                      <XCircle className="h-3.5 w-3.5 shrink-0 mt-0.5" /> {b}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </div>
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
            qc.invalidateQueries({ queryKey: ["release-final-audit"] });
            qc.invalidateQueries({ queryKey: ["remote-config"] });
            qc.invalidateQueries({ queryKey: ["notification-health"] });
            qc.invalidateQueries({ queryKey: ["store-readiness"] });
            qc.invalidateQueries({ queryKey: ["production-gate"] });
            qc.invalidateQueries({ queryKey: ["backup-health-ops"] });
            qc.invalidateQueries({ queryKey: ["account-deletion-audit"] });
            qc.invalidateQueries({ queryKey: ["launch-blockers"] });
            qc.invalidateQueries({ queryKey: ["release-certificate"] });
            qc.invalidateQueries({ queryKey: ["final-audit-check"] });
            qc.invalidateQueries({ queryKey: ["monitoring-observability"] });
            qc.invalidateQueries({ queryKey: ["release-go-no-go"] });
            qc.invalidateQueries({ queryKey: ["rc-security"] });
            qc.invalidateQueries({ queryKey: ["rc-performance"] });
            qc.invalidateQueries({ queryKey: ["rc-production-certificate"] });
            qc.invalidateQueries({ queryKey: ["rc-final-report"] });
            qc.invalidateQueries({ queryKey: ["rc-final-decision"] });
            refreshEmergencyState();
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

function EmergencyToggle({
  label,
  active,
  onEnable,
  onDisable,
  refresh,
}: {
  label: string;
  active: boolean;
  onEnable: () => void;
  onDisable: () => void;
  refresh: () => void;
}) {
  return (
    <div className={cn("rounded-2xl border p-3.5 space-y-2", active ? "border-warning/30 bg-warning/5" : "border-border bg-card/50")}>
      <div className="flex items-center justify-between text-xs font-semibold">
        <span>{label}</span>
        {active ? (
          <AlertTriangle className="h-3.5 w-3.5 text-warning" />
        ) : (
          <CheckCircle2 className="h-3.5 w-3.5 text-success" />
        )}
      </div>
      <div className="text-[11px] text-muted-foreground">{active ? "مفعَّل الآن" : "غير مفعَّل"}</div>
      <Button
        size="sm"
        variant="outline"
        className="w-full h-7 text-[11px]"
        onClick={() => {
          (active ? onDisable : onEnable)();
          refresh();
        }}
      >
        {active ? "إيقاف" : "تفعيل"}
      </Button>
    </div>
  );
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
