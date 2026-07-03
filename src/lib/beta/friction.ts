// =============================================================
// PART 5 — detectUserFriction()
// -------------------------------------------------------------
// Reuses real signals already tracked elsewhere instead of building a
// second measurement system:
//  - quick_exit: page-visit durations from the session tracker.
//  - no_action_page: pages already flagged "missing" by
//    ux/empty-states.ts's static audit (no CTA in the empty state).
//  - multi_step: operations already flagged as exceeding the 2-tap
//    limit by ux/quick-actions.ts's static audit.
//  - dialog_abandoned: open/save pairs from dialogs that call
//    recordDialogOpened()/recordDialogSaved() (see session.ts). Only
//    dialogs that call those two functions are covered — currently
//    the Beta Feedback dialog and the Quick Actions customize dialog;
//    this is a real but partial signal, not full app-wide coverage.
// =============================================================
import { getBetaSessionStats } from "./session";
import { auditEmptyStates } from "@/lib/ux/empty-states";
import { auditQuickActions } from "@/lib/ux/quick-actions";

export type FrictionCategory = "quick_exit" | "no_action_page" | "multi_step" | "dialog_abandoned";
export type FrictionSeverity = "low" | "medium" | "high";

export interface FrictionSignal {
  id: string;
  category: FrictionCategory;
  label: string;
  detail: string;
  severity: FrictionSeverity;
}

export interface FrictionReport {
  signals: FrictionSignal[];
  generatedAt: string;
}

const QUICK_EXIT_THRESHOLD_MS = 3000;
const INSTRUMENTED_DIALOGS = ["beta_feedback", "quick_actions_customize"];

export function detectUserFriction(): FrictionReport {
  const stats = getBetaSessionStats();
  const emptyStates = auditEmptyStates();
  const quickActions = auditQuickActions();
  const signals: FrictionSignal[] = [];

  for (const p of stats.pagesVisited) {
    if (p.visits >= 2 && p.avgMs > 0 && p.avgMs < QUICK_EXIT_THRESHOLD_MS) {
      signals.push({
        id: `quick_exit:${p.path}`,
        category: "quick_exit",
        label: `مغادرة سريعة: ${p.path}`,
        detail: `${p.visits} زيارات بمتوسط ${(p.avgMs / 1000).toFixed(1)} ثانية لكل زيارة`,
        severity: "medium",
      });
    }
  }

  for (const page of emptyStates.pages) {
    if (page.quality === "missing") {
      signals.push({
        id: `no_action:${page.id}`,
        category: "no_action_page",
        label: `صفحة بلا إجراء واضح: ${page.label}`,
        detail: page.note,
        severity: "high",
      });
    }
  }

  for (const action of quickActions.actions) {
    if (!action.withinLimit) {
      signals.push({
        id: `multi_step:${action.id}`,
        category: "multi_step",
        label: `عملية تحتاج أكثر من ضغطتين: ${action.label}`,
        detail: `${action.taps} ضغطات — ${action.path}`,
        severity: action.taps >= 4 ? "high" : "medium",
      });
    }
  }

  for (const dialogId of INSTRUMENTED_DIALOGS) {
    const opened = stats.featureUsageTotals[`dialog_open:${dialogId}`] ?? 0;
    const saved = stats.featureUsageTotals[`dialog_save:${dialogId}`] ?? 0;
    const abandoned = Math.max(0, opened - saved);
    if (opened > 0 && abandoned > 0) {
      signals.push({
        id: `dialog_abandoned:${dialogId}`,
        category: "dialog_abandoned",
        label: `نافذة أُغلقت دون حفظ: ${dialogId}`,
        detail: `${abandoned} من ${opened} مرة فتح لم تنتهِ بحفظ`,
        severity: abandoned / opened > 0.5 ? "high" : "medium",
      });
    }
  }

  return { signals, generatedAt: new Date().toISOString() };
}
