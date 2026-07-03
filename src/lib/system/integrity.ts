// =============================================================
// Integrity Validator — validateFinancialIntegrity()
// -------------------------------------------------------------
// Re-derives figures through the existing pure engines (never
// recomputed with different logic) and flags divergence. Read-only.
// =============================================================
import { supabase } from "@/integrations/supabase/client";
import { computeAssetMetrics, type AssetTx } from "@/lib/assets/calculator";
import { computeAssetZakat } from "@/lib/assets/zakat-asset";
import { reconcileWallets } from "./shared";

export interface IntegrityResult {
  valid: boolean;
  warnings: string[];
  errors: string[];
}

export async function validateFinancialIntegrity(): Promise<IntegrityResult> {
  const warnings: string[] = [];
  const errors: string[] = [];

  // ----- Wallet balances / statements -----
  const wallets = await reconcileWallets();
  for (const w of wallets) {
    if (!w.matches) {
      errors.push(
        `محفظة "${w.name}": حركات المحفظة (${w.walletTxOnlyBalance.toFixed(2)}) لا تطابق كشف الحساب المرصود (${w.statementBalance.toFixed(2)}) — الرصيد الكامل المعروض في التطبيق (${w.computedBalance.toFixed(2)}) لم يتأثر بهذا الفرق`,
      );
    }
  }

  // ----- Assets -----
  const [invRes, invTxRes, mvRes] = await Promise.all([
    supabase
      .from("investments")
      .select("id,name,currency,status,base_value,principal,current_value,sold_amount"),
    supabase.from("investment_transactions").select("investment_id,tx_class,kind,amount"),
    supabase.from("asset_market_values").select("investment_id,valuation_date,market_value"),
  ]);
  const investments = invRes.data ?? [];
  const txByInv = new Map<string, AssetTx[]>();
  for (const t of invTxRes.data ?? []) {
    const a = txByInv.get(t.investment_id) ?? [];
    a.push(t);
    txByInv.set(t.investment_id, a);
  }
  const mvByInv = new Map<string, { valuation_date: string; market_value: number }[]>();
  for (const m of mvRes.data ?? []) {
    const a = mvByInv.get(m.investment_id) ?? [];
    a.push(m);
    mvByInv.set(m.investment_id, a);
  }

  for (const inv of investments) {
    if (inv.status === "archived") continue;
    const metrics = computeAssetMetrics(inv, txByInv.get(inv.id) ?? []);
    if (!Number.isFinite(metrics.bookValue) || !Number.isFinite(metrics.marketValue)) {
      errors.push(
        `أصل "${inv.name}": قيمة غير رقمية (bookValue/marketValue) — تحقق من بيانات المعاملات`,
      );
      continue;
    }
    if (metrics.bookValue < 0) {
      warnings.push(`أصل "${inv.name}": القيمة الدفترية سالبة (${metrics.bookValue.toFixed(2)})`);
    }
    if (metrics.marketValue < 0) {
      warnings.push(`أصل "${inv.name}": القيمة السوقية سالبة (${metrics.marketValue.toFixed(2)})`);
    }

    const zakat = computeAssetZakat({
      asset: inv,
      txs: txByInv.get(inv.id) ?? [],
      marketValues: mvByInv.get(inv.id),
    });
    if (!Number.isFinite(zakat.zakatAmount) || zakat.zakatAmount < 0) {
      errors.push(`أصل "${inv.name}": مبلغ زكاة غير صالح`);
    }
  }

  // ----- Debts (person_ledger) -----
  const { data: ledger } = await supabase
    .from("person_ledger")
    .select("id,contact_name,kind,amount,currency,due_date,settled_at");
  for (const r of ledger ?? []) {
    if (!(Number(r.amount) > 0)) {
      errors.push(`سجل دين لـ "${r.contact_name}": مبلغ غير صالح (${r.amount})`);
    }
    if (
      !r.settled_at &&
      r.due_date &&
      new Date(r.due_date) < new Date(Date.now() - 365 * 24 * 3600 * 1000)
    ) {
      warnings.push(`سجل دين لـ "${r.contact_name}": مستحق منذ أكثر من سنة ولم يُسدّد بعد`);
    }
  }

  // ----- Zakat records -----
  const { data: zakatRecords } = await supabase
    .from("zakat_records")
    .select("id,rate,base_amount,currency,calculated_at");
  for (const z of zakatRecords ?? []) {
    if (Number(z.rate) <= 0 || Number(z.rate) > 0.1) {
      warnings.push(`سجل زكاة بتاريخ ${z.calculated_at}: نسبة غير معتادة (${z.rate})`);
    }
    if (Number(z.base_amount) < 0) {
      errors.push(`سجل زكاة بتاريخ ${z.calculated_at}: وعاء زكوي سالب`);
    }
  }

  return { valid: errors.length === 0, warnings, errors };
}
