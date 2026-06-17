import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users, Search, ChevronLeft, Phone, BellRing, AlertTriangle, FileText } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PersonTxForm, kindSign } from "@/components/PersonTxForm";
import { PersonStatementDrawer } from "@/components/PersonStatementDrawer";

export const Route = createFileRoute("/_authenticated/app/people")({
  head: () => ({ meta: [{ title: "الأشخاص والديون — رصد" }] }),
  component: PeoplePage,
});

type LedgerRow = {
  id: string;
  contact_id: string | null;
  contact_name: string;
  kind: string;
  amount: number;
  currency: string;
  happened_at: string;
  due_date: string | null;
  reminder_enabled: boolean;
  settled_at: string | null;
};
type Contact = { id: string; name: string; phone: string | null };

function PeoplePage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [openNew, setOpenNew] = useState(false);
  const [drawerId, setDrawerId] = useState<string | null>(null);
  const [drawerName, setDrawerName] = useState<string>("");

  const { data: rows, isLoading } = useQuery({
    queryKey: ["person_ledger"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("person_ledger")
        .select("id,contact_id,contact_name,kind,amount,currency,happened_at,due_date,reminder_enabled,settled_at")
        .order("happened_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LedgerRow[];
    },
  });

  const { data: contacts } = useQuery({
    queryKey: ["contacts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("id,name,phone").order("name");
      if (error) throw error;
      return (data ?? []) as Contact[];
    },
  });

  const today = new Date().toISOString().slice(0, 10);

  const { people, dueSoon } = useMemo(() => {
    const map = new Map<string, any>();
    const cmap = new Map((contacts ?? []).map((c) => [c.id, c]));
    const due: { id: string; name: string; contact_id: string; amount: number; currency: string; due_date: string; overdue: boolean }[] = [];
    for (const r of rows ?? []) {
      if (!r.contact_id) continue;
      const c = cmap.get(r.contact_id);
      if (!map.has(r.contact_id)) {
        map.set(r.contact_id, { id: r.contact_id, name: c?.name ?? r.contact_name, phone: c?.phone ?? null, txCount: 0, lastDate: r.happened_at, byCurrency: {} });
      }
      const p = map.get(r.contact_id)!;
      p.txCount++;
      if (r.happened_at > p.lastDate) p.lastDate = r.happened_at;
      p.byCurrency[r.currency] = (p.byCurrency[r.currency] ?? 0) + kindSign(r.kind) * Number(r.amount);

      if ((r.kind === "lend" || r.kind === "borrow") && r.due_date && !r.settled_at && r.reminder_enabled) {
        due.push({
          id: r.id, name: c?.name ?? r.contact_name, contact_id: r.contact_id,
          amount: Number(r.amount), currency: r.currency, due_date: r.due_date,
          overdue: r.due_date < today,
        });
      }
    }
    const sorted = Array.from(map.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
    due.sort((a, b) => a.due_date.localeCompare(b.due_date));
    return { people: sorted, dueSoon: due };
  }, [rows, contacts, today]);

  const filtered = people.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الأشخاص والديون</h1>
          <p className="text-sm text-muted-foreground mt-1">دفتر حساب موحّد + متابعة استحقاقات</p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button className="shrink-0"><Plus className="h-4 w-4" /> حركة جديدة</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <PersonTxForm onDone={() => { setOpenNew(false); qc.invalidateQueries({ queryKey: ["person_ledger"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); }} />
          </DialogContent>
        </Dialog>
      </div>

      {dueSoon.length > 0 && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BellRing className="h-4 w-4 text-amber-600" />
            <div className="font-semibold text-sm">تذكيرات استحقاق ({dueSoon.length})</div>
          </div>
          <div className="space-y-1.5">
            {dueSoon.slice(0, 4).map((d) => (
              <Link key={d.id} to="/app/people/$id" params={{ id: d.contact_id }} className="flex items-center justify-between gap-2 text-xs rounded-lg bg-background/60 p-2 hover:bg-background">
                <div className="flex items-center gap-2 min-w-0">
                  {d.overdue && <AlertTriangle className="h-3.5 w-3.5 text-destructive shrink-0" />}
                  <span className="truncate font-medium">{d.name}</span>
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full", d.overdue ? "bg-destructive/15 text-destructive" : "bg-amber-500/15 text-amber-700")}>
                    {d.overdue ? "متأخر" : "مستحق"} · {formatDate(d.due_date)}
                  </span>
                </div>
                <span className="font-bold tabular-nums shrink-0">{formatMoney(d.amount, d.currency)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث عن شخص..." className="pr-9" />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="h-20 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState onAdd={() => setOpenNew(true)} />
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div
              key={p.id}
              role="button"
              onClick={() => { setDrawerId(p.id); setDrawerName(p.name); }}
              className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)] cursor-pointer"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-white shrink-0 font-bold">
                {p.name.slice(0, 1)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{p.name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-2">
                  <span>{p.txCount} حركة</span>
                  {p.phone && (<><span>·</span><span dir="ltr" className="inline-flex items-center gap-1"><Phone className="h-3 w-3" />{p.phone}</span></>)}
                </div>
              </div>
              <div className="text-left shrink-0 space-y-0.5">
                {Object.entries(p.byCurrency as Record<string, number>).map(([cur, net]) => {
                  const positive = net > 0.001;
                  const negative = net < -0.001;
                  return (
                    <div key={cur} className={cn("text-sm font-bold tabular-nums", positive ? "text-success" : negative ? "text-destructive" : "text-muted-foreground")}>
                      {positive ? "له " : negative ? "عليه " : ""}{formatMoney(Math.abs(net), cur)}
                    </div>
                  );
                })}
              </div>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      )}

      <PersonStatementDrawer
        contactId={drawerId}
        contactName={drawerName}
        onOpenChange={(v) => { if (!v) setDrawerId(null); }}
      />
    </div>
  );
}

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-2xl border bg-card p-10 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent">
        <Users className="h-6 w-6 text-accent-foreground" />
      </div>
      <h3 className="mt-4 font-semibold">لا يوجد أشخاص بعد</h3>
      <p className="mt-1 text-sm text-muted-foreground">سجّل أول حركة (سلّفت/استلفت) لتظهر هنا</p>
      <Button onClick={onAdd} className="mt-4"><Plus className="h-4 w-4" /> حركة جديدة</Button>
    </div>
  );
}
