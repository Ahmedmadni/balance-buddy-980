import { createFileRoute, Link, useSearch, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, Trash2, Wallet, CalendarRange, Paperclip, Package, Users, X } from "lucide-react";
import { CURRENCIES, formatMoney, formatDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { AttachmentUploader } from "@/components/AttachmentUploader";
import { ContactPicker } from "@/components/ContactPicker";


export const Route = createFileRoute("/_authenticated/app/expenses")({
  head: () => ({ meta: [{ title: "المصاريف — رصد" }] }),
  component: ExpensesPage,
});

function ExpensesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [assetFilter, setAssetFilter] = useState<"all" | "regular" | "asset_opex">("all");
  const search = useSearch({ strict: false }) as { new?: string };
  const navigate = useNavigate();
  useEffect(() => {
    if (search?.new) {
      setOpen(true);
      navigate({ to: "/app/expenses", search: {}, replace: true });
    }
  }, [search?.new, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["expenses-list"],
    queryFn: async () => {
      const [eRes, cRes, pRes, wRes, opexRes, invRes] = await Promise.all([
        supabase.from("expenses").select("*, categories(name,color), projects(name,color), wallets(name,color)").order("spent_at", { ascending: false }).limit(200),
        supabase.from("categories").select("*").order("name"),
        supabase.from("projects").select("*").eq("status", "active").order("name"),
        supabase.from("wallets").select("*").order("created_at"),
        supabase.from("investment_transactions").select("id,investment_id,amount,currency,happened_at,notes,wallet_id,tx_class").eq("tx_class", "opex").order("happened_at", { ascending: false }).limit(200),
        supabase.from("investments").select("id,name,asset_kind,type"),
      ]);
      return {
        expenses: eRes.data ?? [],
        categories: cRes.data ?? [],
        projects: pRes.data ?? [],
        wallets: wRes.data ?? [],
        opex: opexRes.data ?? [],
        investments: invRes.data ?? [],
      };
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("expenses").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["expenses-list"] }); qc.invalidateQueries({ queryKey: ["wallets-list"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("تم الحذف"); },
  });

  // Use allocations for the current month total
  const { data: monthAlloc } = useQuery({
    queryKey: ["expense-month-alloc"],
    queryFn: async () => {
      const ms = new Date(); ms.setDate(1);
      const start = ms.toISOString().slice(0, 10);
      const { data, error } = await supabase.from("expense_allocations").select("amount,currency,period").gte("period", start);
      if (error) throw error;
      const cur = new Date().toISOString().slice(0, 7);
      const totals: Record<string, number> = {};
      for (const r of data ?? []) if ((r as any).period.slice(0, 7) === cur) totals[(r as any).currency] = (totals[(r as any).currency] ?? 0) + Number((r as any).amount);
      return totals;
    },
  });

  const noWallets = (data?.wallets ?? []).length === 0;
  const invMap = useMemo(() => {
    const m = new Map<string, any>();
    for (const i of data?.investments ?? []) m.set(i.id, i);
    return m;
  }, [data?.investments]);

  // Merge regular expenses + asset OpEx into a unified list, sorted by date
  const merged = useMemo(() => {
    const reg = (data?.expenses ?? []).map((e: any) => ({ ...e, _kind: "regular" as const, _date: e.spent_at }));
    const ox = (data?.opex ?? []).map((t: any) => {
      const w = (data?.wallets ?? []).find((x: any) => x.id === t.wallet_id);
      const inv = invMap.get(t.investment_id);
      return { ...t, _kind: "asset_opex" as const, _date: t.happened_at, wallets: w, investment: inv };
    });
    const list = [...reg, ...ox].filter((row) => assetFilter === "all" ? true : row._kind === assetFilter);
    list.sort((a, b) => (a._date < b._date ? 1 : -1));
    return list;
  }, [data, invMap, assetFilter]);


  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">المصاريف</h1>
          <p className="text-sm text-muted-foreground mt-1">سجّل وتتبّع جميع مصاريفك (مع دعم التوزيع على أشهر)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button disabled={noWallets}><Plus className="h-4 w-4" /> مصروف جديد</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <ExpenseForm
              categories={data?.categories ?? []}
              projects={data?.projects ?? []}
              wallets={data?.wallets ?? []}
              onDone={() => {
                setOpen(false);
                qc.invalidateQueries({ queryKey: ["expenses-list"] });
                qc.invalidateQueries({ queryKey: ["expense-month-alloc"] });
                qc.invalidateQueries({ queryKey: ["wallets-list"] });
                qc.invalidateQueries({ queryKey: ["dashboard"] });
                qc.invalidateQueries({ queryKey: ["people"] });
                qc.invalidateQueries({ queryKey: ["person-ledger"] });
              }}
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
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-white"><Wallet className="h-5 w-5" /></div>
          <div className="text-sm text-muted-foreground">إجمالي مصاريف هذا الشهر <span className="text-[10px]">(بحسب التوزيع الشهري)</span></div>
        </div>
        <div className="mt-3 space-y-1">
          {Object.keys(monthAlloc ?? {}).length === 0
            ? <div className="text-2xl font-bold text-muted-foreground/60">لا توجد مصاريف</div>
            : Object.entries(monthAlloc ?? {}).map(([c, v]) => (<div key={c} className="text-xl font-bold tabular-nums">{formatMoney(v as number, c)}</div>))}
        </div>
      </div>

      <div className="flex items-center gap-2 flex-wrap text-xs">
        <span className="text-muted-foreground">عرض:</span>
        {([
          ["all", "الكل"],
          ["regular", "مصاريف عامة"],
          ["asset_opex", "مصاريف أصول (تشغيلية)"],
        ] as const).map(([k, lbl]) => (
          <button
            key={k}
            type="button"
            onClick={() => setAssetFilter(k)}
            className={cnFilter(assetFilter === k)}
          >{lbl}</button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-16 animate-pulse rounded-xl bg-muted" />)}</div>
      ) : merged.length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center text-muted-foreground">لا توجد مصاريف بعد</div>
      ) : (
        <div className="space-y-2">
          {merged.map((e: any) => e._kind === "asset_opex" ? (
            <div key={`ox-${e.id}`} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]">
              <div className="h-10 w-10 rounded-xl shrink-0 grid place-items-center bg-amber-500/15 border border-amber-500/40 text-amber-700 dark:text-amber-300"><Package className="h-5 w-5" /></div>
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  <span>مصروف تشغيلي</span>
                  {e.investment && (
                    <span className="text-[10px] rounded-full px-2 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-300 inline-flex items-center gap-1">
                      <Package className="h-3 w-3" /> من أصل: {e.investment.name}
                    </span>
                  )}
                  {e.wallets && <span className="text-[10px] rounded-full px-2 py-0.5" style={{ backgroundColor: (e.wallets.color ?? "#0ea5e9") + "22", color: e.wallets.color }}>{e.wallets.name}</span>}
                </div>
                <div className="text-xs text-muted-foreground truncate">{formatDate(e.happened_at)}{e.notes ? ` · ${e.notes}` : ""}</div>
              </div>
              <div className="font-bold tabular-nums shrink-0">{formatMoney(e.amount, e.currency)}</div>
            </div>
          ) : (
            <div key={e.id} className="flex items-center gap-3 rounded-xl border bg-card p-3 shadow-[var(--shadow-card)]">
              <div className="h-10 w-10 rounded-xl shrink-0" style={{ backgroundColor: (e.categories?.color ?? "#64748b") + "33", border: `1px solid ${e.categories?.color ?? "#64748b"}` }} />
              <div className="flex-1 min-w-0">
                <div className="font-medium flex items-center gap-2 flex-wrap">
                  <span>{e.categories?.name ?? "بدون فئة"}</span>
                  {e.wallets && <span className="text-[10px] rounded-full px-2 py-0.5" style={{ backgroundColor: (e.wallets.color ?? "#0ea5e9") + "22", color: e.wallets.color }}>{e.wallets.name}</span>}
                  {e.projects && <span className="text-[10px] rounded-full px-2 py-0.5" style={{ backgroundColor: (e.projects.color ?? "#0ea5e9") + "22", color: e.projects.color }}>{e.projects.name}</span>}
                  {e.allocation_kind === "spread" && (
                    <span className="text-[10px] rounded-full px-2 py-0.5 bg-primary/15 text-primary inline-flex items-center gap-1"><CalendarRange className="h-3 w-3" /> موزّع {e.spread_months} شهر</span>
                  )}
                </div>
                <div className="text-xs text-muted-foreground truncate">{formatDate(e.spent_at)}{e.note ? ` · ${e.note}` : ""}</div>
              </div>
              <div className="font-bold tabular-nums shrink-0">{formatMoney(e.amount, e.currency)}</div>
              <Dialog>
                <DialogTrigger asChild><Button variant="ghost" size="icon" title="المرفقات"><Paperclip className="h-4 w-4" /></Button></DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>مرفقات المصروف</DialogTitle></DialogHeader>
                  <AttachmentUploader entityType="expense" entityId={e.id} />
                </DialogContent>
              </Dialog>
              <Button variant="ghost" size="icon" onClick={() => del.mutate(e.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function cnFilter(active: boolean) {
  return "rounded-full px-3 py-1 border transition " + (active ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent border-border text-muted-foreground");
}

type Participant = { key: string; contactId: string | null; name: string; amount: string };

function ExpenseForm({ categories, projects, wallets, onDone }: { categories: any[]; projects: any[]; wallets: any[]; onDone: () => void }) {
  const [walletId, setWalletId] = useState<string>(wallets[0]?.id ?? "");
  const initialWallet = wallets.find((w) => w.id === walletId);
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(initialWallet?.currency ?? "SAR");
  const [categoryId, setCategoryId] = useState<string>(categories[0]?.id ?? "");
  const [projectId, setProjectId] = useState<string>("none");
  const [spentAt, setSpentAt] = useState(todayISO());
  const [note, setNote] = useState("");
  const [spread, setSpread] = useState(false);
  const [months, setMonths] = useState("6");
  const [startMonth, setStartMonth] = useState(todayISO().slice(0, 7));

  // Split with other people
  const [split, setSplit] = useState(false);
  const [participants, setParticipants] = useState<Participant[]>([]);

  const onWalletChange = (v: string) => {
    setWalletId(v);
    const w = wallets.find((x) => x.id === v);
    if (w?.currency) setCurrency(w.currency);
  };

  const monthsN = Math.max(1, Math.min(60, parseInt(months) || 1));
  const totalN = parseFloat(amount) || 0;
  const participantsSum = useMemo(
    () => participants.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0),
    [participants],
  );
  const myShare = Math.max(0, totalN - participantsSum);
  const splitInvalid = split && (participantsSum <= 0 || participantsSum > totalN || participants.some((p) => !p.contactId || (parseFloat(p.amount) || 0) <= 0));

  const monthly = useMemo(() => {
    const base = split ? myShare : totalN;
    if (!base || !spread) return 0;
    return base / monthsN;
  }, [totalN, split, myShare, spread, monthsN]);

  const addParticipant = () => {
    setParticipants((prev) => [...prev, { key: Math.random().toString(36).slice(2), contactId: null, name: "", amount: "" }]);
  };
  const updateParticipant = (key: string, patch: Partial<Participant>) => {
    setParticipants((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)));
  };
  const removeParticipant = (key: string) => {
    setParticipants((prev) => prev.filter((p) => p.key !== key));
  };

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      if (!walletId) throw new Error("اختر محفظة");
      if (!categoryId) throw new Error("اختر فئة");
      const total = totalN;
      if (!total || total <= 0) throw new Error("أدخل مبلغاً صالحاً");

      let expenseAmount = total;
      if (split) {
        if (participantsSum <= 0) throw new Error("أدخل حصة شخص واحد على الأقل");
        if (participantsSum > total) throw new Error("مجموع حصص المشاركين أكبر من المبلغ الكلي");
        for (const p of participants) {
          if (!p.contactId) throw new Error("اختر جهة اتصال لكل مشارك");
          if ((parseFloat(p.amount) || 0) <= 0) throw new Error("حدد حصة أكبر من صفر لكل مشارك");
        }
        expenseAmount = myShare;
      }

      // 1) Insert the expense with the user's share only (net)
      const payload: any = {
        user_id: u.user.id,
        amount: expenseAmount,
        currency,
        category_id: categoryId,
        wallet_id: walletId,
        project_id: projectId === "none" ? null : projectId,
        spent_at: spentAt,
        note: note || null,
        allocation_kind: spread ? "spread" : "single",
        spread_months: spread ? monthsN : null,
        spread_start: spread ? `${startMonth}-01` : null,
      };
      const { data: ins, error } = await supabase.from("expenses").insert(payload).select("id").single();
      if (error) throw error;

      // 2) Allocations for user's share
      const allocs: any[] = [];
      if (spread) {
        const [y, m] = startMonth.split("-").map(Number);
        const each = +(expenseAmount / monthsN).toFixed(2);
        let sum = 0;
        for (let i = 0; i < monthsN; i++) {
          const d = new Date(y, (m - 1) + i, 1);
          const period = d.toISOString().slice(0, 10);
          const amt = i === monthsN - 1 ? +(expenseAmount - sum).toFixed(2) : each;
          sum += each;
          allocs.push({ user_id: u.user.id, expense_id: (ins as any).id, period, amount: amt, currency });
        }
      } else {
        const d = new Date(spentAt);
        const period = new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
        allocs.push({ user_id: u.user.id, expense_id: (ins as any).id, period, amount: expenseAmount, currency });
      }
      const { error: aErr } = await supabase.from("expense_allocations").insert(allocs);
      if (aErr) throw aErr;

      // 3) For each participant, create a person_ledger "lend" row.
      //    Linking to the same wallet debits it via the ledger sync trigger,
      //    so the wallet ends up debited the full paid amount overall.
      if (split && participants.length > 0) {
        const catLabel = categories.find((c) => c.id === categoryId)?.name ?? "مصروف";
        const ledgerRows = participants.map((p) => ({
          user_id: u.user.id,
          contact_id: p.contactId,
          contact_name: p.name.trim(),
          kind: "lend",
          amount: parseFloat(p.amount) || 0,
          currency,
          happened_at: spentAt,
          notes: `تقسيم مصروف: ${catLabel}${note ? ` — ${note}` : ""}`,
          wallet_id: walletId,
        }));
        const { error: lErr } = await supabase.from("person_ledger").insert(ledgerRows);
        if (lErr) throw lErr;
      }
    },
    onSuccess: () => {
      toast.success(split ? "تم تسجيل المصروف والديون" : "تمت الإضافة");
      onDone();
    },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
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
        <div><Label>المبلغ الكلي</Label><Input type="number" step="0.01" min="0" value={amount} onChange={(e) => setAmount(e.target.value)} required dir="ltr" /></div>
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

      <div><Label>تاريخ الدفع</Label><Input type="date" value={spentAt} onChange={(e) => setSpentAt(e.target.value)} required dir="ltr" /></div>

      {/* ============ SPLIT WITH PEOPLE ============ */}
      <div className="rounded-xl border bg-accent/30 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium flex items-center gap-1"><Users className="h-4 w-4" /> تقسيم المصروف مع أشخاص</div>
            <div className="text-[11px] text-muted-foreground">حصة كل شخص تُسجَّل ديناً له عليك بشكل تلقائي</div>
          </div>
          <Switch checked={split} onCheckedChange={(v) => { setSplit(v); if (v && participants.length === 0) addParticipant(); }} />
        </div>

        {split && (
          <div className="space-y-2">
            {participants.map((p) => (
              <div key={p.key} className="rounded-lg border bg-card p-2 space-y-2">
                <div className="flex items-center gap-2">
                  <div className="flex-1 min-w-0">
                    <ContactPicker
                      value={{ id: p.contactId, name: p.name }}
                      onChange={(v) => updateParticipant(p.key, { contactId: v.id, name: v.name })}
                    />
                  </div>
                  <Button type="button" variant="ghost" size="icon" onClick={() => removeParticipant(p.key)} title="حذف">
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <div className="grid grid-cols-[1fr_auto] gap-2 items-center">
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="حصة هذا الشخص"
                    value={p.amount}
                    onChange={(e) => updateParticipant(p.key, { amount: e.target.value })}
                    dir="ltr"
                  />
                  {totalN > 0 && (parseFloat(p.amount) || 0) > 0 && (
                    <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                      {(((parseFloat(p.amount) || 0) / totalN) * 100).toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>
            ))}

            <Button type="button" variant="outline" size="sm" onClick={addParticipant} className="w-full">
              <Plus className="h-3.5 w-3.5 ml-1" /> إضافة شخص آخر
            </Button>

            <div className="rounded-lg bg-background border p-2 text-[11px] space-y-1">
              <div className="flex justify-between"><span className="text-muted-foreground">المبلغ الكلي المدفوع</span><span className="tabular-nums font-medium">{formatMoney(totalN, currency)}</span></div>
              <div className="flex justify-between"><span className="text-muted-foreground">مجموع حصص الآخرين</span><span className="tabular-nums text-amber-600">−{formatMoney(participantsSum, currency)}</span></div>
              <div className="flex justify-between border-t pt-1"><span className="font-medium">حصتك (المصروف الفعلي)</span><span className="tabular-nums font-bold text-primary">{formatMoney(myShare, currency)}</span></div>
              {participantsSum > totalN && (
                <div className="text-destructive text-[10px]">⚠️ مجموع الحصص أكبر من المبلغ الكلي</div>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="rounded-xl border bg-accent/30 p-3 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-medium flex items-center gap-1"><CalendarRange className="h-4 w-4" /> توزيع المبلغ على عدة أشهر</div>
            <div className="text-[11px] text-muted-foreground">مفيد للإيجار/الاشتراكات المدفوعة مسبقاً {split && "— يوزّع حصتك فقط"}</div>
          </div>
          <Switch checked={spread} onCheckedChange={setSpread} />
        </div>
        {spread && (
          <div className="grid grid-cols-2 gap-3">
            <div><Label>عدد الأشهر</Label><Input type="number" min="1" max="60" value={months} onChange={(e) => setMonths(e.target.value)} dir="ltr" /></div>
            <div><Label>شهر البداية</Label><Input type="month" value={startMonth} onChange={(e) => setStartMonth(e.target.value)} dir="ltr" /></div>
            {monthly > 0 && (
              <div className="col-span-2 text-xs text-muted-foreground">سيُحسب <span className="font-bold tabular-nums">{formatMoney(monthly, currency)}</span> شهرياً لمدة {monthsN} شهر.</div>
            )}
          </div>
        )}
      </div>

      <div><Label>ملاحظة</Label><Input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} /></div>

      <DialogFooter><Button type="submit" className="w-full" disabled={mut.isPending || splitInvalid}>حفظ</Button></DialogFooter>
    </form>
  );
}

