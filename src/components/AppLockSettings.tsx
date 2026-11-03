import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { biometricAvailable, disableLock, isValidPin, loadLock, setBiometric, setPin } from "@/lib/security/app-lock";

export function AppLockSettings() {
  const [enabled, setEnabled] = useState(false);
  const [bio, setBio] = useState(false);
  const [bioOk, setBioOk] = useState(false);
  const [p1, setP1] = useState("");
  const [p2, setP2] = useState("");

  useEffect(() => {
    const c = loadLock();
    setEnabled(!!c); setBio(!!c?.biometric);
    biometricAvailable().then(setBioOk);
  }, []);

  const save = async () => {
    if (!isValidPin(p1)) return toast.error("الرمز يجب أن يكون من 4 إلى 8 أرقام");
    if (p1 !== p2) return toast.error("الرمزان غير متطابقين");
    await setPin(p1, bio && bioOk);
    setEnabled(true); setP1(""); setP2("");
    toast.success("تم تفعيل قفل التطبيق على هذا الجهاز");
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4" /> قفل التطبيق</div>
      <p className="text-xs text-muted-foreground">
        يُحفظ الرمز مشفّراً على هذا الجهاز فقط ولا يُرسل إلى أي خادم. يُطلب عند فتح التطبيق وبعد دقيقة من الخروج منه.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input type="password" inputMode="numeric" maxLength={8} placeholder={enabled ? "رمز جديد" : "رمز الدخول"} value={p1} onChange={(e) => setP1(e.target.value.replace(/\D/g, ""))} />
        <Input type="password" inputMode="numeric" maxLength={8} placeholder="تأكيد الرمز" value={p2} onChange={(e) => setP2(e.target.value.replace(/\D/g, ""))} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm">
          الفتح بالبصمة أو الوجه {!bioOk && <span className="text-xs text-muted-foreground">(متاح في تطبيق أندرويد فقط)</span>}
        </span>
        <Switch checked={bio} disabled={!bioOk} onCheckedChange={(v) => { setBio(v); if (enabled) setBiometric(v); }} />
      </div>
      <div className="flex gap-2">
        <Button onClick={save}>{enabled ? "تغيير الرمز" : "تفعيل القفل"}</Button>
        {enabled && (
          <Button variant="outline" onClick={() => { disableLock(); setEnabled(false); setBio(false); toast.success("تم إيقاف قفل التطبيق"); }}>
            إيقاف القفل
          </Button>
        )}
      </div>
    </div>
  );
}
