-- investments
CREATE TABLE IF NOT EXISTS public.investments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  type text NOT NULL DEFAULT 'other', -- stocks|real_estate|partnership|fund|crypto|business|other
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  principal numeric NOT NULL DEFAULT 0,
  current_value numeric NOT NULL DEFAULT 0,
  ownership_pct numeric NOT NULL DEFAULT 100,
  currency text NOT NULL DEFAULT 'SAR',
  is_zakatable boolean NOT NULL DEFAULT true,
  start_date date NOT NULL DEFAULT CURRENT_DATE,
  status text NOT NULL DEFAULT 'active', -- active|closed
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investments TO authenticated;
GRANT ALL ON public.investments TO service_role;
ALTER TABLE public.investments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own investments" ON public.investments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_investments_updated BEFORE UPDATE ON public.investments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- investment_transactions
CREATE TABLE IF NOT EXISTS public.investment_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  investment_id uuid NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  kind text NOT NULL, -- capital_add|return|withdraw|revaluation
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  happened_at date NOT NULL DEFAULT CURRENT_DATE,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.investment_transactions TO authenticated;
GRANT ALL ON public.investment_transactions TO service_role;
ALTER TABLE public.investment_transactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own investment_tx" ON public.investment_transactions FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE INDEX idx_inv_tx_inv ON public.investment_transactions(investment_id, happened_at);

-- zakat_records
CREATE TABLE IF NOT EXISTS public.zakat_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  hijri_year text,
  calculated_at date NOT NULL DEFAULT CURRENT_DATE,
  base_amount numeric NOT NULL, -- الوعاء
  rate numeric NOT NULL DEFAULT 0.025,
  zakat_amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  paid boolean NOT NULL DEFAULT false,
  paid_at date,
  breakdown jsonb, -- {cash, bank, investments, debts_owed_to_me, debts_owed_by_me}
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.zakat_records TO authenticated;
GRANT ALL ON public.zakat_records TO service_role;
ALTER TABLE public.zakat_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own zakat" ON public.zakat_records FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE TRIGGER trg_zakat_updated BEFORE UPDATE ON public.zakat_records
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
