import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { Bell, ArrowLeft, CalendarClock } from "lucide-react";
import { computeUpcomingEvents, EVENT_LABEL, PRIORITY_TONE, type UpcomingEvent } from "@/lib/events/engine";
import { cn } from "@/lib/utils";

export function UpcomingEventsWidget() {
  const { data, isLoading } = useQuery({
    queryKey: ["upcoming-events", "top5"],
    queryFn: () => computeUpcomingEvents({ horizonDays: 30 }),
  });

  const top: UpcomingEvent[] = [
    ...(data?.overdue ?? []),
    ...(data?.today ?? []),
    ...(data?.this_week ?? []),
    ...(data?.this_month ?? []),
  ].slice(0, 5);

  return (
    <section className="rounded-3xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary/10 text-primary">
            <Bell className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-base font-bold">الأحداث القادمة</h3>
            <p className="text-[11px] text-muted-foreground">أهم 5 تذكيرات</p>
          </div>
        </div>
        <Link to="/app/events" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
          عرض الكل <ArrowLeft className="h-3 w-3" />
        </Link>
      </div>

      {isLoading ? (
        <div className="space-y-2">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-12 rounded-xl bg-muted/40 animate-pulse" />)}</div>
      ) : top.length === 0 ? (
        <div className="rounded-2xl border-2 border-dashed border-border p-6 text-center text-sm text-muted-foreground">
          <CalendarClock className="mx-auto mb-2 h-5 w-5" /> لا توجد أحداث قادمة
        </div>
      ) : (
        <ul className="space-y-2">
          {top.map((e) => (
            <li key={e.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border/60 bg-muted/30 p-3">
              <div className="min-w-0">
                <div className="text-sm font-semibold truncate">{e.title}</div>
                <div className="text-[11px] text-muted-foreground">{EVENT_LABEL[e.event_type]}</div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-[11px] tabular-nums text-muted-foreground">
                  {new Date(e.due_date).toLocaleDateString("ar")}
                </span>
                <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-medium", PRIORITY_TONE[e.priority])}>
                  {e.priority === "critical" ? "حرج" : e.priority === "high" ? "عاجل" : e.priority === "low" ? "هادئ" : "عادي"}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
