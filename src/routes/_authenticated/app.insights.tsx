import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { computeFinancialInsights } from "@/lib/insights/engine";
import { formatMoney, formatDate } from "@/lib/format";
import { cn } from "@/lib/utils";
import { FadeIn } from "@/components/motion/FadeIn";
import { StaggerGrid, StaggerItem } from "@/components/motion/StaggerGrid";
import { AdSlot } from "@/components/ads/AdSlot";
import {
  Sparkles,
  Wallet,
  Landmark,
  HandCoins,
  TrendingUp,
  TrendingDown,
  PiggyBank,
  Trophy,
  BadgePercent,
  Bell,
  ArrowDownRight,
  ArrowUpRight,
} from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { CurrencyMap } from "@/lib/insights/types";

export const Route = createFileRoute("/_authenticated/app/insights")({
  head: () => ({ meta: [{ title: "الرؤى المالية — رصد" }] }),
  component: InsightsPage,
});

function InsightsPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["financial-insights"],
    queryFn: computeFinancialInsights,
  });

  if (isLoading || !data) return <SkeletonGrid />;

  const trendCurrency = Object.keys(data.cashFlowTrend)[0];
  const trendData = trendCurrency
    ? data.cashFlowTrend[trendCurrency].map((p) => ({
        month: p.month.slice(5) + "/" + p.month.slice(2, 4),
        الدخل: p.income,
        المصروف: p.expense,
        الصافي: p.net,
      }))
    : [];

  return (
    <div className="space-y-6">
      <FadeIn className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[image:var(--gradient-primary)] text-white shadow-[var(--shadow-elegant)]">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold">الرؤى المالية</h1>
          <p className="text-xs text-muted-foreground">
            قراءة موحّدة لكل محركات رصد — بلا تنبؤ، بلا ذكاء اصطناعي، أرقام فعلية فقط
          </p>
        </div>
      </FadeIn>

      {/* Wealth Summary */}
      <StaggerGrid className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <StaggerItem>
          <Kpi
            icon={Sparkles}
            label="صافي الثروة"
            amounts={data.wealth.netWorth}
            accent="primary"
            signed
          />
        </StaggerItem>
        <StaggerItem>
          <Kpi
            icon={Wallet}
            label="إجمالي النقد"
            amounts={data.wealth.totalCash}
            accent="success"
          />
        </StaggerItem>
        <StaggerItem>
          <Kpi
            icon={Landmark}
            label="إجمالي الأصول"
            amounts={data.wealth.totalAssets}
            accent="primary"
          />
        </StaggerItem>
        <StaggerItem>
          <Kpi
            icon={HandCoins}
            label="إجمالي الديون"
            amounts={data.wealth.totalDebt}
            accent="destructive"
          />
        </StaggerItem>
      </StaggerGrid>

      <AdSlot slot="dashboard_top" />

      {/* Cash Flow */}
      <FadeIn delay={0.05}>
        <Section title="التدفق النقدي" desc="الشهر الحالي">
          <div className="grid gap-3 sm:grid-cols-4 mb-4">
            <MiniStat label="الدخل الشهري" amounts={data.cashFlow.monthlyIncome} tone="positive" />
            <MiniStat
              label="المصروفات الشهرية"
              amounts={data.cashFlow.monthlyExpense}
              tone="negative"
            />
            <MiniStat label="صافي التدفق" amounts={data.cashFlow.netCashFlow} tone="signed" />
            <MiniStat
              label="معدل الادخار"
              amounts={data.cashFlow.savingsRate}
              tone="signed"
              isPercent
            />
          </div>
          {trendData.length > 0 && (
            <div className="h-56">
              <ResponsiveContainer>
                <BarChart data={trendData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="month"
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 11, fill: "var(--color-muted-foreground)" }}
                    orientation="right"
                    axisLine={false}
                    tickLine={false}
                  />
                  <Tooltip
                    contentStyle={{
                      direction: "rtl",
                      borderRadius: 12,
                      border: "1px solid var(--color-border)",
                      background: "var(--color-card)",
                      fontSize: 12,
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <Bar dataKey="الدخل" fill="var(--color-success, #10b981)" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="المصروف" fill="var(--color-destructive)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>
      </FadeIn>

      {/* Investment + Asset Analytics */}
      <div className="grid gap-4 lg:grid-cols-2">
        <FadeIn delay={0.08}>
          <Section title="تحليل الاستثمارات" desc="عبر كل الأصول النشطة">
            <div className="grid grid-cols-2 gap-3 mb-4">
              <MiniStat
                label="إجمالي الاستثمار"
                amounts={data.investments.totalInvested}
                tone="neutral"
              />
              <MiniStat
                label="إجمالي العائد"
                amounts={data.investments.totalReturn}
                tone="signed"
              />
            </div>
            <div className="rounded-xl bg-muted/40 p-3 text-sm mb-3">
              <span className="text-muted-foreground">متوسط العائد على الاستثمار (ROI): </span>
              <span
                className={cn(
                  "font-bold tabular-nums",
                  (data.investments.avgROI ?? 0) >= 0 ? "text-success" : "text-destructive",
                )}
              >
                {data.investments.avgROI === null ? "—" : `${data.investments.avgROI.toFixed(1)}%`}
              </span>
            </div>
            <TopListRow
              icon={Trophy}
              label="أفضل أصل (ROI)"
              item={data.investments.bestAsset}
              tone="positive"
              suffix="%"
            />
            <TopListRow
              icon={TrendingDown}
              label="أسوأ أصل (ROI)"
              item={data.investments.worstAsset}
              tone="negative"
              suffix="%"
            />
          </Section>
        </FadeIn>

        <FadeIn delay={0.1}>
          <Section title="تحليل الأصول" desc="القيمة، الربحية، الإهلاك">
            <TopListRow
              icon={Landmark}
              label="أعلى أصل قيمة"
              item={data.assets.topByValue}
              tone="neutral"
              money
            />
            <TopListRow
              icon={TrendingUp}
              label="أعلى أصل ربحية"
              item={data.assets.topByProfit}
              tone="positive"
              money
            />
            <TopListRow
              icon={TrendingDown}
              label="أكثر أصل استهلاكاً (إهلاك)"
              item={data.assets.mostDepreciated}
              tone="negative"
              money
            />
            <TopListRow
              icon={ArrowDownRight}
              label="أكبر انخفاض بالقيمة السوقية"
              item={data.assets.biggestValueDrop}
              tone="negative"
              money
            />
          </Section>
        </FadeIn>
      </div>

      {/* Debt + Zakat + Reminders */}
      <div className="grid gap-4 lg:grid-cols-3">
        <FadeIn delay={0.12}>
          <Section title="تحليل الديون" desc="مستحقات ومطلوبات">
            <div className="grid grid-cols-2 gap-3 mb-3">
              <MiniStat label="مستحق لي" amounts={data.debts.totalReceivable} tone="positive" />
              <MiniStat label="مستحق عليّ" amounts={data.debts.totalPayable} tone="negative" />
            </div>
            <TopListRow
              icon={ArrowDownRight}
              label="أكبر مدين"
              item={
                data.debts.biggestDebtor
                  ? {
                      name: data.debts.biggestDebtor.name,
                      currency: data.debts.biggestDebtor.currency,
                      value: data.debts.biggestDebtor.amount,
                    }
                  : null
              }
              tone="positive"
              money
            />
            <TopListRow
              icon={ArrowUpRight}
              label="أكبر دائن"
              item={
                data.debts.biggestCreditor
                  ? {
                      name: data.debts.biggestCreditor.name,
                      currency: data.debts.biggestCreditor.currency,
                      value: data.debts.biggestCreditor.amount,
                    }
                  : null
              }
              tone="negative"
              money
            />
          </Section>
        </FadeIn>

        <FadeIn delay={0.14}>
          <Section
            title="تحليل الزكاة"
            desc="آخر احتساب محفوظ"
            action={
              <Link to="/app/zakat" className="text-xs font-medium text-primary hover:underline">
                فتح الحاسبة
              </Link>
            }
          >
            <div className="grid grid-cols-1 gap-3">
              <MiniStat
                label="الوعاء الزكوي"
                amounts={data.zakat.zakatPot}
                tone="neutral"
                icon={BadgePercent}
              />
              <MiniStat
                label="الزكاة المستحقة"
                amounts={data.zakat.zakatDue}
                tone="positive"
                icon={PiggyBank}
              />
            </div>
            <div className="mt-3 rounded-xl bg-muted/40 p-3 text-xs text-muted-foreground space-y-1">
              <div>
                تاريخ الحول القادم:{" "}
                <span className="font-semibold text-foreground">
                  {data.zakat.nextHaulDate ? formatDate(data.zakat.nextHaulDate) : "—"}
                </span>
              </div>
              <div>
                آخر احتساب:{" "}
                <span className="font-semibold text-foreground">
                  {data.zakat.lastCalculatedAt
                    ? formatDate(data.zakat.lastCalculatedAt)
                    : "لم يُحتسب بعد"}
                </span>
              </div>
            </div>
          </Section>
        </FadeIn>

        <FadeIn delay={0.16}>
          <Section
            title="تحليل التذكيرات"
            desc="الأحداث القادمة"
            action={
              <Link to="/app/events" className="text-xs font-medium text-primary hover:underline">
                فتح الأحداث
              </Link>
            }
          >
            <div className="grid grid-cols-1 gap-2.5">
              <ReminderRow
                icon={Bell}
                label="متأخرة"
                count={data.reminders.overdue}
                tone="text-destructive bg-destructive/10"
              />
              <ReminderRow
                icon={Bell}
                label="هذا الأسبوع"
                count={data.reminders.thisWeek}
                tone="text-warning bg-warning/10"
              />
              <ReminderRow
                icon={Bell}
                label="هذا الشهر"
                count={data.reminders.thisMonth}
                tone="text-primary bg-primary/10"
              />
            </div>
          </Section>
        </FadeIn>
      </div>

      <AdSlot slot="reports_bottom" />
    </div>
  );
}

function Kpi({
  icon: Icon,
  label,
  amounts,
  accent,
  signed = false,
}: {
  icon: any;
  label: string;
  amounts: CurrencyMap;
  accent: "primary" | "success" | "destructive";
  signed?: boolean;
}) {
  const entries = Object.entries(amounts).filter(([, v]) => Math.abs(v) > 0.001);
  const accentClass = {
    primary: "text-primary bg-primary/10",
    success: "text-success bg-success/10",
    destructive: "text-destructive bg-destructive/10",
  }[accent];
  return (
    <div className="rounded-3xl border border-border bg-card p-4 sm:p-5 shadow-[var(--shadow-card)]">
      <div className={cn("grid h-10 w-10 place-items-center rounded-2xl", accentClass)}>
        <Icon className="h-5 w-5" />
      </div>
      <p className="mt-3 text-xs font-medium text-muted-foreground">{label}</p>
      <div className="mt-1 space-y-0.5">
        {entries.length === 0 ? (
          <div className="text-xl font-bold text-muted-foreground/50">0</div>
        ) : (
          entries.map(([cur, amt]) => {
            const color = signed
              ? amt > 0
                ? "text-success"
                : amt < 0
                  ? "text-destructive"
                  : "text-foreground"
              : "text-foreground";
            const prefix = signed ? (amt > 0 ? "+" : amt < 0 ? "−" : "") : "";
            return (
              <div key={cur} className={cn("text-xl font-bold tabular-nums tracking-tight", color)}>
                {prefix}
                {formatMoney(Math.abs(amt), cur)}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function Section({
  title,
  desc,
  action,
  children,
}: {
  title: string;
  desc?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)] h-full">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-bold">{title}</h3>
          {desc && <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function MiniStat({
  label,
  amounts,
  tone,
  isPercent = false,
  icon: Icon,
}: {
  label: string;
  amounts: CurrencyMap | Record<string, number>;
  tone: "positive" | "negative" | "signed" | "neutral";
  isPercent?: boolean;
  icon?: any;
}) {
  const entries = Object.entries(amounts).filter(([, v]) => Math.abs(v) > 0.001);
  return (
    <div className="rounded-2xl bg-muted/40 dark:bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        {Icon && <Icon className="h-3.5 w-3.5" />}
        {label}
      </div>
      {entries.length === 0 ? (
        <div className="mt-1 text-base font-bold text-muted-foreground/50">0</div>
      ) : (
        entries.map(([cur, amt]) => {
          const color =
            tone === "positive"
              ? "text-success"
              : tone === "negative"
                ? "text-destructive"
                : tone === "signed"
                  ? amt > 0
                    ? "text-success"
                    : amt < 0
                      ? "text-destructive"
                      : ""
                  : "text-foreground";
          const sign = tone === "signed" ? (amt > 0 ? "+" : amt < 0 ? "−" : "") : "";
          return (
            <div key={cur} className={cn("mt-1 text-base font-bold tabular-nums", color)}>
              {sign}
              {isPercent ? `${Math.abs(amt).toFixed(1)}%` : formatMoney(Math.abs(amt), cur)}
            </div>
          );
        })
      )}
    </div>
  );
}

function TopListRow({
  icon: Icon,
  label,
  item,
  tone,
  money = false,
  suffix = "",
}: {
  icon: any;
  label: string;
  item: { name: string; currency: string; value: number } | null;
  tone: "positive" | "negative" | "neutral";
  money?: boolean;
  suffix?: string;
}) {
  const toneClass =
    tone === "positive"
      ? "text-success"
      : tone === "negative"
        ? "text-destructive"
        : "text-foreground";
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl border border-border/60 p-2.5 mb-2 last:mb-0">
      <div className="flex items-center gap-2 min-w-0">
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="min-w-0">
          <div className="text-[11px] text-muted-foreground">{label}</div>
          <div className="text-sm font-semibold truncate">{item ? item.name : "لا يوجد"}</div>
        </div>
      </div>
      {item && (
        <div className={cn("text-sm font-bold tabular-nums shrink-0", toneClass)}>
          {money ? formatMoney(item.value, item.currency) : `${item.value.toFixed(1)}${suffix}`}
        </div>
      )}
    </div>
  );
}

function ReminderRow({
  icon: Icon,
  label,
  count,
  tone,
}: {
  icon: any;
  label: string;
  count: number;
  tone: string;
}) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-muted/40 dark:bg-muted/20 p-2.5">
      <div className="flex items-center gap-2">
        <div className={cn("grid h-7 w-7 place-items-center rounded-lg", tone)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <span className="text-sm">{label}</span>
      </div>
      <span className="text-sm font-bold tabular-nums">{count}</span>
    </div>
  );
}

function SkeletonGrid() {
  return (
    <div className="space-y-4">
      <div className="h-10 w-56 animate-pulse rounded-md bg-muted" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-28 animate-pulse rounded-3xl bg-muted" />
        ))}
      </div>
      <div className="h-64 animate-pulse rounded-3xl bg-muted" />
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="h-64 animate-pulse rounded-3xl bg-muted" />
        <div className="h-64 animate-pulse rounded-3xl bg-muted" />
      </div>
    </div>
  );
}
