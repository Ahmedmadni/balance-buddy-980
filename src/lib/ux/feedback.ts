// =============================================================
// PART 6 — Beta Feedback Engine (local-only).
// -------------------------------------------------------------
// Same localStorage-log convention as audit.ts / errors.ts / notification
// store.ts. Nothing here calls a network, sends anything remotely, or
// touches Supabase — it's a private notebook the user can export
// themselves (via the diagnostic report or Share API) if they choose to.
// =============================================================

export type FeedbackType = "bug" | "suggestion" | "question" | "rating";

export interface BetaFeedbackEntry {
  id: string;
  type: FeedbackType;
  message: string;
  rating?: number; // 1-5, only meaningful when type === "rating"
  context?: Record<string, unknown>;
  createdAt: string;
}

const KEY = "rasd.betaFeedback.v1";
const MAX_ENTRIES = 200;

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `f_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

export function loadBetaFeedback(): BetaFeedbackEntry[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function persist(log: BetaFeedbackEntry[]) {
  if (typeof localStorage === "undefined") return;
  const trimmed = log
    .sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt))
    .slice(0, MAX_ENTRIES);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* quota — best effort */
  }
}

export function submitBetaFeedback(
  type: FeedbackType,
  message: string,
  opts: { rating?: number; context?: Record<string, unknown> } = {},
): BetaFeedbackEntry {
  const entry: BetaFeedbackEntry = {
    id: uuid(),
    type,
    message,
    rating: type === "rating" ? opts.rating : undefined,
    context: opts.context,
    createdAt: new Date().toISOString(),
  };
  const log = loadBetaFeedback();
  log.push(entry);
  persist(log);
  return entry;
}

export function deleteBetaFeedback(id: string) {
  persist(loadBetaFeedback().filter((e) => e.id !== id));
}

export function clearBetaFeedback() {
  if (typeof localStorage === "undefined") return;
  localStorage.removeItem(KEY);
}

export const FEEDBACK_TYPE_LABEL: Record<FeedbackType, string> = {
  bug: "خطأ / عطل",
  suggestion: "اقتراح",
  question: "سؤال",
  rating: "تقييم",
};
