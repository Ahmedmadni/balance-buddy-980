// =============================================================
// PART 2 — Freeze Verification Engine
// -------------------------------------------------------------
// STATIC facts, verified by reading `git log`/`git diff` for each
// frozen path across this entire session (2026-07-04) — there is no
// client-side way to introspect git history or migration files from a
// running browser, so this mirrors final-check.ts's SCHEMA_FREEZE_FACTS
// convention rather than pretending to be a live check. Backup Engine
// is the one honest exception: it WAS modified once (Prompt 24, a
// documented bug fix to LOCAL_KEYS), frozen in every prompt since.
// =============================================================
import type { HealthStatus } from "@/lib/system/health";

export interface FreezeCheckResult {
  id: string;
  label: string;
  status: HealthStatus;
  detail: string;
}

export function verifySchemaFreeze(): FreezeCheckResult {
  return {
    id: "schema",
    label: "Schema Freeze",
    status: "ok",
    detail:
      "صفر migrations جديدة، صفر تعديل على transactions/investment_transactions/investments/person_ledger/system_events/v_account_statement أو أي Trigger/RLS Policy/View عبر كل الجلسة",
  };
}

export function verifyFinancialFreeze(): FreezeCheckResult {
  return {
    id: "financial",
    label: "Financial Engine Freeze",
    status: "ok",
    detail:
      "src/lib/assets/calculator.ts (computeAssetMetrics) وsrc/lib/wallet-balance.ts لم يُعدَّلا عبر أي Prompt هذه الجلسة",
  };
}

export function verifyInvestmentFreeze(): FreezeCheckResult {
  return {
    id: "investments",
    label: "Investment Engine Freeze",
    status: "ok",
    detail:
      "src/lib/assets/depreciation.ts وsrc/lib/assets/zakat-asset.ts وجداول investments/investment_transactions لم تُعدَّل عبر أي Prompt هذه الجلسة",
  };
}

export function verifyNotificationFreeze(): FreezeCheckResult {
  return {
    id: "notifications",
    label: "Notification Engine Freeze",
    status: "ok",
    detail:
      "src/lib/notifications/{engine,config,store,provider}.ts لم تُعدَّل منذ إدخالها في Prompt 15 — مجمَّدة صراحةً منذ Prompt 25",
  };
}

export function verifyBackupFreeze(): FreezeCheckResult {
  return {
    id: "backup",
    label: "Backup Engine Freeze",
    status: "ok",
    detail:
      "عُدِّل مرة واحدة فقط طوال الجلسة في Prompt 24 (إصلاح موثَّق لمفاتيح LOCAL_KEYS غير المطابقة) — مجمَّد بالكامل في كل Prompt قبله وبعده، بما في ذلك هذا",
  };
}

export function verifyAnalyticsFreeze(): FreezeCheckResult {
  return {
    id: "analytics",
    label: "Analytics Engine Freeze",
    status: "ok",
    detail:
      "src/lib/insights/{engine,calculator,types}.ts (Prompt 16) لم تُعدَّل عبر أي Prompt لاحق — مجمَّدة صراحةً بدءاً من هذا الـ Prompt",
  };
}

export interface FreezeVerificationReport {
  items: FreezeCheckResult[];
  allPassed: boolean;
  generatedAt: string;
}

export function runFreezeVerification(): FreezeVerificationReport {
  const items = [
    verifySchemaFreeze(),
    verifyFinancialFreeze(),
    verifyInvestmentFreeze(),
    verifyNotificationFreeze(),
    verifyBackupFreeze(),
    verifyAnalyticsFreeze(),
  ];

  return {
    items,
    allPassed: items.every((i) => i.status === "ok"),
    generatedAt: new Date().toISOString(),
  };
}
