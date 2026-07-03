import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Bug, Lightbulb, HelpCircle, Star, Download, Trash2 } from "lucide-react";
import {
  loadBetaFeedback,
  sortBetaFeedback,
  filterBetaFeedback,
  downloadBetaFeedbackJson,
  deleteBetaFeedback,
  FEEDBACK_TYPE_LABEL,
  type FeedbackType,
  type FeedbackSortBy,
} from "@/lib/ux/feedback";

const TYPE_ICON: Record<FeedbackType, React.ComponentType<{ className?: string }>> = {
  bug: Bug,
  suggestion: Lightbulb,
  question: HelpCircle,
  rating: Star,
};

export function BetaFeedbackDashboard() {
  const [entries, setEntries] = useState(() => loadBetaFeedback());
  const [sortBy, setSortBy] = useState<FeedbackSortBy>("newest");
  const [typeFilter, setTypeFilter] = useState<FeedbackType | "all">("all");

  const visible = useMemo(() => {
    const filtered = filterBetaFeedback(entries, typeFilter === "all" ? {} : { type: typeFilter });
    return sortBetaFeedback(filtered, sortBy);
  }, [entries, sortBy, typeFilter]);

  const counts = useMemo(() => {
    const c: Record<FeedbackType, number> = { bug: 0, suggestion: 0, question: 0, rating: 0 };
    for (const e of entries) c[e.type]++;
    return c;
  }, [entries]);

  const avgRating = useMemo(() => {
    const ratings = entries.filter((e) => e.type === "rating" && typeof e.rating === "number");
    if (ratings.length === 0) return null;
    return ratings.reduce((s, e) => s + (e.rating ?? 0), 0) / ratings.length;
  }, [entries]);

  function refresh() {
    setEntries(loadBetaFeedback());
  }

  return (
    <div className="space-y-3">
      <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5">
        <SummaryTile icon={Bug} label="أخطاء" value={counts.bug} />
        <SummaryTile icon={Lightbulb} label="اقتراحات" value={counts.suggestion} />
        <SummaryTile icon={HelpCircle} label="أسئلة" value={counts.question} />
        <SummaryTile icon={Star} label="تقييمات" value={counts.rating} />
        <SummaryTile
          icon={Star}
          label="متوسط التقييم"
          value={avgRating !== null ? `${avgRating.toFixed(1)}/5` : "—"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Select value={sortBy} onValueChange={(v: FeedbackSortBy) => setSortBy(v)}>
          <SelectTrigger className="h-8 w-40 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="newest">الأحدث أولاً</SelectItem>
            <SelectItem value="oldest">الأقدم أولاً</SelectItem>
            <SelectItem value="rating">حسب التقييم</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={(v: FeedbackType | "all") => setTypeFilter(v)}>
          <SelectTrigger className="h-8 w-36 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            {(Object.keys(FEEDBACK_TYPE_LABEL) as FeedbackType[]).map((t) => (
              <SelectItem key={t} value={t}>
                {FEEDBACK_TYPE_LABEL[t]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-xs gap-1.5"
          onClick={() => downloadBetaFeedbackJson(entries)}
          disabled={entries.length === 0}
        >
          <Download className="h-3.5 w-3.5" /> تصدير JSON
        </Button>
        <span className="text-[11px] text-muted-foreground">
          {visible.length} من {entries.length}
        </span>
      </div>

      <div className="space-y-1.5 max-h-80 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed p-4 text-center text-xs text-muted-foreground">
            لا توجد ملاحظات مطابقة
          </div>
        ) : (
          visible.map((e) => {
            const Icon = TYPE_ICON[e.type];
            return (
              <div
                key={e.id}
                className="flex items-start gap-2.5 rounded-xl border bg-card/50 p-2.5 text-xs"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold">{FEEDBACK_TYPE_LABEL[e.type]}</span>
                    {typeof e.rating === "number" && (
                      <span className="text-warning">{"★".repeat(e.rating)}</span>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(e.createdAt).toLocaleString("ar")}
                    </span>
                  </div>
                  {e.message && <div className="text-muted-foreground mt-0.5">{e.message}</div>}
                </div>
                <button
                  type="button"
                  aria-label="حذف الملاحظة"
                  onClick={() => {
                    deleteBetaFeedback(e.id);
                    refresh();
                  }}
                  className="text-muted-foreground hover:text-destructive shrink-0"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

function SummaryTile({
  icon: Icon,
  label,
  value,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
}) {
  return (
    <div className="rounded-2xl bg-muted/40 dark:bg-muted/20 p-3">
      <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-lg font-bold tabular-nums">{value}</div>
    </div>
  );
}
