-- A01: canonical, atomic person-ledger + wallet-mirror mutation command.
-- This migration deliberately does not repair historical rows.  Deployment
-- stops before the constraint is created if duplicate person-ledger mirrors
-- already exist, so they can be reviewed without deleting financial data.

DO $duplicate_audit$
DECLARE
  duplicate_source_links bigint;
BEGIN
  SELECT count(*)
  INTO duplicate_source_links
  FROM (
    SELECT source_id
    FROM public.wallet_transactions
    WHERE source_kind = 'person_ledger' AND source_id IS NOT NULL
    GROUP BY source_id
    HAVING count(*) > 1
  ) duplicates;

  IF duplicate_source_links > 0 THEN
    RAISE EXCEPTION USING
      ERRCODE = 'P0001',
      MESSAGE = 'PERSON_LEDGER_DUPLICATE_SOURCE_LINKS',
      DETAIL = format('duplicate source links found: %s', duplicate_source_links),
      HINT = 'Review and repair duplicate wallet effects before applying A01; this migration never deletes historical rows.';
  END IF;
END
$duplicate_audit$;

CREATE UNIQUE INDEX IF NOT EXISTS wallet_tx_person_ledger_source_uidx
  ON public.wallet_transactions (source_id)
  WHERE source_kind = 'person_ledger' AND source_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.mutate_person_ledger(
  p_operation text,
  p_ledger_id uuid DEFAULT NULL,
  p_data jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $function$
DECLARE
  caller_id uuid := auth.uid();
  ledger_row public.person_ledger%ROWTYPE;
  requested_contact_id uuid;
  requested_wallet_id uuid;
  wallet_currency text;
  wallet_kind text;
  mirror_notes text;
BEGIN
  IF caller_id IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '42501', MESSAGE = 'PERSON_LEDGER_UNAUTHENTICATED';
  END IF;

  p_operation := lower(trim(coalesce(p_operation, '')));
  IF p_operation NOT IN ('create', 'update', 'delete') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PERSON_LEDGER_INVALID_OPERATION';
  END IF;

  IF p_operation IN ('update', 'delete') THEN
    IF p_ledger_id IS NULL THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PERSON_LEDGER_ID_REQUIRED';
    END IF;

    SELECT * INTO ledger_row
    FROM public.person_ledger
    WHERE id = p_ledger_id AND user_id = caller_id
    FOR UPDATE;

    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = 'P0002', MESSAGE = 'PERSON_LEDGER_NOT_FOUND';
    END IF;
  END IF;

  IF p_operation = 'delete' THEN
    DELETE FROM public.wallet_transactions
    WHERE user_id = caller_id
      AND source_kind = 'person_ledger'
      AND source_id = ledger_row.id;

    DELETE FROM public.person_ledger
    WHERE id = ledger_row.id AND user_id = caller_id;

    RETURN jsonb_build_object('operation', 'delete', 'id', ledger_row.id, 'wallet_mirror', false);
  END IF;

  IF p_operation = 'create' THEN
    requested_contact_id := nullif(p_data->>'contact_id', '')::uuid;
    requested_wallet_id := nullif(p_data->>'wallet_id', '')::uuid;

    ledger_row.id := coalesce(p_ledger_id, gen_random_uuid());
    ledger_row.user_id := caller_id;
    ledger_row.contact_id := requested_contact_id;
    ledger_row.contact_name := trim(coalesce(p_data->>'contact_name', ''));
    ledger_row.kind := p_data->>'kind';
    ledger_row.amount := nullif(p_data->>'amount', '')::numeric;
    ledger_row.currency := coalesce(nullif(trim(p_data->>'currency'), ''), 'SAR');
    ledger_row.happened_at := coalesce(nullif(p_data->>'happened_at', '')::date, current_date);
    ledger_row.due_date := nullif(p_data->>'due_date', '')::date;
    ledger_row.reminder_enabled := coalesce((p_data->>'reminder_enabled')::boolean, false);
    ledger_row.settled_at := nullif(p_data->>'settled_at', '')::timestamptz;
    ledger_row.notes := nullif(trim(p_data->>'notes'), '');
    ledger_row.wallet_id := requested_wallet_id;
  ELSE
    requested_contact_id := CASE WHEN p_data ? 'contact_id' THEN nullif(p_data->>'contact_id', '')::uuid ELSE ledger_row.contact_id END;
    requested_wallet_id := CASE WHEN p_data ? 'wallet_id' THEN nullif(p_data->>'wallet_id', '')::uuid ELSE ledger_row.wallet_id END;

    ledger_row.contact_id := requested_contact_id;
    ledger_row.contact_name := CASE WHEN p_data ? 'contact_name' THEN trim(coalesce(p_data->>'contact_name', '')) ELSE ledger_row.contact_name END;
    ledger_row.kind := CASE WHEN p_data ? 'kind' THEN p_data->>'kind' ELSE ledger_row.kind END;
    ledger_row.amount := CASE WHEN p_data ? 'amount' THEN nullif(p_data->>'amount', '')::numeric ELSE ledger_row.amount END;
    ledger_row.currency := CASE WHEN p_data ? 'currency' THEN trim(p_data->>'currency') ELSE ledger_row.currency END;
    ledger_row.happened_at := CASE WHEN p_data ? 'happened_at' THEN nullif(p_data->>'happened_at', '')::date ELSE ledger_row.happened_at END;
    ledger_row.due_date := CASE WHEN p_data ? 'due_date' THEN nullif(p_data->>'due_date', '')::date ELSE ledger_row.due_date END;
    ledger_row.reminder_enabled := CASE WHEN p_data ? 'reminder_enabled' THEN coalesce((p_data->>'reminder_enabled')::boolean, false) ELSE ledger_row.reminder_enabled END;
    ledger_row.settled_at := CASE WHEN p_data ? 'settled_at' THEN nullif(p_data->>'settled_at', '')::timestamptz ELSE ledger_row.settled_at END;
    ledger_row.notes := CASE WHEN p_data ? 'notes' THEN nullif(trim(p_data->>'notes'), '') ELSE ledger_row.notes END;
    ledger_row.wallet_id := requested_wallet_id;
  END IF;

  IF ledger_row.contact_id IS NULL OR NOT EXISTS (
    SELECT 1 FROM public.contacts WHERE id = ledger_row.contact_id AND user_id = caller_id
  ) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PERSON_LEDGER_INVALID_CONTACT';
  END IF;
  IF ledger_row.contact_name = '' THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PERSON_LEDGER_INVALID_CONTACT';
  END IF;
  IF ledger_row.kind NOT IN ('lend', 'borrow', 'collect', 'pay') THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PERSON_LEDGER_INVALID_KIND';
  END IF;
  IF ledger_row.amount IS NULL OR ledger_row.amount <= 0 THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PERSON_LEDGER_INVALID_AMOUNT';
  END IF;
  IF ledger_row.currency IS NULL OR trim(ledger_row.currency) = '' OR ledger_row.happened_at IS NULL THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PERSON_LEDGER_INVALID_DATA';
  END IF;

  IF ledger_row.wallet_id IS NOT NULL THEN
    SELECT currency INTO wallet_currency
    FROM public.wallets
    WHERE id = ledger_row.wallet_id AND user_id = caller_id;

    IF NOT FOUND OR wallet_currency <> ledger_row.currency THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'PERSON_LEDGER_INVALID_WALLET';
    END IF;
  END IF;

  IF p_operation = 'create' THEN
    INSERT INTO public.person_ledger (
      id, user_id, contact_id, contact_name, kind, amount, currency,
      happened_at, due_date, reminder_enabled, settled_at, notes, wallet_id
    ) VALUES (
      ledger_row.id, caller_id, ledger_row.contact_id, ledger_row.contact_name,
      ledger_row.kind, ledger_row.amount, ledger_row.currency,
      ledger_row.happened_at, ledger_row.due_date, ledger_row.reminder_enabled,
      ledger_row.settled_at, ledger_row.notes, ledger_row.wallet_id
    ) RETURNING * INTO ledger_row;
  ELSE
    UPDATE public.person_ledger SET
      contact_id = ledger_row.contact_id,
      contact_name = ledger_row.contact_name,
      kind = ledger_row.kind,
      amount = ledger_row.amount,
      currency = ledger_row.currency,
      happened_at = ledger_row.happened_at,
      due_date = ledger_row.due_date,
      reminder_enabled = ledger_row.reminder_enabled,
      settled_at = ledger_row.settled_at,
      notes = ledger_row.notes,
      wallet_id = ledger_row.wallet_id
    WHERE id = ledger_row.id AND user_id = caller_id
    RETURNING * INTO ledger_row;
  END IF;

  IF ledger_row.wallet_id IS NULL THEN
    DELETE FROM public.wallet_transactions
    WHERE user_id = caller_id
      AND source_kind = 'person_ledger'
      AND source_id = ledger_row.id;
  ELSE
    -- Existing product semantics: lending/paying is money out; borrowing/
    -- collecting is money in.  The transactions triggers remain the only
    -- writers of the derived `transactions` rows.
    wallet_kind := CASE WHEN ledger_row.kind IN ('lend', 'pay') THEN 'withdraw' ELSE 'deposit' END;
    mirror_notes := CASE ledger_row.kind
      WHEN 'lend' THEN 'سلّفته'
      WHEN 'borrow' THEN 'استلفت منه'
      WHEN 'collect' THEN 'حصّلت منه'
      WHEN 'pay' THEN 'سددت له'
    END || ' — ' || ledger_row.contact_name ||
      CASE WHEN ledger_row.notes IS NULL THEN '' ELSE ': ' || ledger_row.notes END;

    INSERT INTO public.wallet_transactions (
      user_id, wallet_id, kind, amount, currency, happened_at, notes,
      contact_id, source_kind, source_id
    ) VALUES (
      caller_id, ledger_row.wallet_id, wallet_kind, ledger_row.amount,
      ledger_row.currency, ledger_row.happened_at, mirror_notes,
      ledger_row.contact_id, 'person_ledger', ledger_row.id
    )
    ON CONFLICT (source_id) WHERE source_kind = 'person_ledger' AND source_id IS NOT NULL
    DO UPDATE SET
      wallet_id = excluded.wallet_id,
      kind = excluded.kind,
      amount = excluded.amount,
      currency = excluded.currency,
      happened_at = excluded.happened_at,
      notes = excluded.notes,
      contact_id = excluded.contact_id;
  END IF;

  RETURN jsonb_build_object(
    'operation', p_operation,
    'id', ledger_row.id,
    'wallet_mirror', ledger_row.wallet_id IS NOT NULL
  );
END
$function$;

REVOKE ALL ON FUNCTION public.mutate_person_ledger(text, uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mutate_person_ledger(text, uuid, jsonb) TO authenticated;
