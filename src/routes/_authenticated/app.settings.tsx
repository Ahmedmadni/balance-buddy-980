import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { CURRENCIES } from "@/lib/format";
import {
  Plus, Trash2, Pencil, Search, Settings as SettingsIcon, Wallet as WalletIcon,
  Tags, Contact as ContactIcon, Archive, ArchiveRestore, ExternalLink, ChevronLeft,
  Bell, Download, Coins, TrendingDown, RefreshCw, Megaphone, DatabaseBackup, ShieldCheck, Smartphone,
  HelpCircle,
} from "lucide-react";
import { BackupRestoreSection } from "@/components/BackupRestoreSection";
import { BackupV2Section } from "@/components/BackupV2Section";
import { EncryptedBackupSection } from "@/components/EncryptedBackupSection";
import { CloudBackupSection } from "@/components/CloudBackupSection";
import { toast } from "sonner";
import { typeMeta, WALLET_TYPES } from "./app.wallets";
import { computeWalletBalance } from "@/lib/wallet-balance";
import { formatMoney } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { useAds } from "@/lib/ads/ad-context";
import { AdSlot } from "@/components/ads/AdSlot";
import { ReminderSettingsSection } from "@/components/ReminderSettingsSection";
import { NotificationSettingsSection } from "@/components/NotificationSettingsSection";
import { SystemToolsSection } from "@/components/SystemToolsSection";
import { MobileSettingsSection } from "@/components/MobileSettingsSection";
import { HelpSection } from "@/components/HelpSection";
import { createAuditEntry } from "@/lib/system/audit";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "الإعدادات — رصد" }] }),
  component: SettingsPage,
});

// ---------- Local preferences (UI-only, no DB changes) ----------
type LocalPrefs = {
  appName: string;
  language: "ar" | "en";
  timezone: string;
  dateFormat: "dd/MM/yyyy" | "yyyy-MM-dd" | "MM/dd/yyyy";
  numberFormat: "ar-SA" | "en-US" | "ar-EG";
};
const PREFS_KEY = "rasd.localPrefs.v1";
const defaultPrefs: LocalPrefs = {
  appName: "رصد",
  language: "ar",
  timezone: typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "Asia/Riyadh",
  dateFormat: "dd/MM/yyyy",
  numberFormat: "ar-SA",
};
function loadPrefs(): LocalPrefs {
  try { return { ...defaultPrefs, ...JSON.parse(localStorage.getItem(PREFS_KEY) || "{}") }; }
  catch { return defaultPrefs; }
}

function SettingsPage() {
  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[image:var(--gradient-primary)] text-white shadow-[var(--shadow-elegant)]">
          <SettingsIcon className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">مركز الإعدادات</h1>
          <p className="text-sm text-muted-foreground mt-0.5">إدارة التطبيق والمحافظ والفئات وجهات الاتصال</p>
        </div>
      </div>

      <Tabs defaultValue="general" className="space-y-5">
        <TabsList className="w-full justify-start flex-wrap h-auto gap-1 bg-card border p-1 rounded-2xl">
          <TabsTrigger value="general" className="gap-1.5"><SettingsIcon className="h-4 w-4" />عام</TabsTrigger>
          <TabsTrigger value="wallets" className="gap-1.5"><WalletIcon className="h-4 w-4" />المحافظ</TabsTrigger>
          <TabsTrigger value="categories" className="gap-1.5"><Tags className="h-4 w-4" />الفئات</TabsTrigger>
          <TabsTrigger value="contacts" className="gap-1.5"><ContactIcon className="h-4 w-4" />جهات الاتصال</TabsTrigger>
          <TabsTrigger value="reminders" className="gap-1.5"><Bell className="h-4 w-4" />التذكيرات</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1.5"><Bell className="h-4 w-4" />الإشعارات</TabsTrigger>
          <TabsTrigger value="backup" className="gap-1.5"><DatabaseBackup className="h-4 w-4" />النسخ الاحتياطي</TabsTrigger>
          <TabsTrigger value="advanced" className="gap-1.5 text-muted-foreground"><Bell className="h-4 w-4" />متقدم</TabsTrigger>
          <TabsTrigger value="system" className="gap-1.5"><ShieldCheck className="h-4 w-4" />النظام</TabsTrigger>
          <TabsTrigger value="mobile" className="gap-1.5"><Smartphone className="h-4 w-4" />الجهاز</TabsTrigger>
          <TabsTrigger value="ads" className="gap-1.5"><Megaphone className="h-4 w-4" />الإعلانات</TabsTrigger>
          <TabsTrigger value="help" className="gap-1.5"><HelpCircle className="h-4 w-4" />المساعدة</TabsTrigger>
        </TabsList>

        <TabsContent value="general"><GeneralSection /></TabsContent>
        <TabsContent value="wallets"><WalletsSection /></TabsContent>
        <TabsContent value="categories"><CategoriesSection /></TabsContent>
        <TabsContent value="contacts"><ContactsSection /></TabsContent>
        <TabsContent value="reminders"><ReminderSettingsSection /></TabsContent>
        <TabsContent value="notifications"><NotificationSettingsSection /></TabsContent>
        <TabsContent value="backup">
          <div className="space-y-6">
            <BackupV2Section />
            <EncryptedBackupSection />
            <CloudBackupSection />
            <BackupRestoreSection />
          </div>
        </TabsContent>
        <TabsContent value="advanced"><AdvancedPlaceholder /></TabsContent>
        <TabsContent value="system"><SystemToolsSection /></TabsContent>
        <TabsContent value="mobile"><MobileSettingsSection /></TabsContent>
        <TabsContent value="ads"><AdsSection /></TabsContent>
        <TabsContent value="help"><HelpSection /></TabsContent>

      </Tabs>
    </div>
  );
}

