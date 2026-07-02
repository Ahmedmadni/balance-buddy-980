import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  ShieldCheck,
  RefreshCw,
  Sparkles,
  CalendarClock,
  Package,
  TrendingUp,
  FileDown,
  ExternalLink,
} from "lucide-react";
import { toast } from "sonner";
import {
  verifyDatabase,
  rebuildCache,
  recomputeInsights,
  recomputeEvents,
  validateAssets,
  validateInvestments,
  buildDiagnosticReport,
  downloadDiagnosticReport,
} from "@/lib/system/recovery";
import { captureApplicationError } from "@/lib/system/errors";

type ToolKey = "verify" | "cache" | "insights" | "events" | "assets" | "investments" | "report";

export function SystemToolsSection() {
  const qc = useQueryClient();
  const [running, setRunning] = useState<ToolKey | null>(null);

  async function run(key: ToolKey, fn: () => Promise<void>) {
    setRunning(key);
    try {
      await fn();
    } catch (e) {
      captureApplicationError(e, "runtime", { scope: `system_tool:${key}` });
      toast.error("فشلت العملية", { description: e instanceof Error ? e.message : String(e) });
    } finally {
      setRunning(null);
    }
  }

  const tools: {
    key: ToolKey;
    icon: any;
    title: string;
    desc: string;
    action: () => Promise<void>;
  }[] = [
    {
      key: "verify",
      icon: ShieldCheck,
      title: "Verify Database",
      desc: "فحص صحي شامل لقاعدة البيانات والمزامنة",
      action: async () => {
        const r = await verifyDatabase();
        qc.setQueryData(["system-health"], r);
        toast.success("اكتمل الفحص", {
          description: r.status === "ok" ? "كل شيء سليم" : `الحالة: ${r.status}`,
        });
      },
    },
    {
      key: "cache",
      icon: RefreshCw,
      title: "Rebuild Cache",
      desc: "تفريغ وإعادة بناء ذاكرة التطبيق المؤقتة (React Query)",
      action: async () => {
        rebuildCache(qc);
        toast.success("تم تفريغ الذاكرة المؤقتة");
      },
    },
    {
      key: "insights",
      icon: Sparkles,
      title: "Recompute Insights",
      desc: "إعادة حساب الرؤى المالية من جديد",
      action: async () => {
        await recomputeInsights(qc);
        toast.success("تم تحديث الرؤى المالية");
      },
    },
    {
      key: "events",
      icon: CalendarClock,
      title: "Recompute Events",
      desc: "إعادة حساب الأحداث والتذكيرات القادمة",
      action: async () => {
        await recomputeEvents(qc);
        toast.success("تم تحديث الأحداث");
      },
    },
    {
      key: "assets",
      icon: Package,
      title: "Validate Assets",
      desc: "فحص المكونات اليتيمة والتقييمات المفقودة وملفات الإهلاك",
      action: async () => {
        const r = await validateAssets();
        toast[r.issues.length ? "warning" : "success"](
          r.issues.length ? `${r.issues.length} ملاحظة` : "لا توجد مشاكل",
          { description: `${r.checked} أصل تم فحصه` },
        );
      },
    },
    {
      key: "investments",
      icon: TrendingUp,
      title: "Validate Investments",
      desc: "إعادة حساب أداء كل استثمار والتحقق من صحة النتائج",
      action: async () => {
        const r = await validateInvestments();
        toast[r.issues.length ? "warning" : "success"](
          r.issues.length ? `${r.issues.length} ملاحظة` : "لا توجد مشاكل",
          { description: `${r.checked} استثمار تم فحصه` },
        );
      },
    },
    {
      key: "report",
      icon: FileDown,
      title: "Export Diagnostic Report",
      desc: "تصدير تقرير تشخيصي كامل (JSON) يشمل الصحة والسلامة والأداء",
      action: async () => {
        const r = await buildDiagnosticReport();
        downloadDiagnosticReport(r);
        toast.success("تم تصدير التقرير");
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border bg-card p-4">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold text-sm">أدوات الاستعادة والتشخيص</h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              كل الأدوات هنا قراءة فقط أو تُعيد حساب بيانات محلية — لا تحذف أو تعدّل أي عمليات مالية
            </p>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/app/system">
              لوحة التشخيص الكاملة <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-2.5 sm:grid-cols-2">
        {tools.map((t) => (
          <div key={t.key} className="flex items-start gap-3 rounded-2xl border bg-card p-3.5">
            <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <t.icon className="h-4 w-4" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold">{t.title}</div>
              <div className="text-[11px] text-muted-foreground mt-0.5">{t.desc}</div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled={running !== null}
              onClick={() => run(t.key, t.action)}
            >
              {running === t.key ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : "تشغيل"}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
