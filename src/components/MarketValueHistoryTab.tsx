import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, TrendingUp, TrendingDown, LineChart as LineChartIcon } from "lucide-react";
import { CURRENCIES, formatMoney, formatDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

const SOURCES = [
  { value: "manual", label: "تقدير يدوي" },
  { value: "appraisal", label: "تقييم خبير" },
  { value: "market", label: "سعر السوق" },
  { value: "platform", label: "منصة متخصصة" },
  { value: "offer", label: "عرض شراء" },
  { value: "other", label: "أخرى" },
];
const sourceLabel = (v?: string | null) => SOURCES.find((s) => s.value === v)?.label ?? (v ?? "—");

export function MarketValueHistoryTab({ asset }: { asset: any }) {
  const qc = useQueryClient();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["asset-market-values", asset.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("asset_market_values")
        .select("*")
        .eq("investment_id", asset.id)
        .order("valuation_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("asset_market_values").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-market-values", asset.id] });
      toast.success("تم الحذف");
    },
  });

  // Display series — fall back to current_value as a single virtual point if empty.
  const series = useMemo(() => {
    if (rows.length > 0) return rows.map((r: any) => ({ ...r, _virtual: false }));
    const v = Number(asset.current_value ?? asset.base_value ?? 0);
    if (!v) return [];
    return [{
      id: "virtual",
      valuation_date: todayISO(),
      market_value: v,
      currency: asset.currency,
      source: "current",
      notes: "قيمة افتراضية للعرض (لا توجد سجلات)",
      _virtual: true,
    }];
  }, [rows, asset]);

  const stats = useMemo(() => {
    if (rows.length === 0) return null;
    const values = rows.map((r: any) => Number(r.market_value));
    const first = values[0];
    const last = values[values.length - 1];
    const max = Math.max(...values);
    const min = Math.min(...values);
    const diff = last - first;
    const pct = first ? (diff / first) * 100 : 0;
    return { first, last, max, min, diff, pct };
  }, [rows]);

  const chartData = series.map((r: any) => ({
    date: r.valuation_date,
    value: Number(r.market_value),
  }));

  return (
    <div className="space-y-3 mt-3">
      {stats ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <Stat label="القيمة الحالية" value={formatMoney(stats.last, asset.currency)} accent />
          <Stat label="أول قيمة مسجلة" value={formatMoney(stats.first, asset.currency)} />
          <Stat
            label="التغير الكلي"
            value={`${stats.diff >= 0 ? "+" : ""}${formatMoney(stats.diff, asset.currency)}`}
            tone={stats.diff >= 0 ? "text-success" : "text-destructive"}
          />
          <Stat
            label="نسبة التغير"
            value={`${stats.pct >= 0 ? "+" : ""}${stats.pct.toFixed(2)}%`}
            tone={stats.pct >= 0 ? "text-success" : "text-destructive"}
            icon={stats.pct >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          />
          <Stat label="أعلى قيمة" value={formatMoney(stats.max, asset.currency)} tone="text-success" />
          <Stat label="أقل قيمة" value={formatMoney(stats.min, asset.currency)} tone="text-destructive" />
        </div>
      ) : (
        <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
          لا توجد إحصائيات بعد — أضف أول تقييم لبدء تتبع القيمة السوقية.
        </div>
      )}

      {chartData.length > 0 && (
        <div className="rounded-xl border bg-card p-3">
          <div className="text-xs font-semibold mb-2 flex items-center gap-1.5">
            <LineChartIcon className="h-3.5 w-3.5" /> تطور القيمة السوقية
          </div>
          <div className="h-48" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                <YAxis tick={{ fontSize: 10 }} width={60} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(v: any) => formatMoney(Number(v), asset.currency)}
                />
                <Line type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold">سجل التقييمات</div>
        <Button size="sm" onClick={() => { setEditing(null); setOpenForm(true); }}>
          <Plus className="h-3.5 w-3.5" /> تقييم جديد
        </Button>
      </div>

      {isLoading ? (
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground">
          لا توجد سجلات قيمة سوقية بعد. أضف أول تقييم لبدء التتبع.
        </div>
      ) : (
        <div className="space-y-2">
          {[...rows].reverse().map((r: any, idx: number, arr: any[]) => {
            const prev = arr[idx + 1];
            const prevVal = prev ? Number(prev.market_value) : null;
            const cur = Number(r.market_value);
            const delta = prevVal !== null ? cur - prevVal : 0;
            const pct = prevVal ? (delta / prevVal) * 100 : 0;
            return (
              <div key={r.id} className="rounded-xl border bg-card p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-bold tabular-nums text-sm">{formatMoney(cur, r.currency)}</span>
                      {prevVal !== null && (
                        <span className={cn(
                          "text-[10px] rounded-full px-1.5 py-0.5",
                          delta >= 0 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive",
                        )}>
                          {delta >= 0 ? "+" : ""}{formatMoney(delta, r.currency)} ({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)
                        </span>
                      )}
                      <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5">{sourceLabel(r.source)}</span>
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      {formatDate(r.valuation_date)}{r.notes ? ` · ${r.notes}` : ""}
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(r); setOpenForm(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("حذف هذا التقييم؟")) del.mutate(r.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={openForm} onOpenChange={(v) => { if (!v) { setOpenForm(false); setEditing(null); } }}>
        <DialogContent className="max-w-md">
          <ValuationForm
            asset={asset}
            initial={editing}
            onDone={() => {
              setOpenForm(false);
              setEditing(null);
              qc.invalidateQueries({ queryKey: ["asset-market-values", asset.id] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Stat({ label, value, tone, accent, icon }: { label: string; value: string; tone?: string; accent?: boolean; icon?: React.ReactNode }) {
  return (
    <div className={cn("rounded-xl border p-2.5", accent ? "bg-primary/5 border-primary/30" : "bg-card")}>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums mt-0.5 flex items-center gap-1", tone)}>
        {icon}{value}
      </div>
    </div>
  );
}

function ValuationForm({ asset, initial, onDone }: { asset: any; initial: any | null; onDone: () => void }) {
  const isEdit = !!initial;
  const [date, setDate] = useState<string>(initial?.valuation_date ?? todayISO());
  const [value, setValue] = useState<string>(initial?.market_value?.toString() ?? asset.current_value?.toString() ?? "");
  const [currency, setCurrency] = useState<string>(initial?.currency ?? asset.currency ?? "SAR");
  const [source, setSource] = useState<string>(initial?.source ?? "manual");
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const payload: any = {
        user_id: u.user.id,
        investment_id: asset.id,
        valuation_date: date,
        market_value: parseFloat(value) || 0,
        currency,
        source: source || null,
        notes: notes || null,
      };
      if (isEdit) {
        const { error } = await supabase.from("asset_market_values").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("asset_market_values").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(isEdit ? "تم التحديث" : "تمت الإضافة"); onDone(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
      <DialogHeader>
        <DialogTitle>{isEdit ? "تعديل تقييم" : "تقييم جديد"} — {asset.name}</DialogTitle>
      </DialogHeader>

      <div className="grid grid-cols-2 gap-3">
        <div><Label>تاريخ التقييم</Label><Input type="date" value={date} onChange={(e) => setDate(e.target.value)} required /></div>
        <div>
          <Label>العملة</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c: any) => { const code = typeof c === "string" ? c : c.code; return <SelectItem key={code} value={code}>{code}</SelectItem>; })}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div><Label>القيمة السوقية</Label><Input type="number" step="0.01" value={value} onChange={(e) => setValue(e.target.value)} dir="ltr" required /></div>

      <div>
        <Label>مصدر التقييم</Label>
        <Select value={source} onValueChange={setSource}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            {SOURCES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div><Label>الملاحظات</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="مثلاً: تقييم من معرض، عرض من وسيط..." /></div>

      <DialogFooter>
        <Button type="submit" disabled={mut.isPending}>{mut.isPending ? "..." : isEdit ? "حفظ" : "إضافة"}</Button>
      </DialogFooter>
    </form>
  );
}
