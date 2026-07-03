import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import {
  loadPreferences,
  savePreferences,
  acceptAllPreferences,
  type PreferenceItem,
} from "@/lib/consent/preferences";
import { recordDialogOpened, recordDialogSaved } from "@/lib/beta/session";

export function ConsentPreferencesDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSaved?: () => void;
}) {
  const [items, setItems] = useState<PreferenceItem[]>(() => loadPreferences());

  useEffect(() => {
    if (open) {
      setItems(loadPreferences());
      recordDialogOpened("consent_preferences");
    }
  }, [open]);

  function toggle(id: PreferenceItem["id"], value: boolean) {
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, enabled: value } : i)));
  }

  function save() {
    const choices = Object.fromEntries(
      items.filter((i) => i.editable).map((i) => [i.id, i.enabled]),
    );
    savePreferences(choices);
    recordDialogSaved("consent_preferences");
    toast.success("تم حفظ تفضيلات الخصوصية");
    onSaved?.();
    onOpenChange(false);
  }

  function acceptAll() {
    acceptAllPreferences();
    setItems(loadPreferences());
    recordDialogSaved("consent_preferences");
    toast.success("تم قبول كل التفضيلات");
    onSaved?.();
    onOpenChange(false);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> تفضيلات الخصوصية
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-start justify-between gap-3 rounded-2xl border bg-card p-3.5"
            >
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{item.label}</div>
                <div className="text-[11px] text-muted-foreground mt-0.5">{item.description}</div>
                {!item.editable && (
                  <div className="text-[10px] text-muted-foreground mt-1">
                    مفعّلة دائماً — لا يمكن تعطيلها
                  </div>
                )}
              </div>
              <Switch
                checked={item.enabled}
                disabled={!item.editable}
                onCheckedChange={(v) => toggle(item.id, v)}
              />
            </div>
          ))}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button variant="outline" onClick={acceptAll}>
            قبول الكل
          </Button>
          <Button onClick={save}>حفظ التفضيلات</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
