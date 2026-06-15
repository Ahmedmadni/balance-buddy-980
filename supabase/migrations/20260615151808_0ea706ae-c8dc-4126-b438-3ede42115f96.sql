ALTER TABLE public.contacts ADD COLUMN IF NOT EXISTS email text, ADD COLUMN IF NOT EXISTS tags text[];
ALTER TABLE public.person_ledger ADD COLUMN IF NOT EXISTS contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS person_ledger_user_contact_idx ON public.person_ledger(user_id, contact_id);

-- backfill: create missing contacts from ledger names
INSERT INTO public.contacts (user_id, name)
SELECT DISTINCT pl.user_id, pl.contact_name
FROM public.person_ledger pl
LEFT JOIN public.contacts c
  ON c.user_id = pl.user_id AND lower(c.name) = lower(pl.contact_name)
WHERE pl.contact_id IS NULL AND c.id IS NULL;

-- link ledger rows to contacts by name
UPDATE public.person_ledger pl
SET contact_id = c.id
FROM public.contacts c
WHERE c.user_id = pl.user_id
  AND lower(c.name) = lower(pl.contact_name)
  AND pl.contact_id IS NULL;