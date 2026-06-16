// Compute current balance for a wallet from opening + transactions − expenses
export const INFLOW_KINDS = new Set(["deposit", "transfer_in", "receive", "adjustment"]);
export const OUTFLOW_KINDS = new Set(["withdraw", "transfer_out", "send"]);

export function computeWalletBalance(
  opening: number,
  txs: { kind: string; amount: number }[],
  expenses: { amount: number }[],
) {
  let bal = Number(opening || 0);
  for (const t of txs) {
    const a = Number(t.amount);
    if (INFLOW_KINDS.has(t.kind)) bal += a;
    else if (OUTFLOW_KINDS.has(t.kind)) bal -= a;
  }
  for (const e of expenses) bal -= Number(e.amount);
  return bal;
}

export const WALLET_TX_KINDS = [
  { value: "deposit", label: "إيداع كاش", short: "إيداع", sign: "+", color: "text-success", bg: "bg-success/10 border-success/30" },
  { value: "withdraw", label: "سحب", short: "سحب", sign: "−", color: "text-destructive", bg: "bg-destructive/10 border-destructive/30" },
  { value: "send", label: "حوالة صادرة (غير مستردة)", short: "حوالة صادرة", sign: "−", color: "text-destructive", bg: "bg-amber-500/10 border-amber-500/30" },
  { value: "receive", label: "حوالة واردة", short: "حوالة واردة", sign: "+", color: "text-success", bg: "bg-blue-500/10 border-blue-500/30" },
  { value: "adjustment", label: "تسوية يدوية (+)", short: "تسوية", sign: "+", color: "text-foreground", bg: "bg-muted border-border" },
] as const;

export function walletKindMeta(k: string) {
  return WALLET_TX_KINDS.find((x) => x.value === k) ?? WALLET_TX_KINDS[0];
}
