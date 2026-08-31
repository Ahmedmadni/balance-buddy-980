// =============================================================
// Legacy Investment Wallet Link Audit — READ-ONLY.
// -------------------------------------------------------------
// Finds investment_transactions rows that have a wallet_id but no
// matching wallet_transactions mirror keyed on
// (source_kind='investment_transactions', source_id=<row.id>) — i.e.
// transactions created before wallet-sync.ts's linkage was wired into
// the investments page. Nothing here writes anything: no insert, no
// update, no delete, on any table. "possible_matches" are candidate
// suggestions only (amount/date/direction heuristics) — never treated
// as confirmed, never auto-linked, per this prompt's explicit rule.
// =============================================================
import { supabase } from "@/integrations/supabase/client";
import { INFLOW_KINDS, OUTFLOW_KINDS } from "@/lib/wallet-balance";

export type LegacyLinkRisk = "LOW" | "MEDIUM" | "HIGH";
export type MatchConfidence = "low" | "medium" | "high";
export type RecommendedAction =
  | "no_action"
  | "manual_review"
  | "safe_to_link_after_confirmation"
  | "unresolved";

// tx_class values that definitely expect a wallet effect when a wallet is chosen.
const DEFINITE_EFFECT_CLASSES = new Set([
  "capital_contribution",
  "capex",
  "opex",
  "income",
  "sale",
]);
// tx_class values that never expect a wallet effect (excluded from the wallet field in the UI).
const NO_EFFECT_CLASSES = new Set(["adjustment", "personal_benefit"]);

function expectedDirectionKinds(txClass: string | null, kind: string | null): Set<string> | null {
  const cls =
    txClass ??
    (kind === "return" || kind === "withdraw"
      ? "income"
      : kind === "revaluation"
        ? "adjustment"
        : "capex");
  if (cls === "income" || cls === "sale") return INFLOW_KINDS;
  if (cls === "capex" || cls === "opex" || cls === "capital_contribution") return OUTFLOW_KINDS;
  return null; // adjustment / personal_benefit — no expected direction
}

export interface PossibleWalletMatch {
  wallet_tx_id: string;
  wallet_id: string;
  amount: number;
  happened_at: string;
  kind: string;
  confidence: MatchConfidence;
}

export interface LegacyUnlinkedTransaction {
  investment_tx_id: string;
  investment_id: string;
  asset_name: string;
  tx_class: string | null;
  amount: number;
  currency: string;
  happened_at: string;
  wallet_id: string;
  notes: string | null;
  risk: LegacyLinkRisk;
  possible_matches: PossibleWalletMatch[];
}

export interface LegacyInvestmentWalletLinkAudit {
  items: LegacyUnlinkedTransaction[];
  totalUnlinked: number;
  highRiskCount: number;
  mediumRiskCount: number;
  lowRiskCount: number;
  withPossibleMatchesCount: number;
  generatedAt: string;
}

function classifyRisk(txClass: string | null, affectsWallet: boolean | null): LegacyLinkRisk {
  if (txClass && DEFINITE_EFFECT_CLASSES.has(txClass)) {
    // affects_wallet explicitly false contradicts a definite-effect class
    // having a wallet_id at all — that inconsistency is itself uncertain,
    // not a clean "definitely had an effect" case.
    return affectsWallet === false ? "MEDIUM" : "HIGH";
  }
  if (txClass && NO_EFFECT_CLASSES.has(txClass)) return "LOW";
  // Null/unrecognized tx_class — same ambiguity classOf()'s legacy `kind`
  // fallback exists for; can't be certain without re-deriving it live.
  return "MEDIUM";
}

function scoreMatch(
  tx: { amount: number; happened_at: string; tx_class: string | null; kind: string | null },
  candidate: { amount: number; happened_at: string; kind: string },
): MatchConfidence | null {
  const amountMatches = Math.abs(Number(candidate.amount) - Number(tx.amount)) < 0.01;
  if (!amountMatches) return null; // amount is the minimum bar to even surface as a candidate

  const sameDay = candidate.happened_at === tx.happened_at;
  const expected = expectedDirectionKinds(tx.tx_class, tx.kind);
  const directionMatches = expected ? expected.has(candidate.kind) : false;

  if (sameDay && directionMatches) return "high";
  if (sameDay || directionMatches) return "medium";
  return "low";
}

