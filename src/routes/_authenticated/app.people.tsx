import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Plus, Users, Search, ArrowDownRight, ArrowUpRight } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { DebtForm } from "./app.debts";

export const Route = createFileRoute("/_authenticated/app/people")({
  head: () => ({ meta: [{ title: "الأشخاص — حسابي" }] }),
  component: PeoplePage,
});

type DebtRow = {
  id: string;
  contact_name: string;
  direction: "owed_to_me" | "owed_by_me";
  amount: number;
  currency: string;
  due_date: string | null;
  status: string;
  created_at: string;
  debt_payments: { amount: number }[];
};

type PersonAgg = {
  name: string;
  key: string;
  debts: DebtRow[];
  openCount: number;
  byCurrency: Record<string, { net: number; lend: number; borrow: number }>;
};

function PeoplePage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [openFor, setOpenFor] = useState<string | null>(null);
  const [openNew, setOpenNew] = useState(false);

  const { data: debts, isLoading } = useQuery({
    queryKey: ["debts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("debts")
        .select("*, debt_payments(amount)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as DebtRow[];
    },
  });

  const people: PersonAgg[] = useMemo(() => {
    const map = new Map<string, PersonAgg>();
    for (const d of debts ?? []) {
      const key = d.contact_name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, { name: d.contact_name.trim(), key, debts: [], openCount: 0, byCurrency: {} });
      }
      const p = map.get(key)!;
      p.debts.push(d);
      const paid = (d.debt_payments ?? []).reduce((s, x) => s + Number(x.amount), 0);
      const remaining = Math.max(0, Number(d.amount) - paid);
      if (remaining > 0.001) p.openCount++;
      const cur = p.byCurrency[d.currency] ?? { net: 0, lend: 0, borrow: 0 };
      if (d.direction === "owed_to_me") {
        cur.lend += remaining;
        cur.net += remaining;
      } else {
        cur.borrow += remaining;
        cur.net -= remaining;
      }
      p.byCurrency[d.currency] = cur;
    }
    const arr = Array.from(map.values());
    arr.sort((a, b) => b.openCount - a.openCount || a.name.localeCompare(b.name, "ar"));
    return arr;
  }, [debts]);

  const filtered = people.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["debts"] });
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الأشخاص</h1>
          <p className="text-sm text-muted-foreground mt-1">المدينون والدائنون مع رصيد كل شخص</p>
        </div>
        <Dialog open={openNew} onOpenChange={setOpenNew}>
          <DialogTrigger asChild>
            <Button className="shrink-0"><Plus className="h-4 w-4" /> إضافة معاملة</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DebtForm onDone={() => { setOpenNew(false); invalidate(); }} />
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="ابحث عن شخص..."
          className="pr-9"
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : filtered.length === 0 ? (
        <EmptyState onAdd={() => setOpenNew(true)} />
      ) : (
        <div className="space-y-3">
          {filtered.map((p) => (
            <PersonCard
              key={p.key}
              person={p}
              dialogOpen={openFor === p.key}
              setDialogOpen={(v) => setOpenFor(v ? p.key : null)}
              onSaved={invalidate}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonCard({
  person,
  dialogOpen,
  setDialogOpen,
  onSaved,
}: {
  person: PersonAgg;
  dialogOpen: boolean;
  setDialogOpen: (v: boolean) => void;
  onSaved: () => void;
}) {
  const currencies = Object.entries(person.byCurrency).filter(([, v]) => Math.abs(v.net) > 0.001 || v.lend > 0 || v.borrow > 0);

  return (
    <div className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-white shrink-0 font-bold">
          {person.name.slice(0, 1)}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <div className="font-semibold truncate">{person.name}</div>
            <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] text-muted-foreground">
              {person.openCount > 0 ? `${person.openCount} مفتوحة` : "لا مفتوحة"}
            </span>
          </div>
          <div className="mt-2 space-y-1">
            {currencies.length === 0 ? (
              <div className="text-xs text-muted-foreground">لا رصيد</div>
            ) : (
              currencies.map(([cur, v]) => {
                const net = v.net;
                const label = net > 0.001 ? "لي" : net < -0.001 ? "عليّ" : "متوازن";
                const color = net > 0.001 ? "text-success" : net < -0.001 ? "text-destructive" : "text-muted-foreground";
                return (
                  <div key={cur} className="flex items-center justify-between text-sm">
                    <div className={cn("flex items-center gap-1.5", color)}>
                      {net > 0.001 ? <ArrowDownRight className="h-4 w-4" /> : net < -0.001 ? <ArrowUpRight className="h-4 w-4" /> : null}
                      <span className="font-medium">{label}</span>
                    </div>
                    <div className={cn("font-bold tabular-nums", color)}>
                      {formatMoney(Math.abs(net), cur)}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      <div className="mt-3 flex gap-2">
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="flex-1"><Plus className="h-4 w-4" /> إضافة معاملة</Button>
          </DialogTrigger>
          <DialogContent className="max-w-md">
            <DebtForm
              defaults={{ contact_name: person.name }}
              lockContact
              onDone={() => { setDialogOpen(false); onSaved(); }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <Accordion type="single" collapsible className="mt-2">
        <AccordionItem value="d" className="border-0">
          <AccordionTrigger className="py-2 text-xs text-muted-foreground hover:no-underline">
            عرض الديون ({person.debts.length})
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-1.5">
              {person.debts.map((d) => {
                const paid = (d.debt_payments ?? []).reduce((s, x) => s + Number(x.amount), 0);
                const remaining = Math.max(0, Number(d.amount) - paid);
                const isLend = d.direction === "owed_to_me";
                return (
                  <Link
                    key={d.id}
                    to="/app/debts/$id"
                    params={{ id: d.id }}
                    className="flex items-center justify-between rounded-xl border bg-background px-3 py-2 text-sm hover:bg-accent/50"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px]", isLend ? "bg-success/10 text-success" : "bg-destructive/10 text-destructive")}>
                        {isLend ? "لي" : "عليّ"}
                      </span>
                      <span className="text-xs text-muted-foreground truncate">
                        {d.due_date ? formatDate(d.due_date) : formatDate(d.created_at.slice(0, 10))}
                      </span>
                    </div>
                    <div className="text-left">
                      <div className={cn("font-semibold tabular-nums text-sm", isLend ? "text-success" : "text-destructive")}>
                        {formatMoney(remaining > 0 ? remaining : Number(d.amount), d.currency)}
                      </div>
                      {paid > 0 && remaining > 0 && (
                        <div className="text-[10px] text-muted-foreground">مدفوع {formatMoney(paid, d.currency)}</div>
                      )}
                      {remaining <= 0.001 && <div className="text-[10px] text-success">مسدد</div>}
                    </div>
                  </Link>
                );
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
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
      <p className="mt-1 text-sm text-muted-foreground">أضف أول معاملة لتظهر هنا</p>
      <Button onClick={onAdd} className="mt-4"><Plus className="h-4 w-4" /> إضافة معاملة</Button>
    </div>
  );
}
