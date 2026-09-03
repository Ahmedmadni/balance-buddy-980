-- A02: atomically mutate an investment transaction and its wallet mirror.
-- Historical duplicates are never repaired or deleted by this migration.
DO $duplicate_audit$
DECLARE
  duplicate_source_links bigint;
BEGIN
  SELECT count(*) INTO duplicate_source_links
  FROM (
    SELECT source_id FROM public.wallet_transactions
    WHERE source_kind = 'investment_transactions' AND source_id IS NOT NULL
    GROUP BY source_id HAVING count(*) > 1
  ) duplicates;

  IF duplicate_source_links > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001', MESSAGE = 'INVESTMENT_TRANSACTION_DUPLICATE_SOURCE_LINKS',
      DETAIL = format('duplicate source links found: %s', duplicate_source_links),
      HINT = 'Review duplicate wallet effects before applying A02; this migration never deletes historical rows.';
  END IF;
END
$duplicate_audit$;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_investment_source_uidx
  ON public.wallet_transactions (source_id)
  WHERE source_kind = 'investment_transactions' AND source_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mutate_investment_transaction(
  p_operation text,
  p_transaction_id uuid DEFAULT NULL,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  transaction_row public.investment_transactions%ROWTYPE;
  requested_investment_id uuid;
  requested_wallet_id uuid;
  investment_owner uuid;
  investment_name text;
  wallet_owner uuid;
  wallet_currency text;
  wallet_kind text;
  mirror_notes text;
  update_investment boolean := coalesce((p_data->>'update_investment')::boolean, false);
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'INVESTMENT_TRANSACTION_UNAUTHENTICATED';
  END IF;

  p_operation := lower(trim(coalesce(p_operation, '')));
  IF p_operation NOT IN ('create', 'update', 'delete') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVESTMENT_TRANSACTION_INVALID_OPERATION';
  END IF;

  IF p_operation IN ('update', 'delete') THEN
    IF p_transaction_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVESTMENT_TRANSACTION_ID_REQUIRED';
    END IF;

    SELECT * INTO transaction_row FROM public.investment_transactions
    WHERE id = p_transaction_id FOR UPDATE;
    IF NOT FOUND OR transaction_row.user_id IS DISTINCT FROM caller_id THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'INVESTMENT_TRANSACTION_NOT_FOUND';
    END IF;
  END IF;

  IF p_operation = 'delete' THEN
    DELETE FROM public.wallet_transactions
    WHERE user_id = caller_id AND source_kind = 'investment_transactions'
      AND source_id = transaction_row.id;
    DELETE FROM public.investment_transactions
    WHERE id = transaction_row.id AND user_id = caller_id;
    RETURN jsonb_build_object('operation', 'delete', 'id', transaction_row.id, 'wallet_mirror', false);
  END IF;

  IF p_operation = 'create' THEN
    transaction_row.id := coalesce(p_transaction_id, gen_random_uuid());
    transaction_row.user_id := caller_id;
    transaction_row.investment_id := nullif(p_data->>'investment_id', '')::uuid;
    transaction_row.kind := p_data->>'kind';
    transaction_row.tx_class := p_data->>'tx_class';
    transaction_row.amount := nullif(p_data->>'amount', '')::numeric;
    transaction_row.currency := coalesce(nullif(trim(p_data->>'currency'), ''), 'SAR');
    transaction_row.wallet_id := nullif(p_data->>'wallet_id', '')::uuid;
    transaction_row.affects_wallet := coalesce((p_data->>'affects_wallet')::boolean, true);
    transaction_row.happened_at := coalesce(nullif(p_data->>'happened_at', '')::date, current_date);
    transaction_row.notes := nullif(trim(p_data->>'notes'), '');
  ELSE
    transaction_row.investment_id := CASE WHEN p_data ? 'investment_id' THEN nullif(p_data->>'investment_id', '')::uuid ELSE transaction_row.investment_id END;
    transaction_row.kind := CASE WHEN p_data ? 'kind' THEN p_data->>'kind' ELSE transaction_row.kind END;
    transaction_row.tx_class := CASE WHEN p_data ? 'tx_class' THEN p_data->>'tx_class' ELSE transaction_row.tx_class END;
    transaction_row.amount := CASE WHEN p_data ? 'amount' THEN nullif(p_data->>'amount', '')::numeric ELSE transaction_row.amount END;
    transaction_row.currency := CASE WHEN p_data ? 'currency' THEN trim(p_data->>'currency') ELSE transaction_row.currency END;
    transaction_row.wallet_id := CASE WHEN p_data ? 'wallet_id' THEN nullif(p_data->>'wallet_id', '')::uuid ELSE transaction_row.wallet_id END;
    transaction_row.affects_wallet := CASE WHEN p_data ? 'affects_wallet' THEN coalesce((p_data->>'affects_wallet')::boolean, true) ELSE transaction_row.affects_wallet END;
    transaction_row.happened_at := CASE WHEN p_data ? 'happened_at' THEN nullif(p_data->>'happened_at', '')::date ELSE transaction_row.happened_at END;
    transaction_row.notes := CASE WHEN p_data ? 'notes' THEN nullif(trim(p_data->>'notes'), '') ELSE transaction_row.notes END;
  END IF;

  requested_investment_id := transaction_row.investment_id;
  SELECT user_id, name INTO investment_owner, investment_name
  FROM public.investments WHERE id = requested_investment_id;
  IF NOT FOUND OR investment_owner IS DISTINCT FROM caller_id THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVESTMENT_TRANSACTION_INVALID_INVESTMENT';
  END IF;

  IF transaction_row.kind NOT IN ('capital_add', 'return', 'withdraw', 'revaluation')
    OR transaction_row.tx_class NOT IN ('capex', 'opex', 'income', 'adjustment', 'sale', 'capital_contribution', 'personal_benefit')
    OR transaction_row.amount IS NULL OR transaction_row.amount < 0
    OR (transaction_row.tx_class <> 'sale' AND transaction_row.amount = 0)
    OR transaction_row.currency IS NULL OR trim(transaction_row.currency) = ''
    OR transaction_row.happened_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVESTMENT_TRANSACTION_INVALID_DATA';
  END IF;

  requested_wallet_id := transaction_row.wallet_id;
  IF NOT transaction_row.affects_wallet OR transaction_row.tx_class IN ('adjustment', 'personal_benefit') OR transaction_row.amount = 0 THEN
    requested_wallet_id := NULL;
    transaction_row.wallet_id := NULL;
  ELSIF requested_wallet_id IS NOT NULL THEN
    SELECT user_id, currency INTO wallet_owner, wallet_currency
    FROM public.wallets WHERE id = requested_wallet_id;
    IF NOT FOUND OR wallet_owner IS DISTINCT FROM caller_id OR wallet_currency IS DISTINCT FROM transaction_row.currency THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'INVESTMENT_TRANSACTION_INVALID_WALLET';
    END IF;
  END IF;

  IF p_operation = 'create' THEN
    INSERT INTO public.investment_transactions
      (id, user_id, investment_id, kind, tx_class, amount, currency, wallet_id, affects_wallet, happened_at, notes)
    VALUES
      (transaction_row.id, caller_id, transaction_row.investment_id, transaction_row.kind,
       transaction_row.tx_class, transaction_row.amount, transaction_row.currency,
       transaction_row.wallet_id, transaction_row.affects_wallet, transaction_row.happened_at,
       transaction_row.notes)
    RETURNING * INTO transaction_row;

    IF update_investment AND transaction_row.tx_class = 'adjustment' THEN
      UPDATE public.investments SET current_value = transaction_row.amount
      WHERE id = transaction_row.investment_id AND user_id = caller_id;
    ELSIF update_investment AND transaction_row.tx_class = 'sale' THEN
      UPDATE public.investments SET status = 'sold', sold_at = transaction_row.happened_at,
        sold_amount = transaction_row.amount
      WHERE id = transaction_row.investment_id AND user_id = caller_id;
    END IF;
  ELSE
    UPDATE public.investment_transactions SET
      investment_id = transaction_row.investment_id, kind = transaction_row.kind,
      tx_class = transaction_row.tx_class, amount = transaction_row.amount,
      currency = transaction_row.currency, wallet_id = transaction_row.wallet_id,
      affects_wallet = transaction_row.affects_wallet, happened_at = transaction_row.happened_at,
      notes = transaction_row.notes
    WHERE id = transaction_row.id AND user_id = caller_id
    RETURNING * INTO transaction_row;
  END IF;

  IF requested_wallet_id IS NULL THEN
    DELETE FROM public.wallet_transactions
    WHERE user_id = caller_id AND source_kind = 'investment_transactions'
      AND source_id = transaction_row.id;
  ELSE
    wallet_kind := CASE WHEN transaction_row.tx_class IN ('income', 'sale') THEN 'deposit' ELSE 'withdraw' END;
    mirror_notes := CASE transaction_row.tx_class
      WHEN 'capex' THEN 'مصروف رأسمالي' WHEN 'opex' THEN 'مصروف تشغيلي'
      WHEN 'income' THEN 'دخل / إيراد' WHEN 'sale' THEN 'بيع الأصل'
      WHEN 'capital_contribution' THEN 'زيادة رأس المال' ELSE 'حركة استثمار'
    END || ' — ' || investment_name;

    INSERT INTO public.wallet_transactions
      (user_id, wallet_id, kind, amount, currency, happened_at, notes, source_kind, source_id)
    VALUES
      (caller_id, requested_wallet_id, wallet_kind, transaction_row.amount,
       transaction_row.currency, transaction_row.happened_at, mirror_notes,
       'investment_transactions', transaction_row.id)
    ON CONFLICT (source_id) WHERE source_kind = 'investment_transactions' AND source_id IS NOT NULL
    DO UPDATE SET wallet_id = excluded.wallet_id, kind = excluded.kind,
      amount = excluded.amount, currency = excluded.currency,
      happened_at = excluded.happened_at, notes = excluded.notes;
  END IF;

  RETURN jsonb_build_object('operation', p_operation, 'id', transaction_row.id,
    'wallet_mirror', requested_wallet_id IS NOT NULL);
END
$function$;

REVOKE ALL ON FUNCTION public.mutate_investment_transaction(text, uuid, jsonb) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.mutate_investment_transaction(text, uuid, jsonb) FROM anon;
GRANT EXECUTE ON FUNCTION public.mutate_investment_transaction(text, uuid, jsonb) TO authenticated;
