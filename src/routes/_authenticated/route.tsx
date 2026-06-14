import { createFileRoute, Outlet, redirect, Link, useRouterState, useNavigate } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LayoutDashboard, HandCoins, Wallet, FolderKanban, FileBarChart, Settings, LogOut, Menu, Users, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";
import { useState } from "react";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AppLayout,
});

const NAV = [
  { to: "/app", icon: LayoutDashboard, label: "الرئيسية", exact: true },
  { to: "/app/people", icon: Users, label: "الأشخاص" },
  { to: "/app/wallets", icon: Landmark, label: "المحافظ" },
  { to: "/app/expenses", icon: Wallet, label: "المصاريف" },
  { to: "/app/debts", icon: HandCoins, label: "الديون" },
  { to: "/app/reports", icon: FileBarChart, label: "التقارير" },
  { to: "/app/projects", icon: FolderKanban, label: "المشاريع" },
  { to: "/app/settings", icon: Settings, label: "الإعدادات" },
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
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition",
              active ? "bg-[image:var(--gradient-primary)] text-white shadow-[var(--shadow-elegant)]" : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <n.icon className="h-5 w-5" />
            {n.label}
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
  const { user } = Route.useRouteContext();
  const { data: profile } = useQuery({
    queryKey: ["profile"],
    queryFn: async () => {
      const { data } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      return data;
    },
  });

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <div className="min-h-screen bg-background">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 right-0 z-20 hidden w-64 border-l bg-sidebar md:flex md:flex-col">
        <div className="flex items-center gap-2 px-5 py-5 border-b">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-white shadow-[var(--shadow-elegant)]">
            <Wallet className="h-5 w-5" />
          </div>
          <div>
            <div className="text-base font-bold leading-tight">حسابي</div>
            <div className="text-[11px] text-muted-foreground">إدارة ديون ومصاريف</div>
          </div>
        </div>
        <div className="flex-1 p-3"><NavLinks /></div>
        <div className="border-t p-3">
          <div className="mb-2 flex items-center gap-2 rounded-xl bg-accent/50 p-2">
            {profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" referrerPolicy="no-referrer" />
            ) : (
              <div className="grid h-8 w-8 place-items-center rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {(profile?.display_name ?? "U").slice(0, 1)}
              </div>
            )}
            <div className="flex-1 overflow-hidden">
              <div className="truncate text-sm font-medium">{profile?.display_name ?? "مستخدم"}</div>
              <div className="truncate text-xs text-muted-foreground">{user.email}</div>
            </div>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="h-4 w-4" />
            تسجيل الخروج
          </Button>
        </div>
      </aside>

      {/* Mobile topbar */}
      <header className="sticky top-0 z-20 flex items-center justify-between border-b bg-background/80 px-4 py-3 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-white">
            <Wallet className="h-5 w-5" />
          </div>
          <span className="font-bold">حسابي</span>
        </div>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon"><Menu /></Button>
          </SheetTrigger>
          <SheetContent side="right" className="w-72">
            <div className="mt-6"><NavLinks onClick={() => setOpen(false)} /></div>
            <Button variant="outline" className="mt-6 w-full" onClick={signOut}>
              <LogOut className="h-4 w-4" /> تسجيل الخروج
            </Button>
          </SheetContent>
        </Sheet>
      </header>

      <main className="md:mr-64 pb-24 md:pb-8">
        <div className="container mx-auto max-w-5xl px-4 py-6">
          <Outlet />
        </div>
      </main>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 inset-x-0 z-20 border-t bg-background/90 backdrop-blur md:hidden">
        <div className="grid grid-cols-5">
          {NAV.slice(0, 5).map((n) => {
            const active = n.exact ? pathname === n.to : pathname.startsWith(n.to);
            return (
              <Link key={n.to} to={n.to} className={cn("flex flex-col items-center gap-1 py-2.5 text-[11px]", active ? "text-primary" : "text-muted-foreground")}>
                <n.icon className={cn("h-5 w-5", active && "scale-110")} />
                {n.label}
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
