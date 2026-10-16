import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import { useEffect, type ReactNode } from "react";

import appCss from "../styles.css?url";
import { reportLovableError } from "../lib/lovable-error-reporting";
import { supabase } from "@/integrations/supabase/client";
import { Toaster } from "@/components/ui/sonner";
import { AdProviderRoot } from "@/lib/ads/ad-context";
import { createAuditEntry } from "@/lib/system/audit";
import { initErrorTracking } from "@/lib/system/errors";
import { registerServiceWorker } from "@/lib/pwa/register";
import { ConsentBanner } from "@/components/ConsentBanner";
import { RouteProgressBar } from "@/components/motion/RouteProgressBar";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold">404</h1>
        <p className="mt-4 text-muted-foreground">الصفحة غير موجودة</p>
        <a href="/" className="mt-6 inline-block rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">العودة للرئيسية</a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: unknown; reset: () => void }) {
  console.error(error);
  const router = useRouter();
  useEffect(() => {
    const safeError = error instanceof Error ? error : new Error(String(error));
    reportLovableError(safeError, { boundary: "tanstack_root_error_component" });
  }, [error]);
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-xl font-semibold">حدث خطأ غير متوقع</h1>
        <p className="mt-2 text-sm text-muted-foreground">حاول إعادة تحميل الصفحة</p>
        <button onClick={() => { router.invalidate(); reset(); }} className="mt-6 rounded-md bg-primary px-4 py-2 text-sm text-primary-foreground">إعادة المحاولة</button>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
      { name: "theme-color", content: "#0b1220" },
      { title: "رصد — إدارة مالية شخصية" },
      { name: "description", content: "رصد: تطبيق احترافي لإدارة الديون والمصاريف والمحافظ بالعربية، مع تقارير وتصدير PDF و Excel." },
      { property: "og:title", content: "رصد — إدارة مالية شخصية" },
      { property: "og:description", content: "إدارة الديون والمصاريف والمحافظ في مكان واحد، مع جهات اتصال وتقارير قابلة للتصدير." },
      { property: "og:type", content: "website" },
      { property: "og:site_name", content: "رصد" },
      { name: "twitter:title", content: "رصد — إدارة مالية شخصية" },
      { name: "twitter:description", content: "إدارة الديون والمصاريف والمحافظ في مكان واحد." },
      { name: "twitter:card", content: "summary" },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a9cbbedc-de0a-41a0-9543-2d66f396e297/id-preview-5fcd8d16--a152564d-27eb-4c34-88c3-bd4d16c0e912.lovable.app-1781342312610.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/a9cbbedc-de0a-41a0-9543-2d66f396e297/id-preview-5fcd8d16--a152564d-27eb-4c34-88c3-bd4d16c0e912.lovable.app-1781342312610.png" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/icon-512.png" },
      { rel: "icon", href: "/icon-512.png" },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <HeadContent />
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('rasd-privacy')==='1')document.documentElement.classList.add('privacy-on');}catch(e){}})();`,
          }}
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}


function RootComponent() {
  const { queryClient } = Route.useRouteContext();
  const router = useRouter();

  useEffect(() => {
    // Init theme from localStorage / system preference (avoid SSR flash by running early)
    try {
      const saved = localStorage.getItem("rasd-theme");
      const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
      const theme = saved === "dark" || saved === "light" ? saved : prefersDark ? "dark" : "light";
      document.documentElement.classList.toggle("dark", theme === "dark");
      document.documentElement.style.colorScheme = theme;
    } catch {
      // Best-effort persistence; route rendering must continue if storage is blocked.
    }
    initErrorTracking();
    registerServiceWorker();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event !== "SIGNED_IN" && event !== "SIGNED_OUT" && event !== "USER_UPDATED") return;
      if (event === "SIGNED_IN") createAuditEntry("login", "تسجيل دخول");
      if (event === "SIGNED_OUT") createAuditEntry("logout", "تسجيل خروج");
      router.invalidate();
      if (event !== "SIGNED_OUT") queryClient.invalidateQueries();
    });
    return () => subscription.unsubscribe();
  }, [router, queryClient]);

  return (
    <QueryClientProvider client={queryClient}>
      <AdProviderRoot>
        <RouteProgressBar />
        <Outlet />
        <Toaster position="top-center" richColors closeButton />
        <ConsentBanner />
      </AdProviderRoot>
    </QueryClientProvider>
  );
}
