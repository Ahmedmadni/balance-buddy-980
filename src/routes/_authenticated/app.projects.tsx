import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Plus, FolderKanban } from "lucide-react";
import { CURRENCIES, formatMoney } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/projects")({
  head: () => ({ meta: [{ title: "المشاريع — رصد" }] }),
  component: ProjectsPage,
});

function ProjectsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["projects-with-totals"],
    queryFn: async () => {
      const [pRes, eRes] = await Promise.all([
        supabase.from("projects").select("*").order("created_at", { ascending: false }),
        supabase.from("expenses").select("project_id, amount, currency"),
      ]);
      return { projects: pRes.data ?? [], expenses: eRes.data ?? [] };
    },
  });

  const spendByProject = new Map<string, Record<string, number>>();
  for (const e of data?.expenses ?? []) {
    if (!e.project_id) continue;
    const m = spendByProject.get(e.project_id) ?? {};
    m[e.currency] = (m[e.currency] ?? 0) + Number(e.amount);
    spendByProject.set(e.project_id, m);
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">المشاريع</h1>
          <p className="text-sm text-muted-foreground mt-1">محافظ مستقلة لمصاريف معينة (سيارة، رحلة...)</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild><Button><Plus className="h-4 w-4" /> مشروع</Button></DialogTrigger>
          <DialogContent className="max-w-md">
            <ProjectForm onDone={() => { setOpen(false); qc.invalidateQueries({ queryKey: ["projects-with-totals"] }); }} />
          </DialogContent>
        </Dialog>
      </div>

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2">{[1,2].map(i => <div key={i} className="h-32 animate-pulse rounded-2xl bg-muted" />)}</div>
      ) : (data?.projects ?? []).length === 0 ? (
        <div className="rounded-2xl border bg-card p-10 text-center">
          <FolderKanban className="mx-auto h-10 w-10 text-muted-foreground" />
          <p className="mt-3 text-sm text-muted-foreground">لا توجد مشاريع بعد — أنشئ واحداً لمتابعة مصاريف خاصة</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {data!.projects.map((p: any) => {
            const spends = spendByProject.get(p.id) ?? {};
            const mainSpend = spends[p.currency] ?? 0;
            const pct = p.budget ? Math.min(100, (mainSpend / Number(p.budget)) * 100) : 0;
            return (
              <Link key={p.id} to="/app/projects/$id" params={{ id: p.id }} className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-10 w-10 place-items-center rounded-xl text-white" style={{ backgroundColor: p.color }}>
                      <FolderKanban className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="font-bold">{p.name}</div>
                      {p.description && <div className="text-xs text-muted-foreground line-clamp-1">{p.description}</div>}
                    </div>
                  </div>
                </div>
                <div className="mt-4">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">المصروف</span>
                    <span className="font-bold tabular-nums">{formatMoney(mainSpend, p.currency)}</span>
                  </div>
                  {p.budget && (
                    <>
                      <div className="flex items-center justify-between text-xs text-muted-foreground mt-1">
                        <span>من ميزانية {formatMoney(p.budget, p.currency)}</span>
                        <span>{pct.toFixed(0)}%</span>
                      </div>
                      <Progress value={pct} className="mt-2 h-2" />
                    </>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ProjectForm({ onDone }: { onDone: () => void }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [budget, setBudget] = useState("");
  const [currency, setCurrency] = useState("SAR");
  const [color, setColor] = useState("#0ea5e9");

  const mut = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const { error } = await supabase.from("projects").insert({
        user_id: u.user.id, name: name.trim(), description: description.trim() || null,
        budget: budget ? parseFloat(budget) : null, currency, color,
      });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم إنشاء المشروع"); onDone(); },
    onError: (e: any) => toast.error("خطأ", { description: e.message }),
  });

  const colors = ["#0ea5e9","#22c55e","#f97316","#a855f7","#ef4444","#eab308","#06b6d4","#ec4899"];

  return (
    <form onSubmit={(e) => { e.preventDefault(); mut.mutate(); }} className="space-y-4">
      <DialogHeader><DialogTitle>مشروع جديد</DialogTitle></DialogHeader>
      <div>
        <Label>اسم المشروع</Label>
        <Input value={name} onChange={(e) => setName(e.target.value)} required maxLength={80} placeholder="مثلاً: رحلة دبي، السيارة" />
      </div>
      <div>
        <Label>وصف (اختياري)</Label>
        <Textarea value={description} onChange={(e) => setDescription(e.target.value)} maxLength={300} rows={2} />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>الميزانية (اختياري)</Label>
          <Input type="number" step="0.01" min="0" value={budget} onChange={(e) => setBudget(e.target.value)} dir="ltr" />
        </div>
        <div>
          <Label>العملة</Label>
          <Select value={currency} onValueChange={setCurrency}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>{CURRENCIES.map(c => <SelectItem key={c.code} value={c.code}>{c.name}</SelectItem>)}</SelectContent>
          </Select>
        </div>
      </div>
      <div>
        <Label>اللون</Label>
        <div className="flex gap-2 mt-1.5">
          {colors.map(c => (
            <button type="button" key={c} onClick={() => setColor(c)} className="h-8 w-8 rounded-full border-2 transition" style={{ backgroundColor: c, borderColor: color === c ? "white" : "transparent", outline: color === c ? `2px solid ${c}` : "none" }} />
          ))}
        </div>
      </div>
      <DialogFooter><Button type="submit" className="w-full" disabled={mut.isPending}>إنشاء</Button></DialogFooter>
    </form>
  );
}
