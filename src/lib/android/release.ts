// =============================================================
// PART 2 — generateAndroidReleasePlan()
// -------------------------------------------------------------
// Pure documentation: an ordered list of the remaining real-world steps
// between "code is ready" and "AAB submitted to Play Console". Each
// step's `done` flag is derived from auditAndroidProduction()'s items
// rather than guessed — no step is invented that isn't grounded in an
// existing check.
// =============================================================
import { auditAndroidProduction } from "./audit";

export interface AndroidReleaseStep {
  id: string;
  order: number;
  label: string;
  done: boolean;
  detail: string;
}

export interface AndroidReleasePlan {
  steps: AndroidReleaseStep[];
  completedCount: number;
  totalCount: number;
  generatedAt: string;
}

function statusOf(items: { id: string; status: string }[], id: string): boolean {
  return items.find((i) => i.id === id)?.status === "ok";
}

export function generateAndroidReleasePlan(): AndroidReleasePlan {
  const audit = auditAndroidProduction();

  const steps: AndroidReleaseStep[] = [
    {
      id: "add_platform",
      order: 1,
      label: "إضافة منصّة Android",
      done: statusOf(audit.items, "capacitor_android"),
      detail: "bun run android:add (مرة واحدة فقط)",
    },
    {
      id: "generate_assets",
      order: 2,
      label: "توليد الأيقونات وشاشة البداية",
      done: false,
      detail: "bun run android:assets — يُنفَّذ بعد إضافة المنصّة",
    },
    {
      id: "disable_live_reload",
      order: 3,
      label: "تعطيل Live Reload وMixed Content",
      done: statusOf(audit.items, "network_security"),
      detail: "تعليق كائن server في capacitor.config.ts وضبط allowMixedContent إلى false",
    },
    {
      id: "generate_keystore",
      order: 4,
      label: "توليد keystore التوقيع",
      done: statusOf(audit.items, "signing_config"),
      detail: "keytool -genkey ... ثم ضبط android/keystore.properties (راجع MOBILE_BUILD.md)",
    },
    {
      id: "bump_version_code",
      order: 5,
      label: "رفع versionCode",
      done: false,
      detail: "زيادة versionCode في android/app/build.gradle قبل كل رفعة جديدة",
    },
    {
      id: "review_manifest",
      order: 6,
      label: "مراجعة AndroidManifest.xml",
      done: false,
      detail: "استبعاد أي صلاحية زائدة قبل الرفع",
    },
    {
      id: "build_aab",
      order: 7,
      label: "بناء AAB موقّع",
      done: false,
      detail: "bun run android:sync ثم bundleRelease عبر Android Studio أو Gradle CLI",
    },
    {
      id: "play_console_listing",
      order: 8,
      label: "تعبئة قائمة Play Console",
      done: statusOf(audit.items, "play_console_readiness"),
      detail: "العنوان، الوصف، لقطات الشاشة، تصنيف المحتوى، نموذج أمان البيانات",
    },
    {
      id: "submit_review",
      order: 9,
      label: "الإرسال للمراجعة",
      done: false,
      detail: "رفع الـ AAB على Play Console وإرساله للمراجعة",
    },
  ];

  return {
    steps,
    completedCount: steps.filter((s) => s.done).length,
    totalCount: steps.length,
    generatedAt: new Date().toISOString(),
  };
}
