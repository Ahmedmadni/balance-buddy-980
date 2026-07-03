// =============================================================
// PART 4 — auditPWA()
// -------------------------------------------------------------
// Mostly RUNTIME: fetches /manifest.webmanifest live and parses its
// actual fields (so this stays accurate if the manifest changes),
// checks navigator.serviceWorker support/registration, and derives
// installability from Chrome's real installability criteria. One
// STATIC fact: whether a service worker source file exists anywhere in
// the repo at all (verified 2026-07-03: none does).
// =============================================================

export type PWACheckStatus = "ok" | "warning" | "error";

export interface PWACheckItem {
  id: string;
  label: string;
  status: PWACheckStatus;
  detail: string;
}

export interface PWAAuditReport {
  items: PWACheckItem[];
  installable: boolean;
  score: number;
  generatedAt: string;
}

interface ManifestIcon {
  src: string;
  sizes: string;
  type?: string;
  purpose?: string;
}

interface WebManifest {
  name?: string;
  short_name?: string;
  start_url?: string;
  display?: string;
  icons?: ManifestIcon[];
}

export async function auditPWA(): Promise<PWAAuditReport> {
  const items: PWACheckItem[] = [];

  let manifest: WebManifest | null = null;
  try {
    if (typeof fetch !== "undefined") {
      const res = await fetch("/manifest.webmanifest");
      if (res.ok) manifest = (await res.json()) as WebManifest;
    }
  } catch {
    /* offline or not servable from this origin at audit time */
  }

  items.push({
    id: "manifest",
    label: "manifest.json",
    status: manifest ? "ok" : "error",
    detail: manifest
      ? `مُقدَّم فعلياً على /manifest.webmanifest — الاسم: "${manifest.name}"، العرض: ${manifest.display}`
      : "تعذّر جلب /manifest.webmanifest من هذا الأصل وقت الفحص",
  });

  const icons = manifest?.icons ?? [];
  const has192 = icons.some((i) => String(i.sizes).includes("192"));
  const has512 = icons.some((i) => String(i.sizes).includes("512"));
  items.push({
    id: "icons",
    label: "Icons",
    status: has192 && has512 ? "ok" : "warning",
    detail:
      icons.length > 0
        ? `${icons.length} أيقونة معرَّفة في manifest (192: ${has192 ? "✓" : "✗"}, 512: ${has512 ? "✓" : "✗"})`
        : "لا أيقونات في manifest أو تعذّر جلبه",
  });

  const swSupported = typeof navigator !== "undefined" && "serviceWorker" in navigator;
  let swRegistered = false;
  try {
    if (swSupported) {
      const regs = await navigator.serviceWorker.getRegistrations();
      swRegistered = regs.length > 0;
    }
  } catch {
    /* ignore */
  }
  items.push({
    id: "service_worker",
    label: "Service Worker",
    status: swRegistered ? "ok" : "error",
    detail: swRegistered
      ? "مسجَّل فعلياً في هذا المتصفح وقت الفحص"
      : "لا يوجد ملف Service Worker في المشروع إطلاقاً (تحقّق ثابت من المستودع) — بلا هذا، لا عمل دون اتصال ولا تثبيت كامل (Add to Home Screen) في معظم المتصفحات",
  });

  items.push({
    id: "offline_support",
    label: "Offline Support",
    status: swRegistered ? "ok" : "error",
    detail: swRegistered
      ? "الصفحات المخزَّنة عبر الـ Service Worker متاحة دون اتصال"
      : "بلا Service Worker، لا يوجد دعم فعلي لعدم الاتصال على نسخة الويب (نسخة Capacitor الأصلية منفصلة ولا تعتمد على هذا)",
  });

  // Chrome's real installability criteria: manifest + name + icons 192/512 +
  // start_url + display standalone/fullscreen/minimal-ui + an active,
  // controlling service worker.
  const manifestCriteriaOk =
    !!manifest &&
    !!manifest.name &&
    !!manifest.start_url &&
    ["standalone", "fullscreen", "minimal-ui"].includes(manifest.display ?? "") &&
    has192 &&
    has512;
  const installable = manifestCriteriaOk && swRegistered;
  items.push({
    id: "installability",
    label: "Installability",
    status: installable ? "ok" : manifestCriteriaOk ? "warning" : "error",
    detail: installable
      ? "كل معايير Chrome الحقيقية للتثبيت (manifest + أيقونات + Service Worker) مُستوفاة"
      : manifestCriteriaOk
        ? "معايير manifest مُستوفاة، لكن غياب Service Worker يمنع اعتبار الموقع Installable في معظم المتصفحات"
        : "معايير manifest غير مكتملة أو تعذّر جلبه وقت الفحص",
  });

  const okCount = items.filter((i) => i.status === "ok").length;
  return {
    items,
    installable,
    score: Math.round((okCount / items.length) * 100),
    generatedAt: new Date().toISOString(),
  };
}
