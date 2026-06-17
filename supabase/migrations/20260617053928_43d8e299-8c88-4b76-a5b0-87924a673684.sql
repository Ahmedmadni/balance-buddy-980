
-- 1) Extend wallets: account types + archive flag
ALTER TABLE public.wallets ADD COLUMN IF NOT EXISTS is_archived boolean NOT NULL DEFAULT false;
-- 'type' column already exists; we just expand allowed values via app code: cash|bank|credit_card|investment|zakat|asset

-- 2) wallet_tx_categories
CREATE TABLE IF NOT EXISTS public.wallet_tx_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('inflow','outflow')),
  icon text,
  color text,
  is_default boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.wallet_tx_categories TO authenticated;
GRANT ALL ON public.wallet_tx_categories TO service_role;

ALTER TABLE public.wallet_tx_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users manage their wallet tx categories"
ON public.wallet_tx_categories FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- 3) link wallet_transactions to category
ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS category_id uuid REFERENCES public.wallet_tx_categories(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_wallet_tx_category ON public.wallet_transactions(category_id);

-- 4) Seed defaults for existing users
INSERT INTO public.wallet_tx_categories (user_id, name, kind, is_default)
SELECT u.id, x.name, x.kind, true
FROM auth.users u
CROSS JOIN (VALUES
  ('راتب','inflow'),('مكافأة','inflow'),('أجور','inflow'),('تعويض','inflow'),
  ('هدية','inflow'),('أرباح استثمار','inflow'),('استرداد مبلغ','inflow'),('أخرى','inflow'),
  ('هبة','outflow'),('تبرعات','outflow'),('إعانة','outflow'),
  ('تحويل خارجي','outflow'),('مصروف غير مصنف','outflow'),('أخرى','outflow')
) AS x(name, kind)
WHERE NOT EXISTS (
  SELECT 1 FROM public.wallet_tx_categories c WHERE c.user_id = u.id AND c.is_default = true
);

-- 5) Update handle_new_user to seed wallet tx categories for new signups
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, display_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email,'@',1)),
    NEW.raw_user_meta_data->>'avatar_url'
  );

  INSERT INTO public.categories (user_id, name, icon, color, is_default) VALUES
    (NEW.id, 'طعام وشراب', 'utensils', '#f97316', true),
    (NEW.id, 'مواصلات', 'car', '#0ea5e9', true),
    (NEW.id, 'فواتير', 'receipt', '#a855f7', true),
    (NEW.id, 'تسوق', 'shopping-bag', '#ec4899', true),
    (NEW.id, 'صحة', 'heart-pulse', '#ef4444', true),
    (NEW.id, 'ترفيه', 'gamepad-2', '#22c55e', true),
    (NEW.id, 'تعليم', 'graduation-cap', '#3b82f6', true),
    (NEW.id, 'أخرى', 'tag', '#64748b', true);

  INSERT INTO public.wallet_tx_categories (user_id, name, kind, is_default) VALUES
    (NEW.id, 'راتب', 'inflow', true),
    (NEW.id, 'مكافأة', 'inflow', true),
    (NEW.id, 'أجور', 'inflow', true),
    (NEW.id, 'تعويض', 'inflow', true),
    (NEW.id, 'هدية', 'inflow', true),
    (NEW.id, 'أرباح استثمار', 'inflow', true),
    (NEW.id, 'استرداد مبلغ', 'inflow', true),
    (NEW.id, 'أخرى', 'inflow', true),
    (NEW.id, 'هبة', 'outflow', true),
    (NEW.id, 'تبرعات', 'outflow', true),
    (NEW.id, 'إعانة', 'outflow', true),
    (NEW.id, 'تحويل خارجي', 'outflow', true),
    (NEW.id, 'مصروف غير مصنف', 'outflow', true),
    (NEW.id, 'أخرى', 'outflow', true);

  RETURN NEW;
END;
$function$;
