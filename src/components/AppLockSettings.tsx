import { useEffect, useRef, useState } from "react";
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
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);

  useEffect(() => {
    const c = loadLock();
    setEnabled(!!c); setBio(!!c?.biometric);
    biometricAvailable().then(setBioOk);
  }, []);

  const save = async () => {
    if (saving.current) return;
    if (!isValidPin(p1)) return toast.error("الرمز يجب أن يكون من 4 إلى 8 أرقام");
    if (p1 !== p2) return toast.error("الرمزان غير متطابقين");
    saving.current = true;
    setBusy(true);
    try {
      await setPin(p1, bio && bioOk);
      setEnabled(true); setP1(""); setP2("");
      toast.success("تم تفعيل قفل التطبيق على هذا الجهاز");
    } catch {
      toast.error("تعذر حفظ رمز القفل على هذا الجهاز. حاول مرة أخرى.");
    } finally {
      saving.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 space-y-3">
      <div className="flex items-center gap-2 font-semibold"><Lock className="h-4 w-4" /> قفل التطبيق</div>
      <p className="text-xs text-muted-foreground">
        تُحفظ بصمة مشتقة من رمز القفل على هذا الجهاز، وليس الرمز نفسه. القفل يحمي الواجهة فقط ولا يُشفّر البيانات المالية أو النسخ الاحتياطية.
      </p>
      <div className="grid gap-2 sm:grid-cols-2">
        <Input type="password" inputMode="numeric" maxLength={8} placeholder={enabled ? "رمز جديد" : "رمز الدخول"} value={p1} onChange={(e) => setP1(e.target.value.replace(/\D/g, ""))} />
        <Input type="password" inputMode="numeric" maxLength={8} placeholder="تأكيد الرمز" value={p2} onChange={(e) => setP2(e.target.value.replace(/\D/g, ""))} />
      </div>
      <div className="flex items-center justify-between">
        <span className="text-sm">
          الفتح بالبصمة أو الوجه {!bioOk && <span className="text-xs text-muted-foreground">(متاح في تطبيق أندرويد فقط)</span>}
        </span>
        <Switch checked={bio} disabled={!bioOk || busy} onCheckedChange={(v) => {
          try { if (enabled) setBiometric(v); setBio(v); }
          catch { toast.error("تعذر حفظ إعداد البصمة على هذا الجهاز"); }
        }} />
      </div>
      <div className="flex gap-2">
        <Button onClick={save} disabled={busy}>{busy ? "جارٍ الحفظ..." : enabled ? "تغيير الرمز" : "تفعيل القفل"}</Button>
        {enabled && (
          <Button variant="outline" disabled={busy} onClick={() => {
            try { disableLock(); setEnabled(false); setBio(false); toast.success("تم إيقاف قفل التطبيق"); }
            catch { toast.error("تعذر إيقاف قفل التطبيق على هذا الجهاز"); }
          }}>
            إيقاف القفل
          </Button>
        )}
      </div>
    </div>
  );
}
