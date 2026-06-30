// Reminder & Event Engine — read-only aggregator.
// Pulls upcoming events from existing tables (person_ledger, recurring_expenses,
// investments.meta, depreciation_profiles, asset_market_values, zakat_settings)
// and merges them with user-defined rows from `system_events`.
// No notifications, no triggers, no schema mutation of source tables.

import { supabase } from "@/integrations/supabase/client";

export type EventType =
  | "payment_due"
  | "installment_due"
  | "maintenance_due"
  | "insurance_expiry"
  | "license_expiry"
  | "warranty_expiry"
  | "review_depreciation"
  | "review_market_value"
  | "zakat_due"
  | "hawl_due"
  | "subscription_due"
  | "recurring_expense_due"
  | "custom";

export type EventPriority = "low" | "normal" | "high" | "critical";
export type EventStatus = "pending" | "snoozed" | "done" | "dismissed";

export interface UpcomingEvent {
  id: string;
  source: "system_events" | "derived";
  event_type: EventType;
  entity_type: string | null;
  entity_id: string | null;
  title: string;
  description?: string | null;
  due_date: string; // ISO
  priority: EventPriority;
  status: EventStatus;
  metadata?: Record<string, any>;
}

export interface UpcomingBuckets {
  overdue: UpcomingEvent[];
  today: UpcomingEvent[];
  this_week: UpcomingEvent[];
  this_month: UpcomingEvent[];
  all: UpcomingEvent[];
}

export const EVENT_LABEL: Record<EventType, string> = {
  payment_due: "استحقاق دين",
  installment_due: "قسط مستحق",
  maintenance_due: "صيانة أصل",
  insurance_expiry: "انتهاء تأمين",
  license_expiry: "انتهاء ترخيص",
  warranty_expiry: "انتهاء ضمان",
  review_depreciation: "مراجعة إهلاك",
  review_market_value: "مراجعة قيمة سوقية",
  zakat_due: "زكاة مستحقة",
  hawl_due: "حلول الحول",
  subscription_due: "اشتراك مستحق",
  recurring_expense_due: "مصروف دوري",
  custom: "حدث مخصّص",
};

export const PRIORITY_LABEL: Record<EventPriority, string> = {
  low: "منخفضة", normal: "عادية", high: "مرتفعة", critical: "حرجة",
};

function daysBetween(a: Date, b: Date) {
  const ms = a.getTime() - b.getTime();
  return Math.floor(ms / (1000 * 60 * 60 * 24));
}

function inferPriority(daysOut: number, type: EventType): EventPriority {
  if (daysOut < 0) return "critical";
  if (daysOut <= 2) return "high";
  if (daysOut <= 7) return "normal";
  if (type === "review_market_value" || type === "review_depreciation") return "low";
  return "normal";
}

