// Unified statement builder for wallets, people, etc.
import { INFLOW_KINDS, OUTFLOW_KINDS, walletKindMeta } from "@/lib/wallet-balance";
import { kindMeta, kindSign } from "@/components/PersonTxForm";

export type StatementRow = {
  id: string;
  date: string;
  description: string;
  category: string;
  debit: number; // outflow
  credit: number; // inflow
  balance: number;
  currency: string;
  ref?: string;
  kindLabel?: string;
};

export type WalletInputs = {
  openingBalance: number;
  currency: string;
  txs: Array<{ id: string; happened_at: string; kind: string; amount: number; currency: string; notes: string | null; counterparty_wallet_id?: string | null; category_id?: string | null; transfer_group_id?: string | null }>;
  expenses: Array<{ id: string; spent_at: string; amount: number; currency: string; note: string | null; categories?: { name?: string | null } | null }>;
  walletNames?: Map<string, string>;
  categoryNames?: Map<string, string>;
};

export function buildWalletStatement(inp: WalletInputs): StatementRow[] {
  const evs: StatementRow[] = [];
  for (const t of inp.txs) {
    if (t.currency !== inp.currency) continue;
    const m = walletKindMeta(t.kind);
    const inflow = INFLOW_KINDS.has(t.kind) || t.kind === "transfer_in";
    const outflow = OUTFLOW_KINDS.has(t.kind) || t.kind === "transfer_out";
    let desc = m.label;
    if (t.kind === "transfer_in" || t.kind === "transfer_out") {
      const cn = t.counterparty_wallet_id ? inp.walletNames?.get(t.counterparty_wallet_id) ?? "—" : "—";
      desc = t.kind === "transfer_in" ? `تحويل وارد من ${cn}` : `تحويل صادر إلى ${cn}`;
    }
    if (t.notes) desc += ` — ${t.notes}`;
    const cat = t.category_id ? inp.categoryNames?.get(t.category_id) ?? "" : "";
    evs.push({
      id: `t-${t.id}`,
      date: t.happened_at,
      description: desc,
      category: cat || m.short,
      debit: outflow ? Number(t.amount) : 0,
      credit: inflow ? Number(t.amount) : 0,
      balance: 0,
      currency: t.currency,
      kindLabel: m.short,
    });
  }
  for (const e of inp.expenses) {
    if (e.currency !== inp.currency) continue;
    const desc = e.note ? `مصروف — ${e.note}` : "مصروف";
    evs.push({
      id: `e-${e.id}`,
      date: e.spent_at,
      description: desc,
      category: e.categories?.name ?? "مصروف",
      debit: Number(e.amount),
      credit: 0,
      balance: 0,
      currency: e.currency,
      kindLabel: "مصروف",
    });
  }
  // Oldest first to compute running balance, then reverse for UI
  evs.sort((a, b) => a.date.localeCompare(b.date));
  let bal = Number(inp.openingBalance || 0);
  for (const r of evs) {
    bal += r.credit - r.debit;
    r.balance = bal;
  }
  return evs.reverse();
}

export type PersonInputs = {
  currency: string;
  rows: Array<{ id: string; happened_at: string; kind: string; amount: number; currency: string; notes: string | null; due_date?: string | null; settled_at?: string | null }>;
};

// For a person ledger, "debit" = increases what they owe me (lend/pay)
// "credit" = decreases / they paid me / I borrowed from them
export function buildPersonStatement(inp: PersonInputs): StatementRow[] {
  const evs: StatementRow[] = [];
  for (const r of inp.rows) {
    if (r.currency !== inp.currency) continue;
    const m = kindMeta(r.kind);
    const s = kindSign(r.kind); // +1 = له عليّ زاد (in my favor), -1 = inverse
    const amt = Number(r.amount);
    const debit = s > 0 ? amt : 0;
    const credit = s < 0 ? amt : 0;
    let desc = m.label;
    if (r.notes) desc += ` — ${r.notes}`;
    evs.push({
      id: `p-${r.id}`,
      date: r.happened_at,
      description: desc,
      category: m.short,
      debit, credit,
      balance: 0,
      currency: r.currency,
      kindLabel: m.short,
    });
  }
  evs.sort((a, b) => a.date.localeCompare(b.date));
  let bal = 0;
  for (const r of evs) { bal += r.credit - r.debit; r.balance = bal; }
  // For person: positive bal => he owes me; UI flips perspective at display time
  return evs.reverse();
}

export function filterByPeriod(rows: StatementRow[], from?: string, to?: string, search?: string) {
  const q = (search ?? "").trim().toLowerCase();
  return rows.filter((r) => {
    if (from && r.date < from) return false;
    if (to && r.date > to) return false;
    if (q && !(`${r.description} ${r.category}`.toLowerCase().includes(q))) return false;
    return true;
  });
}
