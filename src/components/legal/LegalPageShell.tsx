import { Link } from "@tanstack/react-router";
import { Wallet } from "lucide-react";
import type { ReactNode } from "react";

const LEGAL_NAV = [
  { to: "/legal/privacy", label: "سياسة الخصوصية" },
  { to: "/legal/terms", label: "شروط الاستخدام" },
  { to: "/legal/cookies", label: "ملفات تعريف الارتباط" },
  { to: "/legal/data-export", label: "تصدير بياناتك" },
];

export function LegalPageShell({
  title,
  generatedAt,
  children,
}: {
  title: string;
  generatedAt?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border/60 backdrop-blur supports-[backdrop-filter]:bg-background/70 sticky top-0 z-30">
        <div className="container mx-auto flex items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center gap-2">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[image:var(--gradient-primary)] text-white shadow-[var(--shadow-elegant)]">
              <Wallet className="h-5 w-5" />
            </div>
            <span className="text-lg font-bold">رصد</span>
          </Link>
          <nav className="hidden sm:flex items-center gap-4 text-xs text-muted-foreground">
            {LEGAL_NAV.map((n) => (
              <Link key={n.to} to={n.to} className="hover:text-foreground transition-colors">
                {n.label}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      <main className="container mx-auto max-w-2xl px-4 py-10">
        <h1 className="text-2xl font-bold">{title}</h1>
        {generatedAt && (
          <p className="mt-1 text-xs text-muted-foreground">
            آخر توليد: {new Date(generatedAt).toLocaleDateString("ar")}
          </p>
        )}
        <div className="mt-6 space-y-6">{children}</div>
      </main>

      <footer className="border-t border-border/60 py-6">
        <div className="container mx-auto flex flex-wrap items-center justify-center gap-4 px-4 text-xs text-muted-foreground">
          {LEGAL_NAV.map((n) => (
            <Link key={n.to} to={n.to} className="hover:text-foreground transition-colors">
              {n.label}
            </Link>
          ))}
        </div>
      </footer>
    </div>
  );
}

export function LegalDisclaimer() {
  return (
    <div className="rounded-2xl border border-warning/30 bg-warning/5 p-3.5 text-xs text-warning">
      مسودة تلقائية مُولَّدة من الحالة الفعلية للتطبيق، وليست استشارة قانونية. راجعها مع مختص قانوني
      قبل الاعتماد عليها رسمياً.
    </div>
  );
}

export function LegalSection({ title, body }: { title: string; body: string }) {
  return (
    <section>
      <h2 className="text-base font-bold">{title}</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</p>
    </section>
  );
}