export interface ReminderPrefs {
  enabled: boolean;
  period_days: number; // look-ahead horizon
  rules: Partial<Record<EventType, EventPriority>>;
}
export const DEFAULT_REMINDER_PREFS: ReminderPrefs = {
  enabled: true,
  period_days: 30,
  rules: {},
};
const PREFS_KEY = "rasd.reminderPrefs.v1";
export function loadReminderPrefs(): ReminderPrefs {
  try {
    return { ...DEFAULT_REMINDER_PREFS, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") };
  } catch { return DEFAULT_REMINDER_PREFS; }
}
export function saveReminderPrefs(p: ReminderPrefs) {
  localStorage.setItem(PREFS_KEY, JSON.stringify(p));
}

export async function computeUpcomingEvents(opts?: { horizonDays?: number }): Promise<UpcomingBuckets> {
  const prefs = loadReminderPrefs();
  const horizon = opts?.horizonDays ?? prefs.period_days ?? 30;
  const events: UpcomingEvent[] = [];
  const now = new Date();
  const today0 = new Date(now); today0.setHours(0, 0, 0, 0);

  const [sysRes, ledgerRes, recRes, invRes, depRes, mvRes, zsRes] = await Promise.all([
    supabase.from("system_events").select("*").neq("status", "done").neq("status", "dismissed"),
    supabase.from("person_ledger").select("id,contact_name,kind,amount,currency,due_date,status,settled_at").in("kind", ["lend", "borrow"]),
    supabase.from("recurring_expenses").select("id,name,amount,currency,next_due,is_active").eq("is_active", true),
    supabase.from("investments").select("id,name,currency,meta,asset_kind"),
    supabase.from("depreciation_profiles").select("id,investment_id,start_date,useful_life_months,is_active").eq("is_active", true),
    supabase.from("asset_market_values").select("investment_id,valuation_date"),
    supabase.from("zakat_settings").select("base_currency,last_haul_start_date"),
  ]);

  // 1) User-created system_events
  for (const r of sysRes.data ?? []) {
    const meta = r.metadata && typeof r.metadata === "object" && !Array.isArray(r.metadata)
      ? (r.metadata as Record<string, any>) : {};
    events.push({
      id: r.id, source: "system_events", event_type: r.event_type as EventType,
      entity_type: r.entity_type, entity_id: r.entity_id, title: r.title,
      description: r.description, due_date: r.due_date,
      priority: (r.priority as EventPriority) || "normal",
      status: (r.status as EventStatus) || "pending",
      metadata: meta,
    });
  }

  // 2) Debt due dates
  for (const d of ledgerRes.data ?? []) {
    if (!d.due_date || d.settled_at) continue;
    const due = new Date(d.due_date);
    const daysOut = daysBetween(due, today0);
    if (daysOut > horizon) continue;
    events.push({
      id: `pl:${d.id}`, source: "derived", event_type: "payment_due",
      entity_type: "person_ledger", entity_id: d.id,
      title: `${d.kind === "lend" ? "تحصيل من" : "سداد لـ"} ${d.contact_name}`,
      description: `${d.amount} ${d.currency}`,
      due_date: due.toISOString(),
      priority: inferPriority(daysOut, "payment_due"),
      status: "pending",
      metadata: { amount: d.amount, currency: d.currency, kind: d.kind },
    });
  }

  // 3) Recurring expenses
  for (const r of recRes.data ?? []) {
    if (!r.next_due) continue;
    const due = new Date(r.next_due);
    const daysOut = daysBetween(due, today0);
    if (daysOut > horizon) continue;
    events.push({
      id: `re:${r.id}`, source: "derived", event_type: "recurring_expense_due",
      entity_type: "recurring_expenses", entity_id: r.id,
      title: r.name, description: `${r.amount} ${r.currency}`,
      due_date: due.toISOString(),
      priority: inferPriority(daysOut, "recurring_expense_due"),
      status: "pending",
      metadata: { amount: r.amount, currency: r.currency },
    });
  }

  // 4) Asset meta dates (maintenance / insurance / license / warranty)
  const assetDateFields: { key: string; type: EventType }[] = [
    { key: "maintenance_date", type: "maintenance_due" },
    { key: "insurance_expiry", type: "insurance_expiry" },
    { key: "license_expiry", type: "license_expiry" },
    { key: "warranty_expiry", type: "warranty_expiry" },
  ];
  for (const a of invRes.data ?? []) {
    const meta = (a.meta || {}) as Record<string, any>;
    for (const f of assetDateFields) {
      const raw = meta[f.key];
      if (!raw) continue;
      const due = new Date(raw);
      if (Number.isNaN(due.getTime())) continue;
      const daysOut = daysBetween(due, today0);
      if (daysOut > horizon) continue;
      events.push({
        id: `inv:${a.id}:${f.key}`, source: "derived", event_type: f.type,
        entity_type: "investments", entity_id: a.id,
        title: `${EVENT_LABEL[f.type]} — ${a.name}`,
        due_date: due.toISOString(),
        priority: inferPriority(daysOut, f.type),
        status: "pending",
        metadata: { asset_kind: a.asset_kind, field: f.key },
      });
    }
  }

  // 5) Depreciation review (annual anniversary of start_date)
  for (const dp of depRes.data ?? []) {
    if (!dp.start_date) continue;
    const start = new Date(dp.start_date);
    const next = new Date(start);
    const yearsPassed = Math.max(0, today0.getFullYear() - start.getFullYear());
    next.setFullYear(start.getFullYear() + yearsPassed);
    if (next < today0) next.setFullYear(next.getFullYear() + 1);
    const daysOut = daysBetween(next, today0);
    if (daysOut > horizon) continue;
    const asset = (invRes.data ?? []).find((x) => x.id === dp.investment_id);
    events.push({
      id: `dep:${dp.id}`, source: "derived", event_type: "review_depreciation",
      entity_type: "depreciation_profiles", entity_id: dp.id,
      title: `مراجعة إهلاك — ${asset?.name ?? "أصل"}`,
      due_date: next.toISOString(),
      priority: inferPriority(daysOut, "review_depreciation"),
      status: "pending",
    });
  }

  // 6) Market value review — if latest valuation > 90 days old
  const mvByAsset = new Map<string, string>();
  for (const m of mvRes.data ?? []) {
    const prev = mvByAsset.get(m.investment_id);
    if (!prev || new Date(m.valuation_date) > new Date(prev)) mvByAsset.set(m.investment_id, m.valuation_date);
  }
  for (const a of invRes.data ?? []) {
    const last = mvByAsset.get(a.id);
    if (!last) continue;
    const reviewAt = new Date(last);
    reviewAt.setDate(reviewAt.getDate() + 90);
    const daysOut = daysBetween(reviewAt, today0);
    if (daysOut > horizon) continue;
    events.push({
      id: `mv:${a.id}`, source: "derived", event_type: "review_market_value",
      entity_type: "investments", entity_id: a.id,
      title: `تحديث قيمة سوقية — ${a.name}`,
      due_date: reviewAt.toISOString(),
      priority: inferPriority(daysOut, "review_market_value"),
      status: "pending",
    });
  }

  // 7) Zakat haul (Hijri ≈ 354 days from last haul start)
  for (const z of zsRes.data ?? []) {
    if (!z.last_haul_start_date) continue;
    const due = new Date(z.last_haul_start_date);
    due.setDate(due.getDate() + 354);
    const daysOut = daysBetween(due, today0);
    if (daysOut > horizon) continue;
    events.push({
      id: `zk:${z.last_haul_start_date}`, source: "derived",
      event_type: daysOut <= 0 ? "zakat_due" : "hawl_due",
      entity_type: "zakat_settings", entity_id: null,
      title: daysOut <= 0 ? "زكاة مستحقة" : "اقتراب حلول الحول",
      due_date: due.toISOString(),
      priority: inferPriority(daysOut, "zakat_due"),
      status: "pending",
      metadata: { currency: z.base_currency },
    });
  }

  // Apply user priority rules
  if (prefs.rules) {
    for (const e of events) {
      const override = prefs.rules[e.event_type];
      if (override) e.priority = override;
    }
  }

  // Sort by due_date asc
  events.sort((a, b) => +new Date(a.due_date) - +new Date(b.due_date));

  // Bucket
  const endOfToday = new Date(today0); endOfToday.setHours(23, 59, 59, 999);
  const endOfWeek = new Date(today0); endOfWeek.setDate(endOfWeek.getDate() + 7);
  const endOfMonth = new Date(today0); endOfMonth.setDate(endOfMonth.getDate() + 30);

  const buckets: UpcomingBuckets = { overdue: [], today: [], this_week: [], this_month: [], all: events };
  for (const e of events) {
    const d = new Date(e.due_date);
    if (d < today0) buckets.overdue.push(e);
    else if (d <= endOfToday) buckets.today.push(e);
    else if (d <= endOfWeek) buckets.this_week.push(e);
    else if (d <= endOfMonth) buckets.this_month.push(e);
  }
  return buckets;
}

export const PRIORITY_TONE: Record<EventPriority, string> = {
  low: "bg-muted text-muted-foreground border-border",
  normal: "bg-primary/10 text-primary border-primary/30",
  high: "bg-warning/15 text-warning border-warning/30",
  critical: "bg-destructive/15 text-destructive border-destructive/30",
};
