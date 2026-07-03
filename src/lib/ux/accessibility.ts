// =============================================================
// PART 4 — auditAccessibility()
// -------------------------------------------------------------
// Two kinds of checks, clearly labeled:
//  - "runtime": live DOM probes of whatever page is on screen when this
//    runs (typically the /app/system diagnostics page itself) — real
//    measurements, not estimates.
//  - "static": facts verified once by reading the source (shadcn/ui
//    primitives, __root.tsx) — this module reports them, it does not
//    re-scan files at runtime. Update the static entries by hand if
//    those files change.
// No contrast-ratio math is attempted — that needs rendered pixel
// sampling this module doesn't have access to; the "contrast" check
// only confirms the app declares/toggles a light+dark color scheme.
// =============================================================

export type CheckStatus = "ok" | "warning" | "error";
export type CheckMethod = "runtime" | "static";

export interface AccessibilityCheckItem {
  id: string;
  label: string;
  status: CheckStatus;
  method: CheckMethod;
  detail: string;
}

export interface AccessibilityAuditReport {
  items: AccessibilityCheckItem[];
  score: number; // 0-100
  generatedAt: string;
}

function hasAccessibleName(el: Element): boolean {
  if (el.getAttribute("aria-label")?.trim()) return true;
  if (el.getAttribute("aria-labelledby")?.trim()) return true;
  if (el.getAttribute("title")?.trim()) return true;
  if (el.textContent?.trim()) return true;
  if (el instanceof HTMLInputElement && el.labels && el.labels.length > 0) return true;
  return false;
}

export function auditAccessibility(): AccessibilityAuditReport {
  const items: AccessibilityCheckItem[] = [];
  const hasDom = typeof document !== "undefined";

  // ----- Contrast (static + light runtime confirmation) -----
  const colorScheme = hasDom ? document.documentElement.style.colorScheme : "";
  items.push({
    id: "contrast",
    label: "Contrast (وضع فاتح/داكن)",
    method: "runtime",
    status: colorScheme === "light" || colorScheme === "dark" ? "ok" : "warning",
    detail: colorScheme
      ? `التطبيق يضبط color-scheme صراحة (${colorScheme}) — الألوان معرَّفة عبر CSS variables لكلا الوضعين`
      : "لم يُضبط color-scheme على هذه الصفحة وقت الفحص",
  });

  // ----- Keyboard Navigation -----
  const positiveTabindex = hasDom
    ? document.querySelectorAll('[tabindex]:not([tabindex="0"]):not([tabindex="-1"])').length
    : 0;
  items.push({
    id: "keyboard_nav",
    label: "Keyboard Navigation",
    method: "runtime",
    status: positiveTabindex === 0 ? "ok" : "warning",
    detail:
      positiveTabindex === 0
        ? "لا يوجد tabindex موجب يكسر ترتيب التنقّل الطبيعي بلوحة المفاتيح في هذه الصفحة"
        : `${positiveTabindex} عنصر بـ tabindex موجب — يكسر ترتيب Tab الطبيعي`,
  });

  // ----- Screen Reader Labels -----
  let missingLabels = 0;
  let interactiveCount = 0;
  if (hasDom) {
    const interactive = document.querySelectorAll<HTMLElement>(
      "button, a[href], input, select, textarea",
    );
    interactiveCount = interactive.length;
    interactive.forEach((el) => {
      if (!hasAccessibleName(el)) missingLabels++;
    });
  }
  items.push({
    id: "screen_reader_labels",
    label: "Screen Reader Labels",
    method: "runtime",
    status: interactiveCount === 0 ? "warning" : missingLabels === 0 ? "ok" : "warning",
    detail:
      interactiveCount === 0
        ? "لا توجد عناصر تفاعلية في الصفحة الحالية وقت الفحص"
        : `${interactiveCount - missingLabels}/${interactiveCount} عنصر تفاعلي له اسم واضح لقارئ الشاشة`,
  });

  // ----- Focus States (static — verified in shadcn/ui primitives) -----
  items.push({
    id: "focus_states",
    label: "Focus States",
    method: "static",
    status: "ok",
    detail:
      "مكوّنات button/input الأساسية (src/components/ui) تستخدم focus-visible:ring-1 بدل إزالة outline-none بلا بديل",
  });

  // ----- Touch Targets -----
  let smallTargets = 0;
  let measuredTargets = 0;
  if (hasDom) {
    const clickable = document.querySelectorAll<HTMLElement>("button, a[href]");
    clickable.forEach((el) => {
      const rect = el.getBoundingClientRect();
      if (rect.width === 0 && rect.height === 0) return; // not rendered/visible
      measuredTargets++;
      if (rect.width < 24 || rect.height < 24) smallTargets++;
    });
  }
  items.push({
    id: "touch_targets",
    label: "Touch Targets (≥24px)",
    method: "runtime",
    status: measuredTargets === 0 ? "warning" : smallTargets === 0 ? "ok" : "warning",
    detail:
      measuredTargets === 0
        ? "لا توجد عناصر قابلة للنقر مرئية على هذه الصفحة وقت الفحص"
        : `${measuredTargets - smallTargets}/${measuredTargets} عنصر قابل للنقر بحجم ≥24px`,
  });

  const score = Math.round((items.filter((i) => i.status === "ok").length / items.length) * 100);
  return { items, score, generatedAt: new Date().toISOString() };
}
