// Helpers to keep wallet_transactions in sync with source records
// (person_ledger, investment_transactions, zakat_records).
import { supabase } from "@/integrations/supabase/client";

export type SourceKind = "person_ledger" | "investment_transactions" | "zakat_records";

// For person_ledger: +1 = wallet outflow (lend/pay), -1 = wallet inflow (borrow/collect)
export function personLedgerWalletKind(k: string): "withdraw" | "deposit" {
  // lend (سلّفته) → withdraw, borrow (اقترضت) → deposit, collect (حصّلت) → deposit, pay (سددت) → withdraw
  return k === "lend" || k === "pay" ? "withdraw" : "deposit";
}

export function investmentWalletKind(k: string): "withdraw" | "deposit" | null {
  if (k === "capital_add") return "withdraw"; // money leaving wallet into investment
  if (k === "return" || k === "withdraw") return "deposit"; // returns/withdrawals come back to wallet
  return null; // revaluation has no cash effect
}

type Params = {
  userId: string;
  walletId: string | null;
  walletKind: "withdraw" | "deposit" | null;
  amount: number;
  currency: string;
  happenedAt: string;
  notes: string | null;
  source: { kind: SourceKind; id: string };
};

/** Create / update / delete the mirror wallet_transactions row for a source record. */
export async function syncWalletTx(p: Params) {
  // Find existing mirror
  const { data: existing } = await supabase
    .from("wallet_transactions")
    .select("id")
    .eq("source_kind", p.source.kind)
    .eq("source_id", p.source.id)
    .maybeSingle();

  // No wallet selected or no cash effect → delete any existing mirror
  if (!p.walletId || !p.walletKind) {
    if (existing) await supabase.from("wallet_transactions").delete().eq("id", (existing as any).id);
    return;
  }

  const payload = {
    user_id: p.userId,
    wallet_id: p.walletId,
    kind: p.walletKind,
    amount: p.amount,
    currency: p.currency,
    happened_at: p.happenedAt,
    notes: p.notes,
    source_kind: p.source.kind,
    source_id: p.source.id,
  };

  if (existing) {
    await supabase.from("wallet_transactions").update(payload).eq("id", (existing as any).id);
  } else {
    await supabase.from("wallet_transactions").insert(payload as any);
  }
}

/** Delete the mirror wallet tx for a deleted source record. */
export async function deleteWalletTxForSource(kind: SourceKind, id: string) {
  await supabase.from("wallet_transactions").delete().eq("source_kind", kind).eq("source_id", id);
}
