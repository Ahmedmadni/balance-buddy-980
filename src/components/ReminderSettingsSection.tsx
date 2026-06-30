import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Bell, Info, Save } from "lucide-react";
import {
  loadReminderPrefs, saveReminderPrefs, EVENT_LABEL, PRIORITY_LABEL,
  type ReminderPrefs, type EventType, type EventPriority,
} from "@/lib/events/engine";
import { toast } from "sonner";

const RULE_TYPES: EventType[] = [
  "payment_due","recurring_expense_due","maintenance_due","insurance_expiry",
  "license_expiry","warranty_expiry","review_depreciation","review_market_value",
  "zakat_due","hawl_due",
];

export function ReminderSettingsSection() {
  const [prefs, setPrefs] = useState<ReminderPrefs>(() => loadReminderPrefs());

  function update<K extends keyof ReminderPrefs>(k: K, v: ReminderPrefs[K]) {
    setPrefs((p) => ({ ...p, [k]: v }));
  }
  function setRule(t: EventType, p: EventPriority | "default") {
    setPrefs((prev) => {
      const rules = { ...(prev.rules || {}) };
      if (p === "default") delete rules[t]; else rules[t] = p;
      return { ...prev, rules };
    });
  }
  function save() {
    saveReminderPrefs(prefs);
    toast.success("تم حفظ تفضيلات التذكير");
  }

  return (
    <div className="space-y-4 mt-3">
      <div className="rounded-2xl border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <div>
              <div className="text-sm font-semibold">تفعيل التذكيرات</div>
              <div className="text-[11px] text-muted-foreground">تشغيل/إيقاف محرّك الأحداث في الواجهة</div>
            </div>
          </div>
          <Switch checked={prefs.enabled} onCheckedChange={(v) => update("enabled", v)} />
        </div>

        <div>
          <Label className="text-xs">مدّة التذكير (أيام مقدماً)</Label>
          <Input
            type="number" min={1} max={365}
            value={prefs.period_days}
            onChange={(e) => update("period_days", Math.max(1, parseInt(e.target.value) || 30))}
            className="h-9 max-w-32"
          />
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="text-sm font-semibold">قواعد الأولوية لكل نوع</div>
        <div className="grid gap-2">
          {RULE_TYPES.map((t) => (
            <div key={t} className="grid grid-cols-2 items-center gap-2">
              <div className="text-xs">{EVENT_LABEL[t]}</div>
              <Select
                value={prefs.rules?.[t] ?? "default"}
                onValueChange={(v) => setRule(t, v as any)}
              >
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">تلقائي (حسب القرب)</SelectItem>
                  {(["low","normal","high","critical"] as EventPriority[]).map((p) => (
                    <SelectItem key={p} value={p}>{PRIORITY_LABEL[p]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border bg-amber-50/40 dark:bg-amber-950/10 p-3 text-[11px] text-amber-800 dark:text-amber-200 flex gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>هذه التذكيرات تعرض داخل التطبيق فقط — لا يوجد إرسال بريد إلكتروني أو إشعارات Push أو رسائل SMS/WhatsApp في هذه المرحلة.</span>
      </div>

      <Button onClick={save} className="w-full"><Save className="h-4 w-4 ml-1" /> حفظ التفضيلات</Button>
    </div>
  );
}
