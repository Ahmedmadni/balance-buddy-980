import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CURRENCIES, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, HandCoins, CircleCheck } from "lucide-react";
import { ContactPicker } from "@/components/ContactPicker";

export const LEDGER_KINDS = [
  { value: "lend", label: "سلّفته", short: "تسليف", icon: ArrowUpRight, color: "text-success", bg: "bg-success/10 hover:bg-success/20 border-success/30", sign: "+" },
  { value: "borrow", label: "استلفت منه", short: "استلاف", icon: ArrowDownRight, color: "text-destructive", bg: "bg-destructive/10 hover:bg-destructive/20 border-destructive/30", sign: "−" },
  { value: "collect", label: "حصّلت منه", short: "تحصيل", icon: HandCoins, color: "text-destructive", bg: "bg-amber-500/10 hover:bg-amber-500/20 border-amber-500/30", sign: "−" },
  { value: "pay", label: "سددت له", short: "سداد", icon: CircleCheck, color: "text-success", bg: "bg-blue-500/10 hover:bg-blue-500/20 border-blue-500/30", sign: "+" },
] as const;

export type LedgerKind = (typeof LEDGER_KINDS)[number]["value"];

export function kindMeta(k: string) {
  return LEDGER_KINDS.find((x) => x.value === k) ?? LEDGER_KINDS[0];
}

/** Sign per kind for balance: positive => he owes me more */
export function kindSign(k: string): 1 | -1 {
  return k === "lend" || k === "pay" ? 1 : -1;
}

export function PersonTxForm({
  onDone,
  defaultContactId,
  defaultName,
  lockContact,
  defaultCurrency = "SAR",
}: {
  onDone: () => void;
  defaultContactId?: string | null;
  defaultName?: string;
  lockContact?: boolean;
  defaultCurrency?: string;
}) {
  const [kind, setKind] = useState<LedgerKind>("lend");
  const [contact, setContact] = useState<{ id: string | null; name: string }>(
    { id: defaultContactId ?? null, name: defaultName ?? "" },
  );
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [happenedAt, setHappenedAt] = useState(todayISO());
  const [notes, setNotes] = useState("");

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      if (!contact.id) throw new Error("اختر جهة اتصال");
      const { error } = await supabase.from("person_ledger").insert({
        user_id: u.user.id,
        contact_id: contact.id,
        contact_name: contact.name.trim(),
        kind,
        amount: parseFloat(amount),
        currency,
        happened_at: happenedAt,
        notes: notes.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم تسجيل الحركة"); onDone(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{defaultName ? `معاملة جديدة مع ${defaultName}` : "حركة جديدة"}</DialogTitle>
      </DialogHeader>

      <div>
        <Label className="mb-2 block">نوع الحركة</Label>
        <div className="grid grid-cols-2 gap-2">
          {LEDGER_KINDS.map((k) => {
            const Icon = k.icon;
            const active = kind === k.value;
            return (
              <button
                type="button"
                key={k.value}
                onClick={() => setKind(k.value)}
                className={cn(
                  "flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition text-right",
                  active ? `${k.bg} border-current ${k.color}` : "border-border bg-card hover:bg-accent text-foreground",
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{k.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label className="mb-2 block">جهة الاتصال</Label>
        <ContactPicker
          value={contact}
          onChange={(v) => setContact({ id: v.id, name: v.name })}
          disabled={lockContact}
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>المبلغ</Label>
          <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required dir="ltr" />
        </div>
        <div>
          <Label>العملة</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div>
        <Label>التاريخ</Label>
        <Input type="date" value={happenedAt} onChange={(e) => setHappenedAt(e.target.value)} required dir="ltr" />
      </div>

      <div>
        <Label>ملاحظات</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} rows={2} />
      </div>

      <DialogFooter>
        <Button type="submit" className="w-full" disabled={mut.isPending || !contact.id}>{mut.isPending ? "جاري الحفظ..." : "حفظ"}</Button>
      </DialogFooter>
    </form>
  );
}
