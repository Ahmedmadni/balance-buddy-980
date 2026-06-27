import { useMemo, useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { Calculator, Save, Trash2, Info } from "lucide-react";
import { CURRENCIES, formatMoney, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  computeDepreciation,
  buildDepreciationSchedule,
  DEPRECIATION_METHODS,
  type DepreciationMethod,
  type DepreciationProfile,
} from "@/lib/assets/depreciation";

const n = (v: any) => Number(v ?? 0) || 0;

export function DepreciationTab({ asset }: { asset: any }) {
  const qc = useQueryClient();
  const cur = asset.currency || CURRENCIES[0];
  const cost = n(asset.base_value ?? asset.principal ?? asset.current_value);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["depreciation-profile", asset.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("depreciation_profiles")
        .select("*")
        .eq("investment_id", asset.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Local form state
  const [method, setMethod] = useState<DepreciationMethod>("straight_line");
  const [life, setLife] = useState<string>("60");
  const [salvage, setSalvage] = useState<string>("0");
  const [startDate, setStartDate] = useState<string>(todayISO());
  const [isActive, setIsActive] = useState(true);
  const [unitsTotal, setUnitsTotal] = useState<string>("");
  const [unitsConsumed, setUnitsConsumed] = useState<string>("");

  useEffect(() => {
    if (profile) {
      setMethod(profile.method as DepreciationMethod);
      setLife(String(profile.useful_life_months));
      setSalvage(String(profile.salvage_value ?? 0));
      setStartDate(profile.start_date);
      setIsActive(profile.is_active);
      setUnitsTotal(profile.units_total != null ? String(profile.units_total) : "");
      setUnitsConsumed(profile.units_consumed != null ? String(profile.units_consumed) : "");
    }
  }, [profile?.id]);

  const save = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("غير مسجل");
      const payload = {
        user_id: user.id,
        investment_id: asset.id,
        method,
        useful_life_months: Math.max(1, parseInt(life || "1", 10)),
        salvage_value: n(salvage),
        start_date: startDate,
        is_active: isActive,
        units_total: unitsTotal === "" ? null : n(unitsTotal),
        units_consumed: unitsConsumed === "" ? null : n(unitsConsumed),
      };
      if (profile?.id) {
        const { error } = await supabase.from("depreciation_profiles").update(payload).eq("id", profile.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("depreciation_profiles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["depreciation-profile", asset.id] });
      toast.success("تم حفظ إعدادات الإهلاك");
    },
    onError: (e: any) => toast.error(e.message || "فشل الحفظ"),
  });

  const del = useMutation({
    mutationFn: async () => {
      if (!profile?.id) return;
      const { error } = await supabase.from("depreciation_profiles").delete().eq("id", profile.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["depreciation-profile", asset.id] });
      toast.success("تم حذف ملف الإهلاك");
    },
  });

  // Live preview using current form state
  const previewProfile: DepreciationProfile = {
    method,
    useful_life_months: Math.max(1, parseInt(life || "1", 10)),
    salvage_value: n(salvage),
    start_date: startDate,
    units_total: unitsTotal === "" ? null : n(unitsTotal),
    units_consumed: unitsConsumed === "" ? null : n(unitsConsumed),
  };

  const result = useMemo(() => computeDepreciation(previewProfile, cost), [method, life, salvage, startDate, unitsTotal, unitsConsumed, cost]);
  const schedule = useMemo(() => buildDepreciationSchedule(previewProfile, cost, 120), [method, life, salvage, startDate, unitsTotal, unitsConsumed, cost]);

  if (isLoading) return <div className="p-6 text-center text-sm text-muted-foreground">جارٍ التحميل…</div>;

  const hasProfile = !!profile?.id;

  return (
    <div className="space-y-4 mt-3">
      {/* Header / status */}
      <div className="rounded-2xl border bg-card p-3 flex items-center gap-3">
        <div className="h-10 w-10 rounded-xl bg-primary/10 grid place-items-center text-primary">
          <Calculator className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold">محرك الإهلاك</div>
          <div className="text-[11px] text-muted-foreground">
            {hasProfile ? "ملف إهلاك مفعّل — يُحسب تلقائياً دون أي تأثير على الأرصدة أو القيود." : "لم يتم تفعيل الإهلاك — جميع القيم تبقى كما هي."}
          </div>
        </div>
        {hasProfile && (
          <Button variant="ghost" size="sm" onClick={() => del.mutate()} disabled={del.isPending}>
            <Trash2 className="h-4 w-4 ml-1" /> حذف
          </Button>
        )}
      </div>

      {/* Settings */}
      <div className="rounded-2xl border bg-card p-3 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground">إعدادات الإهلاك</div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-xs">طريقة الإهلاك</Label>
            <Select value={method} onValueChange={(v) => setMethod(v as DepreciationMethod)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {DEPRECIATION_METHODS.map((m) => (
                  <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="text-[10px] text-muted-foreground flex items-start gap-1">
              <Info className="h-3 w-3 mt-0.5" />
              <span>{DEPRECIATION_METHODS.find((x) => x.value === method)?.hint}</span>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">العمر الإنتاجي (بالأشهر)</Label>
            <Input type="number" inputMode="numeric" value={life} onChange={(e) => setLife(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">القيمة التخريدية (Salvage)</Label>
            <Input type="number" inputMode="decimal" value={salvage} onChange={(e) => setSalvage(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">تاريخ البداية</Label>
            <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          {method === "units_of_production" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">إجمالي الوحدات المتوقعة</Label>
                <Input type="number" value={unitsTotal} onChange={(e) => setUnitsTotal(e.target.value)} placeholder="مثلاً: 200000 كم" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">الوحدات المستهلكة حتى الآن</Label>
                <Input type="number" value={unitsConsumed} onChange={(e) => setUnitsConsumed(e.target.value)} placeholder="مثلاً: 45000" />
              </div>
            </>
          )}
          <div className="flex items-center justify-between rounded-xl border p-2.5 md:col-span-2">
            <div>
              <div className="text-xs font-medium">ملف الإهلاك مفعّل</div>
              <div className="text-[10px] text-muted-foreground">عند الإيقاف لا تُحتسب أي قيم إهلاك جديدة.</div>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <div className="flex justify-end">
          <Button size="sm" onClick={() => save.mutate()} disabled={save.isPending || cost <= 0}>
            <Save className="h-4 w-4 ml-1" /> {hasProfile ? "تحديث" : "حفظ"}
          </Button>
        </div>
        {cost <= 0 && (
          <div className="text-[11px] text-amber-600">لا توجد تكلفة (base_value/principal) — لن يُحسب إهلاك حتى تُعتمد قيمة شراء للأصل.</div>
        )}
      </div>

      {/* Results */}
      <div className="rounded-2xl border bg-card p-3 space-y-3">
        <div className="text-xs font-semibold text-muted-foreground">نتائج الإهلاك (معاينة حيّة)</div>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
          <MiniStat label="الإهلاك الشهري" value={result.monthly_depreciation} cur={cur} />
          <MiniStat label="الإهلاك السنوي" value={result.annual_depreciation} cur={cur} />
          <MiniStat label="مجمع الإهلاك" value={result.accumulated_depreciation} cur={cur} tone="text-rose-600" />
          <MiniStat label="القيمة الدفترية" value={result.book_value} cur={cur} tone="text-primary" accent />
          <MiniStat label="التكلفة الأصلية" value={result.cost} cur={cur} />
          <MiniStat label="القيمة التخريدية" value={result.salvage} cur={cur} />
        </div>
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[11px] text-muted-foreground">
            <span>نسبة الإهلاك</span>
            <span className="tabular-nums">{result.depreciation_percentage.toFixed(1)}%</span>
          </div>
          <Progress value={result.depreciation_percentage} />
          <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-1">
            <span>العمر المنقضي: <span className="tabular-nums font-medium text-foreground">{result.elapsed_months.toFixed(1)} شهر</span></span>
            <span>المتبقي: <span className="tabular-nums font-medium text-foreground">{result.remaining_life_months.toFixed(1)} شهر</span></span>
          </div>
        </div>
      </div>

      {/* Schedule */}
      <div className="rounded-2xl border bg-card p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs font-semibold text-muted-foreground">جدول الإهلاك (Depreciation Schedule)</div>
          <div className="text-[10px] text-muted-foreground">{schedule.length} صف</div>
        </div>
        <div className="overflow-auto max-h-[360px] rounded-lg border">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0">
              <tr>
                <th className="p-2 text-start">#</th>
                <th className="p-2 text-start">الفترة</th>
                <th className="p-2 text-end">الإهلاك الشهري</th>
                <th className="p-2 text-end">مجمع الإهلاك</th>
                <th className="p-2 text-end">القيمة الدفترية</th>
              </tr>
            </thead>
            <tbody>
              {schedule.map((r) => (
                <tr key={r.month} className="border-t">
                  <td className="p-2 tabular-nums text-muted-foreground">{r.month}</td>
                  <td className="p-2 tabular-nums">{r.period}</td>
                  <td className="p-2 text-end tabular-nums">{formatMoney(r.monthly, cur)}</td>
                  <td className="p-2 text-end tabular-nums text-rose-600">{formatMoney(r.accumulated, cur)}</td>
                  <td className="p-2 text-end tabular-nums font-medium">{formatMoney(r.book_value, cur)}</td>
                </tr>
              ))}
              {schedule.length === 0 && (
                <tr><td colSpan={5} className="p-4 text-center text-muted-foreground">لا توجد بيانات.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="text-[10px] text-muted-foreground mt-2">
          ⚠️ هذا الجدول للعرض والحساب فقط — لا يُنشئ قيوداً محاسبية ولا يؤثر على الأرصدة أو المعاملات.
        </div>
      </div>
    </div>
  );
}

function MiniStat({ label, value, cur, tone, accent }: { label: string; value: number; cur: string; tone?: string; accent?: boolean }) {
  return (
    <div className={cn("rounded-xl border p-2.5", accent ? "bg-primary/5 border-primary/30" : "bg-background")}>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums mt-0.5", tone)}>{formatMoney(value, cur)}</div>
    </div>
  );
}
