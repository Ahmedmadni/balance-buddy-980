import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { todayISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { WALLET_TX_KINDS, INFLOW_KINDS } from "@/lib/wallet-balance";
import { ArrowDownToLine, ArrowUpFromLine, Send, Inbox, Equal } from "lucide-react";

const ICONS: Record<string, any> = { deposit: ArrowDownToLine, withdraw: ArrowUpFromLine, send: Send, receive: Inbox, adjustment: Equal };

export type WalletTxInitial = {
  id: string;
  kind: string;
  amount: number | string;
  happened_at: string;
  notes: string | null;
  category_id: string | null;
};

export function WalletTxForm({ wallet, onDone, initial }: { wallet: { id: string; name: string; currency: string }; onDone: () => void; initial?: WalletTxInitial | null }) {
  const [kind, setKind] = useState<string>(initial?.kind ?? "deposit");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [happenedAt, setHappenedAt] = useState(initial?.happened_at ?? todayISO());
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [categoryId, setCategoryId] = useState<string>(initial?.category_id ?? "");
  const isEdit = !!initial;

  const isInflow = INFLOW_KINDS.has(kind) && kind !== "adjustment" ? true : kind === "deposit" || kind === "receive";
  const catKind = isInflow ? "inflow" : "outflow";

  const { data: cats } = useQuery({
    queryKey: ["wallet-tx-cats", catKind],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("wallet_tx_categories" as any)
        .select("id,name,kind")
        .eq("kind", catKind)
        .order("name");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const payload: any = {
        user_id: u.user.id,
        wallet_id: wallet.id,
        kind,
        amount: parseFloat(amount),
        currency: wallet.currency,
        happened_at: happenedAt,
        notes: notes.trim() || null,
        category_id: categoryId || null,
      };
      if (isEdit) {
        const { error } = await supabase.from("wallet_transactions").update(payload).eq("id", initial!.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wallet_transactions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(isEdit ? "تم التحديث" : "تم تسجيل العملية"); onDone(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
      <DialogHeader><DialogTitle>{isEdit ? `تعديل عملية — ${wallet.name}` : `عملية على ${wallet.name}`}</DialogTitle></DialogHeader>

      <div>
        <Label className="mb-2 block">نوع العملية</Label>
        <div className="grid grid-cols-2 gap-2">
          {WALLET_TX_KINDS.map((k) => {
            const Icon = ICONS[k.value];
            const active = kind === k.value;
            return (
              <button type="button" key={k.value} onClick={() => { setKind(k.value); setCategoryId(""); }}
                className={cn("flex items-center gap-2 rounded-xl border p-3 text-sm font-medium transition text-right",
                  active ? `${k.bg} border-current ${k.color}` : "border-border bg-card hover:bg-accent")}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="flex-1">{k.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <Label>التصنيف</Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue placeholder="اختر تصنيفاً (اختياري)" /></SelectTrigger>
          <SelectContent>
            {(cats ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>المبلغ ({wallet.currency})</Label>
          <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required dir="ltr" />
        </div>
        <div>
          <Label>التاريخ</Label>
          <Input type="date" value={happenedAt} onChange={(e) => setHappenedAt(e.target.value)} required dir="ltr" />
        </div>
      </div>

      <div>
        <Label>ملاحظات</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} rows={2} />
      </div>

      <DialogFooter>
        <Button type="submit" className="w-full" disabled={mut.isPending}>{mut.isPending ? "جاري الحفظ..." : "حفظ"}</Button>
      </DialogFooter>
    </form>
  );
}

export type WalletTransferInitial = {
  transfer_group_id: string;
  from_wallet_id: string;
  to_wallet_id: string;
  amount: number | string;
  happened_at: string;
  notes: string | null;
};

export function WalletTransferForm({ wallets, defaultFromId, onDone, initial }: { wallets: any[]; defaultFromId?: string; onDone: () => void; initial?: WalletTransferInitial | null }) {
  const isEdit = !!initial;
  const [fromId, setFromId] = useState<string>(initial?.from_wallet_id ?? defaultFromId ?? wallets[0]?.id ?? "");
  const [toId, setToId] = useState<string>(initial?.to_wallet_id ?? wallets.find((w) => w.id !== (defaultFromId ?? wallets[0]?.id))?.id ?? "");
  const [amount, setAmount] = useState(initial ? String(initial.amount) : "");
  const [happenedAt, setHappenedAt] = useState(initial?.happened_at ?? todayISO());
  const [notes, setNotes] = useState(initial?.notes ?? "");

  const from = wallets.find((w) => w.id === fromId);
  const to = wallets.find((w) => w.id === toId);

  const mut = useMutation({
    mutationFn: async () => {
      if (fromId === toId) throw new Error("اختر حسابين مختلفين");
      if (!from || !to) throw new Error("اختر الحسابات");
      if (from.currency !== to.currency) throw new Error("تحويل بعملات مختلفة غير مدعوم بعد");
      const { error } = await (supabase.rpc as any)("mutate_wallet_transfer", {
        p_operation: isEdit ? "update" : "create",
        p_transfer_group_id: isEdit ? initial!.transfer_group_id : null,
        p_data: {
          from_wallet_id: fromId,
          to_wallet_id: toId,
          amount: parseFloat(amount),
          happened_at: happenedAt,
          notes: notes.trim() || null,
        },
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success(isEdit ? "تم تحديث التحويل" : "تم التحويل"); onDone(); },
    onError: (e: any) => toast.error("تعذر تنفيذ التحويل", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
      <DialogHeader><DialogTitle>{isEdit ? "تعديل التحويل" : "تحويل بين الحسابات"}</DialogTitle></DialogHeader>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>من</Label>
          <Select value={fromId} onValueChange={setFromId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{wallets.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label>إلى</Label>
          <Select value={toId} onValueChange={setToId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{wallets.filter((w: any) => w.id !== fromId).map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>المبلغ {from && `(${from.currency})`}</Label>
          <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required dir="ltr" />
        </div>
        <div>
          <Label>التاريخ</Label>
          <Input type="date" value={happenedAt} onChange={(e) => setHappenedAt(e.target.value)} required dir="ltr" />
        </div>
      </div>

      <div>
        <Label>ملاحظات</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} rows={2} />
      </div>

      <DialogFooter>
        <Button type="submit" className="w-full" disabled={mut.isPending}>{mut.isPending ? "جاري التحويل..." : "تنفيذ التحويل"}</Button>
      </DialogFooter>
    </form>
  );
}
