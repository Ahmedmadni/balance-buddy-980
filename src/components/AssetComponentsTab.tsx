import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { CURRENCIES, formatMoney, formatDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const COMPONENT_TYPES = [
  { value: "engine", label: "محرك" },
  { value: "battery", label: "بطارية" },
  { value: "tires", label: "كفرات" },
  { value: "transmission", label: "ناقل حركة" },
  { value: "ac", label: "تكييف" },
  { value: "elevator", label: "مصعد" },
  { value: "furniture", label: "أثاث" },
  { value: "security", label: "نظام أمن" },
  { value: "spare_part", label: "قطعة غيار" },
  { value: "accessory", label: "ملحق" },
  { value: "other", label: "أخرى" },
];
const compLabel = (v: string) => COMPONENT_TYPES.find((t) => t.value === v)?.label ?? v;
const STATUSES = [
  { value: "active", label: "نشط" },
  { value: "needs_service", label: "بحاجة صيانة" },
  { value: "replaced", label: "مستبدل" },
  { value: "sold", label: "مباع" },
  { value: "closed", label: "مغلق" },
];

export function AssetComponentsTab({ parent }: { parent: any }) {
  const qc = useQueryClient();
  const [openForm, setOpenForm] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);

  const { data: components = [], isLoading } = useQuery({
    queryKey: ["asset-components", parent.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("investments")
        .select("*")
        .eq("parent_investment_id", parent.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("investments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["asset-components", parent.id] });
      qc.invalidateQueries({ queryKey: ["investments-list"] });
      toast.success("تم الحذف");
    },
  });

  const stats = useMemo(() => {
    const cur = parent.currency;
    let count = 0, cost = 0, value = 0;
    for (const c of components) {
      count += 1;
      cost += Number(c.base_value ?? c.principal ?? 0);
      value += Number(c.current_value ?? 0);
    }
    return { count, cost, value, diff: value - cost, cur };
  }, [components, parent.currency]);

  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        <StatCard label="عدد المكونات" value={String(stats.count)} />
        <StatCard label="إجمالي التكلفة" value={formatMoney(stats.cost, stats.cur)} />
        <StatCard label="القيمة الحالية" value={formatMoney(stats.value, stats.cur)} accent />
        <StatCard label="الفرق" value={`${stats.diff >= 0 ? "+" : ""}${formatMoney(stats.diff, stats.cur)}`} tone={stats.diff >= 0 ? "text-success" : "text-destructive"} />
      </div>

      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold flex items-center gap-1.5"><Package className="h-4 w-4" /> مكونات الأصل</div>
        <Button size="sm" onClick={() => { setEditing(null); setOpenForm(true); }}><Plus className="h-3.5 w-3.5" /> إضافة مكوّن</Button>
      </div>

      {isLoading ? (
        <div className="h-20 animate-pulse rounded-xl bg-muted" />
      ) : components.length === 0 ? (
        <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">
          لا توجد مكونات بعد. أضف أول مكوّن (محرك، بطارية، تكييف...) لتفصيل الأصل.
        </div>
      ) : (
        <div className="space-y-2">
          {components.map((c: any) => {
            const cost = Number(c.base_value ?? c.principal ?? 0);
            const val = Number(c.current_value ?? 0);
            const diff = val - cost;
            return (
              <div key={c.id} className="rounded-xl border bg-card p-3">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm flex items-center gap-2 flex-wrap">
                      {c.name}
                      <span className="text-[10px] rounded-full bg-primary/15 text-primary px-1.5 py-0.5">{compLabel(c.subtype ?? "other")}</span>
                      <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5">{c.status ?? "active"}</span>
                      {c.meta?.expected_life_years && (
                        <span className="text-[10px] rounded-full bg-accent px-1.5 py-0.5">عمر متوقع: {c.meta.expected_life_years} سنة</span>
                      )}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {c.acquired_at ? `اشتري ${formatDate(c.acquired_at)}` : (c.start_date ? formatDate(c.start_date) : "")}
                      {c.notes ? ` · ${c.notes}` : ""}
                    </div>
                    <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                      <div><div className="text-muted-foreground">التكلفة</div><div className="font-bold tabular-nums">{formatMoney(cost, c.currency)}</div></div>
                      <div><div className="text-muted-foreground">القيمة</div><div className="font-bold tabular-nums">{formatMoney(val, c.currency)}</div></div>
                      <div><div className="text-muted-foreground">الفرق</div><div className={cn("font-bold tabular-nums", diff >= 0 ? "text-success" : "text-destructive")}>{diff >= 0 ? "+" : ""}{formatMoney(diff, c.currency)}</div></div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1 shrink-0">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(c); setOpenForm(true); }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => { if (confirm("حذف المكوّن؟")) del.mutate(c.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={openForm} onOpenChange={(v) => { if (!v) { setOpenForm(false); setEditing(null); } }}>
        <DialogContent className="max-w-md max-h-[88vh] overflow-y-auto">
          <ComponentForm
            parent={parent}
            initial={editing}
            onDone={() => {
              setOpenForm(false);
              setEditing(null);
              qc.invalidateQueries({ queryKey: ["asset-components", parent.id] });
              qc.invalidateQueries({ queryKey: ["investments-list"] });
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

function StatCard({ label, value, tone, accent }: { label: string; value: string; tone?: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-2.5", accent ? "bg-primary/5 border-primary/30" : "bg-card")}>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums mt-0.5", tone)}>{value}</div>
    </div>
  );
}

function ComponentForm({ parent, initial, onDone }: { parent: any; initial: any | null; onDone: () => void }) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [subtype, setSubtype] = useState<string>(initial?.subtype ?? "other");
  const [cost, setCost] = useState<string>(initial?.base_value?.toString() ?? initial?.principal?.toString() ?? "");
  const [currentValue, setCurrentValue] = useState<string>(initial?.current_value?.toString() ?? "");
  const [acquiredAt, setAcquiredAt] = useState<string>(initial?.acquired_at ?? todayISO());
  const [currency, setCurrency] = useState<string>(initial?.currency ?? parent.currency ?? "SAR");
  const [status, setStatus] = useState<string>(initial?.status ?? "active");
  const [expectedLife, setExpectedLife] = useState<string>(initial?.meta?.expected_life_years?.toString() ?? "");
  const [notes, setNotes] = useState<string>(initial?.notes ?? "");

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const c = parseFloat(cost) || 0;
      const v = parseFloat(currentValue) || c;
      const meta: Record<string, any> = { ...(initial?.meta ?? {}), is_component: true };
      if (expectedLife) meta.expected_life_years = parseFloat(expectedLife);
      else delete meta.expected_life_years;

      const payload: any = {
        user_id: u.user.id,
        parent_investment_id: parent.id,
        name: name.trim(),
        type: parent.type,
        asset_kind: parent.asset_kind ?? parent.type,
        subtype,
        meta,
        wallet_id: null,
        principal: c,
        base_value: c,
        current_value: v,
        ownership_pct: 100,
        currency,
        is_zakatable: false,
        start_date: acquiredAt || todayISO(),
        acquired_at: acquiredAt || null,
        status,
        notes: notes || null,
      };
      if (isEdit) {
        const { error } = await supabase.from("investments").update(payload).eq("id", initial.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("investments").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { toast.success(isEdit ? "تم التحديث" : "تمت الإضافة"); onDone(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
      <DialogHeader>
        <DialogTitle>{isEdit ? "تعديل مكوّن" : "إضافة مكوّن"} — {parent.name}</DialogTitle>
      </DialogHeader>

      <div><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="مثلاً: محرك، مكيف الصالة، إطارات أمامية..." /></div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>التصنيف الفرعي</Label>
          <Select value={subtype} onValueChange={setSubtype}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {COMPONENT_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>الحالة</Label>
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {STATUSES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><Label>التكلفة</Label><Input type="number" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} dir="ltr" required /></div>
        <div><Label>القيمة الحالية</Label><Input type="number" step="0.01" value={currentValue} onChange={(e) => setCurrentValue(e.target.value)} dir="ltr" placeholder="اتركها فارغة = التكلفة" /></div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div><Label>تاريخ الشراء</Label><Input type="date" value={acquiredAt} onChange={(e) => setAcquiredAt(e.target.value)} /></div>
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

      <div><Label>العمر المتوقع (بالسنوات) — اختياري</Label><Input type="number" step="0.5" value={expectedLife} onChange={(e) => setExpectedLife(e.target.value)} dir="ltr" placeholder="مثلاً 5" /></div>

      <div><Label>الملاحظات</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} /></div>

      <DialogFooter>
        <Button type="submit" disabled={mut.isPending}>{mut.isPending ? "..." : isEdit ? "حفظ" : "إضافة"}</Button>
      </DialogFooter>
    </form>
  );
}
