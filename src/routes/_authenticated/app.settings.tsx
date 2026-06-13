import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { CURRENCIES } from "@/lib/format";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/settings")({
  head: () => ({ meta: [{ title: "الإعدادات — حسابي" }] }),
  component: SettingsPage,
});

function SettingsPage() {
  const qc = useQueryClient();
  const { user } = Route.useRouteContext();

  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => (await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle()).data,
  });

  const { data: categories } = useQuery({
    queryKey: ["categories"],
    queryFn: async () => (await supabase.from("categories").select("*").order("created_at")).data ?? [],
  });

  const [displayName, setDisplayName] = useState("");
  const [defaultCurrency, setDefaultCurrency] = useState("SAR");
  useEffect(() => {
    if (profile) { setDisplayName(profile.display_name ?? ""); setDefaultCurrency(profile.default_currency ?? "SAR"); }
  }, [profile]);

  const saveProfile = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("profiles").update({ display_name: displayName, default_currency: defaultCurrency }).eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحفظ"); qc.invalidateQueries({ queryKey: ["profile"] }); },
  });

  const [newCat, setNewCat] = useState("");
  const [newColor, setNewColor] = useState("#64748b");
  const addCat = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("categories").insert({ user_id: user.id, name: newCat.trim(), color: newColor });
      if (error) throw error;
    },
    onSuccess: () => { setNewCat(""); qc.invalidateQueries({ queryKey: ["categories"] }); toast.success("أُضيفت الفئة"); },
  });
  const delCat = useMutation({
    mutationFn: async (id: string) => { const { error } = await supabase.from("categories").delete().eq("id", id); if (error) throw error; },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["categories"] }),
  });

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-bold">الإعدادات</h1>
        <p className="text-sm text-muted-foreground mt-1">حسابك وتفضيلاتك</p>
      </div>

      <div className="rounded-2xl border bg-card p-5 space-y-4">
        <h3 className="font-semibold">الملف الشخصي</h3>
        <div><Label>الاسم</Label><Input value={displayName} onChange={(e) => setDisplayName(e.target.value)} maxLength={80} /></div>
        <div>
          <Label>العملة الافتراضية</Label>
          <Select value={defaultCurrency} onValueChange={setDefaultCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name} ({c.symbol})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <Button onClick={() => saveProfile.mutate()} disabled={saveProfile.isPending}>حفظ</Button>
      </div>

      <div className="rounded-2xl border bg-card p-5 space-y-3">
        <h3 className="font-semibold">فئات المصاريف</h3>
        <div className="flex gap-2">
          <Input value={newCat} onChange={(e) => setNewCat(e.target.value)} placeholder="اسم فئة جديدة" maxLength={40} />
          <Input type="color" value={newColor} onChange={(e) => setNewColor(e.target.value)} className="w-14 p-1" />
          <Button onClick={() => addCat.mutate()} disabled={!newCat.trim() || addCat.isPending}><Plus className="h-4 w-4" /></Button>
        </div>
        <div className="space-y-1.5">
          {(categories ?? []).map((c) => (
            <div key={c.id} className="flex items-center gap-2 rounded-xl border p-2">
              <div className="h-6 w-6 rounded-md" style={{ backgroundColor: c.color ?? "#64748b" }} />
              <div className="flex-1 text-sm">{c.name}</div>
              {c.is_default && <span className="text-[10px] rounded-full bg-accent px-2 py-0.5">افتراضية</span>}
              <Button variant="ghost" size="icon" onClick={() => delCat.mutate(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-5 space-y-2">
        <h3 className="font-semibold">حول التطبيق</h3>
        <p className="text-sm text-muted-foreground">يمكنك تثبيت التطبيق على شاشتك الرئيسية من قائمة المتصفح ("إضافة إلى الشاشة الرئيسية") ليعمل كتطبيق أصلي.</p>
      </div>
    </div>
  );
}
