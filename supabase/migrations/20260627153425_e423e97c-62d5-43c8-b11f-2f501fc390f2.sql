
CREATE TABLE public.asset_market_values (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_id uuid NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  valuation_date date NOT NULL DEFAULT CURRENT_DATE,
  market_value numeric NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  source text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_amv_investment ON public.asset_market_values(investment_id);
CREATE INDEX idx_amv_date ON public.asset_market_values(valuation_date);
CREATE INDEX idx_amv_user ON public.asset_market_values(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.asset_market_values TO authenticated;
GRANT ALL ON public.asset_market_values TO service_role;

ALTER TABLE public.asset_market_values ENABLE ROW LEVEL SECURITY;

CREATE POLICY "amv_owner_all" ON public.asset_market_values
  FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_amv_touch BEFORE UPDATE ON public.asset_market_values
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
