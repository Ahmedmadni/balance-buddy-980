import { useCallback, useEffect, useRef, useState } from "react";
import { Lock, Fingerprint } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authenticateBiometric, biometricAvailable, loadLock, verifyPin } from "@/lib/security/app-lock";

const RELOCK_AFTER_MS = 60_000;

export function AppLockGate({ children }: { children: React.ReactNode }) {
  const [locked, setLocked] = useState(false);
  const [ready, setReady] = useState(false);
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [bioOk, setBioOk] = useState(false);
  const hiddenAt = useRef<number | null>(null);

  const tryBio = useCallback(async () => {
    const c = loadLock();
    if (!c?.biometric) return;
    if (await authenticateBiometric()) setLocked(false);
  }, []);

  useEffect(() => {
    const c = loadLock();
    setLocked(!!c);
    setReady(true);
    if (c?.biometric) biometricAvailable().then((ok) => { setBioOk(ok); if (ok) tryBio(); });
    const onVis = () => {
      if (document.hidden) hiddenAt.current = Date.now();
      else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS && loadLock()) {
        setLocked(true);
        setPin("");
        tryBio();
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [tryBio]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await verifyPin(pin)) { setLocked(false); setPin(""); setError(""); }
    else { setError("الرمز غير صحيح"); setPin(""); }
  };

  if (!ready) return null;
  if (!locked) return <>{children}</>;
  return (
    <div dir="rtl" className="fixed inset-0 z-[100] flex items-center justify-center bg-background p-6">
      <form onSubmit={submit} className="w-full max-w-xs space-y-4 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary">
          <Lock className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold">رصد مقفل</h1>
        <p className="text-sm text-muted-foreground">أدخل رمز الدخول</p>
        <Input
          type="password" inputMode="numeric" autoFocus maxLength={8} value={pin}
          onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
          className="text-center text-2xl tracking-[0.5em]" aria-label="رمز الدخول"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button type="submit" className="w-full" disabled={pin.length < 4}>فتح</Button>
        {bioOk && (
          <Button type="button" variant="outline" className="w-full" onClick={tryBio}>
            <Fingerprint className="h-4 w-4" /> البصمة أو الوجه
          </Button>
        )}
      </form>
    </div>
  );
}
