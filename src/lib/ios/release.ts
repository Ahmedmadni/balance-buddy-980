// =============================================================
// PART 3 — generateIOSReleasePlan()
// -------------------------------------------------------------
// Pure documentation, mirroring android/release.ts's shape. iOS has a
// much longer "not started" tail than Android in this project (no
// macOS/Xcode/Apple Developer account available in this session), so
// most steps are honestly `done: false` rather than optimistically
// marked ready.
// =============================================================
import { auditIOSProduction } from "./audit";

export interface IOSReleaseStep {
  id: string;
  order: number;
  label: string;
  done: boolean;
  detail: string;
}

export interface IOSReleasePlan {
  steps: IOSReleaseStep[];
  completedCount: number;
  totalCount: number;
  generatedAt: string;
}

function statusOf(items: { id: string; status: string }[], id: string): boolean {
  return items.find((i) => i.id === id)?.status === "ok";
}

export function generateIOSReleasePlan(): IOSReleasePlan {
  const audit = auditIOSProduction();

  const steps: IOSReleaseStep[] = [
    {
      id: "enroll_apple_developer",
      order: 1,
      label: "التسجيل في Apple Developer Program",
      done: false,
      detail: "عضوية سنوية مدفوعة ($99) — شرط مسبق لكل ما يلي",
    },
    {
      id: "add_ios_platform",
      order: 2,
      label: "إضافة منصّة iOS",
      done: statusOf(audit.items, "info_plist"),
      detail: "npx cap add ios — يتطلّب macOS + Xcode",
    },
    {
      id: "generate_ios_assets",
      order: 3,
      label: "توليد أيقونات وشاشة بداية iOS",
      done: statusOf(audit.items, "app_icons"),
      detail: "bun run android:assets يولّد كلا المنصّتين من نفس المصادر",
    },
    {
      id: "configure_signing",
      order: 4,
      label: "ضبط توقيع Xcode (Provisioning Profile)",
      done: false,
      detail: "Automatic Signing أو Manual Provisioning Profile في Xcode",
    },
    {
      id: "add_privacy_manifest",
      order: 5,
      label: "إضافة PrivacyInfo.xcprivacy",
      done: statusOf(audit.items, "privacy_manifest"),
      detail: "إلزامي من Apple لأي رفعة جديدة",
    },
    {
      id: "decide_apple_signin",
      order: 6,
      label: "تفعيل Apple Sign-In إن لزم",
      done: statusOf(audit.items, "apple_signin"),
      detail: "إلزامي فقط إن عُرضت طرق تسجيل اجتماعية أخرى (مثل Google) — الوضع الحالي: Google فقط",
    },
    {
      id: "build_archive",
      order: 7,
      label: "بناء Archive وتصديره",
      done: false,
      detail: "Xcode Organizer → Archive → Distribute App",
    },
    {
      id: "app_store_connect_listing",
      order: 8,
      label: "تعبئة قائمة App Store Connect",
      done: statusOf(audit.items, "app_store_connect_readiness"),
      detail: "العنوان، الوصف، الكلمات المفتاحية، لقطات الشاشة، خصوصية البيانات",
    },
    {
      id: "submit_review",
      order: 9,
      label: "الإرسال للمراجعة",
      done: false,
      detail: "رفع البناء عبر Transporter/Xcode وإرساله لمراجعة Apple",
    },
  ];

  return {
    steps,
    completedCount: steps.filter((s) => s.done).length,
    totalCount: steps.length,
    generatedAt: new Date().toISOString(),
  };
}
