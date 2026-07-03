import { createFileRoute } from "@tanstack/react-router";
import { generatePrivacyPolicy } from "@/lib/compliance/privacy-policy";
import { LegalPageShell, LegalDisclaimer, LegalSection } from "@/components/legal/LegalPageShell";

export const Route = createFileRoute("/legal/privacy")({
  head: () => ({
    meta: [
      { title: "سياسة الخصوصية — رصد" },
      {
        name: "description",
        content: "سياسة خصوصية تطبيق رصد: كيف تُخزَّن بياناتك ومن يمكنه الوصول إليها.",
      },
    ],
  }),
  component: PrivacyPolicyPage,
});

function PrivacyPolicyPage() {
  const policy = generatePrivacyPolicy();
  return (
    <LegalPageShell title="سياسة الخصوصية" generatedAt={policy.generatedAt}>
      <LegalDisclaimer />
      {policy.sections.map((s) => (
        <LegalSection key={s.id} title={s.title} body={s.body} />
      ))}
    </LegalPageShell>
  );
}
