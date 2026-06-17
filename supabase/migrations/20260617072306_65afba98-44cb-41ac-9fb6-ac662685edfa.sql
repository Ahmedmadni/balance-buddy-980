-- Phase 2 migration

-- 1) recurring_expenses
CREATE TABLE IF NOT EXISTS public.recurring_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL,
  currency text NOT NULL DEFAULT 'SAR',
  wallet_id uuid REFERENCES public.wallets(id) ON DELETE SET NULL,
  category_id uuid REFERENCES public.categories(id) ON DELETE SET NULL,
  contact_id uuid REFERENCES public.contacts(id) ON DELETE SET NULL,
  project_id uuid REFERENCES public.projects(id) ON DELETE SET NULL,
  frequency text NOT NULL DEFAULT 'monthly', -- daily|weekly|monthly|yearly
  interval_count integer NOT NULL DEFAULT 1,
  start_date date NOT NULL,
  end_date date,
  next_due date NOT NULL,
  last_posted_at date,
  auto_post boolean NOT NULL DEFAULT false,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.recurring_expenses TO authenticated;
GRANT ALL ON public.recurring_expenses TO service_role;
ALTER TABLE public.recurring_expenses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own recurring_expenses" ON public.recurring_expenses FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_recurring_expenses_updated
BEFORE UPDATE ON public.recurring_expenses
FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

CREATE INDEX idx_recurring_expenses_user_due ON public.recurring_expenses(user_id, next_due) WHERE is_active = true;

-- 2) attachments
CREATE TABLE IF NOT EXISTS public.attachments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  entity_type text NOT NULL, -- expense|person_ledger|wallet_tx|debt|recurring_expense
  entity_id uuid NOT NULL,
  file_path text NOT NULL, -- path in storage bucket
  file_name text NOT NULL,
  mime_type text,
  size_bytes bigint,
  kind text DEFAULT 'document', -- receipt|invoice|contract|document
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.attachments TO authenticated;
GRANT ALL ON public.attachments TO service_role;
ALTER TABLE public.attachments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own attachments" ON public.attachments FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_attachments_entity ON public.attachments(entity_type, entity_id);
CREATE INDEX idx_attachments_user ON public.attachments(user_id);

-- 3) person_ledger status
ALTER TABLE public.person_ledger ADD COLUMN IF NOT EXISTS status text;

-- compute initial status
UPDATE public.person_ledger SET status = CASE
  WHEN settled_at IS NOT NULL THEN 'settled'
  WHEN kind IN ('lend','borrow') AND due_date IS NOT NULL AND due_date < CURRENT_DATE THEN 'overdue'
  WHEN kind IN ('lend','borrow') THEN 'active'
  ELSE NULL
END;

-- trigger to keep status current on insert/update
CREATE OR REPLACE FUNCTION public.person_ledger_set_status()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.settled_at IS NOT NULL THEN
    NEW.status := 'settled';
  ELSIF NEW.kind IN ('lend','borrow') AND NEW.due_date IS NOT NULL AND NEW.due_date < CURRENT_DATE THEN
    NEW.status := 'overdue';
  ELSIF NEW.kind IN ('lend','borrow') THEN
    NEW.status := 'active';
  ELSE
    NEW.status := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_person_ledger_status ON public.person_ledger;
CREATE TRIGGER trg_person_ledger_status
BEFORE INSERT OR UPDATE ON public.person_ledger
FOR EACH ROW EXECUTE FUNCTION public.person_ledger_set_status();