// ===================== GENERAL =====================
function GeneralSection() {
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()).data,
  });

  const [displayName, setDisplayName] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("SAR");
  const [prefs, setPrefs] = useState<LocalPrefs>(defaultPrefs);

  useEffect(() => { setPrefs(loadPrefs()); }, []);
  useEffect(() => {
    if (profile) { setDisplayName(profile.display_name ?? ""); setDefaultCurrency(profile.default_currency ?? "SAR"); }
  }, [profile]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles")
        .update({ display_name: displayName, default_currency: defaultCurrency })
        .eq("id", user.id);
      if (error) throw error;
      localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
    },
    onSuccess: () => {
      toast.success("تم حفظ التفضيلات");
      createAuditEntry("settings_change", "تعديل الملف الشخصي / العملة الافتراضية");
      qc.invalidateQueries({ queryKey: ["profile"] });
    },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <Section title="الملف الشخصي" desc="الاسم الظاهر والعملة الافتراضية">
        <Field label="الاسم">
          <Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} />
        </Field>
        <Field label="العملة الافتراضية">
          <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name} ({c.symbol})</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </Section>

      <Section title="تفضيلات التطبيق" desc="تعرض محلياً على جهازك">
        <Field label="اسم التطبيق">
          <Input value={prefs.appName} onChange={(e) => setPrefs(p => ({ ...p, appName: e.target.value }))} maxLength={40} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="اللغة">
            <Select value={prefs.language} onValueChange={(v: any) => setPrefs(p => ({ ...p, language: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ar">العربية</SelectItem>
                <SelectItem value="en">English</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="المنطقة الزمنية">
            <Input value={prefs.timezone} onChange={(e) => setPrefs(p => ({ ...p, timezone: e.target.value }))} dir="ltr" />
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="تنسيق التاريخ">
            <Select value={prefs.dateFormat} onValueChange={(v: any) => setPrefs(p => ({ ...p, dateFormat: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="dd/MM/yyyy">31/12/2026</SelectItem>
                <SelectItem value="yyyy-MM-dd">2026-12-31</SelectItem>
                <SelectItem value="MM/dd/yyyy">12/31/2026</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="تنسيق الأرقام">
            <Select value={prefs.numberFormat} onValueChange={(v: any) => setPrefs(p => ({ ...p, numberFormat: v }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ar-SA">١٢٣٬٤٥٦٫٧٨</SelectItem>
                <SelectItem value="en-US">123,456.78</SelectItem>
                <SelectItem value="ar-EG">123٬456٫78</SelectItem>
              </SelectContent>
            </Select>
          </Field>
        </div>
      </Section>

      <div className="lg:col-span-2 flex justify-end">
        <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>
          {saveProfile.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
        </Button>
      </div>
    </div>
  );
}

// ===================== WALLETS =====================
function WalletsSection() {
  const qc = useQueryClient();
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

  const toggleArchive = useMutation({
    mutationFn: async (w: any) => {
      const { error } = await supabase.from("wallets").update({ is_archived: !w.is_archived } as any).eq("id", w.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wallets-list"] }); qc.invalidateQueries({ queryKey: ["dashboard"] }); toast.success("تم التحديث"); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  const [editing, setEditing] = useState<any | null>(null);

  const expByWallet = new Map<string, any[]>();
  for (const e of data?.expenses ?? []) {
    if (!e.wallet_id) continue;
    const a = expByWallet.get(e.wallet_id) ?? []; a.push(e); expByWallet.set(e.wallet_id, a);
  }
  const txByWallet = new Map<string, any[]>();
  for (const t of data?.txs ?? []) {
    const a = txByWallet.get(t.wallet_id) ?? []; a.push(t); txByWallet.set(t.wallet_id, a);
  }

  const wallets = data?.wallets ?? [];

  return (
    <Section
      title="المحافظ والحسابات"
      desc="إدارة كاملة لحساباتك. التعديلات تتزامن فوراً مع جميع الصفحات."
      action={
        <Button asChild size="sm" variant="outline">
          <Link to="/app/wallets" search={{ new: "1" } as any}><Plus className="h-4 w-4" /> محفظة جديدة</Link>
        </Button>
      }
    >
      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">{[1, 2].map(i => <div key={i} className="h-24 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : wallets.length === 0 ? (
        <EmptyHint icon={<WalletIcon className="h-5 w-5" />} text="لا توجد محافظ بعد. ابدأ بإضافة أول حساب." />
      ) : (
        <div className="grid gap-2.5 sm:grid-cols-2">
          {wallets.map((w: any) => {
            const meta = typeMeta(w.type);
            const Icon = meta.icon;
            const balance = computeWalletBalance(Number(w.opening_balance), txByWallet.get(w.id) ?? [], expByWallet.get(w.id) ?? []);
            return (
              <div key={w.id} className={`rounded-2xl border bg-card p-3.5 flex items-center gap-3 ${w.is_archived ? "opacity-60" : ""}`}>
                <div className="grid h-10 w-10 place-items-center rounded-xl text-white shrink-0" style={{ background: w.color ?? meta.color }}>
                  <Icon className="h-4 w-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate flex items-center gap-2">
                    {w.name}
                    {w.is_archived && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">مؤرشف</span>}
                  </div>
                  <div className="text-[11px] text-muted-foreground tabular-nums">{formatMoney(balance, w.currency)} · {meta.label}</div>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" onClick={() => setEditing(w)} title="تعديل"><Pencil className="h-4 w-4" /></Button>
                  <Button variant="ghost" size="icon" onClick={() => toggleArchive.mutate(w)} title={w.is_archived ? "إلغاء الأرشفة" : "إيقاف"}>
                    {w.is_archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                  </Button>
                  <Button asChild variant="ghost" size="icon" title="فتح الكشف">
                    <Link to="/app/wallets/$id" params={{ id: w.id }}><ChevronLeft className="h-4 w-4" /></Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={!!editing} onOpenChange={(v) => !v && setEditing(null)}>
        <DialogContent className="max-w-md">
          {editing && <WalletInlineForm initial={editing} onDone={() => { setEditing(null); qc.invalidateQueries({ queryKey: ["wallets-list"] }); }} />}
        </DialogContent>
      </Dialog>
    </Section>
  );
}

function WalletInlineForm({ initial, onDone }: { initial: any; onDone: () => void }) {
  const [name, setName] = useState(initial.name);
  const [type, setType] = useState(initial.type);
  const [currency, setCurrency] = useState(initial.currency);
  const [opening, setOpening] = useState(String(initial.opening_balance));
  const [color, setColor] = useState(initial.color ?? typeMeta(initial.type).color);

  const mut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("wallets").update({
        name: name.trim(), type, currency, opening_balance: parseFloat(opening) || 0, color,
      }).eq("id", initial.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم التحديث"); onDone(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
      <DialogHeader><DialogTitle>تعديل المحفظة</DialogTitle></DialogHeader>
      <Field label="الاسم"><Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} /></Field>
      <Field label="النوع">
        <Select value={type} onValueChange={(v) => { setType(v); setColor(typeMeta(v).color); }}>
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>{WALLET_TYPES.map(t => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}</SelectContent>
        </Select>
      </Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="الرصيد الافتتاحي"><Input type="number" step="0.01" value={opening} onChange={(e) => setOpening(e.target.value)} required dir="ltr" /></Field>
        <Field label="العملة">
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </Field>
      </div>
      <Field label="اللون"><Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-full" /></Field>
      <DialogFooter><Button type="submit" className="w-full" disabled={mut.isPending}>{mut.isPending ? "جاري الحفظ..." : "حفظ"}</Button></DialogFooter>
    </form>
  );
}

// ===================== CATEGORIES =====================
function CategoriesSection() {
  return (
    <Tabs defaultValue="expense" className="space-y-4">
      <TabsList className="bg-card border rounded-xl">
        <TabsTrigger value="expense" className="gap-1.5"><TrendingDown className="h-4 w-4" />فئات المصروف</TabsTrigger>
        <TabsTrigger value="income" className="gap-1.5"><Coins className="h-4 w-4" />فئات الدخل</TabsTrigger>
      </TabsList>
      <TabsContent value="expense"><ExpenseCategoryManager /></TabsContent>
      <TabsContent value="income"><IncomeCategoryManager /></TabsContent>
    </Tabs>
  );
}

function ExpenseCategoryManager() {
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();
  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("created_at")).data ?? [],
  });
  const [name, setName] = useState("");
  const [color, setColor] = useState("#64748b");
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("categories").insert({ user_id: user.id, name: name.trim(), color });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("أُضيفت الفئة"); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("categories").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("تم الحذف"); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <Section title="فئات المصروف" desc="تستخدم في تصنيف عمليات المصروف">
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم فئة جديدة" maxLength={40} />
        <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-14 p-1" />
        <Button onClick={() => add.mutate()} disabled={!name.trim() || add.isPending}><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-1.5">
        {(categories ?? []).map((c: any) => (
          <div key={c.id} className="flex items-center gap-2 rounded-xl border bg-card p-2.5">
            <div className="h-6 w-6 rounded-md" style={{ backgroundColor: c.color ?? "#64748b" }} />
            <div className="flex-1 text-sm">{c.name}</div>
            {c.is_default && <span className="text-[10px] rounded-full bg-accent px-2 py-0.5">افتراضية</span>}
            <Button variant="ghost" size="icon" onClick={() => { if (confirm("حذف الفئة؟")) del.mutate(c.id); }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {(categories ?? []).length === 0 && <EmptyHint icon={<Tags className="h-5 w-5" />} text="لا توجد فئات بعد." />}
      </div>
    </Section>
  );
}

function IncomeCategoryManager() {
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();
  const { data: cats } = useQuery({
    queryKey: ["wallet_tx_categories", "income"],
    queryFn: async () =>
      (await supabase.from("wallet_tx_categories").select("*").eq("kind", "income").order("name")).data ?? [],
  });
  const [name, setName] = useState("");
  const [color, setColor] = useState("#10b981");
  const add = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("wallet_tx_categories").insert({
        user_id: user.id, name: name.trim(), kind: "income", color,
      });
      if (error) throw error;
    },
    onSuccess: () => { setName(""); qc.invalidateQueries({ queryKey: ["wallet_tx_categories", "income"] }); toast.success("أُضيفت الفئة"); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });
  const del = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("wallet_tx_categories").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["wallet_tx_categories", "income"] }); toast.success("تم الحذف"); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  return (
    <Section title="فئات الدخل" desc="مصادر الدخل المستخدمة عند إضافة دخل جديد">
      <div className="flex gap-2">
        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="مثلاً: راتب، عمولات، أرباح..." maxLength={40} />
        <Input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="w-14 p-1" />
        <Button onClick={() => add.mutate()} disabled={!name.trim() || add.isPending}><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-1.5">
        {(cats ?? []).map((c: any) => (
          <div key={c.id} className="flex items-center gap-2 rounded-xl border bg-card p-2.5">
            <div className="h-6 w-6 rounded-md" style={{ backgroundColor: c.color ?? "#10b981" }} />
            <div className="flex-1 text-sm">{c.name}</div>
            {c.is_default && <span className="text-[10px] rounded-full bg-accent px-2 py-0.5">افتراضية</span>}
            <Button variant="ghost" size="icon" disabled={c.is_default} onClick={() => { if (confirm("حذف المصدر؟")) del.mutate(c.id); }}>
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </div>
        ))}
        {(cats ?? []).length === 0 && <EmptyHint icon={<Coins className="h-5 w-5" />} text="لا توجد مصادر دخل مخصصة بعد." />}
      </div>
    </Section>
  );
}

// ===================== CONTACTS =====================
function ContactsSection() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "active" | "archived">("active");

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts", "settings"],
    queryFn: async () => (await supabase.from("contacts").select("id,name,phone,tags,notes").order("name")).data ?? [],
  });

  const toggleArchive = useMutation({
    mutationFn: async (c: any) => {
      const tags: string[] = Array.isArray(c.tags) ? c.tags : [];
      const next = tags.includes("archived") ? tags.filter((t) => t !== "archived") : [...tags, "archived"];
      const { error } = await supabase.from("contacts").update({ tags: next } as any).eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["contacts", "settings"] }); qc.invalidateQueries({ queryKey: ["contacts"] }); toast.success("تم التحديث"); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (contacts as any[]).filter((c) => {
      const isArch = Array.isArray(c.tags) && c.tags.includes("archived");
      if (filter === "active" && isArch) return false;
      if (filter === "archived" && !isArch) return false;
      if (!q) return true;
      return c.name.toLowerCase().includes(q) || (c.phone ?? "").includes(q);
    });
  }, [contacts, search, filter]);

  return (
    <Section
      title="جهات الاتصال"
      desc="بحث وتصفية وأرشفة جهات الاتصال. لإضافة أو تعديل التفاصيل افتح صفحة جهات الاتصال."
      action={
        <Button asChild size="sm" variant="outline">
          <Link to="/app/contacts"><ExternalLink className="h-4 w-4" /> فتح الصفحة</Link>
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="ابحث بالاسم أو الجوال..." className="pr-9" />
        </div>
        <Select value={filter} onValueChange={(v: any) => setFilter(v)}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="active">النشطة فقط</SelectItem>
            <SelectItem value="archived">المؤرشفة</SelectItem>
            <SelectItem value="all">الكل</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5 max-h-[420px] overflow-auto">
        {filtered.length === 0 ? (
          <EmptyHint icon={<ContactIcon className="h-5 w-5" />} text="لا توجد نتائج." />
        ) : (
          filtered.map((c: any) => {
            const isArch = Array.isArray(c.tags) && c.tags.includes("archived");
            return (
              <div key={c.id} className={`flex items-center gap-3 rounded-xl border bg-card p-2.5 ${isArch ? "opacity-60" : ""}`}>
                <div className="grid h-9 w-9 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-white font-bold text-sm shrink-0">
                  {c.name.slice(0, 1)}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate flex items-center gap-2">
                    {c.name}
                    {isArch && <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted">مؤرشف</span>}
                  </div>
                  {c.phone && <div className="text-[11px] text-muted-foreground" dir="ltr">{c.phone}</div>}
                </div>
                <Button variant="ghost" size="icon" onClick={() => toggleArchive.mutate(c)} title={isArch ? "إلغاء الأرشفة" : "أرشفة"}>
                  {isArch ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                </Button>
                <Button asChild variant="ghost" size="icon" title="فتح">
                  <Link to="/app/people/$id" params={{ id: c.id }}><ChevronLeft className="h-4 w-4" /></Link>
                </Button>
              </div>
            );
          })
        )}
      </div>
    </Section>
  );
}

// ===================== ADVANCED PLACEHOLDER =====================
function AdvancedPlaceholder() {
  const items = [
    { icon: Coins, label: "إعدادات الزكاة", desc: "النصاب والعملة المرجعية" },
    { icon: TrendingDown, label: "إعدادات الإهلاك", desc: "طرق الإهلاك للأصول" },
    { icon: RefreshCw, label: "أسعار الصرف", desc: "تحديث تلقائي أو يدوي" },
    { icon: Download, label: "النسخ الاحتياطي", desc: "تصدير واستيراد البيانات" },
  ];
  return (
    <Section title="إعدادات متقدمة" desc="قيد التحضير — ستفعّل في المراحل القادمة">
      <div className="grid gap-2 sm:grid-cols-2">
        {items.map((it) => (
          <div key={it.label} className="flex items-center gap-3 rounded-xl border bg-card/50 p-3 opacity-70">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-muted text-muted-foreground">
              <it.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-sm">{it.label}</div>
              <div className="text-[11px] text-muted-foreground">{it.desc}</div>
            </div>
            <span className="text-[10px] rounded-full bg-muted px-2 py-0.5">قريباً</span>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ===================== Shared bits =====================
function Section({ title, desc, action, children }: { title: string; desc?: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border bg-card p-5 space-y-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">{title}</h3>
          {desc && <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>}
        </div>
        {action}
      </div>
      {children}
    </div>
  );
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="space-y-1.5"><Label className="text-xs text-muted-foreground">{label}</Label>{children}</div>;
}
function EmptyHint({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <div className="rounded-xl border border-dashed p-6 text-center text-sm text-muted-foreground flex flex-col items-center gap-2">
      <div className="grid h-10 w-10 place-items-center rounded-xl bg-accent text-accent-foreground">{icon}</div>
      {text}
    </div>
  );
}

// ===================== ADS =====================
function AdsSection() {
  const { prefs, setPrefs, platform } = useAds();
  const Row = ({ title, desc, value, onChange, disabled }: { title: string; desc: string; value: boolean; onChange: (v: boolean) => void; disabled?: boolean }) => (
    <div className={cn("flex items-start justify-between gap-4 rounded-xl border bg-card/50 p-3", disabled && "opacity-60")}>
      <div className="min-w-0">
        <div className="text-sm font-semibold">{title}</div>
        <div className="text-[11px] text-muted-foreground mt-0.5">{desc}</div>
      </div>
      <Switch checked={value} onCheckedChange={onChange} disabled={disabled} />
    </div>
  );
  return (
    <div className="space-y-4">
      <Section title="إعدادات الإعلانات" desc="تحكم بالإعلانات داخل التطبيق — لن تظهر إعلانات حقيقية الآن، البنية مهيّأة فقط">
        <div className="grid gap-2 sm:grid-cols-2">
          <Row title="تفعيل الإعلانات" desc="عند التفعيل ستظهر الإعلانات في الأماكن المخصصة"
               value={prefs.enabled} onChange={(v) => setPrefs({ enabled: v })} disabled={prefs.premium} />
          <Row title="إعلانات مخصصة" desc="إعلانات أكثر صلة بناءً على اهتماماتك"
               value={prefs.personalized} onChange={(v) => setPrefs({ personalized: v })} disabled={prefs.premium || !prefs.enabled} />
          <Row title="حساب Premium" desc="إخفاء كل الإعلانات لمشتركي النسخة المميزة"
               value={prefs.premium} onChange={(v) => setPrefs({ premium: v })} />
          <Row title="وضع الاختبار" desc="استخدام معرّفات اختبارية رسمية أثناء التطوير"
               value={prefs.testMode} onChange={(v) => setPrefs({ testMode: v })} />
          <Row title="إظهار مساحات تجريبية" desc="عرض مكان الإعلان كقالب فارغ حتى لو كانت الإعلانات معطلة"
               value={prefs.showPlaceholder} onChange={(v) => setPrefs({ showPlaceholder: v })} />
        </div>
        <div className="rounded-xl border border-dashed bg-muted/30 p-3 text-[11px] text-muted-foreground space-y-1">
          <div>المنصة الحالية: <span className="font-semibold text-foreground">{platform}</span></div>
          <div>الأماكن المدعومة: dashboard_top, dashboard_bottom, transactions_inline, reports_bottom, settings_banner, assets_list_bottom, asset_details_bottom, people_bottom, zakat_bottom</div>
          <div>لا يتم تحميل أي SDK أو سكربت خارجي حالياً.</div>
        </div>
      </Section>
      <AdSlot slot="settings_banner" />
    </div>
  );
}
