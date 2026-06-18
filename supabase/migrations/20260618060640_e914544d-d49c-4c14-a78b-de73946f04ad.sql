ALTER TABLE public.person_ledger
  ADD COLUMN IF NOT EXISTS wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS person_ledger_wallet_idx ON public.person_ledger(user_id, wallet_id);

ALTER TABLE public.wallet_transactions
  ADD COLUMN IF NOT EXISTS source_kind text,
  ADD COLUMN IF NOT EXISTS source_id uuid;

CREATE INDEX IF NOT EXISTS wallet_tx_source_idx ON public.wallet_transactions(source_kind, source_id);