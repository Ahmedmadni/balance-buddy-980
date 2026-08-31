import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo, useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Plus, TrendingUp, Trash2, Pencil, X, Wallet as WalletIcon, Search, ArrowUpDown, LayoutGrid, List as ListIcon, Calculator } from "lucide-react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { AttachmentUploader } from "@/components/AttachmentUploader";
import { CURRENCIES, formatMoney, formatDate, todayISO } from "@/lib/format";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { computeAssetMetrics, TX_CLASS_META, type AssetTxClass } from "@/lib/assets/calculator";
import { AdSlot } from "@/components/ads/AdSlot";
import { AssetComponentsTab } from "@/components/AssetComponentsTab";
import { MarketValueHistoryTab } from "@/components/MarketValueHistoryTab";
import { DepreciationTab } from "@/components/DepreciationTab";
import { InvestmentPerformanceTab } from "@/components/InvestmentPerformanceTab";
import { AssetZakatTab } from "@/components/AssetZakatTab";
import { computeDepreciation, type DepreciationProfile } from "@/lib/assets/depreciation";
import { syncWalletTx, deleteWalletTxForSource, investmentWalletKind } from "@/lib/wallet-sync";
import { isDepreciable, defaultsFor } from "@/lib/assets/depreciation-defaults";


export const Route = createFileRoute("/_authenticated/app/investments")({
  head: () => ({ meta: [{ title: "الأصول والاستثمارات — رصد" }] }),
  component: InvestmentsPage,
});

const INV_TYPES = [
  { value: "stocks", label: "أسهم", icon: "📈" },
  { value: "gold", label: "ذهب", icon: "🪙" },
  { value: "crypto", label: "عملات رقمية", icon: "₿" },
  { value: "real_estate", label: "عقار", icon: "🏠" },
  { value: "car", label: "سيارة", icon: "🚗" },
  { value: "fund", label: "صندوق", icon: "📊" },
  { value: "business", label: "نشاط", icon: "🏢" },
  { value: "other", label: "أخرى", icon: "💎" },
];
const typeLabel = (v: string) => INV_TYPES.find((t) => t.value === v)?.label ?? v;
const typeIcon = (v: string) => INV_TYPES.find((t) => t.value === v)?.icon ?? "💎";

// Asset transaction classes (CapEx / OpEx / Income / Adjustment / Sale / Capital Contribution)
const TX_CLASSES: { value: AssetTxClass; label: string; emoji: string }[] = [
  { value: "capex", label: "مصروف رأسمالي", emoji: "🔧" },
  { value: "opex", label: "مصروف تشغيلي", emoji: "⛽" },
  { value: "income", label: "دخل / إيراد", emoji: "💰" },
  { value: "adjustment", label: "تعديل قيمة", emoji: "📊" },
  { value: "sale", label: "بيع الأصل", emoji: "🏁" },
  { value: "capital_contribution", label: "زيادة رأس المال", emoji: "➕" },
];

function MetricCard({ label, value, cur, tone, accent, signed }: { label: string; value: number; cur: string; tone?: string; accent?: boolean; signed?: boolean }) {
  const sign = signed && value !== 0 ? (value > 0 ? "+" : "−") : "";
  return (
    <div className={cn("rounded-xl border p-2.5", accent ? "bg-primary/5 border-primary/30" : "bg-card")}>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className={cn("text-sm font-bold tabular-nums mt-0.5", tone)}>{sign}{formatMoney(Math.abs(value), cur)}</div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between rounded-lg bg-card border p-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium truncate ml-2">{value}</span>
    </div>
  );
}


function InvestmentsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any | null>(null);
  const [txFor, setTxFor] = useState<any | null>(null);
  const [detail, setDetail] = useState<any | null>(null);
  const [editingTx, setEditingTx] = useState<any | null>(null);
  const [deletingTx, setDeletingTx] = useState<any | null>(null);
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("active");
  const [sort, setSort] = useState<"recent" | "value_desc" | "value_asc" | "pnl_desc" | "name">("recent");
  const [groupByType, setGroupByType] = useState(true);

  const { data, isLoading } = useQuery({
    queryKey: ["investments-list"],
    queryFn: async () => {
      const [iRes, tRes, wRes, dRes] = await Promise.all([
        supabase.from("investments").select("*, wallets(name,color,currency)").is("parent_investment_id", null).order("created_at", { ascending: false }),
        supabase.from("investment_transactions").select("*").order("happened_at", { ascending: false }),
        supabase.from("wallets").select("*").order("created_at"),
        supabase.from("depreciation_profiles").select("*").eq("is_active", true),
      ]);
      return { items: iRes.data ?? [], txs: (tRes.data ?? []) as any[], wallets: wRes.data ?? [], depreciationProfiles: (dRes.data ?? []) as any[] };
    },
  });

  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("investments").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["investments-list"] }); toast.success("تم الحذف"); },
  });

  const enableDep = useMutation({
    mutationFn: async (inv: any) => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const d = defaultsFor(inv.type);
      const cost = Number(inv.base_value ?? inv.principal ?? inv.current_value ?? 0) || 0;
      const start = inv.acquired_at || inv.start_date || todayISO();
      const { error } = await supabase.from("depreciation_profiles").insert({
        user_id: u.user.id,
        investment_id: inv.id,
        method: d.method,
        useful_life_months: d.useful_life_months,
        salvage_value: Math.round(cost * d.salvage_ratio),
        start_date: start,
        is_active: true,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["investments-list"] });
      toast.success("تم تفعيل الإهلاك بإعدادات افتراضية");
    },
    onError: (e: any) => toast.error(e.message || "فشل التفعيل"),
  });

  const txByInv = new Map<string, any[]>();
  for (const t of data?.txs ?? []) {
    const a = txByInv.get(t.investment_id) ?? []; a.push(t); txByInv.set(t.investment_id, a);
  }

  // Latest active depreciation profile per investment
  const depProfileByInv = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of data?.depreciationProfiles ?? []) {
      const prev = m.get(p.investment_id);
      if (!prev || new Date(p.created_at) > new Date(prev.created_at)) m.set(p.investment_id, p);
    }
    return m;
  }, [data?.depreciationProfiles]);


  const totals = useMemo(() => {
    const byCur: Record<string, { invested: number; value: number; income: number; opex: number; pnl: number }> = {};
    for (const inv of data?.items ?? []) {
      const cur = inv.currency;
      const t = (byCur[cur] ??= { invested: 0, value: 0, income: 0, opex: 0, pnl: 0 });
      const txs = txByInv.get(inv.id) ?? [];
      const m = computeAssetMetrics(inv, txs);
      t.invested += m.bookValue;
      t.value += m.marketValue;
      t.income += m.income;
      t.opex += m.opex;
      t.pnl += m.totalPnl;
    }
    return byCur;
  }, [data, txByInv]);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><TrendingUp className="h-6 w-6" /> الأصول والاستثمارات</h1>
          <p className="text-sm text-muted-foreground mt-1">إدارة موحّدة لجميع ممتلكاتك مع تتبّع الإيرادات والمصاريف الرأسمالية والتشغيلية</p>
        </div>
        <Dialog open={open || !!editing} onOpenChange={(v) => { if (!v) { setOpen(false); setEditing(null); } }}>
          <DialogTrigger asChild><Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4" /> استثمار</Button></DialogTrigger>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <InvestmentForm initial={editing} wallets={data?.wallets ?? []} onDone={() => { setOpen(false); setEditing(null); qc.invalidateQueries({ queryKey: ["investments-list"] }); }} />
          </DialogContent>
        </Dialog>
      </div>

      {Object.keys(totals).length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {Object.entries(totals).map(([cur, t]) => {
            const pnl = t.pnl;
            return (
              <div key={cur} className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)]">
                <div className="text-[11px] text-muted-foreground">إجمالي رأس المال ({cur})</div>
                <div className="text-xl font-extrabold tabular-nums">{formatMoney(t.invested, cur)}</div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                  <div><div className="text-muted-foreground">القيمة</div><div className="font-bold tabular-nums">{formatMoney(t.value, cur)}</div></div>
                  <div><div className="text-muted-foreground">إيرادات</div><div className="font-bold tabular-nums text-success">{formatMoney(t.income, cur)}</div></div>
                  <div><div className="text-muted-foreground">صافي ربح</div><div className={cn("font-bold tabular-nums", pnl >= 0 ? "text-success" : "text-destructive")}>{formatMoney(pnl, cur)}</div></div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Filter / Search / Sort / Group bar */}
      <div className="rounded-2xl border bg-card p-3 flex flex-wrap items-center gap-2">
        <div className="relative flex-1 min-w-[180px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث في الأصول..." className="pr-9" />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-36"><SelectValue placeholder="النوع" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            {INV_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.icon} {t.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-32"><SelectValue placeholder="الحالة" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الحالات</SelectItem>
            <SelectItem value="active">نشط</SelectItem>
            <SelectItem value="closed">مغلق</SelectItem>
            <SelectItem value="sold">مباع</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v: any) => setSort(v)}>
          <SelectTrigger className="w-40"><ArrowUpDown className="h-3.5 w-3.5" /><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="recent">الأحدث</SelectItem>
            <SelectItem value="name">الاسم (أبجدي)</SelectItem>
            <SelectItem value="value_desc">القيمة (↓)</SelectItem>
            <SelectItem value="value_asc">القيمة (↑)</SelectItem>
            <SelectItem value="pnl_desc">الأعلى ربحاً</SelectItem>
          </SelectContent>
        </Select>
        <Button type="button" variant={groupByType ? "default" : "outline"} size="sm" onClick={() => setGroupByType((g) => !g)}>
          {groupByType ? <LayoutGrid className="h-3.5 w-3.5" /> : <ListIcon className="h-3.5 w-3.5" />}
          {groupByType ? "مجمّع" : "قائمة"}
        </Button>
      </div>

      {(() => {
        if (isLoading) return <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}</div>;
        const all = data?.items ?? [];
        if (all.length === 0) {
          return (
            <div className="rounded-2xl border bg-card p-10 text-center">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-accent"><TrendingUp className="h-6 w-6" /></div>
              <h3 className="mt-4 font-semibold">لا يوجد أصول بعد</h3>
              <p className="mt-1 text-sm text-muted-foreground">أضف أول أصل لمتابعة قيمته وعوائده</p>
            </div>
          );
        }
        const q = search.trim().toLowerCase();
        const filtered = all.filter((inv: any) => {
          if (filterStatus !== "all" && (inv.status ?? "active") !== filterStatus) return false;
          if (filterType !== "all" && inv.type !== filterType) return false;
          if (!q) return true;
          return (
            (inv.name ?? "").toLowerCase().includes(q) ||
            (inv.notes ?? "").toLowerCase().includes(q) ||
            JSON.stringify(inv.meta ?? {}).toLowerCase().includes(q)
          );
        });
        const withMetrics = filtered.map((inv: any) => {
          const txs = txByInv.get(inv.id) ?? [];
          const m = computeAssetMetrics(inv, txs);
          return { inv, txs, m };
        });
        withMetrics.sort((a, b) => {
          if (sort === "name") return (a.inv.name ?? "").localeCompare(b.inv.name ?? "", "ar");
          if (sort === "value_desc") return b.m.marketValue - a.m.marketValue;
          if (sort === "value_asc") return a.m.marketValue - b.m.marketValue;
          if (sort === "pnl_desc") return b.m.totalPnl - a.m.totalPnl;
          return new Date(b.inv.created_at).getTime() - new Date(a.inv.created_at).getTime();
        });

        if (withMetrics.length === 0) {
          return <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">لا توجد نتائج تطابق التصفية</div>;
        }

        const renderCard = ({ inv, m }: any) => {
          const dp = depProfileByInv.get(inv.id);
          const depResult = dp ? computeDepreciation(dp as DepreciationProfile, m.bookValue) : null;
          return (
          <div key={inv.id} className="rounded-2xl border bg-card p-4 shadow-[var(--shadow-card)] cursor-pointer hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)] transition" onClick={() => setDetail(inv)}>
            <div className="flex items-start gap-3">
              <div className="grid h-11 w-11 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-white text-lg shrink-0">{typeIcon(inv.type)}</div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold truncate flex items-center gap-2 flex-wrap">
                  {inv.name}
                  <span className="text-[10px] rounded-full bg-primary/15 text-primary px-1.5 py-0.5">{typeLabel(inv.type)}</span>
                  {inv.is_zakatable && <span className="text-[10px] rounded-full bg-amber-500/15 text-amber-700 px-1.5 py-0.5">قابل للزكاة</span>}
                  {depResult && (
                    <span className="text-[10px] rounded-full bg-blue-500/15 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 inline-flex items-center gap-1" title="القيمة الدفترية بعد الإهلاك">
                      إهلاك {depResult.depreciation_percentage.toFixed(0)}%
                    </span>
                  )}
                  {inv.status === "closed" && <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5">مغلق</span>}
                  {inv.status === "sold" && <span className="text-[10px] rounded-full bg-success/15 text-success px-1.5 py-0.5">مباع</span>}
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5">
                  الملكية {inv.ownership_pct}% · بدأ {formatDate(inv.start_date)}
                  {inv.meta?.market && <> · {inv.meta.market}</>}
                  {inv.meta?.karat && <> · عيار {inv.meta.karat}</>}
                </div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[11px]">
                  <div><div className="text-muted-foreground">رأس المال</div><div className="font-bold tabular-nums">{formatMoney(m.bookValue, inv.currency)}</div></div>
                  <div><div className="text-muted-foreground">{depResult ? "الدفترية (صافي)" : "القيمة"}</div><div className="font-bold tabular-nums">{formatMoney(depResult ? depResult.book_value : m.marketValue, inv.currency)}</div></div>
                  <div><div className="text-muted-foreground">العائد</div><div className={cn("font-bold tabular-nums", m.totalPnl >= 0 ? "text-success" : "text-destructive")}>{m.totalPnl >= 0 ? "+" : ""}{formatMoney(m.totalPnl, inv.currency)}</div></div>
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
                <Button variant="outline" size="sm" onClick={() => setTxFor(inv)}><Plus className="h-3.5 w-3.5" /> حركة</Button>
                {!depResult && isDepreciable(inv.type) && (
                  <Button variant="outline" size="sm" onClick={() => enableDep.mutate(inv)} disabled={enableDep.isPending} title="تفعيل الإهلاك بإعدادات افتراضية">
                    <Calculator className="h-3.5 w-3.5" /> إهلاك
                  </Button>
                )}
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(inv)}><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => { if (confirm("حذف الأصل؟")) del.mutate(inv.id); }}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                </div>
              </div>
            </div>
          </div>
          );
        };


        if (!groupByType) {
          return <div className="space-y-2">{withMetrics.map(renderCard)}</div>;
        }

        const groups = new Map<string, typeof withMetrics>();
        for (const row of withMetrics) {
          const key = row.inv.type;
          if (!groups.has(key)) groups.set(key, [] as any);
          groups.get(key)!.push(row);
        }
        return (
          <div className="space-y-5">
            {Array.from(groups.entries()).map(([type, rows]) => (
              <div key={type} className="space-y-2">
                <div className="flex items-center justify-between px-1">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <span className="text-lg">{typeIcon(type)}</span>
                    {typeLabel(type)}
                    <span className="text-[10px] text-muted-foreground">({rows.length})</span>
                  </h3>
                </div>
                {rows.map(renderCard)}
              </div>
            ))}
          </div>
        );
      })()}

      <Dialog open={!!txFor} onOpenChange={(v) => !v && setTxFor(null)}>
        <DialogContent className="max-w-md">
          {txFor && <InvestmentTxForm investment={txFor} wallets={data?.wallets ?? []} onDone={() => { setTxFor(null); qc.invalidateQueries({ queryKey: ["investments-list"] }); qc.invalidateQueries({ queryKey: ["wallets-list"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); }} />}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editingTx} onOpenChange={(v) => !v && setEditingTx(null)}>
        <DialogContent className="max-w-md">
          {editingTx && (
            <InvestmentTxEditForm
              tx={editingTx}
              wallets={data?.wallets ?? []}
              onDone={() => {
                setEditingTx(null);
                qc.invalidateQueries({ queryKey: ["investments-list"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deletingTx} onOpenChange={(v) => !v && setDeletingTx(null)}>
        <DialogContent className="max-w-md">
          {deletingTx && (
            <InvestmentTxDeleteConfirm
              tx={deletingTx}
              allTxs={txByInv.get(deletingTx.investment_id) ?? []}
              asset={(data?.items ?? []).find((i: any) => i.id === deletingTx.investment_id)}
              onCancel={() => setDeletingTx(null)}
              onDone={() => {
                setDeletingTx(null);
                qc.invalidateQueries({ queryKey: ["investments-list"] });
              }}
            />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
        <DialogContent className="max-w-2xl max-h-[88vh] overflow-y-auto">
          {detail && (() => {
            const txs = txByInv.get(detail.id) ?? [];
            const m = computeAssetMetrics(detail, txs);
            const cur = detail.currency;
            const pnlPct = m.bookValue > 0 ? (m.totalPnl / m.bookValue) * 100 : 0;
            const showDepreciation = isDepreciable(detail.type) || !!depProfileByInv.get(detail.id);
            const tabColsSm = showDepreciation ? "sm:grid-cols-9" : "sm:grid-cols-8";
            return (
              <>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2 flex-wrap">
                    <span className="text-2xl">{typeIcon(detail.type)}</span>
                    {detail.name}
                    <span className="text-[10px] rounded-full bg-primary/15 text-primary px-1.5 py-0.5">{typeLabel(detail.type)}</span>
                    {detail.subtype && detail.subtype !== detail.type && (
                      <span className="text-[10px] rounded-full bg-muted px-1.5 py-0.5">{detail.subtype}</span>
                    )}
                    <span className="text-[10px] rounded-full bg-accent px-1.5 py-0.5">{detail.status ?? "active"}</span>
                  </DialogTitle>
                </DialogHeader>

                <Tabs defaultValue="overview" className="mt-2">
                  <TabsList className={cn("w-full grid grid-cols-3 h-auto gap-1", tabColsSm)}>
                    <TabsTrigger value="overview">نظرة عامة</TabsTrigger>
                    <TabsTrigger value="components">المكونات</TabsTrigger>
                    <TabsTrigger value="transactions">الحركات ({txs.length})</TabsTrigger>
                    <TabsTrigger value="summary">ملخص مالي</TabsTrigger>
                    <TabsTrigger value="performance">الأداء</TabsTrigger>
                    <TabsTrigger value="market">القيمة السوقية</TabsTrigger>
                    {showDepreciation && <TabsTrigger value="depreciation">الإهلاك</TabsTrigger>}
                    <TabsTrigger value="zakat">الزكاة</TabsTrigger>
                    <TabsTrigger value="notes">ملاحظات ومرفقات</TabsTrigger>
                  </TabsList>


                  {/* ============ COMPONENTS ============ */}
                  <TabsContent value="components">
                    <AssetComponentsTab parent={detail} />
                  </TabsContent>

                  {/* ============ OVERVIEW ============ */}
                  <TabsContent value="overview" className="space-y-3 mt-3">
                    <div className="rounded-2xl border bg-[image:var(--gradient-primary)]/5 p-4">
                      <div className="text-[11px] text-muted-foreground">القيمة السوقية الحالية</div>
                      <div className="text-3xl font-extrabold tabular-nums text-primary">{formatMoney(m.marketValue, cur)}</div>
                      <div className="mt-1 text-xs flex items-center gap-2">
                        <span className="text-muted-foreground">فرق القيمة:</span>
                        <span className={cn("font-bold tabular-nums", m.unrealizedPnl >= 0 ? "text-success" : "text-destructive")}>
                          {m.unrealizedPnl >= 0 ? "+" : ""}{formatMoney(m.unrealizedPnl, cur)} ({pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(1)}%)
                        </span>
                      </div>
                    </div>

                    {(() => {
                      const dp = depProfileByInv.get(detail.id);
                      if (!dp) return null;
                      const dr = computeDepreciation(dp as DepreciationProfile, m.bookValue);
                      return (
                        <div className="rounded-2xl border bg-blue-500/5 border-blue-500/30 p-3 space-y-1.5">
                          <div className="flex items-center justify-between text-xs">
                            <span className="text-muted-foreground">القيمة الدفترية بعد الإهلاك</span>
                            <span className="font-bold tabular-nums text-blue-700 dark:text-blue-300">{formatMoney(dr.book_value, cur)}</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">مجمع الإهلاك</span>
                            <span className="tabular-nums text-rose-600">−{formatMoney(dr.accumulated_depreciation, cur)} ({dr.depreciation_percentage.toFixed(1)}%)</span>
                          </div>
                          <div className="flex items-center justify-between text-[11px]">
                            <span className="text-muted-foreground">إهلاك شهري</span>
                            <span className="tabular-nums">{formatMoney(dr.monthly_depreciation, cur)}</span>
                          </div>
                        </div>
                      );
                    })()}

                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <InfoRow label="الاسم" value={detail.name} />
                      <InfoRow label="النوع" value={typeLabel(detail.type)} />
                      <InfoRow label="التصنيف الفرعي" value={detail.subtype ?? "—"} />
                      <InfoRow label="الحالة" value={detail.status ?? "active"} />
                      <InfoRow label="تاريخ الشراء" value={detail.acquired_at ? formatDate(detail.acquired_at) : (detail.start_date ? formatDate(detail.start_date) : "—")} />
                      <InfoRow label="نسبة الملكية" value={`${detail.ownership_pct ?? 100}%`} />
                      <InfoRow label="التكلفة الأصلية" value={formatMoney(m.baseValue, cur)} />
                      <InfoRow label="القيمة الحالية" value={formatMoney(m.marketValue, cur)} />
                      <InfoRow label="فرق القيمة" value={`${m.unrealizedPnl >= 0 ? "+" : ""}${formatMoney(m.unrealizedPnl, cur)}`} />
                      <InfoRow label="نسبة الربح/الخسارة" value={`${pnlPct >= 0 ? "+" : ""}${pnlPct.toFixed(2)}%`} />
                      <InfoRow label="العملة" value={cur} />
                      <InfoRow label="قابل للزكاة" value={detail.is_zakatable ? "نعم" : "لا"} />
                    </div>


                    {detail.meta && Object.keys(detail.meta).length > 0 && (
                      <div className="rounded-xl border bg-accent/30 p-3 text-xs space-y-1">
                        <div className="font-semibold mb-1">تفاصيل {typeLabel(detail.type)}</div>
                        {Object.entries(detail.meta).map(([k, v]: any) => (
                          <div key={k} className="flex justify-between"><span className="text-muted-foreground">{k}</span><span className="font-medium">{String(v)}</span></div>
                        ))}
                      </div>
                    )}

                    <Button
                      type="button"
                      className="w-full pt-2"
                      onClick={() => { setDetail(null); setTxFor({ ...detail, _preset_tx_class: "capital_contribution" }); }}
                    >
                      <Plus className="h-4 w-4" /> زيادة رأس المال
                    </Button>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t">
                      {(["capex","opex","income","adjustment"] as AssetTxClass[]).map((c) => {
                        const tm = TX_CLASS_META[c];
                        return (
                          <Button key={c} variant="outline" size="sm" onClick={() => { setDetail(null); setTxFor({ ...detail, _preset_tx_class: c }); }}>
                            <Plus className="h-3.5 w-3.5" /> {tm.label}
                          </Button>
                        );
                      })}
                    </div>
                  </TabsContent>

                  {/* ============ TRANSACTIONS ============ */}
                  <TabsContent value="transactions" className="space-y-2 mt-3">
                    {txs.length === 0 ? (
                      <div className="rounded-xl border border-dashed p-8 text-center text-sm text-muted-foreground">لا توجد حركات بعد</div>
                    ) : txs.map((t: any) => {
                      const cls = (t.tx_class || "capex") as AssetTxClass;
                      const tm = TX_CLASS_META[cls] ?? TX_CLASS_META.capex;
                      return (
                        <div key={t.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                          <span className={cn("text-lg leading-none", tm.color)}>{tm.sign}</span>
                          <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium">{tm.label}</div>
                            <div className="text-[11px] text-muted-foreground">{formatDate(t.happened_at)}{t.notes ? ` · ${t.notes}` : ""}</div>
                          </div>
                          <div className={cn("font-bold tabular-nums", tm.color)}>{tm.sign === "−" ? "−" : tm.sign === "+" ? "+" : ""}{formatMoney(t.amount, t.currency)}</div>
                          <div className="flex items-center gap-0.5 shrink-0">
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setEditingTx(t)}><Pencil className="h-3.5 w-3.5" /></Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setDeletingTx(t)}><Trash2 className="h-3.5 w-3.5 text-destructive" /></Button>
                          </div>
                        </div>
                      );
                    })}
                  </TabsContent>

                  {/* ============ FINANCIAL SUMMARY (legacy quick view) ============ */}
                  <TabsContent value="summary" className="space-y-3 mt-3">
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                      <MetricCard label="إجمالي الإيرادات" value={m.income} cur={cur} tone="text-success" />
                      <MetricCard label="إجمالي المصروفات" value={m.opex + m.capex} cur={cur} tone="text-amber-600" />
                      <MetricCard label="صافي الربح" value={m.totalPnl} cur={cur} tone={m.totalPnl >= 0 ? "text-success" : "text-destructive"} signed />
                      <MetricCard label="القيمة الدفترية" value={m.bookValue} cur={cur} />
                      <MetricCard label="القيمة السوقية" value={m.marketValue} cur={cur} accent />
                      <MetricCard label="صافي التدفق النقدي" value={m.netCashflow} cur={cur} tone={m.netCashflow >= 0 ? "text-success" : "text-destructive"} signed />
                      <MetricCard label="CapEx" value={m.capex} cur={cur} tone="text-blue-600" />
                      <MetricCard label="OpEx" value={m.opex} cur={cur} tone="text-amber-600" />
                      <MetricCard label="غير محقق P&L" value={m.unrealizedPnl} cur={cur} tone={m.unrealizedPnl >= 0 ? "text-success" : "text-destructive"} signed />
                    </div>
                    <div className="rounded-xl border bg-accent/20 p-3 text-xs space-y-1">
                      <div className="flex justify-between"><span className="text-muted-foreground">العائد الحالي</span>
                        <span className={cn("font-bold tabular-nums", pnlPct >= 0 ? "text-success" : "text-destructive")}>{pnlPct >= 0 ? "+" : ""}{pnlPct.toFixed(2)}%</span>
                      </div>
                      <div className="flex justify-between"><span className="text-muted-foreground">عدد الحركات</span><span className="font-medium tabular-nums">{txs.length}</span></div>
                      {detail.sold_amount > 0 && (
                        <div className="flex justify-between"><span className="text-muted-foreground">قيمة البيع</span><span className="font-bold tabular-nums text-success">{formatMoney(detail.sold_amount, cur)}</span></div>
                      )}
                    </div>
                    <AdSlot slot="asset_details_bottom" />
                  </TabsContent>

                  {/* ============ INVESTMENT PERFORMANCE ENGINE ============ */}
                  <TabsContent value="performance">
                    <InvestmentPerformanceTab asset={detail} />
                  </TabsContent>

                  {/* ============ MARKET VALUE HISTORY ============ */}
                  <TabsContent value="market">
                    <MarketValueHistoryTab asset={detail} />
                  </TabsContent>

                  {/* ============ DEPRECIATION ============ */}
                  {showDepreciation && (
                    <TabsContent value="depreciation">
                      <DepreciationTab asset={detail} />
                    </TabsContent>
                  )}


                  {/* ============ ASSET ZAKAT ============ */}
                  <TabsContent value="zakat">
                    <AssetZakatTab asset={detail} />
                  </TabsContent>



                  {/* ============ NOTES + ATTACHMENTS ============ */}
                  <TabsContent value="notes" className="space-y-3 mt-3">
                    <div className="rounded-xl border bg-card p-3">
                      <div className="text-xs font-semibold text-muted-foreground mb-1.5">الملاحظات</div>
                      {detail.notes ? (
                        <div className="text-sm whitespace-pre-wrap">{detail.notes}</div>
                      ) : (
                        <div className="text-xs text-muted-foreground">لا توجد ملاحظات.</div>
                      )}
                    </div>
                    <div className="rounded-xl border bg-card p-3">
                      <div className="text-xs font-semibold text-muted-foreground mb-2">المرفقات</div>
                      <AttachmentUploader entityType="investments" entityId={detail.id} />
                    </div>
                  </TabsContent>
                </Tabs>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>

      <AdSlot slot="assets_list_bottom" />
    </div>
  );
}

// =========== Dynamic Investment Form ===========

const PURPOSE_OPTIONS: Record<string, Array<{ value: string; label: string }>> = {
  gold: [
    { value: "personal_use", label: "زينة شخصية" },
    { value: "savings", label: "ادخار" },
    { value: "investment", label: "استثمار" },
    { value: "trade", label: "تجارة" },
  ],
  real_estate: [
    { value: "personal_use", label: "سكن شخصي" },
    { value: "rental", label: "تأجير" },
    { value: "resale", label: "للبيع / تجارة" },
  ],
  stocks: [
    { value: "long_term", label: "استثمار طويل الأجل" },
    { value: "speculation", label: "مضاربة" },
    { value: "trade", label: "تجارة" },
  ],
  car: [
    { value: "personal_use", label: "استخدام شخصي" },
    { value: "rental", label: "تأجير / تشغيل" },
    { value: "resale", label: "للبيع / تجارة" },
  ],
};

function InvestmentForm({ initial, wallets, onDone }: any) {
  const isEdit = !!initial;
  const [name, setName] = useState(initial?.name ?? "");
  const [type, setType] = useState(initial?.type ?? "stocks");
  const [walletId, setWalletId] = useState<string>(initial?.wallet_id ?? "none");
  const [ownership, setOwnership] = useState(initial?.ownership_pct?.toString() ?? "100");
  const [currency, setCurrency] = useState(initial?.currency ?? "SAR");
  const [isZakatable, setIsZakatable] = useState(initial?.is_zakatable ?? true);
  const [startDate, setStartDate] = useState(initial?.start_date ?? todayISO());
  const [acquiredAt, setAcquiredAt] = useState(initial?.acquired_at ?? initial?.start_date ?? todayISO());
  const [purpose, setPurpose] = useState<string>(initial?.purpose ?? "");
  const [status, setStatus] = useState(initial?.status ?? "active");
  const [notes, setNotes] = useState(initial?.notes ?? "");
  const [meta, setMeta] = useState<Record<string, any>>(initial?.meta ?? {});
  const [principalOverride, setPrincipalOverride] = useState<string>(initial?.principal?.toString() ?? "");
  const [customFields, setCustomFields] = useState<Array<{ k: string; v: string }>>(
    initial?.type === "other" && initial?.meta
      ? Object.entries(initial.meta).map(([k, v]) => ({ k, v: String(v) }))
      : [{ k: "", v: "" }]
  );

  // Reset meta when type changes
  useEffect(() => {
    if (!isEdit) setMeta({});
  }, [type, isEdit]);

  const setM = (k: string, v: any) => setMeta((m) => ({ ...m, [k]: v }));

  // Auto-compute current_value based on type+meta
  const computedValue = useMemo(() => {
    if (type === "stocks") {
      const shares = Number(meta.shares) || 0;
      const price = Number(meta.price_per_share) || 0;
      return shares * price;
    }
    if (type === "gold") {
      const grams = Number(meta.grams) || 0;
      const price = Number(meta.price_per_gram) || 0;
      const karat = Number(meta.karat) || 24;
      return grams * price * (karat / 24);
    }
    if (type === "crypto") {
      const units = Number(meta.units) || 0;
      const price = Number(meta.unit_price) || 0;
      return units * price;
    }
    if (type === "real_estate") {
      return Number(meta.current_value) || 0;
    }
    return Number(principalOverride) || 0;
  }, [type, meta, principalOverride]);

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");

      let finalMeta = meta;
      if (type === "other") {
        finalMeta = {};
        for (const f of customFields) {
          if (f.k.trim()) finalMeta[f.k.trim()] = f.v;
        }
      }

      const principal = parseFloat(principalOverride) || computedValue;
      const currentValue = computedValue || principal;

      const payload: any = {
        user_id: u.user.id, name: name.trim(), type,
        asset_kind: type,
        subtype: type,
        meta: finalMeta,
        wallet_id: walletId === "none" ? null : walletId,
        principal,
        base_value: principal,
        current_value: currentValue,
        ownership_pct: parseFloat(ownership) || 100,
        currency, is_zakatable: isZakatable, start_date: startDate, status, notes: notes || null,
        purpose: purpose || null,
        acquired_at: acquiredAt || null,
      };
      if (isEdit) { const { error } = await supabase.from("investments").update(payload).eq("id", initial.id); if (error) throw error; }
      else { const { error } = await supabase.from("investments").insert(payload); if (error) throw error; }
    },
    onSuccess: () => { toast.success(isEdit ? "تم التحديث" : "تمت الإضافة"); onDone(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
      <DialogHeader><DialogTitle>{isEdit ? "تعديل استثمار" : "استثمار جديد"}</DialogTitle></DialogHeader>

      <div>
        <Label>النوع</Label>
        <div className="grid grid-cols-4 gap-1.5 mt-1.5">
          {INV_TYPES.map((t) => (
            <button key={t.value} type="button" onClick={() => setType(t.value)}
              className={cn("flex flex-col items-center gap-0.5 rounded-xl border p-2 text-[11px] font-medium transition",
                type === t.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40")}>
              <span className="text-lg leading-none">{t.icon}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </div>

      <div><Label>الاسم</Label><Input value={name} onChange={(e) => setName(e.target.value)} required placeholder="مثلاً: أسهم أرامكو، شقة الرياض..." /></div>

      {/* Dynamic fields per type */}
      {type === "stocks" && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border bg-accent/20 p-3">
          <div className="col-span-2"><Label>رمز/اسم السهم</Label><Input value={meta.ticker ?? ""} onChange={(e) => setM("ticker", e.target.value)} placeholder="مثلاً: 2222 - أرامكو" /></div>
          <div><Label>عدد الأسهم</Label><Input type="number" step="1" value={meta.shares ?? ""} onChange={(e) => setM("shares", e.target.value)} dir="ltr" /></div>
          <div><Label>سعر السهم</Label><Input type="number" step="0.01" value={meta.price_per_share ?? ""} onChange={(e) => setM("price_per_share", e.target.value)} dir="ltr" /></div>
          <div className="col-span-2"><Label>السوق</Label><Input value={meta.market ?? ""} onChange={(e) => setM("market", e.target.value)} placeholder="تداول السعودية، NASDAQ، NYSE..." /></div>
        </div>
      )}

      {type === "gold" && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border bg-accent/20 p-3">
          <div>
            <Label>نوع الذهب</Label>
            <Select value={meta.gold_type ?? "bullion"} onValueChange={(v) => setM("gold_type", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="bullion">سبائك</SelectItem>
                <SelectItem value="coins">عملات</SelectItem>
                <SelectItem value="jewelry">مجوهرات</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>العيار</Label>
            <Select value={meta.karat?.toString() ?? "24"} onValueChange={(v) => setM("karat", parseInt(v))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="24">24 (خالص)</SelectItem>
                <SelectItem value="22">22</SelectItem>
                <SelectItem value="21">21</SelectItem>
                <SelectItem value="18">18</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div><Label>عدد الجرامات</Label><Input type="number" step="0.01" value={meta.grams ?? ""} onChange={(e) => setM("grams", e.target.value)} dir="ltr" /></div>
          <div><Label>سعر الجرام (24)</Label><Input type="number" step="0.01" value={meta.price_per_gram ?? ""} onChange={(e) => setM("price_per_gram", e.target.value)} dir="ltr" /></div>
        </div>
      )}

      {type === "crypto" && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border bg-accent/20 p-3">
          <div className="col-span-2"><Label>اسم/رمز العملة</Label><Input value={meta.symbol ?? ""} onChange={(e) => setM("symbol", e.target.value)} placeholder="BTC, ETH, USDT..." /></div>
          <div><Label>عدد الوحدات</Label><Input type="number" step="0.00000001" value={meta.units ?? ""} onChange={(e) => setM("units", e.target.value)} dir="ltr" /></div>
          <div><Label>سعر الوحدة</Label><Input type="number" step="0.01" value={meta.unit_price ?? ""} onChange={(e) => setM("unit_price", e.target.value)} dir="ltr" /></div>
        </div>
      )}

      {type === "real_estate" && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border bg-accent/20 p-3">
          <div className="col-span-2"><Label>اسم/وصف العقار</Label><Input value={meta.property_name ?? ""} onChange={(e) => setM("property_name", e.target.value)} placeholder="شقة الرياض، أرض جدة..." /></div>
          <div><Label>القيمة الحالية</Label><Input type="number" step="0.01" value={meta.current_value ?? ""} onChange={(e) => setM("current_value", e.target.value)} dir="ltr" /></div>
          <div><Label>العائد السنوي %</Label><Input type="number" step="0.01" value={meta.annual_yield ?? ""} onChange={(e) => setM("annual_yield", e.target.value)} dir="ltr" /></div>
        </div>
      )}

      {type === "car" && (
        <div className="grid grid-cols-2 gap-3 rounded-xl border bg-accent/20 p-3">
          <div className="col-span-2"><Label>الموديل / الوصف</Label><Input value={meta.model ?? ""} onChange={(e) => setM("model", e.target.value)} placeholder="تويوتا كامري 2022..." /></div>
          <div><Label>رقم اللوحة</Label><Input value={meta.plate ?? ""} onChange={(e) => setM("plate", e.target.value)} /></div>
          <div><Label>سنة الصنع</Label><Input type="number" value={meta.year ?? ""} onChange={(e) => setM("year", e.target.value)} dir="ltr" /></div>
          <div className="col-span-2"><Label>سعر الشراء / القيمة الحالية</Label><Input type="number" step="0.01" value={principalOverride} onChange={(e) => setPrincipalOverride(e.target.value)} dir="ltr" placeholder="0.00" /></div>
        </div>
      )}

      {(type === "fund" || type === "partnership" || type === "business") && (
        <div className="rounded-xl border bg-accent/20 p-3">
          <Label>القيمة الحالية / رأس المال</Label>
          <Input type="number" step="0.01" value={principalOverride} onChange={(e) => setPrincipalOverride(e.target.value)} dir="ltr" placeholder="0.00" />
        </div>
      )}

      {type === "other" && (
        <div className="rounded-xl border bg-accent/20 p-3 space-y-2">
          <div className="flex items-center justify-between">
            <Label>حقول مخصصة</Label>
            <Button type="button" size="sm" variant="ghost" onClick={() => setCustomFields((f) => [...f, { k: "", v: "" }])}><Plus className="h-3.5 w-3.5" /> حقل</Button>
          </div>
          {customFields.map((f, i) => (
            <div key={i} className="flex gap-2">
              <Input placeholder="اسم الحقل" value={f.k} onChange={(e) => setCustomFields((arr) => arr.map((x, idx) => idx === i ? { ...x, k: e.target.value } : x))} />
              <Input placeholder="القيمة" value={f.v} onChange={(e) => setCustomFields((arr) => arr.map((x, idx) => idx === i ? { ...x, v: e.target.value } : x))} />
              <Button type="button" size="icon" variant="ghost" onClick={() => setCustomFields((arr) => arr.filter((_, idx) => idx !== i))}><X className="h-4 w-4" /></Button>
            </div>
          ))}
          <div><Label>القيمة الإجمالية</Label><Input type="number" step="0.01" value={principalOverride} onChange={(e) => setPrincipalOverride(e.target.value)} dir="ltr" /></div>
        </div>
      )}

      {/* Computed value preview */}
      {computedValue > 0 && (
        <div className="rounded-xl bg-primary/5 border border-primary/30 p-3 text-sm flex items-center justify-between">
          <span className="text-muted-foreground">القيمة الإجمالية المحسوبة</span>
          <span className="font-extrabold tabular-nums text-primary">{formatMoney(computedValue, currency)}</span>
        </div>
      )}

      {/* Purpose & acquisition date — drives zakat eligibility */}
      {PURPOSE_OPTIONS[type] && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 space-y-2">
          <Label className="text-xs flex items-center gap-1">🕌 الغرض من التملك (للزكاة)</Label>
          <Select value={purpose} onValueChange={setPurpose}>
            <SelectTrigger><SelectValue placeholder="اختر الغرض..." /></SelectTrigger>
            <SelectContent>
              {PURPOSE_OPTIONS[type].map((p) => <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-[10px] text-muted-foreground">يحدد هذا الخيار ما إذا كان الأصل يدخل في وعاء الزكاة.</div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3">
        <div><Label>تاريخ التملك</Label><Input type="date" value={acquiredAt} onChange={(e) => setAcquiredAt(e.target.value)} dir="ltr" /></div>
        <div><Label>نسبة الملكية %</Label><Input type="number" step="0.01" value={ownership} onChange={(e) => setOwnership(e.target.value)} dir="ltr" /></div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>العملة</Label>
          <Select value={currency} onValueChange={setCurrency}><SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent></Select>
        </div>
        <div><Label>تاريخ البدء</Label><Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} dir="ltr" /></div>
      </div>
      <div>
        <Label>المحفظة المرتبطة</Label>
        <Select value={walletId} onValueChange={setWalletId}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="none">—</SelectItem>{wallets.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}</SelectContent></Select>
      </div>

      <div>
        <Label>الحالة</Label>
        <Select value={status} onValueChange={setStatus}><SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent><SelectItem value="active">نشط</SelectItem><SelectItem value="closed">مغلق</SelectItem></SelectContent></Select>
      </div>

      <div className="flex items-center justify-between rounded-xl border bg-accent/30 p-3">
        <div>
          <div className="text-sm font-medium">قابل للزكاة</div>
          <div className="text-[11px] text-muted-foreground">يُحتسب ضمن وعاء الزكاة</div>
        </div>
        <Switch checked={isZakatable} onCheckedChange={setIsZakatable} />
      </div>
      <div><Label>ملاحظات</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={300} /></div>
      <DialogFooter><Button type="submit" className="w-full" disabled={mut.isPending}>حفظ</Button></DialogFooter>
    </form>
  );
}

function InvestmentTxForm({ investment, wallets, onDone }: any) {
  const [txClass, setTxClass] = useState<AssetTxClass>(investment._preset_tx_class ?? "capex");
  const [amount, setAmount] = useState("");
  const [walletId, setWalletId] = useState<string>(investment.wallet_id ?? "none");
  const [happenedAt, setHappenedAt] = useState(todayISO());
  const [notes, setNotes] = useState("");
  const [updateValue, setUpdateValue] = useState(true);

  const meta = TX_CLASS_META[txClass];

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const amt = parseFloat(amount);
      if (!amt) throw new Error("أدخل المبلغ");

      // Map tx_class → legacy kind for compatibility with old reports/triggers
      const legacyKind =
        txClass === "capex" ? "capital_add" :
        txClass === "income" ? "return" :
        txClass === "sale" ? "withdraw" :
        txClass === "adjustment" ? "revaluation" :
        txClass === "opex" ? "capital_add" : // OpEx not in old enum — fallback
        txClass === "capital_contribution" ? "capital_add" : // maps to the same legacy bucket as capex — DB trigger resolves the real type from tx_class directly
        "capital_add";

      const affectsWallet = txClass !== "personal_benefit" && txClass !== "adjustment";
      const useWallet = affectsWallet && walletId !== "none";

      const { data: inserted, error } = await supabase
        .from("investment_transactions")
        .insert({
          user_id: u.user.id,
          investment_id: investment.id,
          kind: legacyKind,
          tx_class: txClass,
          amount: amt,
          currency: investment.currency,
          wallet_id: useWallet ? walletId : null,
          affects_wallet: affectsWallet,
          happened_at: happenedAt,
          notes: notes || null,
        } as any)
        .select("id")
        .single();
      if (error) throw error;

      // Update asset value based on class — CapEx no longer touches
      // current_value (market value is independent of capital movements);
      // adjustment stays the one explicit "set the market value" entry
      // point, and sale still records the closing status/proceeds only.
      if (updateValue) {
        const base = Number(investment.base_value ?? investment.principal) || 0;
        const updates: any = {};
        if (txClass === "adjustment") {
          updates.current_value = amt; // amount = new market value
        } else if (txClass === "sale") {
          updates.status = "sold";
          updates.sold_at = happenedAt;
          updates.sold_amount = amt;
          updates.realized_pnl = amt - (base);
        }
        if (Object.keys(updates).length) {
          await supabase.from("investments").update(updates).eq("id", investment.id);
        }
      }

      // Link the wallet effect to this transaction via the existing
      // source_kind/source_id mechanism (wallet-sync.ts) — the same one
      // already used for person_ledger — so a later edit/delete of this
      // transaction can find and resync/remove its wallet mirror safely.
      await syncWalletTx({
        userId: u.user.id,
        walletId: useWallet ? walletId : null,
        walletKind: investmentWalletKind(legacyKind),
        amount: amt,
        currency: investment.currency,
        happenedAt,
        notes: `${meta.label} — ${investment.name}`,
        source: { kind: "investment_transactions", id: (inserted as any).id },
      });
    },
    onSuccess: () => { toast.success("تمت الإضافة"); onDone(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
      <DialogHeader><DialogTitle>حركة مالية على: {investment.name}</DialogTitle></DialogHeader>

      <div>
        <Label>نوع الحركة</Label>
        <div className="grid grid-cols-3 gap-1.5 mt-1.5">
          {TX_CLASSES.map((t) => (
            <button key={t.value} type="button" onClick={() => setTxClass(t.value)}
              className={cn("flex flex-col items-center gap-0.5 rounded-xl border p-2 text-[10px] font-medium transition",
                txClass === t.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40")}>
              <span className="text-base leading-none">{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1.5">{meta.description}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{txClass === "adjustment" ? "القيمة السوقية الجديدة" : "المبلغ"}</Label>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required dir="ltr" />
        </div>
        <div><Label>التاريخ</Label><Input type="date" value={happenedAt} onChange={(e) => setHappenedAt(e.target.value)} dir="ltr" /></div>
      </div>

      {txClass !== "adjustment" && txClass !== "personal_benefit" && (
        <div>
          <Label className="flex items-center gap-1"><WalletIcon className="h-3.5 w-3.5" /> المحفظة المتأثرة</Label>
          <Select value={walletId} onValueChange={setWalletId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— بدون تأثير على المحافظ</SelectItem>
              {wallets.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <div className="text-[10px] text-muted-foreground mt-1">
            {txClass === "capex" || txClass === "opex" || txClass === "capital_contribution" ? "سيُخصم المبلغ من المحفظة" : "سيُضاف المبلغ إلى المحفظة"}
          </div>
        </div>
      )}

      <div><Label>ملاحظة</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} /></div>

      {(txClass === "adjustment" || txClass === "sale") && (
        <div className="flex items-center justify-between rounded-xl border bg-accent/30 p-3">
          <div className="text-xs text-muted-foreground">
            {txClass === "adjustment" ? "تحديث القيمة السوقية" : "تسجيل البيع وإغلاق الأصل"}
          </div>
          <Switch checked={updateValue} onCheckedChange={setUpdateValue} />
        </div>
      )}

      <DialogFooter><Button type="submit" className="w-full" disabled={mut.isPending}>حفظ</Button></DialogFooter>
    </form>
  );
}

// =========== Edit / Delete an existing investment transaction ===========
// Scoped intentionally to the investment_transactions row itself: amount,
// date, notes, tx_class, wallet. It does NOT retroactively reconcile
// investments.current_value/status/sold_amount or any wallet_transactions
// row that may have been created when the transaction was first added —
// those side effects aren't tracked anywhere against the source row (no
// back-reference column), so attempting to auto-reverse/reapply them here
// would be guesswork. computeAssetMetrics()/computeInvestmentPerformance()
// read the transaction list live, so book value, totals, and performance
// are always correct after an edit or delete — no separate recompute step
// is needed. The DB's AFTER trigger (tg_sync_tx_investment_tx) mirrors
// UPDATE/DELETE into public.transactions automatically.

function InvestmentTxEditForm({ tx, wallets, onDone }: any) {
  const [txClass, setTxClass] = useState<AssetTxClass>((tx.tx_class as AssetTxClass) ?? "capex");
  const [amount, setAmount] = useState(String(tx.amount ?? ""));
  const [walletId, setWalletId] = useState<string>(tx.wallet_id ?? "none");
  const [happenedAt, setHappenedAt] = useState(tx.happened_at ?? todayISO());
  const [notes, setNotes] = useState(tx.notes ?? "");

  const meta = TX_CLASS_META[txClass];

  // Whether this transaction already has a linked wallet_transactions
  // mirror (source_kind/source_id) — transactions added before this
  // linkage existed won't have one, so editing them can't safely resync
  // whatever wallet effect they originally applied.
  const { data: linkedWalletTx, isLoading: linkedTxLoading } = useQuery({
    queryKey: ["investment-tx-wallet-link", tx.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("wallet_transactions")
        .select("id")
        .eq("source_kind", "investment_transactions")
        .eq("source_id", tx.id)
        .maybeSingle();
      return data;
    },
  });

  const mut = useMutation({
    mutationFn: async () => {
      const amt = parseFloat(amount);
      if (!amt) throw new Error("أدخل المبلغ");

      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");

      // Keep legacy `kind` in sync with tx_class — the DB sync trigger falls
      // back to `kind` for any tx_class it doesn't explicitly branch on
      // (currently only capital_contribution), so an edit that changes
      // tx_class without updating `kind` could mirror the wrong direction
      // into public.transactions. Same mapping as InvestmentTxForm's insert.
      const legacyKind =
        txClass === "capex" ? "capital_add" :
        txClass === "income" ? "return" :
        txClass === "sale" ? "withdraw" :
        txClass === "adjustment" ? "revaluation" :
        txClass === "opex" ? "capital_add" :
        txClass === "capital_contribution" ? "capital_add" :
        "capital_add";

      const affectsWallet = txClass !== "personal_benefit" && txClass !== "adjustment";
      const useWallet = affectsWallet && walletId !== "none";

      const { error } = await supabase
        .from("investment_transactions")
        .update({
          tx_class: txClass,
          kind: legacyKind,
          amount: amt,
          wallet_id: useWallet ? walletId : null,
          affects_wallet: affectsWallet,
          happened_at: happenedAt,
          notes: notes || null,
        } as any)
        .eq("id", tx.id);
      if (error) throw error;

      // Resync the linked wallet mirror: syncWalletTx() looks up the
      // existing wallet_transactions row by (source_kind, source_id) and
      // updates it in place (moving wallet/amount if changed), inserts one
      // if none exists yet, or removes it if no wallet is selected anymore
      // — so a wallet A→B / amount change never leaves a duplicate or a
      // stale effect on the old wallet.
      await syncWalletTx({
        userId: u.user.id,
        walletId: useWallet ? walletId : null,
        walletKind: investmentWalletKind(legacyKind),
        amount: amt,
        currency: tx.currency,
        happenedAt,
        notes: `${meta.label} — ${notes || ""}`.trim(),
        source: { kind: "investment_transactions", id: tx.id },
      });
    },
    onSuccess: () => { toast.success("تم تحديث الحركة"); onDone(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-3">
      <DialogHeader><DialogTitle>تعديل الحركة</DialogTitle></DialogHeader>

      <div>
        <Label>نوع الحركة</Label>
        <div className="grid grid-cols-3 gap-1.5 mt-1.5">
          {TX_CLASSES.map((t) => (
            <button key={t.value} type="button" onClick={() => setTxClass(t.value)}
              className={cn("flex flex-col items-center gap-0.5 rounded-xl border p-2 text-[10px] font-medium transition",
                txClass === t.value ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary/40")}>
              <span className="text-base leading-none">{t.emoji}</span>
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="text-[10px] text-muted-foreground mt-1.5">{meta.description}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>{txClass === "adjustment" ? "القيمة السوقية الجديدة" : "المبلغ"}</Label>
          <Input type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} required dir="ltr" />
        </div>
        <div><Label>التاريخ</Label><Input type="date" value={happenedAt} onChange={(e) => setHappenedAt(e.target.value)} dir="ltr" /></div>
      </div>

      {txClass !== "adjustment" && txClass !== "personal_benefit" && (
        <div>
          <Label className="flex items-center gap-1"><WalletIcon className="h-3.5 w-3.5" /> المحفظة المتأثرة</Label>
          <Select value={walletId} onValueChange={setWalletId}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— بدون تأثير على المحافظ</SelectItem>
              {wallets.map((w: any) => <SelectItem key={w.id} value={w.id}>{w.name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      )}

      <div><Label>ملاحظة</Label><Input value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={200} /></div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-2.5 text-[11px] text-amber-800 dark:text-amber-200">
        {linkedTxLoading ? (
          "جارٍ التحقق من ارتباط هذه الحركة بالمحفظة..."
        ) : linkedWalletTx ? (
          "سيُحدَّث أثر المحفظة المرتبط بهذه الحركة تلقائياً (نفس المبلغ/المحفظة الجديدين). لا يُعاد ضبط أي تحديث سابق طُبِّق على قيمة الأصل نفسه (مثل تعديل يدوي للقيمة السوقية أو إغلاق بيع)."
        ) : (
          "هذه الحركة لا ترتبط حالياً بأي أثر محفظة معروف — إن كانت أُنشئت قبل إضافة الربط الآمن فقد أثّرت على رصيد المحفظة وقتها دون رابط يمكن تتبّعه أو تصحيحه هنا. إن اخترت محفظة الآن سيُنشأ أثر جديد مرتبط بأمان، بلا علاقة بأي أثر سابق غير مرتبط."
        )}
      </div>

      <DialogFooter><Button type="submit" className="w-full" disabled={mut.isPending}>حفظ التعديل</Button></DialogFooter>
    </form>
  );
}

function InvestmentTxDeleteConfirm({ tx, allTxs, asset, onDone, onCancel }: any) {
  const cls = (tx.tx_class || "capex") as AssetTxClass;
  const tm = TX_CLASS_META[cls] ?? TX_CLASS_META.capex;
  const before = computeAssetMetrics(asset ?? {}, allTxs);
  const after = computeAssetMetrics(asset ?? {}, allTxs.filter((t: any) => t.id !== tx.id));

  // Show whether a linked wallet effect will also be reversed.
  const { data: linkedWalletTx, isLoading: linkedTxLoading } = useQuery({
    queryKey: ["investment-tx-wallet-link", tx.id],
    queryFn: async () => {
      const { data } = await supabase
        .from("wallet_transactions")
        .select("id, wallet_id, amount, kind")
        .eq("source_kind", "investment_transactions")
        .eq("source_id", tx.id)
        .maybeSingle();
      return data;
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("investment_transactions").delete().eq("id", tx.id);
      if (error) throw error;
      // Reverse the linked wallet mirror, if one exists, so the wallet
      // balance never keeps reflecting a transaction that no longer exists.
      await deleteWalletTxForSource("investment_transactions", tx.id);
    },
    onSuccess: () => { toast.success("تم حذف الحركة"); onDone(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <div className="space-y-3">
      <DialogHeader><DialogTitle>حذف الحركة؟</DialogTitle></DialogHeader>

      <div className="flex items-center gap-3 rounded-xl border bg-card p-3">
        <span className={cn("text-lg leading-none", tm.color)}>{tm.sign}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-medium">{tm.label}</div>
          <div className="text-[11px] text-muted-foreground">{formatDate(tx.happened_at)}{tx.notes ? ` · ${tx.notes}` : ""}</div>
        </div>
        <div className={cn("font-bold tabular-nums", tm.color)}>{formatMoney(tx.amount, tx.currency)}</div>
      </div>

      <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs space-y-1.5">
        <div className="font-semibold text-destructive">أثر الحذف على الأصل</div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">القيمة الدفترية</span>
          <span className="font-medium tabular-nums">{formatMoney(before.bookValue, tx.currency)} ← {formatMoney(after.bookValue, tx.currency)}</span>
        </div>
        <div className="flex justify-between">
          <span className="text-muted-foreground">صافي الربح</span>
          <span className="font-medium tabular-nums">{formatMoney(before.totalPnl, tx.currency)} ← {formatMoney(after.totalPnl, tx.currency)}</span>
        </div>
        <div className="flex justify-between pt-1 border-t border-destructive/20">
          <span className="text-muted-foreground">أثر المحفظة</span>
          <span className="font-medium">
            {linkedTxLoading ? "..." : linkedWalletTx ? "سيُعاد للمحفظة تلقائياً" : "لا أثر محفظة مرتبط معروف"}
          </span>
        </div>
      </div>

      <div className="text-[11px] text-muted-foreground">
        هذا الإجراء نهائي ولا يمكن التراجع عنه. لن يتأثر الأصل نفسه أو بقية الحركات — فقط هذه الحركة (وأثرها على المحفظة المرتبطة إن وُجد) ستُحذف.
      </div>

      <DialogFooter className="flex gap-2">
        <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>إلغاء</Button>
        <Button type="button" variant="destructive" className="flex-1" disabled={del.isPending} onClick={() => del.mutate()}>حذف نهائياً</Button>
      </DialogFooter>
    </div>
  );
}
