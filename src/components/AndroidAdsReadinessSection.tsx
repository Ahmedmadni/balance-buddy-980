import { useMemo } from "react";
import { getContactsRegressionChecklist, contactsRegressionScore } from "@/lib/contacts/regression";
import { auditAdsProduction } from "@/lib/ads/production-audit";
import { auditAndroidReleaseConfig } from "@/lib/android-production/release-config";
import { verifyAndroidSigning } from "@/lib/android/audit";
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

export function AndroidAdsReadinessSection() {
  const ads = useMemo(() => auditAdsProduction(), []);
  const androidCfg = useMemo(() => auditAndroidReleaseConfig(), []);
  const checks = useMemo(() => getContactsRegressionChecklist(), []);
  const contactsScore = useMemo(() => contactsRegressionScore(), []);

  const blockers = [
    ...ads.blockers,
    ...(androidCfg.blockers ?? []),
    ...(checks.some((c) => c.status === "auto-fail") ? ["فشل أحد اختبارات ترميز أسماء جهات الاتصال"] : []),
  ];

  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4">
      <div>
        <h2 className="font-bold">جاهزية Android والإعلانات</h2>
        <p className="text-xs text-muted-foreground mt-0.5">Android &amp; Ads Production Readiness</p>
      </div>

      <div className="grid grid-cols-3 gap-2">
        <ScoreChip label="ANDROID" score={androidCfg.score} />
        <ScoreChip label="CONTACTS" score={contactsScore} />
        <ScoreChip label="ADS" score={ads.score} />
      </div>

      <div className="space-y-1 text-xs">
        <Row label="منصّة android/ مثبّتة" ok={false} note="لم تُضف بعد — bun run android:add" />
        <Row label="Application ID" ok note="app.lovable.rasd" />
        <Row label="إعداد الإصدار (Release config)" ok={androidCfg.score >= 90} />
        <Row label="توقيع الإصدار (Signing)" ok={false} note="لا keystore — راجع MOBILE_BUILD.md" />
        <Row label="AdMob App ID" ok={ads.appIdConfigured} note={ads.appIdConfigured ? undefined : "placeholder"} />
        <Row label="Banner Unit ID" ok={ads.bannerIdConfigured} />
        <Row label="AdMob SDK" ok={ads.androidSdkIntegrated} note="لا SDK — الوضع الحالي Noop/Test فقط" />
        <Row label="ربط الموافقة (Consent)" ok={ads.consentIntegrated} />
        <Row label="وضع الاختبار (Test IDs)" ok={ads.testModeActive} note="مطلوب قبل الإنتاج" />
        <Row label="ترميز أسماء جهات الاتصال" ok={!checks.some((c) => c.status === "auto-fail")} />
        <Row label="حذف جهات الاتصال (chunked + error mapping)" ok />
      </div>

      {blockers.length > 0 && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-3 text-xs space-y-1">
          <div className="font-semibold text-destructive">Blockers ({blockers.length})</div>
          {blockers.map((b, i) => <div key={i}>• {b}</div>)}
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
