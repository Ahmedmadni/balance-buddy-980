// =============================================================
// PART 2 — trackBetaSession()
// -------------------------------------------------------------
// Local-only usage tracker for Closed Beta operations: session count,
// session duration, pages opened, and feature/dialog usage. No
// analytics SDK, no network call, no user identifiers — everything
// lives in localStorage on this device only, same convention as
// audit.ts / errors.ts / notifications/store.ts / ux/feedback.ts.
//
// A "session" is a burst of activity: it continues across page
// navigations as long as the app stays open, and a fresh session
// starts once more than SESSION_TIMEOUT_MS has passed since the last
// recorded activity (e.g. the tab was closed and reopened later).
// =============================================================

export interface BetaSessionPageVisit {
  path: string;
  enteredAt: string;
  ms: number; // filled in once the next page visit or a flush happens
}

export interface BetaSessionRecord {
  id: string;
  startedAt: string;
  endedAt: string; // heartbeat — last known activity in this session
  durationMs: number;
  deviceCategory: "mobile" | "tablet" | "desktop";
  isNative: boolean;
  pages: BetaSessionPageVisit[];
  featureUsage: Record<string, number>;
}

const KEY = "rasd.betaSessions.v1";
const MAX_SESSIONS = 100;
const SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes idle => new session

