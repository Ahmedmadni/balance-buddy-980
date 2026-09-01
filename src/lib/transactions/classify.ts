// =============================================================
// Canonical wallet_transactions classification.
// -------------------------------------------------------------
// A `wallet_transactions` row can be a plain wallet movement OR a mirror
// written by another module's atomic RPC (person_ledger debt lend/borrow/
// collect/repay, investment_transactions capex/sale, zakat_records payment).
// Mirrored rows correctly reduce the wallet balance and correctly appear in
// raw cash-outflow, but they are NOT personal expenses/income — see
// src/lib/statement.ts's `isMirror` flag, which uses the same source_kind
// field to label these rows "ديون"/"استثمار"/"زكاة" instead of a spend
// category. This mirrors that same distinction for dashboard/report totals.
// =============================================================
export type MirrorSourceKind =
  | "person_ledger"
  | "investment_transactions"
  | "zakat_records"
  | string
  | null
  | undefined;

export function isMirroredWalletTx(sourceKind: MirrorSourceKind): boolean {
  return (
    sourceKind === "person_ledger" ||
    sourceKind === "investment_transactions" ||
    sourceKind === "zakat_records"
  );
}

/** True cash EXPENSE: an outflow wallet_transactions row that isn't a mirror of
 * another module (debt/investment/zakat) — i.e. not a receivable/payable move. */
export function isExpenseWalletTx(
  kind: string,
  sourceKind: MirrorSourceKind,
  outflowKinds: Set<string>,
): boolean {
  return outflowKinds.has(kind) && !isMirroredWalletTx(sourceKind);
}
