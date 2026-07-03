import { createFileRoute, Link } from "@tanstack/react-router";
import { auditUserDataExport } from "@/lib/compliance/data-export-audit";
import { LegalPageShell, LegalSection } from "@/components/legal/LegalPageShell";
import { Button } from "@/components/ui/button";
import { CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/legal/data-export")({
  head: () => ({
    meta: [
      { title: "تصدير بياناتك — رصد" },
      {
        name: "description",
        content: "كيف تصدّر نسخة كاملة من بياناتك في تطبيق رصد، وما الذي يغطّيه التصدير فعلياً.",
      },
    ],
  }),
  component: DataExportPage,
});

const STATUS_TONE: Record<string, string> = {
  ok: "border-success/30 bg-success/5",
  warning: "border-warning/30 bg-warning/5",
  error: "border-destructive/30 bg-destructive/5",
};

function StatusIcon({ status }: { status: string }) {
  if (status === "ok") return <CheckCircle2 className="h-3.5 w-3.5 text-success" />;
  if (status === "warning") return <AlertTriangle className="h-3.5 w-3.5 text-warning" />;
  return <XCircle className="h-3.5 w-3.5 text-destructive" />;
}

function DataExportPage() {
  const audit = auditUserDataExport();

  return (
    <LegalPageShell title="تصدير بياناتك" generatedAt={audit.generatedAt}>
      <LegalSection
        title="حقّك في تصدير بياناتك"
        body="يمكنك تصدير نسخة كاملة من بياناتك المالية المخزَّنة في حسابك (المحافظ، العمليات، المصاريف، الديون، الأصول، الزكاة) بصيغة JSON أو Excel أو CSV في أي وقت، من دون التواصل مع الدعم."
      />

      <div className="rounded-2xl border bg-card p-4">
        <div className="text-sm font-semibold">خطوات التصدير</div>
        <ol className="mt-2 list-decimal ps-5 text-sm text-muted-foreground space-y-1">
          <li>سجّل الدخول إلى حسابك في التطبيق.</li>
          <li>افتح الإعدادات ← تبويب «النسخ الاحتياطي».</li>
          <li>اختر النطاق (كامل/مالي/أصول/تقارير) وصيغة الملف، ثم اضغط تصدير.</li>
        </ol>
        <Button asChild size="sm" className="mt-3">
          <Link to="/app/settings">فتح الإعدادات</Link>
        </Button>
      </div>

      <div>
        <div className="text-sm font-semibold mb-2">ما الذي يغطّيه التصدير فعلياً الآن</div>
        <div className="grid gap-2 sm:grid-cols-2">
          {audit.items.map((item) => (
            <div
              key={item.id}
              className={cn("rounded-xl border p-3 text-xs space-y-1", STATUS_TONE[item.status])}
            >
              <div className="flex items-center justify-between">
                <span className="font-semibold">{item.label}</span>
                <StatusIcon status={item.status} />
              </div>
              <div className="text-muted-foreground">{item.detail}</div>
            </div>
          ))}
        </div>
      </div>
    </LegalPageShell>
  );
}
