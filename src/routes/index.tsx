import { createFileRoute, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({ meta: [
    { title: "رصد — إدارة أموالك الشخصية" },
    { name: "description", content: "محافظ وديون ومصاريف وأصول في حسابك الشخصي على رصد." },
    { property: "og:title", content: "رصد — إدارة أموالك الشخصية" },
    { property: "og:description", content: "تابع أموالك ومحافظك وأصولك بأمان مع رصد." },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    throw redirect({ to: data.session ? "/app" : "/auth", replace: true });
  },
  component: () => null,
});
