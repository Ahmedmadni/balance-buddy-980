import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, Plus, CalendarClock, Trash2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  computeUpcomingEvents, EVENT_LABEL, PRIORITY_LABEL, PRIORITY_TONE,
  type EventType, type EventPriority, type UpcomingEvent,
} from "@/lib/events/engine";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/app/events")({
  head: () => ({ meta: [{ title: "الأحداث القادمة — رصد" }] }),
  component: EventsPage,
});

const EVENT_TYPES: EventType[] = [
  "payment_due","installment_due","maintenance_due","insurance_expiry",
  "license_expiry","warranty_expiry","review_depreciation","review_market_value",
  "zakat_due","hawl_due","subscription_due","recurring_expense_due","custom",
];

function EventsPage() {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ["upcoming-events"],
    queryFn: () => computeUpcomingEvents({ horizonDays: 365 }),
  });
  const [openNew, setOpenNew] = useState(false);

  const markDone = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("system_events").update({ status: "done" }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["upcoming-events"] }); toast.success("تم الإنهاء"); },
  });
  const removeOne = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("system_events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["upcoming-events"] }); toast.success("تم الحذف"); },
  });

  const sections: { key: keyof NonNullable<typeof data>; label: string; tone: string }[] = [
    { key: "overdue", label: "متأخر", tone: "text-destructive" },
    { key: "today", label: "اليوم", tone: "text-warning" },
    { key: "this_week", label: "هذا الأسبوع", tone: "text-primary" },
    { key: "this_month", label: "هذا الشهر", tone: "text-foreground" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="grid h-11 w-11 place-items-center rounded-2xl bg-[image:var(--gradient-primary)] text-white shadow-[var(--shadow-elegant)]">
            <Bell className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">الأحداث والتذكيرات</h1>
            <p className="text-xs text-muted-foreground">مركز موحّد لجميع الاستحقاقات والمراجعات</p>
          </div>
        </div>
        <Button onClick={() => setOpenNew(true)}><Plus className="h-4 w-4 ml-1" /> حدث جديد</Button>
      </div>

      <Tabs defaultValue="overdue" className="space-y-4">
        <TabsList className="bg-card border rounded-2xl p-1">
          {sections.map((s) => {
            const count = data?.[s.key]?.length ?? 0;
            return (
              <TabsTrigger key={s.key} value={s.key} className="gap-2">
                <span>{s.label}</span>
                <span className="rounded-md bg-muted px-1.5 text-[10px] tabular-nums">{count}</span>
              </TabsTrigger>
            );
          })}
        </TabsList>

        {sections.map((s) => (
          <TabsContent key={s.key} value={s.key}>
            <EventList
              loading={isLoading}
              events={(data?.[s.key] as UpcomingEvent[]) ?? []}
              onDone={(id) => markDone.mutate(id)}
              onDelete={(id) => removeOne.mutate(id)}
            />
          </TabsContent>
        ))}
      </Tabs>

      <NewEventDialog open={openNew} onOpenChange={setOpenNew} onCreated={() => qc.invalidateQueries({ queryKey: ["upcoming-events"] })} />
    </div>
  );
}

function EventList({ events, loading, onDone, onDelete }: { events: UpcomingEvent[]; loading: boolean; onDone: (id: string) => void; onDelete: (id: string) => void; }) {
  if (loading) return <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-muted/40 animate-pulse" />)}</div>;
  if (events.length === 0) return (
    <div className="rounded-3xl border-2 border-dashed border-border p-12 text-center text-sm text-muted-foreground">
      <CalendarClock className="mx-auto mb-2 h-6 w-6" /> لا توجد أحداث في هذه الفترة
    </div>
  );
  return (
    <ul className="space-y-2">
      {events.map((e) => (
        <li key={e.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card p-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold truncate">{e.title}</span>
              <span className={cn("rounded-md border px-1.5 py-0.5 text-[10px] font-medium", PRIORITY_TONE[e.priority])}>
                {PRIORITY_LABEL[e.priority]}
              </span>
            </div>
            <div className="text-[11px] text-muted-foreground mt-0.5">
              {EVENT_LABEL[e.event_type]} · {new Date(e.due_date).toLocaleString("ar")}
              {e.description ? ` · ${e.description}` : ""}
            </div>
          </div>
          {e.source === "system_events" && (
            <div className="flex items-center gap-1 shrink-0">
              <Button size="icon" variant="ghost" onClick={() => onDone(e.id)} title="إنهاء"><CheckCircle2 className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" onClick={() => onDelete(e.id)} title="حذف"><Trash2 className="h-4 w-4" /></Button>
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

function NewEventDialog({ open, onOpenChange, onCreated }: { open: boolean; onOpenChange: (v: boolean) => void; onCreated: () => void; }) {
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [type, setType] = useState<EventType>("custom");
  const [priority, setPriority] = useState<EventPriority>("normal");
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 16));

  const create = useMutation({
    mutationFn: async () => {
      const { data: u } = await supabase.auth.getUser();
      if (!u.user) throw new Error("غير مسجل");
      const { error } = await supabase.from("system_events").insert({
        user_id: u.user.id, event_type: type, title, description: desc || null,
        due_date: new Date(date).toISOString(), priority, status: "pending", metadata: {},
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم إنشاء الحدث");
      onCreated(); onOpenChange(false);
      setTitle(""); setDesc(""); setType("custom"); setPriority("normal");
    },
    onError: (e: any) => toast.error("فشل الإنشاء", { description: e.message }),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader><DialogTitle>إنشاء حدث / تذكير</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label>العنوان</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="مثال: تجديد رخصة السيارة" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>النوع</Label>
              <Select value={type} onValueChange={(v) => setType(v as EventType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {EVENT_TYPES.map((t) => <SelectItem key={t} value={t}>{EVENT_LABEL[t]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>الأولوية</Label>
              <Select value={priority} onValueChange={(v) => setPriority(v as EventPriority)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {(["low","normal","high","critical"] as EventPriority[]).map((p) => <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>تاريخ الاستحقاق</Label>
            <Input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <Label>وصف (اختياري)</Label>
            <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} rows={2} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>إلغاء</Button>
          <Button onClick={() => create.mutate()} disabled={!title || create.isPending}>إنشاء</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
