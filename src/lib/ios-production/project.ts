// =============================================================
// PART 2 — iOS Project Bootstrap Audit
// -------------------------------------------------------------
// STATIC facts verified by reading the repo directly (2026-07-04):
// there is no ios/ directory, no .xcodeproj/.xcworkspace, and no
// `ios:` key in capacitor.config.ts anywhere in this project — iOS has
// never been bootstrapped here (release/ios-audit.ts established this
// same fact for the store-listing audit; this module covers the
// project-structure side instead).
// =============================================================
import type { HealthStatus } from "@/lib/system/health";

const PACKAGE_NAME_MIRROR = "app.lovable.rasd"; // same appId Capacitor would use as the iOS Bundle ID

export interface IOSProjectCheckItem {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export interface IOSProjectAudit {
  items: IOSProjectCheckItem[];
  score: number;
  generatedAt: string;
}

export function auditIOSProject(): IOSProjectAudit {
  const items: IOSProjectCheckItem[] = [
    {
      id: "ios_folder",
      label: "مجلد ios/",
      status: "error",
      detail: "غير موجود — منصّة iOS لم تُضَف إطلاقاً (npx cap add ios يتطلب macOS + Xcode)",
    },
    {
      id: "xcode_project",
      label: "مشروع Xcode (.xcodeproj/.xcworkspace)",
      status: "error",
      detail: "غير موجود — يُولَّد تلقائياً فقط عند إضافة منصّة iOS",
    },
    {
      id: "bundle_id",
      label: "Bundle Identifier",
      status: "warning",
      detail: `سيُستخدم ${PACKAGE_NAME_MIRROR} نفسه (نفس appId في capacitor.config.ts) عند الإضافة — لا Info.plist فعلي بعد يحمله`,
    },
    {
      id: "capabilities",
      label: "Capabilities (Push/Associated Domains)",
      status: "warning",
      detail:
        "لا capabilities مضافة في Xcode (لا مشروع Xcode أصلاً) — لا حاجة فعلية حالياً (لا Push حقيقي، لا Universal Links)",
    },
    {
      id: "entitlements",
      label: "ملف .entitlements",
      status: "error",
      detail: "غير موجود — يُولَّد فقط عند إضافة منصّة iOS وتفعيل أي Capability",
    },
  ];

  const okCount = items.filter((i) => i.status === "ok").length;
  return {
    items,
    score: Math.round((okCount / items.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
