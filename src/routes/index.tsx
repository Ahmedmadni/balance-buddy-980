import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, ArrowUpRight, ArrowDownRight, FolderKanban, FileBarChart, Smartphone, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "رصد — متابعة الديون والمصاريف باحترافية" },
      { name: "description", content: "أدر ديونك ومصاريفك في مكان واحد، مع تقارير قابلة للتصدير ودعم تعدد العملات وتسجيل دخول بجوجل." },
    ],
  }),
  component: Landing,
});

function Landing() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-white shadow-[var(--shadow-elegant)]">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold">رصد</span>
          </div>
          {authed ? (
            <Button asChild><Link to="/app">فتح التطبيق</Link></Button>
          ) : (
            <Button asChild><Link to="/auth">تسجيل الدخول</Link></Button>
          )}
        </div>
      </header>

      <main>
        <section className="container mx-auto px-4 py-20 text-center">
          <div className="mx-auto max-w-3xl">
            <span className="inline-block rounded-full border bg-card px-3 py-1 text-xs text-muted-foreground">احترافي · مودرن · يعمل على جميع الأجهزة</span>
            <h1 className="mt-6 text-4xl font-extrabold leading-tight md:text-6xl">
              تابع <span className="bg-[image:var(--gradient-primary)] bg-clip-text text-transparent">ديونك</span> ومصاريفك
              <br /> بكل سهولة واحترافية
            </h1>
            <p className="mt-5 text-base text-muted-foreground md:text-lg">
              تطبيق واحد لإدارة ما لك وما عليك من ديون، ومصاريفك العامة ومشاريعك (سيارة، رحلات، عائلة...)، مع تقارير وتصدير PDF و Excel.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Button asChild size="lg" className="bg-[image:var(--gradient-primary)] text-white shadow-[var(--shadow-elegant)]">
                <Link to={authed ? "/app" : "/auth"}>{authed ? "فتح لوحة التحكم" : "ابدأ مجاناً بحساب جوجل"}</Link>
              </Button>
            </div>
          </div>
        </section>

        <section className="container mx-auto grid gap-4 px-4 pb-20 md:grid-cols-3">
          {[
            { icon: ArrowDownRight, color: "text-success", title: "ديون لي", desc: "سجّل المبالغ المستحقة لك مع تذكير بتاريخ الاستحقاق ودفعات جزئية." },
            { icon: ArrowUpRight, color: "text-destructive", title: "ديون عليّ", desc: "تابع التزاماتك المالية بوضوح وحدّث الرصيد المتبقي بسهولة." },
            { icon: FolderKanban, color: "text-primary", title: "مصاريف ومشاريع", desc: "فئات جاهزة + إنشاء مشاريع مستقلة (سيارة، رحلة دبي…) بميزانية مخصصة." },
            { icon: FileBarChart, color: "text-warning", title: "تقارير وتصدير", desc: "تقارير دقيقة قابلة للتصدير بصيغة PDF و Excel للأرشفة والمشاركة." },
            { icon: Smartphone, color: "text-accent-foreground", title: "يعمل كتطبيق هاتف", desc: "ثبّته على هاتفك (PWA) واستخدمه كأي تطبيق أصلي على iOS و Android." },
            { icon: ShieldCheck, color: "text-primary", title: "بياناتك بأمان", desc: "تسجيل دخول بجوجل وحفظ سحابي مع عزل كامل بين حسابات المستخدمين." },
          ].map((f, i) => (
            <div key={i} className="rounded-2xl border bg-card p-5 shadow-[var(--shadow-card)] transition hover:-translate-y-0.5 hover:shadow-[var(--shadow-elegant)]">
              <f.icon className={`h-7 w-7 ${f.color}`} />
              <h3 className="mt-3 text-lg font-bold">{f.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </section>
      </main>

      <footer className="border-t py-6 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} رصد · كل الحقوق محفوظة
      </footer>
    </div>
  );
}
