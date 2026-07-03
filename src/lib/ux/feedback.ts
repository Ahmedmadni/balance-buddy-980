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

// =============================================================
// PART 4 (Prompt 21) — Beta Feedback Dashboard helpers: sorting,
// filtering, and JSON export. Still purely local — no network call.
// =============================================================

export type FeedbackSortBy = "newest" | "oldest" | "rating";

export function sortBetaFeedback(
  entries: BetaFeedbackEntry[],
  sortBy: FeedbackSortBy = "newest",
): BetaFeedbackEntry[] {
  const sorted = [...entries];
  if (sortBy === "oldest") return sorted.sort((a, b) => +new Date(a.createdAt) - +new Date(b.createdAt));
  if (sortBy === "rating") return sorted.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  return sorted.sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export function filterBetaFeedback(
  entries: BetaFeedbackEntry[],
  filter: { type?: FeedbackType } = {},
): BetaFeedbackEntry[] {
  if (!filter.type) return entries;
  return entries.filter((e) => e.type === filter.type);
}

export function exportBetaFeedbackAsJson(entries: BetaFeedbackEntry[] = loadBetaFeedback()): string {
  return JSON.stringify(entries, null, 2);
}

export function downloadBetaFeedbackJson(entries: BetaFeedbackEntry[] = loadBetaFeedback()): void {
  const blob = new Blob([exportBetaFeedbackAsJson(entries)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `rasd-beta-feedback-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}
