
-- 1) zakat_settings
CREATE TABLE IF NOT EXISTS public.zakat_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  annual_date_type text NOT NULL DEFAULT 'hijri' CHECK (annual_date_type IN ('hijri','gregorian')),
  annual_date_value text NOT NULL DEFAULT '01-09',
  base_currency text NOT NULL DEFAULT 'SAR',
  nisab_method text NOT NULL DEFAULT 'gold' CHECK (nisab_method IN ('gold','silver')),
  gold_jewelry_opinion text NOT NULL DEFAULT 'no_zakat' CHECK (gold_jewelry_opinion IN ('zakat','no_zakat')),
  nisab_gold_grams numeric NOT NULL DEFAULT 85,
  nisab_silver_grams numeric NOT NULL DEFAULT 595,
  gold_gram_price numeric,
  silver_gram_price numeric,
  last_haul_start_date date,
  first_nisab_reached_at date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.zakat_settings TO authenticated;
GRANT ALL ON public.zakat_settings TO service_role;

ALTER TABLE public.zakat_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "zakat_settings_own" ON public.zakat_settings
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_zakat_settings_updated
  BEFORE UPDATE ON public.zakat_settings
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 2) exchange_rates
CREATE TABLE IF NOT EXISTS public.exchange_rates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  currency text NOT NULL,
  rate_to_base numeric NOT NULL,
  base_currency text NOT NULL DEFAULT 'SAR',
  updated_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, currency, base_currency)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.exchange_rates TO authenticated;
GRANT ALL ON public.exchange_rates TO service_role;

ALTER TABLE public.exchange_rates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exchange_rates_own" ON public.exchange_rates
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_exchange_rates_updated
  BEFORE UPDATE ON public.exchange_rates
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- 3) extend investments
ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS purpose text,
  ADD COLUMN IF NOT EXISTS is_zakatable boolean,
  ADD COLUMN IF NOT EXISTS acquired_at date,
  ADD COLUMN IF NOT EXISTS nisab_reached_at date;

-- 4) extend zakat_records
ALTER TABLE public.zakat_records
  ADD COLUMN IF NOT EXISTS base_currency text DEFAULT 'SAR',
  ADD COLUMN IF NOT EXISTS total_cash numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_gold numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_stocks numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_investments numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS total_trade numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS nisab_value numeric DEFAULT 0,
  ADD COLUMN IF NOT EXISTS haul_start date,
  ADD COLUMN IF NOT EXISTS haul_end date,
  ADD COLUMN IF NOT EXISTS breakdown_json jsonb;
