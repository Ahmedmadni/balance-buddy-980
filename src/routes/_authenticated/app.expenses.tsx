import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Wallet } from "lucide-react";
import { CURRENCIES, formatMoney, formatDate, todayISO } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/expenses")({
  head: () => ({ meta: [{ title: "المصاريف — حسابي" }] }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["expenses-list"],
    queryFn: async () => {
      const [eRes, cRes, pRes, wRes] = await Promise.all([
        supabase.from("expenses").select("*, categories(name,color), projects(name,color), wallets(name,color)").order("spent_at", { ascending: false }).limit(200),
        supabase.from("categories").select("*").order("name"),
        supabase.from("projects").select("*").eq("status", "active").order("name"),
        supabase.from("wallets").select("*").order("created_at"),
      ]);
      return { expenses: eRes.data ?? [], categories: cRes.data ?? [], projects: pRes.data ?? [], wallets: wRes.data ?? [] };
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses-list"] }); qc.invalidateQueries({ queryKey: ["wallets-list"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("تم الحذف"); },
  });

  const totalsByCurrency: Record<string, number> = {};
  const monthStart = new Date(); monthStart.setDate(1);
  for (const e of data?.expenses ?? []) {
    if (new Date(e.spent_at) >= monthStart) totalsByCurrency[e.currency] = (totalsByCurrency[e.currency] ?? 0) + Number(e.amount);
  }

  const noWallets = (data?.wallets ?? []).length === 0;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">المصاريف</h1>
          <p className="text-sm text-muted-foreground mt-1">سجّل وتتبّع جميع مصاريفك</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button disabled={noWallets}><Plus className="h-4 w-4" /> مصروف جديد</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <ExpenseForm
              categories={data?.categories ?? []}
              projects={data?.projects ?? []}
              wallets={data?.wallets ?? []}
              onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["expenses-list"] }); qc.invalidateQueries({ queryKey: ["wallets-list"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {noWallets && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm">
          <div className="font-semibold mb-1">أنشئ محفظة أولاً</div>
          <div className="text-muted-foreground mb-3">يجب ربط كل مصروف بمحفظة (نقد/بنكية/أصل).</div>
          <Button asChild size="sm"><Link to="/app/wallets"><Wallet className="h-4 w-4" /> إنشاء محفظة</Link></Button>
        </div>
      )}

      <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] relative overflow-hidden">
        <div className="absolute -top-8 -left-8 h-24 w-24 rounded-full bg-[image:var(--gradient-primary)] opacity-20" />
        <div className="flex items-center gap-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-white">
            <Wallet className="h-5 w-5" />
          </div>
          <div className="text-sm text-muted-foreground">إجمالي مصاريف هذا الشهر</div>
        </div>
        <div className="mt-3 space-y-1">
          {Object.keys(totalsByCurrency).length === 0
            ? <div className="text-2xl font-bold text-muted-foreground/60">لا توجد مصاريف</div>
            : Object.entries(totalsByCurrency).map(([c, v]) => (
                <div key={c} className="text-xl font-bold tabular-nums">{formatMoney(v, c)}</div>
              ))}
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : (data?.expenses ?? []).length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">لا توجد مصاريف بعد</div>
      ) : (
        <div className="space-y-2">
          {data!.expenses.map((e: any) => (
            <div key={e.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]">
              <div className="h-10 w-10 rounded-xl shrink-0" style={{ backgroundColor: (e.categories?.color ?? "#64748b") + "33", border: `1px solid ${e.categories?.color ?? "#64748b"}` }} />
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  <span>{e.categories?.name ?? "بدون فئة"}</span>
                  {e.wallets && <span className="text-[10px] rounded-full px-2 py-0.5" style={{ backgroundColor: (e.wallets.color ?? "#0ea5e9") + "22", color: e.wallets.color }}>{e.wallets.name}</span>}
                  {e.projects && <span className="text-[10px] rounded-full px-2 py-0.5" style={{ backgroundColor: (e.projects.color ?? "#0ea5e9") + "22", color: e.projects.color }}>{e.projects.name}</span>}
                </div>
                <div className="text-xs text-muted-foreground truncate">{formatDate(e.spent_at)}{e.note ? ` · ${e.note}` : ""}</div>
              </div>
              <div className="font-bold tabular-nums shrink-0">{formatMoney(e.amount, e.currency)}</div>
              <Button variant="ghost" size="icon" onClick={() => del.mutate(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ExpenseForm({ categories, projects, wallets, onDone }: { categories: any[]; projects: any[]; wallets: any[]; onDone: () => void }) {
  const [walletId, setWalletId] = useState<string>(wallets[0]?.id ?? "");
  const initialWallet = wallets.find((w) => w.id === walletId);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(initialWallet?.currency ?? "SAR");
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? "");
  const [projectId, setProjectId] = useState<string>("none");
  const [spentAt, setSpentAt] = useState(todayISO());
  const [note, setNote] = useState("");

  const onWalletChange = (v: string) => {
    setWalletId(v);
    const w = wallets.find((x) => x.id === v);
    if (w?.currency) setCurrency(w.currency);
  };

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      if (!walletId) throw new Error("اختر محفظة");
      if (!categoryId) throw new Error("اختر فئة");
      const { error } = await supabase.from("expenses").insert({
        user_id: u.user.id,
        amount: parseFloat(amount), currency,
        category_id: categoryId,
        wallet_id: walletId,
        project_id: projectId === "none" ? null : projectId,
        spent_at: spentAt, note: note || null,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تمت الإضافة"); onDone(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
      <DialogHeader><DialogTitle>مصروف جديد</DialogTitle></DialogHeader>

      <div>
        <Label>المحفظة <span className="text-destructive">*</span></Label>
        <Select value={walletId} onValueChange={onWalletChange}>
          <SelectTrigger><SelectValue placeholder="اختر محفظة" /></SelectTrigger>
          <SelectContent>{wallets.map(w => <SelectItem key={w.id} value={w.id}>{w.name} · {w.currency}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div>
        <Label>الفئة <span className="text-destructive">*</span></Label>
        <Select value={categoryId} onValueChange={setCategoryId}>
          <SelectTrigger><SelectValue placeholder="اختر فئة" /></SelectTrigger>
          <SelectContent>{categories.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>المبلغ</Label>
          <Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required dir="ltr" />
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
        <Label>المشروع (اختياري)</Label>
        <Select value={projectId} onValueChange={setProjectId}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">بدون مشروع</SelectItem>
            {projects.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>التاريخ</Label>
        <Input type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} required dir="ltr" />
      </div>

      <div>
        <Label>ملاحظة</Label>
        <Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      </div>

      <DialogFooter><Button type="submit" className="w-full" disabled={mut.isPending}>حفظ</Button></DialogFooter>
    </form>
  );
}
