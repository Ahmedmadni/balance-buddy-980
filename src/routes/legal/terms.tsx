import { createFileRoute } from "@tanstack/react-router";
import { generateTermsOfService } from "@/lib/compliance/terms-of-service";
import { LegalPageShell, LegalDisclaimer, LegalSection } from "@/components/legal/LegalPageShell";

export const Route = createFileRoute("/legal/terms")({
  head: () => ({
    meta: [
      { title: "شروط الاستخدام — رصد" },
      {
        name: "description",
        content: "شروط استخدام تطبيق رصد: الاستخدام المقبول، حدود المسؤولية، والإعلانات.",
      },
    ],
  }),
  component: TermsOfServicePage,
});

function TermsOfServicePage() {
  const terms = generateTermsOfService();
  return (
    <LegalPageShell title="شروط الاستخدام" generatedAt={terms.generatedAt}>
      <LegalDisclaimer />
      {terms.sections.map((s) => (
        <LegalSection key={s.id} title={s.title} body={s.body} />
      ))}
    </LegalPageShell>
  );
}
