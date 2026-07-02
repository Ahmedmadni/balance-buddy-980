// =============================================================
// Compact dashboard widgets sourced from computeFinancialInsights():
// Net Worth, Cash Flow, Investment Performance, Zakat Status.
// "Upcoming Events" is already covered by UpcomingEventsWidget.
// Read-only — links out to /app/insights and /app/zakat for detail.
// =============================================================
import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { computeFinancialInsights } from "@/lib/insights/engine";
import { formatMoney, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Sparkles, Wallet, TrendingUp, BadgePercent, ChevronLeft } from "lucide-react";
import type { CurrencyMap } from "@/lib/insights/types";

function firstEntries(m: CurrencyMap) {
  return Object.entries(m).filter(([, v]) => Math.abs(v) > 0.001);
}

export function WealthOverviewWidgets() {
  const { data, isLoading } = useQuery({
    queryKey: ["financial-insights"],
    queryFn: computeFinancialInsights,
  });

  if (isLoading || !data) {
    return (
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-3xl bg-muted" />
        ))}
      </div>
    );
  }

  const netWorthEntries = firstEntries(data.wealth.netWorth);
  const netEntries = firstEntries(data.cashFlow.netCashFlow);
  const roi = data.investments.avgROI;

  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      <Widget to="/app/insights" icon={Sparkles} accent="primary" title="صافي الثروة">
        {netWorthEntries.length === 0 ? (
          <Empty />
        ) : (
          netWorthEntries.map(([c, v]) => (
            <div
              key={c}
              className={cn(
                "text-lg font-bold tabular-nums",
                v >= 0 ? "text-foreground" : "text-destructive",
              )}
            >
              {formatMoney(v, c)}
            </div>
          ))
        )}
      </Widget>

      <Widget
        to="/app/insights"
        icon={Wallet}
        accent="success"
        title="صافي التدفق النقدي"
        sub="هذا الشهر"
      >
        {netEntries.length === 0 ? (
          <Empty />
        ) : (
          netEntries.map(([c, v]) => (
            <div
              key={c}
              className={cn(
                "text-lg font-bold tabular-nums",
                v >= 0 ? "text-success" : "text-destructive",
              )}
            >
              {v >= 0 ? "+" : "−"}
              {formatMoney(Math.abs(v), c)}
            </div>
          ))
        )}
      </Widget>

      <Widget
        to="/app/insights"
        icon={TrendingUp}
        accent="primary"
        title="أداء الاستثمارات"
        sub="متوسط ROI"
      >
        <div
          className={cn(
            "text-lg font-bold tabular-nums",
            (roi ?? 0) >= 0 ? "text-success" : "text-destructive",
          )}
        >
          {roi === null ? "لا يوجد" : `${roi.toFixed(1)}%`}
        </div>
      </Widget>

      <Widget
        to="/app/zakat"
        icon={BadgePercent}
        accent="success"
        title="حالة الزكاة"
        sub={data.zakat.nextHaulDate ? `الحول: ${formatDate(data.zakat.nextHaulDate)}` : undefined}
      >
        {firstEntries(data.zakat.zakatDue).length === 0 ? (
          <Empty text="لم يُحتسب بعد" />
        ) : (
          firstEntries(data.zakat.zakatDue).map(([c, v]) => (
            <div key={c} className="text-lg font-bold tabular-nums">
              {formatMoney(v, c)}
            </div>
          ))
        )}
      </Widget>
    </div>
  );
}

function Widget({
  to,
  icon: Icon,
  accent,
  title,
  sub,
  children,
}: {
  to: string;
  icon: any;
  accent: "primary" | "success";
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  const accentClass =
    accent === "primary" ? "text-primary bg-primary/10" : "text-success bg-success/10";
  return (
    <Link
      to={to}
      className="group rounded-3xl border border-border bg-card p-4 shadow-[var(--shadow-card)] transition-all hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]"
    >
      <div className="flex items-start justify-between">
        <div className={cn("grid h-9 w-9 place-items-center rounded-xl", accentClass)}>
          <Icon className="h-4 w-4" />
        </div>
        <ChevronLeft className="h-4 w-4 text-muted-foreground/50 transition-transform group-hover:-translate-x-0.5" />
      </div>
      <p className="mt-2.5 text-xs font-medium text-muted-foreground">{title}</p>
      <div className="mt-0.5">{children}</div>
      {sub && <p className="mt-1 text-[10px] text-muted-foreground">{sub}</p>}
    </Link>
  );
}

function Empty({ text = "0" }: { text?: string }) {
  return <div className="text-lg font-bold text-muted-foreground/50">{text}</div>;
}
