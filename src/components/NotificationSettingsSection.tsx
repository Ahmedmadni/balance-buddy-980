import { useState } from "react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Bell, Info, Save, RefreshCw } from "lucide-react";
import {
  loadNotificationSettings,
  saveNotificationSettings,
  CHANNEL_LABEL,
  CHANNEL_AVAILABLE,
  type NotificationSettings,
  type NotificationChannel,
} from "@/lib/notifications/config";
import { processPendingNotifications } from "@/lib/notifications/engine";
import { PRIORITY_LABEL, type EventPriority } from "@/lib/events/engine";
import { toast } from "sonner";

const CHANNELS: NotificationChannel[] = ["local", "push", "email", "sms", "whatsapp"];
const PRIORITIES: EventPriority[] = ["low", "normal", "high", "critical"];

export function NotificationSettingsSection() {
  const [settings, setSettings] = useState<NotificationSettings>(() => loadNotificationSettings());
  const [checking, setChecking] = useState(false);

  function update<K extends keyof NotificationSettings>(k: K, v: NotificationSettings[K]) {
    setSettings((s) => ({ ...s, [k]: v }));
  }
  function toggleChannel(c: NotificationChannel, v: boolean) {
    setSettings((s) => ({ ...s, channels: { ...s.channels, [c]: v } }));
  }
  function save() {
    saveNotificationSettings(settings);
    toast.success("تم حفظ إعدادات الإشعارات");
  }
  async function checkNow() {
    setChecking(true);
    try {
      saveNotificationSettings(settings); // ensure the check uses the values on screen
      const r = await processPendingNotifications();
      if (r.disabled) toast.info("الإشعارات غير مفعّلة");
      else toast.success(`تم الفحص — أُرسل ${r.sent}، تخطي ${r.skipped}، فشل ${r.failed}`);
    } catch (e: any) {
      toast.error("فشل الفحص", { description: e?.message });
    } finally {
      setChecking(false);
    }
  }

  return (
    <div className="space-y-4 mt-3">
      <div className="rounded-2xl border bg-card p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <div>
              <div className="text-sm font-semibold">تفعيل الإشعارات</div>
              <div className="text-[11px] text-muted-foreground">
                المفتاح الرئيسي لمحرك إرسال الإشعارات
              </div>
            </div>
          </div>
          <Switch checked={settings.enabled} onCheckedChange={(v) => update("enabled", v)} />
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="text-sm font-semibold">قنوات الإرسال</div>
        <div className="grid gap-2">
          {CHANNELS.map((c) => (
            <div
              key={c}
              className="flex items-center justify-between gap-2 rounded-xl border bg-card/50 p-2.5"
            >
              <div className="min-w-0">
                <div className="text-xs font-medium">{CHANNEL_LABEL[c]}</div>
                {!CHANNEL_AVAILABLE[c] && (
                  <div className="text-[10px] text-muted-foreground">
                    غير متاح بعد — بنية جاهزة، بانتظار ربط مزوّد حقيقي
                  </div>
                )}
              </div>
              <Switch
                checked={settings.channels[c]}
                onCheckedChange={(v) => toggleChannel(c, v)}
                disabled={!settings.enabled}
              />
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold">ساعات الهدوء</div>
          <Switch
            checked={settings.quietHours.enabled}
            onCheckedChange={(v) => update("quietHours", { ...settings.quietHours, enabled: v })}
            disabled={!settings.enabled}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-xs">من</Label>
            <Input
              type="time"
              value={settings.quietHours.start}
              disabled={!settings.quietHours.enabled}
              onChange={(e) =>
                update("quietHours", { ...settings.quietHours, start: e.target.value })
              }
              dir="ltr"
            />
          </div>
          <div>
            <Label className="text-xs">إلى</Label>
            <Input
              type="time"
              value={settings.quietHours.end}
              disabled={!settings.quietHours.enabled}
              onChange={(e) =>
                update("quietHours", { ...settings.quietHours, end: e.target.value })
              }
              dir="ltr"
            />
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          لا تُرسل إشعارات خلال هذه الفترة، عدا الأحداث ذات الأولوية "حرجة".
        </p>
      </div>

      <div className="rounded-2xl border bg-card p-4 space-y-2">
        <Label className="text-xs">أدنى أولوية للإرسال</Label>
        <Select
          value={settings.priorityFilter}
          onValueChange={(v: EventPriority) => update("priorityFilter", v)}
          disabled={!settings.enabled}
        >
          <SelectTrigger className="h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {PRIORITIES.map((p) => (
              <SelectItem key={p} value={p}>
                {PRIORITY_LABEL[p]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-[11px] text-muted-foreground">
          الأحداث ذات الأولوية الأقل من هذه القيمة لن تُرسَل إشعاراً لها.
        </p>
      </div>

      <div className="rounded-2xl border bg-amber-50/40 dark:bg-amber-950/10 p-3 text-[11px] text-amber-800 dark:text-amber-200 flex gap-2">
        <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
        <span>
          الإشعارات المحلية (على الجهاز) تعمل فعلياً عبر متصفح الويب. Push/Email/SMS/واتساب جاهزة من
          ناحية البنية لكنها بلا مزوّد حقيقي بعد — لن يصلك شيء منها حالياً.
        </span>
      </div>

      <div className="flex gap-2">
        <Button onClick={save} className="flex-1">
          <Save className="h-4 w-4 ml-1" /> حفظ الإعدادات
        </Button>
        <Button onClick={checkNow} variant="outline" disabled={checking}>
          <RefreshCw className={`h-4 w-4 ml-1 ${checking ? "animate-spin" : ""}`} /> فحص الآن
        </Button>
      </div>
    </div>
  );
}
