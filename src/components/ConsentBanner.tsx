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
      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 p-4 shadow-[var(--shadow-elegant)]">
        <div className="container mx-auto flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2.5 text-xs text-muted-foreground max-w-xl">
            <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5 text-primary" />
            <span>
              نستخدم بيانات محلية على جهازك (تفضيلات، تشخيص، إشعارات) لتحسين تجربتك — لا شيء يُرسَل
              لطرف ثالث بلا موافقتك. راجع{" "}
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
          <div className="flex items-center gap-2 shrink-0">
            <Button size="sm" variant="ghost" onClick={() => setPrefsOpen(true)}>
              تخصيص
            </Button>
            <Button size="sm" variant="outline" onClick={rejectNonEssential}>
              رفض غير الأساسي
            </Button>
            <Button size="sm" onClick={acceptAll}>
              قبول الكل
            </Button>
          </div>
        </div>
      </div>
      <ConsentPreferencesDialog open={prefsOpen} onOpenChange={setPrefsOpen} onSaved={dismiss} />
    </>
  );
}
