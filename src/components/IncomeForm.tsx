import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { todayISO, formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { TrendingUp, Plus } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_SOURCES = [
  { id: "salary", name: "راتب" },
  { id: "bonus", name: "مكافأة" },
  { id: "side", name: "دخل إضافي" },
  { id: "invest", name: "أرباح استثمار" },
  { id: "gift", name: "هدية" },
  { id: "refund", name: "استرداد مبلغ" },
];

export function IncomeForm({ onDone, defaultWalletId }: { onDone: () => void; defaultWalletId?: string }) {
  const qc = useQueryClient();
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState<string>(defaultWalletId ?? "");
  const [categoryId, setCategoryId] = useState<string>("");
  const [happenedAt, setHappenedAt] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [addingCustom, setAddingCustom] = useState(false);
  const [customName, setCustomName] = useState("");

  const { data: wallets } = useQuery({
    queryKey: ["wallets-for-income"],
    queryFn: async () => {
      const { data } = await supabase.from("wallets").select("id,name,currency,type,color").eq("is_archived", false).order("created_at");
      return data ?? [];
    },
  });

  const { data: cats, refetch: refetchCats } = useQuery({
    queryKey: ["wallet-tx-cats", "inflow"],
    queryFn: async () => {
      const { data } = await supabase.from("wallet_tx_categories" as any).select("id,name").eq("kind", "inflow").order("name");
      return (data ?? []) as any[];
    },
  });

  const wallet = wallets?.find((w: any) => w.id === walletId);

  const addCustomCat = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const trimmed = customName.trim();
      if (!trimmed) throw new Error("اكتب اسم المصدر");
      const { data, error } = await supabase
        .from("wallet_tx_categories" as any)
        .insert({ user_id: u.user.id, name: trimmed, kind: "inflow", is_default: false } as any)
        .select("id,name")
        .single();
      if (error) throw error;
      return data as any;
    },
    onSuccess: async (row: any) => {
      await refetchCats();
      setCategoryId(row.id);
      setAddingCustom(false);
      setCustomName("");
      toast.success("تمت إضافة المصدر");
    },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      if (!walletId) throw new Error("اختر المحفظة");
      if (!wallet) throw new Error("المحفظة غير موجودة");
      const amt = parseFloat(amount);
      if (!amt || amt <= 0) throw new Error("أدخل مبلغاً صحيحاً");
      const { error } = await supabase.from("wallet_transactions").insert({
        user_id: u.user.id,
        wallet_id: walletId,
        kind: "deposit",
        amount: amt,
        currency: wallet.currency,
        happened_at: happenedAt,
        notes: notes.trim() || null,
        category_id: categoryId || null,
      } as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تسجيل الدخل وتحديث رصيد المحفظة");
      qc.invalidateQueries({ queryKey: ["wallets-list"] });
      qc.invalidateQueries({ queryKey: ["dashboard"] });
      qc.invalidateQueries({ queryKey: ["transactions"] });
      onDone();
    },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
      <DialogHeader>
        <DialogTitle className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-emerald-500/15 text-emerald-600">
            <TrendingUp className="h-4 w-4" />
          </span>
          تسجيل دخل جديد
        </DialogTitle>
      </DialogHeader>

      <div>
        <Label>المحفظة المستلِمة <span className="text-destructive">*</span></Label>
        <Select value={walletId} onValueChange={setWalletId}>
          <SelectTrigger><SelectValue placeholder="اختر المحفظة" /></SelectTrigger>
          <SelectContent>
            {(wallets ?? []).map((w: any) => (
              <SelectItem key={w.id} value={w.id}>
                <span className="inline-flex items-center gap-2">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ background: w.color ?? "#0ea5e9" }} />
                  {w.name} <span className="text-muted-foreground text-[11px]">({w.currency})</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {(wallets ?? []).length === 0 && (
          <div className="mt-1 text-[11px] text-amber-600">لا توجد محافظ — أنشئ محفظة أولاً من صفحة المحافظ.</div>
        )}
      </div>

      <div>
        <Label>مصدر الدخل</Label>
        {!addingCustom ? (
          <div className="space-y-2">
            <Select value={categoryId} onValueChange={(v) => v === "__new" ? setAddingCustom(true) : setCategoryId(v)}>
              <SelectTrigger><SelectValue placeholder="اختر مصدراً (اختياري)" /></SelectTrigger>
              <SelectContent>
                {(cats ?? []).map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                <SelectItem value="__new" className="text-primary font-semibold">
                  <span className="inline-flex items-center gap-1.5"><Plus className="h-3.5 w-3.5" /> إضافة مصدر مخصص…</span>
                </SelectItem>
              </SelectContent>
            </Select>
            {(!cats || cats.length === 0) && (
              <div className="flex flex-wrap gap-1.5">
                {DEFAULT_SOURCES.map((s) => (
                  <button key={s.id} type="button" onClick={() => { setCustomName(s.name); setAddingCustom(true); }}
                    className="text-[11px] rounded-full border border-border px-2 py-0.5 hover:border-primary hover:text-primary">
                    + {s.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex gap-2">
            <Input value={customName} onChange={(e) => setCustomName(e.target.value)} placeholder="اسم المصدر" autoFocus maxLength={60} />
            <Button type="button" size="sm" onClick={() => addCustomCat.mutate()} disabled={addCustomCat.isPending}>إضافة</Button>
            <Button type="button" size="sm" variant="ghost" onClick={() => { setAddingCustom(false); setCustomName(""); }}>إلغاء</Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>المبلغ {wallet && <span className="text-muted-foreground text-[11px]">({wallet.currency})</span>}</Label>
          <Input type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required dir="ltr" />
        </div>
        <div>
          <Label>التاريخ</Label>
          <Input type="date" value={happenedAt} onChange={(e) => setHappenedAt(e.target.value)} required dir="ltr" />
        </div>
      </div>

      <div>
        <Label>ملاحظات</Label>
        <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} rows={2} placeholder="اختياري" />
      </div>

      {wallet && amount && (
        <div className={cn("rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm")}>
          سيُضاف <span className="font-bold tabular-nums">{formatMoney(parseFloat(amount) || 0, wallet.currency)}</span> إلى محفظة <span className="font-bold">{wallet.name}</span>
        </div>
      )}

      <DialogFooter>
        <Button type="submit" className="w-full" disabled={mut.isPending || !walletId}>
          {mut.isPending ? "جاري الحفظ..." : "تسجيل الدخل"}
        </Button>
      </DialogFooter>
    </form>
  );
}
