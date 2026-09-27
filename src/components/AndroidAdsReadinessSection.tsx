import { useCallback, useState, type ReactNode } from "react";
import { RefreshCw } from "lucide-react";
import { getContactsRegressionChecklist, contactsRegressionScore } from "@/lib/contacts/regression";
import { auditAdsProduction } from "@/lib/ads/production-audit";
import { auditAds } from "@/lib/ads/audit";
import { auditAndroidReleaseConfig } from "@/lib/android-production/release-config";
import { auditAndroidRelease } from "@/lib/release/android-audit";
import { APP_VERSION } from "@/lib/mobile/version";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

function ScoreChip({ label, score }: { label: string; score: number }) {
  const tone = score >= 90 ? "text-success" : score >= 60 ? "text-amber-600" : "text-destructive";
  return (
    <div className="rounded-xl border bg-card p-3 text-center">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={cn("text-xl font-bold tabular-nums", tone)}>{score}</div>
    </div>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="space-y-1">
      <div className="text-xs font-semibold text-muted-foreground">{title}</div>
      <div className="space-y-1 text-xs">{children}</div>
    </div>
  );
}

export function AndroidAdsReadinessSection() {
  const [, setNonce] = useState(0);
  const refresh = useCallback(() => setNonce((n) => n + 1), []);

  const ads = auditAdsProduction();
  const adsRuntime = auditAds();
  const androidCfg = auditAndroidReleaseConfig();
  const androidRelease = auditAndroidRelease();
  const checks = getContactsRegressionChecklist();
  const contactsScore = contactsRegressionScore();

  const encodingOk = !checks.some((c) => c.status === "auto-fail");

  const blockers = [
    ...ads.blockers,
    ...androidCfg.items.filter((i) => i.status === "error").map((i) => `${i.label}: ${i.detail}`),
    ...(encodingOk ? [] : ["فشل أحد اختبارات ترميز أسماء جهات الاتصال"]),
    ...(androidRelease.items.some((i) => i.id === "capacitor_android" && i.status !== "ok")
      ? ["منصّة android/ غير مضافة — لا يمكن بناء APK/AAB بعد"]
      : []),
    "لا يوجد keystore للتوقيع — خطوة خارجية مطلوبة من المالك",
  ];

  return (
    <section className="space-y-4 rounded-2xl border bg-card p-4">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-bold">مركز إنتاج Android والإعلانات</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Android &amp; Ads Production Center</p>
        </div>
        <Button variant="outline" size="sm" onClick={refresh} className="gap-1.5">
          <RefreshCw className="size-3.5" />
          تحديث
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <ScoreChip label="ANDROID" score={Math.round((androidCfg.score + androidRelease.score) / 2)} />
        <ScoreChip label="CONTACTS" score={contactsScore} />
        <ScoreChip label="ADS" score={ads.score} />
      </div>

      <Group title="Android">
        <Row label="منصّة android/" ok={false} note="غير مضافة — bun run android:add" />
        <Row label="Application ID" ok note="app.lovable.rasd" />
        <Row label="الإصدار (versionName)" ok note={APP_VERSION} />
        <Row label="versionCode" ok={false} note="يُضبط يدوياً في build.gradle" />
        <Row label="خادم الإنتاج (HTTPS)" ok note="CAP_ENV=production → الدومين المنشور" />
        <Row label="بدون Live Reload / Mixed Content" ok={androidCfg.score >= 90} />
        <Row label="التوقيع (Signing)" ok={false} note="لا keystore — راجع ANDROID_RELEASE.md" />
        <Row label="جاهزية APK" ok={false} note="بعد إضافة المنصّة + التوقيع" />
        <Row label="جاهزية AAB" ok={false} note="بعد إضافة المنصّة + التوقيع" />
      </Group>

      <Group title="الإعلانات (Ads)">
        <Row label="المزوّد (Provider)" ok={false} note={adsRuntime.provider} />
        <Row label="AdMob App ID (Android)" ok={ads.appIdConfigured} note={ads.appIdConfigured ? undefined : "غير مُعدّ"} />
        <Row label="Banner Unit ID" ok={ads.bannerIdConfigured} note={ads.bannerIdConfigured ? undefined : "غير مُعدّ"} />
        <Row label="الموافقة (Consent)" ok={adsRuntime.consentReady} />
        <Row
          label="الوضع"
          ok={adsRuntime.mode === "production"}
          note={adsRuntime.mode === "production" ? "production" : "test"}
        />
        <Row
          label="الإعلانات مفعّلة فعلياً"
          ok={adsRuntime.adsEnabled}
          note={adsRuntime.adsEnabled ? "مفعّلة" : "معطّلة (لا معرّفات حقيقية)"}
        />
      </Group>

      <Group title="جهات الاتصال">
        <Row label="الاستيراد" ok note="من جهات الجهاز أو ملف vCard" />
        <Row label="ترميز الأسماء (عربي/UTF-8)" ok={encodingOk} />
        <Row label="الحذف (مجزّأ + رسائل خطأ عربية)" ok />
        <Row label="عرض RTL والبحث" ok />
      </Group>

      {blockers.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs space-y-1">
          <div className="font-semibold text-destructive">Blockers ({blockers.length})</div>
          {blockers.map((b, i) => (
            <div key={i}>• {b}</div>
          ))}
        </div>
      )}
    </section>
  );
}

function Row({ label, ok, note }: { label: string; ok: boolean; note?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 rounded-lg bg-muted/40 px-2.5 py-1.5">
      <span className="truncate">{label}</span>
      <span className={cn("shrink-0 font-medium", ok ? "text-success" : "text-destructive")}>
        {note ?? (ok ? "جاهز" : "غير جاهز")}
      </span>
    </div>
  );
}

export default AndroidAdsReadinessSection;
