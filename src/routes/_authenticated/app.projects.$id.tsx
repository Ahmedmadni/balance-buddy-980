import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { ArrowRight, FolderKanban, Trash2 } from "lucide-react";
import { formatMoney, formatDate } from "@/lib/format";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/projects/$id")({
  head: () => ({ meta: [{ title: "تفاصيل المشروع — حسابي" }] }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["project", id],
    queryFn: async () => {
      const [pRes, eRes] = await Promise.all([
        supabase.from("projects").select("*").eq("id", id).single(),
        supabase.from("expenses").select("*, categories(name,color)").eq("project_id", id).order("spent_at", { ascending: false }),
      ]);
      if (pRes.error) throw pRes.error;
      return { project: pRes.data, expenses: eRes.data ?? [] };
    },
  });

  const del = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("projects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("تم الحذف"); qc.invalidateQueries({ queryKey: ["projects-with-totals"] }); navigate({ to: "/app/projects" }); },
  });

  if (isLoading || !data) return <div className="h-40 animate-pulse rounded-2xl bg-muted" />;
  const { project: p, expenses } = data;

  const totalsByCur: Record<string, number> = {};
  for (const e of expenses) totalsByCur[e.currency] = (totalsByCur[e.currency] ?? 0) + Number(e.amount);
  const mainSpend = totalsByCur[p.currency] ?? 0;
  const pct = p.budget ? Math.min(100, (mainSpend / Number(p.budget)) * 100) : 0;

  return (
    <div className="space-y-5">
      <Link to="/app/projects" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowRight className="h-4 w-4 rotate-180" /> رجوع للمشاريع
      </Link>

      <div className="rounded-2xl p-6 text-white shadow-[var(--shadow-elegant)]" style={{ background: `linear-gradient(135deg, ${p.color}, ${p.color}cc)` }}>
        <div className="flex items-center gap-3">
          <FolderKanban className="h-6 w-6" />
          <div>
            <div className="text-2xl font-bold">{p.name}</div>
            {p.description && <div className="text-sm opacity-90 mt-0.5">{p.description}</div>}
          </div>
        </div>
        <div className="mt-5">
          <div className="text-xs opacity-80">إجمالي المصروف</div>
          <div className="text-3xl font-extrabold tabular-nums">{formatMoney(mainSpend, p.currency)}</div>
          {p.budget && (
            <>
              <div className="mt-2 text-xs opacity-90">من ميزانية {formatMoney(p.budget, p.currency)} ({pct.toFixed(0)}%)</div>
              <Progress value={pct} className="mt-2 h-2 bg-white/20" />
            </>
          )}
        </div>
      </div>

      <Button variant="outline" onClick={() => { if (confirm("حذف المشروع؟ (المصاريف ستبقى بدون مشروع)")) del.mutate(); }} className="w-full">
        <Trash2 className="h-4 w-4 text-destructive" /> حذف المشروع
      </Button>

      <div>
        <h3 className="font-semibold mb-2">مصاريف المشروع</h3>
        {expenses.length === 0 ? (
          <div className="rounded-xl border bg-card p-6 text-center text-sm text-muted-foreground">لا توجد مصاريف. أضفها من صفحة المصاريف واختر هذا المشروع.</div>
        ) : (
          <div className="space-y-2">
            {expenses.map((e: any) => (
              <div key={e.id} className="flex items-center gap-3 rounded-xl border bg-card p-3">
                <div className="h-9 w-9 rounded-xl shrink-0" style={{ backgroundColor: (e.categories?.color ?? "#64748b") + "33", border: `1px solid ${e.categories?.color ?? "#64748b"}` }} />
                <div className="flex-1 min-w-0">
                  <div className="font-medium">{e.categories?.name ?? "بدون فئة"}</div>
                  <div className="text-xs text-muted-foreground">{formatDate(e.spent_at)}{e.note ? ` · ${e.note}` : ""}</div>
                </div>
                <div className="font-bold tabular-nums">{formatMoney(e.amount, e.currency)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
