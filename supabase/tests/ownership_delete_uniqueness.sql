-- A05, A09 and A10 integration regression tests. Disposable/local database only.
BEGIN;

DO $test$
DECLARE
  owner_id uuid := '14000000-0000-0000-0000-000000000001';
  other_id uuid := '14000000-0000-0000-0000-000000000002';
  owner_wallet uuid := '34000000-0000-0000-0000-000000000001';
  other_wallet uuid := '34000000-0000-0000-0000-000000000002';
  owner_category uuid := '44000000-0000-0000-0000-000000000001';
  other_category uuid := '44000000-0000-0000-0000-000000000002';
  investment_id uuid := '54000000-0000-0000-0000-000000000001';
  expense_id uuid := '64000000-0000-0000-0000-000000000001';
  investment_tx_id uuid := '74000000-0000-0000-0000-000000000001';
  failed boolean;
BEGIN
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at) VALUES
    (owner_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a05-owner@example.invalid', '', now()),
    (other_id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'a05-other@example.invalid', '', now());
  INSERT INTO public.wallets (id,user_id,name,currency) VALUES
    (owner_wallet,owner_id,'owner wallet','SAR'), (other_wallet,other_id,'other wallet','SAR');
  INSERT INTO public.categories (id,user_id,name) VALUES
    (owner_category,owner_id,'owner category'), (other_category,other_id,'other category');
  INSERT INTO public.investments (id,user_id,name,type,principal,current_value,currency,start_date)
  VALUES (investment_id,owner_id,'A05 investment','stocks',100,100,'SAR','2026-09-01');

  -- A05: same-owner composite references are accepted.
  INSERT INTO public.expenses (id,user_id,category_id,wallet_id,amount,currency,spent_at)
  VALUES (expense_id,owner_id,owner_category,owner_wallet,10,'SAR','2026-09-01');

  -- A05: a UUID that belongs to another user must fail at the database boundary.
  failed := false;
  BEGIN
    INSERT INTO public.expenses (user_id,category_id,wallet_id,amount,currency,spent_at)
    VALUES (owner_id,other_category,owner_wallet,10,'SAR','2026-09-01');
  EXCEPTION WHEN foreign_key_violation THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'A05 cross-user category reference was accepted'; END IF;

  failed := false;
  BEGIN
    INSERT INTO public.expenses (user_id,category_id,wallet_id,amount,currency,spent_at)
    VALUES (owner_id,owner_category,other_wallet,10,'SAR','2026-09-01');
  EXCEPTION WHEN foreign_key_violation THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'A05 cross-user wallet reference was accepted'; END IF;

  -- A10: optional expense references use SET NULL.
  DELETE FROM public.categories WHERE id=owner_category;
  IF (SELECT category_id FROM public.expenses WHERE id=expense_id) IS NOT NULL
  THEN RAISE EXCEPTION 'A10 expense category did not SET NULL'; END IF;

  -- A10: investment transaction ownership is enforced and child rows cascade.
  INSERT INTO public.investment_transactions
    (id,user_id,investment_id,kind,tx_class,amount,currency,wallet_id,affects_wallet,happened_at)
  VALUES (investment_tx_id,owner_id,investment_id,'capital_add','capex',10,'SAR',owner_wallet,false,'2026-09-01');
  failed := false;
  BEGIN
    INSERT INTO public.investment_transactions
      (user_id,investment_id,kind,tx_class,amount,currency,affects_wallet,happened_at)
    VALUES (other_id,investment_id,'capital_add','capex',10,'SAR',false,'2026-09-01');
  EXCEPTION WHEN foreign_key_violation THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'A05 cross-user investment reference was accepted'; END IF;
  DELETE FROM public.investments WHERE id=investment_id;
  IF EXISTS (SELECT 1 FROM public.investment_transactions WHERE id=investment_tx_id)
  THEN RAISE EXCEPTION 'A10 investment transaction did not CASCADE'; END IF;

  -- A09: one market value per user/investment/date.
  INSERT INTO public.investments (id,user_id,name,type,principal,current_value,currency,start_date)
  VALUES (investment_id,owner_id,'A09 investment','stocks',100,100,'SAR','2026-09-01');
  INSERT INTO public.asset_market_values (user_id,investment_id,valuation_date,market_value,currency)
  VALUES (owner_id,investment_id,'2026-09-01',100,'SAR');
  failed := false;
  BEGIN
    INSERT INTO public.asset_market_values (user_id,investment_id,valuation_date,market_value,currency)
    VALUES (owner_id,investment_id,'2026-09-01',101,'SAR');
  EXCEPTION WHEN unique_violation THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'A09 duplicate market valuation was accepted'; END IF;

  -- A09: one depreciation profile per user/investment.
  INSERT INTO public.depreciation_profiles (user_id,investment_id,useful_life_months)
  VALUES (owner_id,investment_id,12);
  failed := false;
  BEGIN
    INSERT INTO public.depreciation_profiles (user_id,investment_id,useful_life_months)
    VALUES (owner_id,investment_id,24);
  EXCEPTION WHEN unique_violation THEN failed := true; END;
  IF NOT failed THEN RAISE EXCEPTION 'A09 duplicate depreciation profile was accepted'; END IF;
END
$test$;

ROLLBACK;
