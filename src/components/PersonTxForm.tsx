import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CURRENCIES, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ArrowDownRight, ArrowUpRight, HandCoins, CircleCheck } from "lucide-react";
import { ContactPicker } from "@/components/ContactPicker";
import { mutatePersonLedger } from "@/lib/person-ledger";

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

export function kindSign(k: string): 1 | -1 {
  return k === "lend" || k === "pay" ? 1 : -1;
}

export type PersonLedgerInitial = {
  id: string;
  kind: string;
  contact_id: string | null;
  contact_name: string;
  amount: number | string;
  currency: string;
  happened_at: string;
  due_date: string | null;
  reminder_enabled: boolean;
  notes: string | null;
  wallet_id?: string | null;
};

export function PersonTxForm({
  onDone,
  defaultContactId,
  defaultName,
  lockContact,
  defaultCurrency = "SAR",
  initial,
}: {
  onDone: () => void;
  defaultContactId?: string | null;
  defaultName?: string;
  lockContact?: boolean;
  defaultCurrency?: string;
  initial?: PersonLedgerInitial | null;
}) {
  const [kind, setKind] = useState<LedgerKind>((initial?.kind as LedgerKind) ?? "lend");
  const [contact, setContact] = useState<{ id: string | null; name: string }>(
    { id: initial?.contact_id ?? defaultContactId ?? null, name: initial?.contact_name ?? defaultName ?? "" },
  );
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [currency, setCurrency] = useState(initial?.currency ?? defaultCurrency);
  const [happenedAt, setHappenedAt] = useState(initial?.happened_at ?? todayISO());
  const [dueDate, setDueDate] = useState<string>(initial?.due_date ?? "");
  const [reminderEnabled, setReminderEnabled] = useState(initial?.reminder_enabled ?? false);
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [walletId, setWalletId] = useState<string>(initial?.wallet_id ?? "none");

  const isDebtLike = kind === "lend" || kind === "borrow";
  const isEdit = !!initial;

  const { data: wallets } = useQuery({
    queryKey: ["wallets-for-person-form"],
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("id,name,currency").order("created_at");
      return (data ?? []) as { id: string; name: string; currency: string }[];
    },
  });

  // Auto-pick currency to wallet currency on selection
  useEffect(() => {
    if (walletId && walletId !== "none") {
      const w = wallets?.find((x) => x.id === walletId);
      if (w?.currency) setCurrency(w.currency);
    }
  }, [walletId, wallets]);

  const mut = useMutation({
    mutationFn: async () => {
      if (!contact.id) throw new Error("اختر جهة اتصال");
      const amt = parseFloat(amount);
      const payload: any = {
        contact_id: contact.id,
        contact_name: contact.name.trim(),
        kind,
        amount: amt,
        currency,
        happened_at: happenedAt,
        due_date: isDebtLike && dueDate ? dueDate : null,
        reminder_enabled: isDebtLike && !!dueDate && reminderEnabled,
        notes: notes.trim() || null,
        wallet_id: walletId !== "none" ? walletId : null,
      };

      await mutatePersonLedger(isEdit ? "update" : "create", initial?.id ?? null, payload);
    },
    onSuccess: () => { toast.success(isEdit ? "تم التحديث" : "تم تسجيل الحركة"); onDone(); },
    onError: (e: any) => toast.error("خطأ", { description: e.userMessage ?? "تعذر حفظ الحركة" }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
      <DialogHeader>
        <DialogTitle>{isEdit ? "تعديل الحركة" : defaultName ? `معاملة جديدة مع ${defaultName}` : "حركة جديدة"}</DialogTitle>
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

      <div>
        <Label>المحفظة المتأثرة (اختياري)</Label>
        <Select value={walletId} onValueChange={setWalletId}>
          <SelectTrigger><SelectValue placeholder="بدون تأثير على المحافظ" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">بدون تأثير على المحافظ</SelectItem>
            {(wallets ?? []).map((w) => (
              <SelectItem key={w.id} value={w.id}>{w.name} · {w.currency}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground mt-1">
          عند تحديد المحفظة سيُسجَّل {kind === "lend" || kind === "pay" ? "خصم" : "إيداع"} مطابق تلقائياً في كشف المحفظة.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>المبلغ</Label>
          <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required dir="ltr" />
        </div>
        <div>
          <Label>العملة</Label>
          <Select value={currency} onValueChange={setCurrency} disabled={walletId !== "none"}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>التاريخ</Label>
          <Input type="date" value={happenedAt} onChange={(e) => setHappenedAt(e.target.value)} required dir="ltr" />
        </div>
        {isDebtLike && (
          <div>
            <Label>تاريخ الاستحقاق (اختياري)</Label>
            <Input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} dir="ltr" />
          </div>
        )}
      </div>

      {isDebtLike && dueDate && (
        <div className="flex items-center justify-between rounded-xl border bg-accent/30 px-3 py-2">
          <div>
            <div className="text-sm font-medium">تفعيل تذكير الاستحقاق</div>
            <div className="text-[11px] text-muted-foreground">ستظهر هذه الحركة في تنبيهات الاستحقاق</div>
          </div>
          <Switch checked={reminderEnabled} onCheckedChange={setReminderEnabled} />
        </div>
      )}

      <div>
        <Label>ملاحظات</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} rows={2} />
      </div>

      <DialogFooter>
        <Button type="submit" className="w-full" disabled={mut.isPending || !contact.id}>
          {mut.isPending ? "جاري الحفظ..." : isEdit ? "حفظ التعديلات" : "حفظ"}
        </Button>
      </DialogFooter>
    </form>
  );
}
