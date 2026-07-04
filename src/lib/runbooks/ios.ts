// =============================================================
// PART 2 — iOS Release Runbook
// -------------------------------------------------------------
// Pure documentation, mirroring runbooks/android.ts's shape. `done`
// flags are derived from ios-production/project.ts (Prompt 29) rather
// than guessed. This project has no macOS/Xcode/Apple Developer
// account available in this session, so most steps are honestly
// `done: false` rather than optimistically marked ready.
// =============================================================
import { auditIOSProject } from "@/lib/ios-production/project";

export interface IOSReleaseStep {
  id: string;
  order: number;
  label: string;
  done: boolean;
  detail: string;
}

export interface IOSReleaseRunbook {
  steps: IOSReleaseStep[];
  completedCount: number;
  totalCount: number;
  generatedAt: string;
}

function statusOf(items: { id: string; status: string }[], id: string): boolean {
  return items.find((i) => i.id === id)?.status === "ok";
}

export function generateIOSReleaseRunbook(): IOSReleaseRunbook {
  const project = auditIOSProject();

  const steps: IOSReleaseStep[] = [
    {
      id: "install_xcode",
      order: 1,
      label: "Install Xcode",
      done: false,
      detail: "يتطلّب جهاز macOS + تثبيت Xcode من App Store — غير متاح في هذه الجلسة",
    },
    {
      id: "add_capacitor_ios",
      order: 2,
      label: "Add Capacitor iOS",
      done: statusOf(project.items, "ios_folder"),
      detail: "npx cap add ios — ينشئ مجلد ios/ ومشروع Xcode",
    },
    {
      id: "configure_bundle_id",
      order: 3,
      label: "Configure Bundle ID",
      done: statusOf(project.items, "bundle_id"),
      detail: "ضبط Bundle Identifier في Xcode ليطابق appId (app.lovable.rasd)",
    },
    {
      id: "configure_certificates",
      order: 4,
      label: "Configure Certificates",
      done: false,
      detail: "توليد شهادة توزيع (Distribution Certificate) عبر Apple Developer Portal",
    },
    {
      id: "configure_provisioning",
      order: 5,
      label: "Configure Provisioning",
      done: false,
      detail: "إنشاء Provisioning Profile مرتبط بالشهادة وBundle ID",
    },
    {
      id: "archive",
      order: 6,
      label: "Archive",
      done: false,
      detail: "Xcode Organizer → Archive → Distribute App",
    },
    {
      id: "testflight",
      order: 7,
      label: "TestFlight",
      done: false,
      detail: "رفع البناء لـ TestFlight للاختبار الداخلي/الخارجي قبل الإصدار الكامل",
    },
    {
      id: "app_store_release",
      order: 8,
      label: "App Store Release",
      done: false,
      detail: "تقديم البناء للمراجعة عبر App Store Connect بعد استقرار TestFlight",
    },
  ];

  return {
    steps,
    completedCount: steps.filter((s) => s.done).length,
    totalCount: steps.length,
    generatedAt: new Date().toISOString(),
  };
}
