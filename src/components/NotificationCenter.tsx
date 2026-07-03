import { useMemo, useState } from "react";
import { Bell, Check, Trash2, Archive, CheckCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { cn } from "@/lib/utils";
import {
  loadNotificationLog,
  bucketNotifications,
  markRead,
  markAllRead,
  archiveNotification,
  deleteNotification,
  type StoredNotification,
} from "@/lib/notifications/store";
import { CHANNEL_LABEL } from "@/lib/notifications/config";
import { PRIORITY_LABEL, PRIORITY_TONE } from "@/lib/events/engine";

const SECTIONS = [
  { key: "unread", label: "غير مقروء" },
  { key: "today", label: "اليوم" },
  { key: "this_week", label: "هذا الأسبوع" },
  { key: "all", label: "الكل" },
] as const;

export function NotificationCenter() {
  const [log, setLog] = useState<StoredNotification[]>(() => loadNotificationLog());
  const refresh = () => setLog(loadNotificationLog());
  const buckets = useMemo(() => bucketNotifications(log), [log]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-xs text-muted-foreground">
          سجل الإشعارات التي حاول المحرّك إرسالها فعلياً (وليس الأحداث نفسها — راجع تبويبات
          "الأحداث" لذلك).
        </p>
        <Button
          size="sm"
          variant="outline"
          onClick={() => {
            markAllRead();
            refresh();
          }}
        >
          <CheckCheck className="h-4 w-4 ml-1" /> تعليم الكل كمقروء
        </Button>
      </div>

      <Tabs defaultValue="unread" className="space-y-3">
        <TabsList className="bg-card border rounded-2xl p-1">
          {SECTIONS.map((s) => (
            <TabsTrigger key={s.key} value={s.key} className="gap-2">
              <span>{s.label}</span>
              <span className="rounded-md bg-muted px-1.5 text-[10px] tabular-nums">
                {buckets[s.key].length}
              </span>
            </TabsTrigger>
          ))}
        </TabsList>
        {SECTIONS.map((s) => (
          <TabsContent key={s.key} value={s.key}>
            <NotificationList
              items={buckets[s.key]}
              onRead={(id) => {
                markRead(id);
                refresh();
              }}
              onArchive={(id) => {
                archiveNotification(id);
                refresh();
              }}
              onDelete={(id) => {
                deleteNotification(id);
                refresh();
              }}
            />
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

function NotificationList({
  items,
  onRead,
  onArchive,
  onDelete,
}: {
  items: StoredNotification[];
  onRead: (id: string) => void;
  onArchive: (id: string) => void;
  onDelete: (id: string) => void;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-3xl border-2 border-dashed border-border p-12 text-center text-sm text-muted-foreground">
        <Bell className="mx-auto mb-2 h-6 w-6" /> لا توجد إشعارات هنا
      </div>
    );
  }
  const statusLabel: Record<StoredNotification["status"], string> = {
    sent: "أُرسل",
    failed: "فشل",
    skipped: "تخطّي",
  };
  const statusTone: Record<StoredNotification["status"], string> = {
    sent: "bg-success/15 text-success",
    failed: "bg-destructive/15 text-destructive",
    skipped: "bg-muted text-muted-foreground",
  };
  return (
    <ul className="space-y-2">
      {items.map((n) => (
        <li
          key={n.id}
          className={cn(
            "flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4",
            n.readAt && "opacity-70",
          )}
        >
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-semibold truncate">{n.title}</span>
              <span
                className={cn(
                  "rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
                  PRIORITY_TONE[n.priority],
                )}
              >
                {PRIORITY_LABEL[n.priority]}
              </span>
              <span className="rounded-md bg-muted px-1.5 py-0.5 text-[10px]">
                {CHANNEL_LABEL[n.channel]}
              </span>
              <span className={cn("rounded-md px-1.5 py-0.5 text-[10px]", statusTone[n.status])}>
                {statusLabel[n.status]}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {new Date(n.createdAt).toLocaleString("ar")}
              {n.body ? ` · ${n.body}` : ""}
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            {!n.readAt && (
              <Button size="icon" variant="ghost" onClick={() => onRead(n.id)} title="تعليم كمقروء">
                <Check className="h-4 w-4" />
              </Button>
            )}
            <Button size="icon" variant="ghost" onClick={() => onArchive(n.id)} title="أرشفة">
              <Archive className="h-4 w-4" />
            </Button>
            <Button size="icon" variant="ghost" onClick={() => onDelete(n.id)} title="حذف">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
