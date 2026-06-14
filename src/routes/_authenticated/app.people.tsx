import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Plus, Users, Search, ChevronLeft } from "lucide-react";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { PersonTxForm, kindSign } from "@/components/PersonTxForm";

export const Route = createFileRoute("/_authenticated/app/people")({
  head: () => ({ meta: [{ title: "الأشخاص — حسابي" }] }),
  component: PeoplePage,
});

type LedgerRow = {
  id: string;
  contact_name: string;
  kind: string;
  amount: number;
  currency: string;
  happened_at: string;
};

type PersonAgg = {
  name: string;
  key: string;
  txCount: number;
  lastDate: string;
  byCurrency: Record<string, number>;
};

function PeoplePage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [openNew, setOpenNew] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ["person_ledger"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("person_ledger")
        .select("id,contact_name,kind,amount,currency,happened_at")
        .order("happened_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as LedgerRow[];
    },
  });

  const people: PersonAgg[] = useMemo(() => {
    const map = new Map<string, PersonAgg>();
    for (const r of rows ?? []) {
      const key = r.contact_name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, { name: r.contact_name.trim(), key, txCount: 0, lastDate: r.happened_at, byCurrency: {} });
      }
      const p = map.get(key)!;
      p.txCount++;
      if (r.happened_at > p.lastDate) p.lastDate = r.happened_at;
      const signed = kindSign(r.kind) * Number(r.amount);
      p.byCurrency[r.currency] = (p.byCurrency[r.currency] ?? 0) + signed;
    }
    return Array.from(map.values()).sort((a, b) => b.lastDate.localeCompare(a.lastDate));
  }, [rows]);

  const filtered = people.filter((p) => p.name.toLowerCase().includes(search.trim().toLowerCase()));

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">الأشخاص</h1>
          <p className="text-sm text-muted-foreground mt-1">دفتر حساب موحّد لكل شخص</p>
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
            <Link
              key={p.key}
              to="/app/people/$name"
              params={{ name: p.name }}
              className="flex items-center gap-3 rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]"
            >
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-white shrink-0 font-bold">
                {p.name.slice(0, 1)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate">{p.name}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{p.txCount} حركة</div>
              </div>
              <div className="text-left shrink-0 space-y-0.5">
                {Object.entries(p.byCurrency).map(([cur, net]) => {
                  const positive = net > 0.001;
                  const negative = net < -0.001;
                  return (
                    <div key={cur} className={cn("text-sm font-bold tabular-nums", positive ? "text-success" : negative ? "text-destructive" : "text-muted-foreground")}>
                      {positive ? "له " : negative ? "عليه " : ""}{formatMoney(Math.abs(net), cur)}
                    </div>
                  );
                })}
              </div>
              <ChevronLeft className="h-4 w-4 text-muted-foreground" />
            </Link>
          ))}
        </div>
      )}
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
