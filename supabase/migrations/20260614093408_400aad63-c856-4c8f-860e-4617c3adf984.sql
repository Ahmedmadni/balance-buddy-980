-- Wallets table
CREATE TABLE public.wallets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'cash',
  currency text NOT NULL DEFAULT 'SAR',
  opening_balance numeric NOT NULL DEFAULT 0,
  color text DEFAULT '#0ea5e9',
  icon text DEFAULT 'wallet',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallets TO authenticated;
GRANT ALL ON public.wallets TO service_role;
ALTER TABLE public.wallets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own wallets" ON public.wallets FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER wallets_updated_at BEFORE UPDATE ON public.wallets FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
CREATE INDEX wallets_user_idx ON public.wallets(user_id);

-- Person ledger table
CREATE TABLE public.person_ledger (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  contact_name text NOT NULL,
  kind text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  happened_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.person_ledger TO authenticated;
GRANT ALL ON public.person_ledger TO service_role;
ALTER TABLE public.person_ledger ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own person_ledger" ON public.person_ledger FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX person_ledger_user_contact_idx ON public.person_ledger(user_id, contact_name);

-- Link expenses to wallets
ALTER TABLE public.expenses ADD COLUMN wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL;
CREATE INDEX expenses_wallet_idx ON public.expenses(user_id, wallet_id);