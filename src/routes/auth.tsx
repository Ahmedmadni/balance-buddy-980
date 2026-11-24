import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { authReturnUrl } from "@/lib/auth/session-navigation";
import { supabase } from "@/integrations/supabase/client";
import { isNative } from "@/lib/mobile/platform";
import { runGoogleSignIn } from "@/lib/auth/google-sign-in-flow";
import { Browser } from "@capacitor/browser";
import { nativeGoogleReady, NATIVE_GOOGLE_SETUP_REQUIRED, startNativeGoogleSignIn } from "@/lib/auth/native-oauth";
import { isNativeGoogleSessionVerificationInProgress } from "@/lib/auth/native-google-handoff";
import {
  clearNativeGoogleQuarantine,
  isNativeGoogleQuarantinedOnDevice,
  NATIVE_GOOGLE_QUARANTINE_EVENT,
} from "@/lib/auth/native-google-quarantine";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Wallet } from "lucide-react";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "تسجيل الدخول — رصد" },
      { name: "description", content: "ادخل إلى حسابك في تطبيق رصد عبر جوجل." },
      { property: "og:title", content: "تسجيل الدخول — رصد" },
      { property: "og:description", content: "تسجيل آمن للوصول إلى محافظك وديونك في رصد." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [signInError, setSignInError] = useState<string | null>(null);
  const [nativeMode, setNativeMode] = useState(false);
  const [needsNativeSessionRepair, setNeedsNativeSessionRepair] = useState(false);

  // SSR starts as web; detect the actual native shell after hydration so the
  // login card never promises Android Google OAuth that this build cannot do.
  useEffect(() => {
    // Test-only UI preview: Vite removes DEV-only branches from production.
    // This does NOT mock Capacitor plugins, authentication, or native sessions.
    const previewNativeUI = import.meta.env.DEV &&
      new URLSearchParams(window.location.search).get("__rasdNativeUiTest") === "1";
    setNativeMode(isNative() || previewNativeUI);
    const refresh = () => setNeedsNativeSessionRepair(isNativeGoogleQuarantinedOnDevice());
    refresh();
    window.addEventListener(NATIVE_GOOGLE_QUARANTINE_EVENT, refresh);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      window.removeEventListener(NATIVE_GOOGLE_QUARANTINE_EVENT, refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);
  const signingIn = useRef(false);

  useEffect(() => {
    let active = true;
    let checking = false;
    const verifyAndEnter = async () => {
      if (!active || checking || isNativeGoogleSessionVerificationInProgress()) return;
      checking = true;
      try {
        const { data, error } = await supabase.auth.getUser();
        if (active && !error && data.user) await navigate({ to: "/app", replace: true });
      } finally { checking = false; }
    };
    // Defer auth-server requests outside the auth callback to avoid its internal lock.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session && (event === "SIGNED_IN" || event === "INITIAL_SESSION" || event === "USER_UPDATED")
          && !isNativeGoogleSessionVerificationInProgress()) {
        setTimeout(() => { void verifyAndEnter().catch(() => {}); }, 0);
      }
    });
    void verifyAndEnter().catch(() => {
      if (active) toast.error("تعذّر التحقق من تسجيل الدخول، حاول مرة أخرى");
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, [navigate]);

  async function openWebLogin() {
    try {
      // A safe, external browser session lets existing users access their
      // original account without copying tokens back to this Android WebView.
      await Browser.open({ url: "https://balance-buddy-980.lovable.app/auth" });
    } catch {
      setSignInError("تعذر فتح متصفح الهاتف. افتح balance-buddy-980.lovable.app/auth مباشرةً.");
    }
  }

  async function repairNativeGoogleSession() {
    if (!isNative() || signingIn.current || loading || !isNativeGoogleQuarantinedOnDevice()) return;
    signingIn.current = true;
    setLoading(true);
    setSignInError(null);
    try {
      // scope=local never signs the user out on their other devices. The
      // quarantine stays in place if local cleanup fails or is unconfirmed.
      const result = await supabase.auth.signOut({ scope: "local" });
      if (result.error || !clearNativeGoogleQuarantine(localStorage)) {
        setSignInError("تعذر تنظيف جلسة Google غير المكتملة. سيظل الوصول إلى البيانات محظورًا حتى إتمام الإصلاح.");
        return;
      }
      setNeedsNativeSessionRepair(false);
      toast.success("تم تنظيف الجلسة غير المكتملة. يمكنك تسجيل الدخول مجددًا.");
      await navigate({ to: "/auth", replace: true });
    } catch {
      setSignInError("تعذر تنظيف الجلسة المحلية. تحقق من اتصال الجهاز وأعد المحاولة.");
    } finally {
      signingIn.current = false;
      setLoading(false);
    }
  }

  async function signInNative() {
    if (signingIn.current || !nativeGoogleReady()) return;
    signingIn.current = true;
    setLoading(true);
    setSignInError(null);
    try {
      const result = await startNativeGoogleSignIn();
      if (result.kind === "error") setSignInError(result.message);
      else if (result.kind === "authenticated") await navigate({ to: "/app", replace: true });
      // "opened" is intentionally NOT success: root will validate the returned
      // PKCE code and user before navigating to the financial application.
    } finally {
      signingIn.current = false;
      setLoading(false);
    }
  }

  async function signIn() {
    if (signingIn.current) return;
    signingIn.current = true;
    setLoading(true);
    setSignInError(null);
    try {
      const result = await runGoogleSignIn(isNative(), {
        managedSignIn: () => lovable.auth.signInWithOAuth("google", {
          redirect_uri: authReturnUrl(window.location.origin),
        }),
        verifyUser: async () => {
          const { data, error } = await supabase.auth.getUser();
          return !error && Boolean(data.user);
        },
      });
      if (result.kind === "error") {
        setSignInError(result.message);
        return;
      }
      if (result.kind === "redirected") return;
      await navigate({ to: "/app", replace: true });
    } catch {
      setSignInError("تعذّر إكمال تسجيل الدخول. تحقق من اتصالك وحاول مرة أخرى.");
    } finally {
      signingIn.current = false;
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="w-full max-w-md">
        <Link to="/" className="mb-6 flex items-center justify-center gap-2">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-primary-foreground shadow-[var(--shadow-elegant)]">
            <Wallet className="h-5 w-5" />
          </div>
          <span className="text-xl font-bold">رصد</span>
        </Link>
        <div className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] sm:p-8">
          <h1 className="text-2xl font-bold text-center">مرحباً بك</h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">سجّل الدخول للوصول إلى ديونك ومصاريفك بأمان</p>
          {nativeMode ? (
            <div className="mt-8 space-y-3">
              {needsNativeSessionRepair ? (
                <>
                  <p role="alert" className="text-sm leading-7 text-destructive text-center">
                    توقّفت عملية Google قبل تأكيد الجلسة. حماية بياناتك المالية مفعلة،
                    ولن تُفتح الحسابات حتى حذف الجلسة المحلية غير المكتملة.
                  </p>
                  <Button onClick={repairNativeGoogleSession} disabled={loading} type="button" size="lg" className="w-full">
                    {loading ? "جار إصلاح الجلسة..." : "إصلاح جلسة Google غير المكتملة"}
                  </Button>
                </>
              ) : nativeGoogleReady() ? (
                <>
                  <Button onClick={signInNative} disabled={loading} type="button" size="lg" className="w-full">
                    {loading ? "جار فتح Google..." : "متابعة باستخدام Google داخل التطبيق"}
                  </Button>
                  <p className="text-sm leading-7 text-muted-foreground text-center" role="status">
                    بعد اختيار حساب Google في متصفح الهاتف، سيعود رصد تلقائيًا
                    ويؤكد الجلسة قبل فتح بياناتك.
                  </p>
                </>
              ) : (
                <p className="text-sm leading-7 text-muted-foreground text-center" role="status">
                  {NATIVE_GOOGLE_SETUP_REQUIRED}
                </p>
              )}
              <Button onClick={openWebLogin} type="button" size="lg" variant="outline" className="w-full">
                فتح حساب رصد في المتصفح
              </Button>
              <p className="text-xs leading-6 text-muted-foreground text-center">
                جلسة المتصفح مستقلة ولن تسجّل دخولك إلى تطبيق Android تلقائيًا.
                هذا خيار بديل مؤقت، وليس تسجيلًا داخل التطبيق.
              </p>
            </div>
          ) : (
            <Button onClick={signIn} disabled={loading} type="button" size="lg" className="mt-8 w-full" variant="outline">
              <svg className="h-5 w-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
              متابعة باستخدام جوجل
            </Button>
          )}
          {signInError && <p role="alert" className="mt-4 text-sm leading-7 text-destructive">{signInError}</p>}
          <p className="mt-6 text-center text-xs text-muted-foreground">
            بتسجيلك توافق على حفظ بياناتك بأمان في حسابك السحابي.
          </p>
        </div>
      </div>
    </div>
  );
}
