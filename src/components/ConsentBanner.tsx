import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Link } from "@tanstack/react-router";
import { ShieldCheck } from "lucide-react";
import { loadConsent } from "@/lib/consent/consent";
import { acceptAllPreferences, rejectAllPreferences } from "@/lib/consent/preferences";
import { createAuditEntry } from "@/lib/system/audit";
import { ConsentPreferencesDialog } from "./ConsentPreferencesDialog";

export function ConsentBanner() {
  const [visible, setVisible] = useState(false);
  const [prefsOpen, setPrefsOpen] = useState(false);

  useEffect(() => {
    setVisible(!loadConsent().bannerShown);
  }, []);

  function dismiss() {
    setVisible(false);
  }

  function acceptAll() {
    acceptAllPreferences();
    createAuditEntry("settings_change", "قبول كل تفضيلات الخصوصية (شاشة الموافقة)");
    dismiss();
  }

  function rejectNonEssential() {
    // rejectAllPreferences() saves via saveConsent() internally, which
    // already marks the banner as answered — notifications are
    // intentionally left untouched (functional, not tracking).
    rejectAllPreferences();
    createAuditEntry("settings_change", "رفض التفضيلات غير الأساسية (شاشة الموافقة)");
    dismiss();
  }

  if (!visible) {
    return prefsOpen ? (
      <ConsentPreferencesDialog open={prefsOpen} onOpenChange={setPrefsOpen} onSaved={dismiss} />
    ) : null;
  }

  return (
    <>
      <section
        data-testid="consent-banner"
        aria-label="تفضيلات الخصوصية"
        className="fixed inset-x-3 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-50 mx-auto max-h-[min(55dvh,360px)] max-w-3xl overflow-y-auto overscroll-contain rounded-2xl border border-border bg-card p-3 shadow-xl sm:inset-x-6 sm:p-4"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2 text-[11px] leading-5 text-muted-foreground sm:max-w-xl sm:text-xs">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <span>
              يعتمد تسجيل الدخول وحفظ البيانات المالية على خدمات سحابية أساسية.
              يمكنك قبول التفضيلات غير الضرورية أو رفضها أو تخصيصها. راجع{" "}
              <Link to="/legal/privacy" className="underline hover:text-foreground">
                سياسة الخصوصية
              </Link>{" "}
              أو{" "}
              <Link to="/legal/cookies" className="underline hover:text-foreground">
                سياسة ملفات تعريف الارتباط
              </Link>
              .
            </span>
          </div>
          <div className="grid grid-cols-3 gap-1.5 sm:flex sm:shrink-0 sm:items-center sm:gap-2">
            <Button size="sm" variant="ghost" className="min-w-0 px-1 text-[11px] sm:px-3 sm:text-xs" onClick={() => setPrefsOpen(true)}>
              تخصيص
            </Button>
            <Button size="sm" variant="outline" className="min-w-0 px-1 text-[11px] sm:px-3 sm:text-xs" onClick={rejectNonEssential}>
              رفض غير الأساسي
            </Button>
            <Button size="sm" className="min-w-0 px-1 text-[11px] sm:px-3 sm:text-xs" onClick={acceptAll}>
              قبول الكل
            </Button>
          </div>
        </div>
      </section>
      <ConsentPreferencesDialog open={prefsOpen} onOpenChange={setPrefsOpen} onSaved={dismiss} />
    </>
  );
}
