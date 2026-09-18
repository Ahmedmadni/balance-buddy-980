import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export type PersonLedgerOperation = "create" | "update" | "delete";

export type PersonLedgerMutationData = {
  contact_id?: string | null;
  contact_name?: string;
  kind?: "lend" | "borrow" | "collect" | "pay";
  amount?: number;
  currency?: string;
  happened_at?: string;
  due_date?: string | null;
  reminder_enabled?: boolean;
  settled_at?: string | null;
  notes?: string | null;
  wallet_id?: string | null;
};

export class PersonLedgerMutationError extends Error {
  constructor(
    public readonly userMessage: string,
    public readonly technicalError?: unknown,
  ) {
    super(userMessage);
    this.name = "PersonLedgerMutationError";
  }
}

export function personLedgerErrorMessage(error: { message?: string; code?: string } | null | undefined): string {
  const message = error?.message ?? "";
  if (message.includes("PERSON_LEDGER_INVALID_WALLET")) return "المحفظة غير صالحة";
  if (message.includes("PERSON_LEDGER_NOT_FOUND")) return "الحركة غير موجودة";
  if (message.includes("PERSON_LEDGER_UNAUTHENTICATED") || error?.code === "42501")
    return "ليس لديك صلاحية لتنفيذ هذه العملية";
  if (message.includes("PERSON_LEDGER_INVALID_CONTACT")) return "جهة الاتصال غير صالحة";
  return "تعذر حفظ الحركة";
}

export async function mutatePersonLedger(
  operation: PersonLedgerOperation,
  ledgerId: string | null,
  data: PersonLedgerMutationData = {},
): Promise<{ id: string; operation: PersonLedgerOperation; wallet_mirror: boolean }> {
  const { data: result, error } = await supabase.rpc("mutate_person_ledger", {
    p_operation: operation,
    p_ledger_id: ledgerId ?? undefined,
    p_data: data as Json,
  });
  if (error) throw new PersonLedgerMutationError(personLedgerErrorMessage(error), error);
  return result as { id: string; operation: PersonLedgerOperation; wallet_mirror: boolean };
}
