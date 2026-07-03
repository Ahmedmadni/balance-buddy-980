// =============================================================
// Shared read-only fetchers for health.ts and integrity.ts.
// -------------------------------------------------------------
// Every check here re-derives numbers via existing pure engines
// (computeWalletBalance, computeAssetMetrics, ...) and cross-references
// them against `transactions` / `v_account_statement` — both read-only.
// Nothing here writes, and nothing bypasses RLS (uses the normal client).
// =============================================================
import { supabase } from "@/integrations/supabase/client";
import { computeWalletBalance } from "@/lib/wallet-balance";

const EPSILON = 0.01;

export interface WalletReconciliation {
  walletId: string;
  name: string;
  currency: string;
  computedBalance: number; // via computeWalletBalance (wallet_transactions + expenses) — the figure shown throughout the app
  walletTxOnlyBalance: number; // wallet_transactions only, no opening/expenses — matches what v_account_statement mirrors
  statementBalance: number; // latest v_account_statement.running_balance for this wallet
  diff: number; // walletTxOnlyBalance − statementBalance
  matches: boolean;
}

/**
 * `v_account_statement` (see supabase/migrations, the `_sync_tx_from_*`
 * triggers) is fed ONLY by `wallet_transactions` — the `expenses` and
 * `person_ledger` sync triggers set `affects_balance = (wallet_id IS
 * NULL)`, so a wallet-linked expense/debt row is deliberately excluded
 * from this view. Comparing the view against the full app-facing balance
 * (which does include expenses, via computeWalletBalance) would flag a
 * "mismatch" on every wallet with any expense — a false positive. So we
 * compare like-for-like: wallet_transactions-only balance vs. the view.
 * Full-app balance is still reported (computedBalance) for context/UI.
 */
export async function reconcileWallets(): Promise<WalletReconciliation[]> {
  const [walletsRes, walletTxRes, expensesRes, statementRes] = await Promise.all([
    supabase.from("wallets").select("id,name,opening_balance,currency").eq("is_archived", false),
    supabase.from("wallet_transactions").select("wallet_id,kind,amount"),
    supabase.from("expenses").select("wallet_id,amount"),
    supabase
      .from("v_account_statement")
      .select("account_id,running_balance,happened_at,created_at"),
  ]);

  const txByWallet = new Map<string, { kind: string; amount: number }[]>();
  for (const t of walletTxRes.data ?? []) {
    const a = txByWallet.get(t.wallet_id) ?? [];
    a.push(t);
    txByWallet.set(t.wallet_id, a);
  }
  const expByWallet = new Map<string, { amount: number }[]>();
  for (const e of expensesRes.data ?? []) {
    if (!e.wallet_id) continue;
    const a = expByWallet.get(e.wallet_id) ?? [];
    a.push(e);
    expByWallet.set(e.wallet_id, a);
  }

  // Latest running_balance per account (rows already ordered by the view's window function
  // per account, but we defensively pick the max happened_at/created_at ourselves).
  const latestByAccount = new Map<string, { balance: number; at: string }>();
  for (const r of statementRes.data ?? []) {
    if (!r.account_id) continue;
    const at = `${r.happened_at ?? ""}|${r.created_at ?? ""}`;
    const prev = latestByAccount.get(r.account_id);
    if (!prev || at > prev.at)
      latestByAccount.set(r.account_id, { balance: Number(r.running_balance) || 0, at });
  }

  interface WalletRow {
    id: string;
    name: string;
    opening_balance: number;
    currency: string;
  }
  return ((walletsRes.data ?? []) as WalletRow[]).map((w) => {
    const computedBalance = computeWalletBalance(
      Number(w.opening_balance),
      txByWallet.get(w.id) ?? [],
      expByWallet.get(w.id) ?? [],
    );
    const walletTxOnlyBalance = computeWalletBalance(0, txByWallet.get(w.id) ?? [], []);
    const statementBalance = latestByAccount.get(w.id)?.balance ?? 0;
    const diff = walletTxOnlyBalance - statementBalance;
    return {
      walletId: w.id,
      name: w.name,
      currency: w.currency,
      computedBalance,
      walletTxOnlyBalance,
      statementBalance,
      diff,
      matches: Math.abs(diff) < EPSILON,
    };
  });
}

export interface SyncCountCheck {
  table: string;
  sourceCount: number;
  mirroredCount: number;
  matches: boolean;
}

const SYNCED_TABLES = [
  "wallet_transactions",
  "expenses",
  "person_ledger",
  "investment_transactions",
] as const;

/**
 * Every row in these 4 tables is mirrored 1:1 into `transactions` by DB
 * triggers (_sync_tx_from_*, see supabase/migrations). Comparing row
 * counts is a cheap, exact way to detect a broken/disabled trigger
 * without touching the trigger or the tables themselves.
 */
export async function checkTransactionSync(): Promise<SyncCountCheck[]> {
  const results: SyncCountCheck[] = [];
  for (const table of SYNCED_TABLES) {
    const [sourceRes, mirroredRes] = await Promise.all([
      supabase.from(table).select("*", { count: "exact", head: true }),
      supabase
        .from("transactions")
        .select("*", { count: "exact", head: true })
        .eq("source_kind", table),
    ]);
    const sourceCount = sourceRes.count ?? 0;
    const mirroredCount = mirroredRes.count ?? 0;
    results.push({ table, sourceCount, mirroredCount, matches: sourceCount === mirroredCount });
  }
  return results;
}