function uuid(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `s_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}

function detectDeviceCategory(): BetaSessionRecord["deviceCategory"] {
  if (typeof window === "undefined") return "desktop";
  const w = window.innerWidth;
  if (w < 640) return "mobile";
  if (w < 1024) return "tablet";
  return "desktop";
}

function detectIsNative(): boolean {
  return (
    typeof window !== "undefined" &&
    !!(
      window as unknown as { Capacitor?: { isNativePlatform?: () => boolean } }
    ).Capacitor?.isNativePlatform?.()
  );
}

function loadSessions(): BetaSessionRecord[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = JSON.parse(localStorage.getItem(KEY) || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

function persistSessions(sessions: BetaSessionRecord[]) {
  if (typeof localStorage === "undefined") return;
  const trimmed = sessions
    .sort((a, b) => +new Date(b.startedAt) - +new Date(a.startedAt))
    .slice(0, MAX_SESSIONS);
  try {
    localStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {
    /* quota — best effort */
  }
}

function getOrCreateCurrentSession(sessions: BetaSessionRecord[]): BetaSessionRecord {
  const latest = sessions[0];
  const now = Date.now();
  if (latest && now - new Date(latest.endedAt).getTime() < SESSION_TIMEOUT_MS) {
    return latest;
  }
  const fresh: BetaSessionRecord = {
    id: uuid(),
    startedAt: new Date().toISOString(),
    endedAt: new Date().toISOString(),
    durationMs: 0,
    deviceCategory: detectDeviceCategory(),
    isNative: detectIsNative(),
    pages: [],
    featureUsage: {},
  };
  sessions.unshift(fresh);
  return fresh;
}

/** Ensures a session exists and bumps its heartbeat. Safe to call often. */
export function trackBetaSession(): BetaSessionRecord {
  const sessions = loadSessions();
  const session = getOrCreateCurrentSession(sessions);
  const now = Date.now();
  session.durationMs = now - new Date(session.startedAt).getTime();
  session.endedAt = new Date(now).toISOString();
  persistSessions(sessions.some((s) => s.id === session.id) ? sessions : [session, ...sessions]);
  return session;
}

/** Call on every route change with the new pathname. Closes out the previous page's duration. */
export function recordPageVisit(path: string): void {
  if (typeof localStorage === "undefined") return;
  const sessions = loadSessions();
  const session = getOrCreateCurrentSession(sessions);
  const now = Date.now();

  const lastPage = session.pages[session.pages.length - 1];
  if (lastPage && lastPage.ms === 0) {
    lastPage.ms = now - new Date(lastPage.enteredAt).getTime();
  }
  if (!lastPage || lastPage.path !== path) {
    session.pages.push({ path, enteredAt: new Date(now).toISOString(), ms: 0 });
  } else {
    // Same path re-entered (e.g. re-render) — restart its timer instead of duplicating.
    lastPage.enteredAt = new Date(now).toISOString();
    lastPage.ms = 0;
  }

  session.durationMs = now - new Date(session.startedAt).getTime();
  session.endedAt = new Date(now).toISOString();
  persistSessions(sessions.some((s) => s.id === session.id) ? sessions : [session, ...sessions]);
}

/** Closes out whatever page is currently open — call on beforeunload. */
export function finalizeCurrentPage(): void {
  if (typeof localStorage === "undefined") return;
  const sessions = loadSessions();
  const session = sessions[0];
  if (!session) return;
  const lastPage = session.pages[session.pages.length - 1];
  const now = Date.now();
  if (lastPage && lastPage.ms === 0) {
    lastPage.ms = now - new Date(lastPage.enteredAt).getTime();
  }
  session.durationMs = now - new Date(session.startedAt).getTime();
  session.endedAt = new Date(now).toISOString();
  persistSessions(sessions);
}

/** Call when the user triggers a tracked feature (quick action, dialog, etc). */
export function recordFeatureUse(feature: string): void {
  if (typeof localStorage === "undefined") return;
  const sessions = loadSessions();
  const session = getOrCreateCurrentSession(sessions);
  session.featureUsage[feature] = (session.featureUsage[feature] ?? 0) + 1;
  session.endedAt = new Date().toISOString();
  persistSessions(sessions.some((s) => s.id === session.id) ? sessions : [session, ...sessions]);
}

/** Instrumented dialogs call this on open — pairs with recordDialogSaved() to detect abandonment. */
export function recordDialogOpened(dialogId: string): void {
  recordFeatureUse(`dialog_open:${dialogId}`);
}
export function recordDialogSaved(dialogId: string): void {
  recordFeatureUse(`dialog_save:${dialogId}`);
}

export interface BetaPageStat {
  path: string;
  visits: number;
  totalMs: number;
  avgMs: number;
}

export interface BetaSessionStats {
  totalSessions: number;
  totalDurationMs: number;
  averageSessionDurationMs: number;
  pagesVisited: BetaPageStat[];
  mostUsedFeatures: { feature: string; count: number }[];
  featureUsageTotals: Record<string, number>;
  mobileSessionsPercent: number; // % of sessions on a native app or a mobile/tablet-width browser
}

export function getBetaSessionStats(): BetaSessionStats {
  const sessions = loadSessions();
  const totalSessions = sessions.length;
  const totalDurationMs = sessions.reduce((s, x) => s + x.durationMs, 0);

  const pageMap = new Map<string, { visits: number; totalMs: number }>();
  const featureUsageTotals: Record<string, number> = {};
  let mobileSessions = 0;

  for (const session of sessions) {
    if (session.isNative || session.deviceCategory !== "desktop") mobileSessions++;
    for (const p of session.pages) {
      const entry = pageMap.get(p.path) ?? { visits: 0, totalMs: 0 };
      entry.visits += 1;
      entry.totalMs += p.ms;
      pageMap.set(p.path, entry);
    }
    for (const [feature, count] of Object.entries(session.featureUsage)) {
      featureUsageTotals[feature] = (featureUsageTotals[feature] ?? 0) + count;
    }
  }

  const pagesVisited: BetaPageStat[] = Array.from(pageMap.entries()).map(([path, v]) => ({
    path,
    visits: v.visits,
    totalMs: v.totalMs,
    avgMs: v.visits > 0 ? Math.round(v.totalMs / v.visits) : 0,
  }));

  const mostUsedFeatures = Object.entries(featureUsageTotals)
    .filter(([feature]) => !feature.startsWith("dialog_"))
    .map(([feature, count]) => ({ feature, count }))
    .sort((a, b) => b.count - a.count);

  return {
    totalSessions,
    totalDurationMs,
    averageSessionDurationMs: totalSessions > 0 ? Math.round(totalDurationMs / totalSessions) : 0,
    pagesVisited,
    mostUsedFeatures,
    featureUsageTotals,
    mobileSessionsPercent:
      totalSessions > 0 ? Math.round((mobileSessions / totalSessions) * 100) : 0,
  };
}
