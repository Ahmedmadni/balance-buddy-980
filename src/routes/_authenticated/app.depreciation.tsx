import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { computeDepreciation, type DepreciationProfile } from "@/lib/assets/depreciation";
import { formatMoney, formatDate } from "@/lib/format";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Calculator, Search, TrendingDown, Pencil } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/app/depreciation")({
  head: () => ({ meta: [{ title: "سجل الإهلاك — رصد" }] }),
  component: DepreciationLogPage,
});

type Row = {
  investmentId: string;
  name: string;
  type: string;
  currency: string;
  cost: number;
  profile: DepreciationProfile;
  result: ReturnType<typeof computeDepreciation>;
};

const METHOD_LABEL: Record<string, string> = {
  straight_line: "القسط الثابت",
  double_declining: "المتناقص المضاعف",
  units_of_production: "وحدات الإنتاج",
};

function DepreciationLogPage() {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"pct_desc" | "pct_asc" | "recent" | "book_desc">("pct_desc");
  const [editing, setEditing] = useState<Row | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["depreciation-log"],
    queryFn: async () => {
      const [iRes, dRes] = await Promise.all([
        supabase.from("investments").select("id,name,type,currency,base_value,principal,current_value,acquired_at,start_date,status"),
        supabase.from("depreciation_profiles").select("*").eq("is_active", true),
      ]);
      return { items: iRes.data ?? [], profiles: (dRes.data ?? []) as any[] };
    },
  });

  const rows = useMemo<Row[]>(() => {
    const invById = new Map((data?.items ?? []).map((i: any) => [i.id, i]));
    const out: Row[] = [];
    for (const p of data?.profiles ?? []) {
      const inv: any = invById.get(p.investment_id);
      if (!inv) continue;
      const cost = Number(inv.base_value ?? inv.principal ?? inv.current_value ?? 0) || 0;
      const profile: DepreciationProfile = {
        id: p.id,
        investment_id: p.investment_id,
        method: p.method,
        useful_life_months: p.useful_life_months,
        salvage_value: Number(p.salvage_value) || 0,
        start_date: p.start_date,
        is_active: p.is_active,
        units_total: p.units_total,
        units_consumed: p.units_consumed,
      };
      const result = computeDepreciation(profile, cost);
      out.push({
        investmentId: inv.id,
        name: inv.name,
        type: inv.type,
        currency: inv.currency,
        cost,
        profile,
        result,
      });
    }
    let filtered = out;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      filtered = filtered.filter((r) => r.name.toLowerCase().includes(q));
    }
    filtered.sort((a, b) => {
      if (sort === "pct_desc") return b.result.depreciation_percentage - a.result.depreciation_percentage;
      if (sort === "pct_asc") return a.result.depreciation_percentage - b.result.depreciation_percentage;
      if (sort === "book_desc") return b.result.book_value - a.result.book_value;
      return new Date(b.profile.start_date).getTime() - new Date(a.profile.start_date).getTime();
    });
    return filtered;
  }, [data, search, sort]);

  const totals = useMemo(() => {
    const byCur: Record<string, { cost: number; accumulated: number; book: number; monthly: number }> = {};
    for (const r of rows) {
      const t = (byCur[r.currency] ??= { cost: 0, accumulated: 0, book: 0, monthly: 0 });
      t.cost += r.result.cost;
      t.accumulated += r.result.accumulated_depreciation;
      t.book += r.result.book_value;
      t.monthly += r.result.monthly_depreciation;
    }
    return byCur;
  }, [rows]);

  return (
    <div className="space-y-4 p-3 sm:p-6 max-w-6xl mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <Calculator className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">سجل الإهلاك</h1>
          <p className="text-xs text-muted-foreground">تاريخ البدء والقيمة ونسبة الإهلاك لكل أصل</p>
        </div>
      </div>

      {/* Totals */}
      {Object.keys(totals).length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {Object.entries(totals).map(([cur, t]) => (
            <div key={cur + "-cost"} className="rounded-xl border bg-card p-3">
              <div className="text-[10px] text-muted-foreground">إجمالي التكلفة ({cur})</div>
              <div className="text-sm font-bold tabular-nums mt-0.5">{formatMoney(t.cost, cur)}</div>
            </div>
          ))}
          {Object.entries(totals).map(([cur, t]) => (
            <div key={cur + "-acc"} className="rounded-xl border bg-card p-3">
              <div className="text-[10px] text-muted-foreground">مجمّع الإهلاك ({cur})</div>
              <div className="text-sm font-bold tabular-nums mt-0.5 text-amber-600">−{formatMoney(t.accumulated, cur)}</div>
            </div>
          ))}
          {Object.entries(totals).map(([cur, t]) => (
            <div key={cur + "-book"} className="rounded-xl border bg-card p-3">
              <div className="text-[10px] text-muted-foreground">القيمة الدفترية ({cur})</div>
              <div className="text-sm font-bold tabular-nums mt-0.5 text-primary">{formatMoney(t.book, cur)}</div>
            </div>
          ))}
          {Object.entries(totals).map(([cur, t]) => (
            <div key={cur + "-m"} className="rounded-xl border bg-card p-3">
              <div className="text-[10px] text-muted-foreground">إهلاك شهري ({cur})</div>
              <div className="text-sm font-bold tabular-nums mt-0.5">{formatMoney(t.monthly, cur)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ابحث باسم الأصل"
            className="pe-9"
          />
        </div>
        <Select value={sort} onValueChange={(v) => setSort(v as any)}>
          <SelectTrigger className="sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="pct_desc">النسبة (الأعلى أولاً)</SelectItem>
            <SelectItem value="pct_asc">النسبة (الأقل أولاً)</SelectItem>
            <SelectItem value="book_desc">القيمة الدفترية</SelectItem>
            <SelectItem value="recent">تاريخ البدء (الأحدث)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">جارٍ التحميل…</div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border bg-card p-8 text-center">
          <TrendingDown className="h-10 w-10 mx-auto text-muted-foreground/50 mb-2" />
          <p className="text-sm font-medium">لا توجد أصول مُفعَّل عليها الإهلاك</p>
          <p className="text-xs text-muted-foreground mt-1">
            فعّل الإهلاك من صفحة{" "}
            <Link to="/app/investments" className="text-primary underline">الأصول والاستثمارات</Link>.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <div key={r.investmentId} className="rounded-xl border bg-card p-3 sm:p-4">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <Link
                      to="/app/investments"
                      className="font-semibold hover:text-primary truncate"
                    >
                      {r.name}
                    </Link>
                    <span className="text-[10px] rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                      {METHOD_LABEL[r.profile.method] ?? r.profile.method}
                    </span>
                    {r.result.fully_depreciated && (
                      <span className="text-[10px] rounded-full bg-amber-500/10 text-amber-600 px-2 py-0.5">
                        مُهلَك بالكامل
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-0.5">
                    بدأ في {formatDate(r.profile.start_date)} • عمر إنتاجي {r.profile.useful_life_months} شهر
                    {" • "}مضى {r.result.elapsed_months.toFixed(1)} شهر
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <div className="text-right">
                    <div className="text-[10px] text-muted-foreground">نسبة الإهلاك</div>
                    <div className={cn(
                      "text-lg font-bold tabular-nums",
                      r.result.depreciation_percentage >= 75 ? "text-amber-600" :
                      r.result.depreciation_percentage >= 40 ? "text-primary" : "text-muted-foreground"
                    )}>
                      {r.result.depreciation_percentage.toFixed(1)}%
                    </div>
                  </div>
                  <Button variant="outline" size="icon" onClick={() => setEditing(r)} aria-label="تعديل الإهلاك">
                    <Pencil className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="mt-3 h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className={cn(
                    "h-full transition-all",
                    r.result.depreciation_percentage >= 75 ? "bg-amber-500" :
                    r.result.depreciation_percentage >= 40 ? "bg-primary" : "bg-primary/60"
                  )}
                  style={{ width: `${Math.min(100, r.result.depreciation_percentage)}%` }}
                />
              </div>

              {/* Numbers */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-3 text-xs">
                <Cell label="التكلفة" value={formatMoney(r.result.cost, r.currency)} />
                <Cell label="مجمّع الإهلاك" value={`−${formatMoney(r.result.accumulated_depreciation, r.currency)}`} tone="text-amber-600" />
                <Cell label="القيمة الدفترية" value={formatMoney(r.result.book_value, r.currency)} tone="text-primary" accent />
                <Cell label="إهلاك شهري" value={formatMoney(r.result.monthly_depreciation, r.currency)} />
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-2 text-xs">
                <Cell label="القيمة التخريدية" value={formatMoney(r.result.salvage, r.currency)} />
                <Cell label="إهلاك سنوي" value={formatMoney(r.result.annual_depreciation, r.currency)} />
                <Cell label="متبقٍ من العمر" value={`${r.result.remaining_life_months.toFixed(1)} شهر`} />
                <Cell label="العملة" value={r.currency} />
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-sm">
          {editing && <EditProfileForm row={editing} onDone={() => setEditing(null)} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function EditProfileForm({ row, onDone }: { row: Row; onDone: () => void }) {
  const qc = useQueryClient();
  const [method, setMethod] = useState(row.profile.method);
  const [startDate, setStartDate] = useState(row.profile.start_date);
  const [life, setLife] = useState(String(row.profile.useful_life_months));
  const [salvage, setSalvage] = useState(String(row.profile.salvage_value));
  const lifeNum = Math.max(1, Number(life) || 1);
  const ratePct = (1200 / lifeNum).toFixed(2);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("depreciation_profiles")
        .update({
          method,
          start_date: startDate,
          useful_life_months: lifeNum,
          salvage_value: Number(salvage) || 0,
        })
        .eq("id", row.profile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم تحديث إعدادات الإهلاك");
      qc.invalidateQueries({ queryKey: ["depreciation-log"] });
      qc.invalidateQueries({ queryKey: ["depreciation_profiles"] });
      qc.invalidateQueries({ queryKey: ["investments"] });
      onDone();
    },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); save.mutate(); }} className="space-y-3">
      <DialogHeader><DialogTitle>تعديل إهلاك: {row.name}</DialogTitle></DialogHeader>

      <div>
        <Label>طريقة الإهلاك</Label>
        <Select value={method} onValueChange={(v) => setMethod(v as any)}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="straight_line">القسط الثابت</SelectItem>
            <SelectItem value="double_declining">المتناقص المضاعف</SelectItem>
            <SelectItem value="units_of_production">وحدات الإنتاج</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>تاريخ البدء</Label>
        <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required />
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <Label>نسبة سنوية %</Label>
          <Input
            type="number"
            step="0.01"
            min="0.01"
            max="100"
            value={ratePct}
            onChange={(e) => {
              const p = Number(e.target.value);
              if (p > 0) setLife(String(Math.max(1, Math.round(1200 / p))));
            }}
          />
        </div>
        <div>
          <Label>العمر الإنتاجي (شهر)</Label>
          <Input type="number" min="1" value={life} onChange={(e) => setLife(e.target.value)} required />
        </div>
      </div>

      <div>
        <Label>القيمة التخريدية ({row.currency})</Label>
        <Input type="number" step="0.01" min="0" value={salvage} onChange={(e) => setSalvage(e.target.value)} />
      </div>

      <p className="text-[11px] text-muted-foreground">
        التكلفة: {formatMoney(row.cost, row.currency)} • النسبة والعمر مرتبطان تلقائياً.
      </p>

      <DialogFooter>
        <Button type="submit" className="w-full" disabled={save.isPending}>
          {save.isPending ? "جاري الحفظ..." : "حفظ"}
        </Button>
      </DialogFooter>
    </form>
  );
}

function Cell({ label, value, tone, accent }: { label: string; value: string; tone?: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-lg border p-2", accent ? "bg-primary/5 border-primary/30" : "bg-background")}>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("font-semibold tabular-nums mt-0.5", tone)}>{value}</div>
    </div>
  );
}
