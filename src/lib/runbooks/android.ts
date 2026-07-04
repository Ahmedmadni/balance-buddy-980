// =============================================================
// PART 1 — Android Release Runbook
// -------------------------------------------------------------
// Pure documentation of the remaining real-world sequence to actually
// ship on Play Console, from "generate a keystore" through "production
// release" (staged rollout: internal → closed → open → production, the
// real Play Console track progression). `done` flags are derived from
// android-production/{keystore,release-config}.ts (Prompt 29) rather
// than guessed — no step is invented that isn't grounded in an
// existing check.
// =============================================================
import { verifyAndroidSigning } from "@/lib/android-production/keystore";
import { auditAndroidReleaseConfig } from "@/lib/android-production/release-config";

export interface AndroidReleaseStep {
  id: string;
  order: number;
  label: string;
  done: boolean;
  detail: string;
}

export interface AndroidReleaseRunbook {
  steps: AndroidReleaseStep[];
  completedCount: number;
  totalCount: number;
  generatedAt: string;
}

export async function generateAndroidReleaseRunbook(): Promise<AndroidReleaseRunbook> {
  const signing = await verifyAndroidSigning();
  const releaseConfig = auditAndroidReleaseConfig();
  const liveReloadResolved =
    releaseConfig.items.find((i) => i.id === "live_reload")?.status === "ok";

  const steps: AndroidReleaseStep[] = [
    {
      id: "generate_keystore",
      order: 1,
      label: "Generate Keystore",
      done: signing.hasKeystore,
      detail:
        "keytool -genkey -v -keystore rasd-release.keystore -alias rasd -keyalg RSA -keysize 2048 -validity 10000",
    },
    {
      id: "configure_signing",
      order: 2,
      label: "Configure Signing",
      done: signing.hasReleaseSigningConfig,
      detail:
        "ضبط android/keystore.properties + signingConfigs.release في android/app/build.gradle",
    },
    {
      id: "build_aab",
      order: 3,
      label: "Build AAB",
      done: false,
      detail: liveReloadResolved
        ? "bun run android:sync ثم ./gradlew bundleRelease"
        : "يتطلّب أولاً تعطيل Live Reload/Mixed Content في capacitor.config.ts",
    },
    {
      id: "upload_play_console",
      order: 4,
      label: "Upload Play Console",
      done: false,
      detail: "رفع ملف .aab الموقَّع إلى Play Console عبر واجهة الرفع",
    },
    {
      id: "internal_testing",
      order: 5,
      label: "Internal Testing",
      done: false,
      detail: "مسار Play Console الأول — يقتصر على مختبرين مضافين يدوياً بالبريد",
    },
    {
      id: "closed_testing",
      order: 6,
      label: "Closed Testing",
      done: false,
      detail: "توسيع الاختبار لمجموعة مغلقة أكبر عبر رابط انضمام",
    },
    {
      id: "open_testing",
      order: 7,
      label: "Open Testing",
      done: false,
      detail: "اختبار علني عبر Play Store قبل الإصدار الكامل (اختياري لكن مُوصى به)",
    },
    {
      id: "production_release",
      order: 8,
      label: "Production Release",
      done: false,
      detail: "ترقية المسار إلى Production بعد استقرار الاختبار المغلق/العلني",
    },
  ];

  return {
    steps,
    completedCount: steps.filter((s) => s.done).length,
    totalCount: steps.length,
    generatedAt: new Date().toISOString(),
  };
}
