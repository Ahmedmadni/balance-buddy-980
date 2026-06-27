
CREATE TABLE public.depreciation_profiles (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  investment_id UUID NOT NULL REFERENCES public.investments(id) ON DELETE CASCADE,
  method TEXT NOT NULL DEFAULT 'straight_line' CHECK (method IN ('straight_line','double_declining','units_of_production')),
  useful_life_months INTEGER NOT NULL CHECK (useful_life_months > 0),
  salvage_value NUMERIC NOT NULL DEFAULT 0 CHECK (salvage_value >= 0),
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  is_active BOOLEAN NOT NULL DEFAULT true,
  units_total NUMERIC,
  units_consumed NUMERIC DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_depreciation_profiles_investment ON public.depreciation_profiles(investment_id);
CREATE INDEX idx_depreciation_profiles_user ON public.depreciation_profiles(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.depreciation_profiles TO authenticated;
GRANT ALL ON public.depreciation_profiles TO service_role;

ALTER TABLE public.depreciation_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Owner manages depreciation profiles"
ON public.depreciation_profiles FOR ALL TO authenticated
USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_depreciation_profiles_updated_at
BEFORE UPDATE ON public.depreciation_profiles
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();
