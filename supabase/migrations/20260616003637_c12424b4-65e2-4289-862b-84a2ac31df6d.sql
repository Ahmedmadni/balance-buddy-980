
-- 1) person_ledger: due/reminder/settled
ALTER TABLE public.person_ledger
  ADD COLUMN IF NOT EXISTS due_date date,
  ADD COLUMN IF NOT EXISTS reminder_enabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS settled_at timestamptz;

-- 2) expenses: allocation fields
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS allocation_kind text NOT NULL DEFAULT 'single',
  ADD COLUMN IF NOT EXISTS spread_months int,
  ADD COLUMN IF NOT EXISTS spread_start date;

-- 3) wallet_transactions
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  wallet_id uuid NOT NULL REFERENCES public.wallets(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('deposit','withdraw','transfer_out','transfer_in','send','receive','adjustment')),
  amount numeric(14,2) NOT NULL CHECK (amount > 0),
  currency text NOT NULL DEFAULT 'SAR',
  happened_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  counterparty_wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  transfer_group_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_transactions TO authenticated;
GRANT ALL ON public.wallet_transactions TO service_role;
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "wallet_tx_own" ON public.wallet_transactions
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS wallet_tx_user_wallet_idx ON public.wallet_transactions(user_id, wallet_id, happened_at DESC);

-- 4) expense_allocations
CREATE TABLE IF NOT EXISTS public.expense_allocations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id uuid NOT NULL REFERENCES public.expenses(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period date NOT NULL,
  amount numeric(14,2) NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.expense_allocations TO authenticated;
GRANT ALL ON public.expense_allocations TO service_role;
ALTER TABLE public.expense_allocations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "expense_alloc_own" ON public.expense_allocations
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX IF NOT EXISTS expense_alloc_user_period_idx ON public.expense_allocations(user_id, period);
CREATE INDEX IF NOT EXISTS expense_alloc_expense_idx ON public.expense_allocations(expense_id);