export async function auditLegacyInvestmentWalletLinks(): Promise<LegacyInvestmentWalletLinkAudit> {
  const [invTxRes, investmentsRes, walletTxRes] = await Promise.all([
    supabase
      .from("investment_transactions")
      .select(
        "id,investment_id,tx_class,kind,amount,currency,happened_at,wallet_id,notes,affects_wallet",
      )
      .not("wallet_id", "is", null),
    supabase.from("investments").select("id,name"),
    // Only rows never linked to ANY source are viable candidates — one
    // already claimed by another source_id is not a valid suggestion here.
    supabase
      .from("wallet_transactions")
      .select("id,wallet_id,amount,happened_at,kind,source_kind,source_id"),
  ]);

  const investmentTxs = invTxRes.data ?? [];
  const assetNameById = new Map<string, string>(
    (investmentsRes.data ?? []).map((i: any) => [i.id, i.name]),
  );
  const allWalletTxs = walletTxRes.data ?? [];

  const linkedSourceIds = new Set(
    allWalletTxs
      .filter((w: any) => w.source_kind === "investment_transactions" && w.source_id)
      .map((w: any) => w.source_id as string),
  );
  const unclaimedWalletTxs = allWalletTxs.filter((w: any) => !w.source_id);

  const items: LegacyUnlinkedTransaction[] = investmentTxs
    .filter((t: any) => !linkedSourceIds.has(t.id))
    .map((t: any) => {
      const candidates = unclaimedWalletTxs.filter((w: any) => w.wallet_id === t.wallet_id);
      const possible_matches: PossibleWalletMatch[] = candidates
        .map((w: any) => {
          const confidence = scoreMatch(t, w);
          return confidence
            ? {
                wallet_tx_id: w.id,
                wallet_id: w.wallet_id,
                amount: Number(w.amount),
                happened_at: w.happened_at,
                kind: w.kind,
                confidence,
              }
            : null;
        })
        .filter((m: PossibleWalletMatch | null): m is PossibleWalletMatch => m !== null)
        .sort((a: PossibleWalletMatch, b: PossibleWalletMatch) => {
          const order: Record<MatchConfidence, number> = { high: 0, medium: 1, low: 2 };
          return order[a.confidence] - order[b.confidence];
        })
        .slice(0, 5);

      return {
        investment_tx_id: t.id,
        investment_id: t.investment_id,
        asset_name: assetNameById.get(t.investment_id) ?? "—",
        tx_class: t.tx_class,
        amount: Number(t.amount),
        currency: t.currency,
        happened_at: t.happened_at,
        wallet_id: t.wallet_id,
        notes: t.notes,
        risk: classifyRisk(t.tx_class, t.affects_wallet),
        possible_matches,
      };
    });

  return {
    items,
    totalUnlinked: items.length,
    highRiskCount: items.filter((i) => i.risk === "HIGH").length,
    mediumRiskCount: items.filter((i) => i.risk === "MEDIUM").length,
    lowRiskCount: items.filter((i) => i.risk === "LOW").length,
    withPossibleMatchesCount: items.filter((i) => i.possible_matches.length > 0).length,
    generatedAt: new Date().toISOString(),
  };
}

export interface LegacyInvestmentRepairPlanEntry {
  investment_tx_id: string;
  candidate_wallet_tx_ids: string[];
  confidence: MatchConfidence | "none";
  recommended_action: RecommendedAction;
}

export interface LegacyInvestmentRepairPlan {
  entries: LegacyInvestmentRepairPlanEntry[];
  generatedAt: string;
}

/**
 * Pure proposal generator — documentation only. Never links, never writes.
 * Any future "apply" action is explicitly out of scope for this prompt;
 * every entry here is surfaced to the user as requiring manual review.
 */
export function generateLegacyInvestmentRepairPlan(
  audit: LegacyInvestmentWalletLinkAudit,
): LegacyInvestmentRepairPlan {
  const entries: LegacyInvestmentRepairPlanEntry[] = audit.items.map((item) => {
    const best = item.possible_matches[0] ?? null;

    let recommended_action: RecommendedAction;
    if (item.risk === "LOW") {
      recommended_action = "no_action";
    } else if (!best) {
      recommended_action = "unresolved";
    } else if (best.confidence === "high" && item.possible_matches.length === 1) {
      recommended_action = "safe_to_link_after_confirmation";
    } else {
      recommended_action = "manual_review";
    }

    return {
      investment_tx_id: item.investment_tx_id,
      candidate_wallet_tx_ids: item.possible_matches.map((m) => m.wallet_tx_id),
      confidence: best?.confidence ?? "none",
      recommended_action,
    };
  });

  return { entries, generatedAt: new Date().toISOString() };
}
