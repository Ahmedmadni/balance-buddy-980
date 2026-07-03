import { createFileRoute } from "@tanstack/react-router";
import { generateCookiePolicy } from "@/lib/compliance/cookie-policy";
import { LegalPageShell, LegalDisclaimer, LegalSection } from "@/components/legal/LegalPageShell";

export const Route = createFileRoute("/legal/cookies")({
  head: () => ({
    meta: [
      { title: "ملفات تعريف الارتباط — رصد" },
      { name: "description", content: "سياسة ملفات تعريف الارتباط والتخزين المحلي في تطبيق رصد." },
    ],
  }),
  component: CookiePolicyPage,
});

function CookiePolicyPage() {
  const policy = generateCookiePolicy();
  return (
    <LegalPageShell title="ملفات تعريف الارتباط" generatedAt={policy.generatedAt}>
      <LegalDisclaimer />
      {policy.sections.map((s) => (
        <LegalSection key={s.id} title={s.title} body={s.body} />
      ))}
    </LegalPageShell>
  );
}
