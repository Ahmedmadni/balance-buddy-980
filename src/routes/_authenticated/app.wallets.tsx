import { createFileRoute, Link, useSearch, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Wallet, Banknote, Landmark, TrendingUp, ArrowLeftRight, ChevronLeft, CreditCard, HandCoins, Archive, ArchiveRestore } from "lucide-react";
import { CURRENCIES, formatMoney } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { computeWalletBalance } from "@/lib/wallet-balance";
import { WalletTransferForm } from "@/components/WalletTxForm";
import { IncomeForm } from "@/components/IncomeForm";

export const Route = createFileRoute("/_authenticated/app/wallets")({
  head: () => ({ meta: [{ title: "المحافظ — رصد" }] }),
  component: WalletsPage,
});

export const WALLET_TYPES = [
  { value: "cash", label: "نقد (كاش)", icon: Banknote, color: "#22c55e" },
  { value: "bank", label: "حساب بنكي", icon: Landmark, color: "#0ea5e9" },
  { value: "credit_card", label: "بطاقة ائتمانية", icon: CreditCard, color: "#ef4444" },
  { value: "investment", label: "حساب استثماري", icon: TrendingUp, color: "#a855f7" },
  { value: "zakat", label: "حساب زكاة", icon: HandCoins, color: "#eab308" },
  { value: "asset", label: "أصل آخر", icon: Wallet, color: "#64748b" },
];

export function typeMeta(t: string) {
  return WALLET_TYPES.find((x) => x.value === t) ?? WALLET_TYPES[0];
}

function WalletsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [openTransfer, setOpenTransfer] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const qs = useSearch({ strict: false }) as { new?: string };
  const navigate = useNavigate();
  useEffect(() => {
    if (qs?.new === "transfer") setOpenTransfer(true);
    else if (qs?.new) setOpen(true);
    if (qs?.new) navigate({ to: "/app/wallets", search: {}, replace: true });
  }, [qs?.new, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["wallets-list"],
    queryFn: async () => {
      const [wRes, eRes, tRes] = await Promise.all([
        supabase.from("wallets").select("*").order("created_at", { ascending: true }),
        supabase.from("expenses").select("wallet_id,amount,currency,spent_at"),
        supabase.from("wallet_transactions").select("wallet_id,kind,amount,happened_at"),
      ]);
      return { wallets: wRes.data ?? [], expenses: eRes.data ?? [], txs: (tRes.data ?? []) as any[] };
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("wallets").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["wallets-list"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  const toggleArchive = useMutation({
    mutationFn: async (w: any) => { const { error } = await supabase.from("wallets").update({ is_archived: !w.is_archived } as any).eq("id", w.id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wallets-list"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  const allWallets = data?.wallets ?? [];
  const wallets = allWallets.filter((w: any) => showArchived ? true : !w.is_archived);
  const archivedCount = allWallets.filter((w: any) => w.is_archived).length;

  const expByWallet = new Map<string, any[]>();
  for (const e of data?.expenses ?? []) {
    if (!e.wallet_id) continue;
    const a = expByWallet.get(e.wallet_id) ?? []; a.push(e); expByWallet.set(e.wallet_id, a);
  }
  const txByWallet = new Map<string, any[]>();
  for (const t of data?.txs ?? []) {
    const a = txByWallet.get(t.wallet_id) ?? []; a.push(t); txByWallet.set(t.wallet_id, a);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">المحافظ والحسابات</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة حساباتك البنكية والنقدية والاستثمارية</p>
        </div>
        <div className="flex gap-2">
          {archivedCount > 0 && (
            <Button variant="ghost" size="sm" onClick={() => setShowArchived(s => !s)}>
              {showArchived ? "إخفاء المؤرشف" : `عرض المؤرشف (${archivedCount})`}
            </Button>
          )}
          {wallets.length >= 2 && (
            <Dialog open={openTransfer} onOpenChange={setOpenTransfer}>
              <DialogTrigger asChild>
                <Button variant="outline"><ArrowLeftRight className="h-4 w-4" /> تحويل</Button>
              </DialogTrigger>
              <DialogContent className="max-w-md">
                <WalletTransferForm wallets={wallets} onDone={() => { setOpenTransfer(false); qc.invalidateQueries({ queryKey: ["wallets-list"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); }} />
              </DialogContent>
            </Dialog>
          )}
          <Dialog open={open || !!editing} onOpenChange={(v) => { if (!v) { setOpen(false); setEditing(null); } }}>
            <DialogTrigger asChild>
              <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> حساب</Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <WalletForm initial={editing} onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["wallets-list"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); }} />
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">{[1,2].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : wallets.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {wallets.map((w: any) => {
            const meta = typeMeta(w.type);
            const Icon = meta.icon;
            const balance = computeWalletBalance(Number(w.opening_balance), txByWallet.get(w.id) ?? [], expByWallet.get(w.id) ?? []);
            return (
              <Link key={w.id} to="/app/wallets/$id" params={{ id: w.id }} className={cn("rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] relative overflow-hidden block transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]", w.is_archived && "opacity-60")}>
                <div className="absolute -top-8 -left-8 h-24 w-24 rounded-full opacity-20" style={{ background: w.color ?? meta.color }} />
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-11 w-11 place-items-center rounded-xl text-white" style={{ background: w.color ?? meta.color }}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold flex items-center gap-2">{w.name} {w.is_archived && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">مؤرشف</span>}</div>
                      <div className="text-[11px] text-muted-foreground">{meta.label}</div>
                    </div>
                  </div>
                  <div className="flex gap-1" onClick={(e) => e.preventDefault()}>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); setEditing(w); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); toggleArchive.mutate(w); }} title={w.is_archived ? "إلغاء الأرشفة" : "أرشفة"}>
                      {w.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    </Button>
                    <Button variant="ghost" size="icon" onClick={(e) => { e.preventDefault(); if (confirm("حذف الحساب؟ سيتم حذف جميع عملياته.")) del.mutate(w.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="text-xs text-muted-foreground">الرصيد الحالي</div>
                  <div className={cn("text-2xl font-extrabold tabular-nums", balance < 0 && "text-destructive")}>
                    {formatMoney(balance, w.currency)}
                  </div>
                  <div className="mt-2 flex items-center justify-between text-[11px] text-muted-foreground">
                    <span>افتتاحي: <span className="tabular-nums">{formatMoney(w.opening_balance, w.currency)}</span></span>
                    <span className="inline-flex items-center gap-1 text-primary">عرض الكشف <ChevronLeft className="h-3 w-3" /></span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border bg-card p-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent">
        <Wallet className="h-6 w-6 text-accent-foreground" />
      </div>
      <h3 className="mt-4 font-semibold">لا توجد حسابات بعد</h3>
      <p className="mt-1 text-sm text-muted-foreground">أضف أول حساب لربط مصاريفك وحركاتك به</p>
    </div>
  );
}

function WalletForm({ onDone, initial }: { onDone: () => void; initial?: any }) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? "cash");
  const [currency, setCurrency] = useState(initial?.currency ?? "SAR");
  const [opening, setOpening] = useState(initial?.opening_balance?.toString() ?? "0");
  const [color, setColor] = useState(initial?.color ?? typeMeta(initial?.type ?? "cash").color);

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const payload = { user_id: u.user.id, name: name.trim(), type, currency, opening_balance: parseFloat(opening) || 0, color };
      if (isEdit) {
        const { error } = await supabase.from("wallets").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("wallets").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(isEdit ? "تم التحديث" : "تمت الإضافة"); onDone(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
      <DialogHeader><DialogTitle>{isEdit ? "تعديل حساب" : "حساب جديد"}</DialogTitle></DialogHeader>
      <div><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="مثلاً: الراجحي، نقد جيب، فيزا" /></div>
      <div>
        <Label>النوع</Label>
        <Select value={type} onValueChange={(v) => { setType(v); if (!isEdit) setColor(typeMeta(v).color); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{WALLET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div><Label>الرصيد الافتتاحي</Label><Input type="number" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} required dir="ltr" /></div>
        <div>
          <Label>العملة</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div><Label>اللون</Label><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full" /></div>
      <DialogFooter><Button type="submit" className="w-full" disabled={mut.isPending}>{mut.isPending ? "جاري الحفظ..." : "حفظ"}</Button></DialogFooter>
    </form>
  );
}
