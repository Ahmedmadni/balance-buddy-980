import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isNativeGoogleSessionVerificationInProgress } from "@/lib/auth/native-google-handoff";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  LayoutDashboard, Wallet, FileBarChart, Settings, LogOut, Menu, Landmark,
  Contact, Repeat, TrendingUp, HandCoins, Receipt, BadgePercent, Bell, Sparkles,
  Eye, EyeOff, TrendingDown,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { ThemeToggle } from "@/components/ThemeToggle";
import { PageTransition } from "@/components/motion/PageTransition";
import { AppLockGate } from "@/components/AppLockGate";
import { cn } from "@/lib/utils";
import { useEffect, useRef, useState } from "react";
import { processPendingNotifications } from "@/lib/notifications/engine";
import { Capacitor } from "@capacitor/core";
import { syncNativeReminders, clearNativeReminders } from "@/lib/notifications/native-scheduler";
import { trackBetaSession, recordPageVisit, finalizeCurrentPage } from "@/lib/beta/session";
import { usePrivacy } from "@/hooks/use-privacy";
import { toast } from "sonner";

function PrivacyToggle() {
  const [on, toggle] = usePrivacy();
  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={on ? "إظهار الأرصدة" : "إخفاء الأرصدة"}
      title={on ? "إظهار الأرصدة" : "إخفاء الأرصدة"}
      className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-primary hover:border-primary/30"
    >
      {on ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
    </button>
  );
}


export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    // Do not allow a cached, not-yet-verified native Google session to unlock
    // financial routes, even after a WebView kill/relaunch or sign-out failure.
    if (isNativeGoogleSessionVerificationInProgress()) throw redirect({ to: "/auth" });
    const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
    if (isNativeGoogleSessionVerificationInProgress() || sessionError || !sessionData.session)
      throw redirect({ to: "/auth" });

    const { data, error } = await supabase.auth.getUser(sessionData.session.access_token);
    if (isNativeGoogleSessionVerificationInProgress() || error || !data.user)
      throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppLayout,
});

const NAV = [
  { to: "/app", icon: LayoutDashboard, label: "الرئيسية", exact: true },
  { to: "/app/people", icon: HandCoins, label: "الديون" },
  { to: "/app/wallets", icon: Landmark, label: "المحافظ" },
  { to: "/app/expenses", icon: Receipt, label: "المصاريف" },
  { to: "/app/recurring", icon: Repeat, label: "المصاريف الدورية" },
  { to: "/app/investments", icon: TrendingUp, label: "الاستثمارات" },
  { to: "/app/depreciation", icon: TrendingDown, label: "سجل الإهلاك" },
  { to: "/app/zakat", icon: BadgePercent, label: "الزكاة" },
  { to: "/app/reports", icon: FileBarChart, label: "التقارير" },
  { to: "/app/events", icon: Bell, label: "الأحداث" },
  { to: "/app/contacts", icon: Contact, label: "جهات الاتصال" },
  { to: "/app/insights", icon: Sparkles, label: "الرؤى المالية" },
];

const BOTTOM_NAV = [
  NAV[0], NAV[1], NAV[2], NAV[3], NAV[8],
];

function NavLinks({ onClick }: { onClick?: () => void }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <nav className="flex flex-col gap-1">
      {NAV.map((n) => {
        const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
        return (
          <Link
            key={n.to}
            to={n.to}
            onClick={onClick}
            className={cn(
              "group flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all",
              active
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent/60 hover:text-foreground"
            )}
          >
            <n.icon className={cn("h-[18px] w-[18px] transition-transform", active && "scale-105")} />
            <span>{n.label}</span>
            {active && <span className="ms-auto h-1.5 w-1.5 rounded-full bg-primary" />}
          </Link>
        );
      })}
    </nav>
  );
}

function AppLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const signingOut = useRef(false);
  const { user } = Route.useRouteContext();
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  // Foreground-only notification tick — no cron/background worker. Runs once
  // on layout mount and every 5 minutes while the app stays open; a no-op
  // when notifications are disabled in Settings (see engine.ts).
  useEffect(() => {
    const tick = () => {
      if (signingOut.current) return;
      if (Capacitor.isNativePlatform()) void syncNativeReminders(user.id).catch(() => {});
      else void processPendingNotifications().catch(() => {});
    };
    tick();
    const id = setInterval(tick, 10 * 60 * 1000);
    const onResume = () => { if (!document.hidden) tick(); };
    document.addEventListener("visibilitychange", onResume);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onResume); };
  }, [user.id]);

  async function signOut() {
    if (signingOut.current) return;
    signingOut.current = true;
    try {
      // Stop new reminders from this layout before waiting for the native
      // queue to cancel any schedules already in progress.
      await qc.cancelQueries();
      // A failed Android OS cancellation must never prevent signing out of
      // a financial account. The global auth listener retries cleanup.
      let reminderClearFailed = false;
      if (Capacitor.isNativePlatform()) {
        // A remote reminder sync may be waiting on a stalled connection.
        // Attempt OS cleanup, but never hold financial account logout forever.
        let cancellationTimeout: ReturnType<typeof setTimeout> | undefined;
        try {
          await Promise.race([
            clearNativeReminders(),
            new Promise<never>((_, reject) => {
              cancellationTimeout = setTimeout(() => reject(new Error("cancel_timeout")), 5000);
            }),
          ]);
        } catch {
          reminderClearFailed = true;
        } finally {
          if (cancellationTimeout) clearTimeout(cancellationTimeout);
        }
      }
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      qc.clear();
      await navigate({ to: "/auth", replace: true });
      if (reminderClearFailed) {
        toast.warning("تم تسجيل الخروج، لكن قد تبقى تنبيهات Android سابقة", {
          description: "يمكنك مراجعة إشعارات رصد في إعدادات الهاتف.",
        });
      }
    } catch {
      signingOut.current = false;
      toast.error("تعذر تسجيل الخروج بالكامل", {
        description: "تحقق من الاتصال وأعد المحاولة. لم يتم تأكيد إغلاق الجلسة.",
      });
    }
  }

  const pathname = useRouterState({ select: (s) => s.location.pathname });

  // Local-only Beta session/usage tracker (localStorage) — no analytics SDK,
  // no network call. See src/lib/beta/session.ts.
  useEffect(() => {
    trackBetaSession();
    const onBeforeUnload = () => finalizeCurrentPage();
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);
  useEffect(() => {
    recordPageVisit(pathname);
  }, [pathname]);

  return (
    <div className="min-h-screen bg-muted/30 dark:bg-background">
      {/* Sidebar (right, RTL) */}
      <aside className="fixed inset-y-0 right-0 z-20 hidden w-64 border-l border-border bg-card md:flex md:flex-col">
        <div className="flex items-center gap-3 px-5 py-5">
          <div className="grid h-10 w-10 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-lg shadow-primary/20">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <div className="text-lg font-bold leading-tight">رصد</div>
            <div className="text-[11px] text-muted-foreground">إدارة مالية شخصية</div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-3 pb-3">
          <NavLinks />
        </div>

        <div className="border-t border-border p-3 space-y-3">
          <div className="flex items-center justify-between gap-2 rounded-2xl bg-muted/50 dark:bg-muted/30 p-2 pe-3">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-9 w-9 rounded-xl object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground text-xs font-bold">
                {(profile?.display_name ?? user.email ?? "U").slice(0, 1).toUpperCase()}
              </div>
            )}
            <div className="flex-1 overflow-hidden min-w-0">
              <div className="truncate text-sm font-semibold">{profile?.display_name ?? "مستخدم"}</div>
              <div className="truncate text-[11px] text-muted-foreground">{user.email}</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to="/app/settings"
              className={cn(
                "inline-flex h-9 flex-1 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm text-muted-foreground hover:text-primary hover:border-primary/30 transition-colors",
                pathname.startsWith("/app/settings") && "text-primary border-primary/40"
              )}
            >
              <Settings className="h-4 w-4" /> الإعدادات
            </Link>
            <ThemeToggle />
            <button
              type="button"
              onClick={signOut}
              aria-label="تسجيل الخروج"
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl border border-border bg-card text-muted-foreground transition-colors hover:text-destructive hover:border-destructive/30"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b border-border bg-card/80 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <Wallet className="h-5 w-5" />
          </div>
          <span className="font-bold">رصد</span>
        </div>
        <div className="flex items-center gap-2">
          <PrivacyToggle />
          <ThemeToggle />

          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon"><Menu /></Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-72 bg-card">
              <div className="mt-6"><NavLinks onClick={() => setOpen(false)} /></div>
              <div className="mt-6 flex flex-col gap-2">
                <Link
                  to="/app/settings"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-10 items-center gap-2 rounded-xl border border-border px-3 text-sm"
                >
                  <Settings className="h-4 w-4" /> الإعدادات
                </Link>
                <Button variant="outline" className="w-full" onClick={signOut}>
                  <LogOut className="h-4 w-4" /> تسجيل الخروج
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </header>

      <main className="md:mr-64 pb-[calc(6.75rem+env(safe-area-inset-bottom))] md:pb-8">
        <div className="container mx-auto max-w-6xl min-w-0 px-3 py-5 sm:px-4 md:py-8">
          <AppLockGate>
            <PageTransition>
              <Outlet />
            </PageTransition>
          </AppLockGate>
        </div>
      </main>

      {/* Bottom nav mobile */}
      <nav className="fixed bottom-0 inset-x-0 z-20 border-t border-border bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {BOTTOM_NAV.map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to} className={cn("flex min-w-0 flex-col items-center justify-center gap-1 py-2.5 text-[clamp(0.68rem,2.7vw,0.78rem)] leading-tight transition-colors", active ? "text-primary" : "text-muted-foreground")}>
                <n.icon className={cn("h-5 w-5 transition-transform", active && "scale-110")} />
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
