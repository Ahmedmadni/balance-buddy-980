// Backup v2 — server-side export/restore via Supabase RPCs.
// No direct table writes; the DB functions handle everything transactionally.

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { exportFile } from "@/lib/mobile/share-export";
import { Capacitor } from "@capacitor/core";
import { clearNativeReminders, syncNativeReminders } from "@/lib/notifications/native-scheduler";
import { afterSuccessfulBackupRestore } from "@/lib/backup/post-restore";
import { runGuardedBackupRestore } from "@/lib/backup/restore-request";
import { classifyServerRestoreStatus, selectRestoreApiMode } from "@/lib/backup/restore-protocol";
import {
  RESTORE_HOLD_PREFIX, getRestoreHoldStorage, acknowledgeRestoreHold, readRestoreHold,
  readRestoreOperationId, reserveRestoreHold, settleRestoreHold, type RestoreHoldState,
} from "@/lib/backup/restore-hold";
import { decryptBackup, encryptBackup, isEncryptedBackup } from "@/lib/backup/encrypted-backup";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import {
  Download, Upload, ShieldAlert, CheckCircle2, RefreshCw, CloudDownload, FileWarning,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { createAuditEntry } from "@/lib/system/audit";
import { countBackupV2Rows, isBackupJsonFile, validateBackupV2, type BackupV2 } from "@/lib/backup/v2-validation";

export function BackupV2Section() {
  const qc = useQueryClient();
  const [exporting, setExporting] = useState(false);
  const [backupPassword, setBackupPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [restorePassword, setRestorePassword] = useState("");
  const [legacyUnencrypted, setLegacyUnencrypted] = useState(false);
  const [restoreConfirmation, setRestoreConfirmation] = useState("");
  const [restoring, setRestoring] = useState(false);
  const [pendingBackup, setPendingBackup] = useState<BackupV2 | null>(null);
  const [previewUserId, setPreviewUserId] = useState<string | null>(null);
  const [restoreHold, setRestoreHold] = useState<RestoreHoldState>(null);
  const [reviewAccountId, setReviewAccountId] = useState<string | null>(null);
  const [reviewConfirmation, setReviewConfirmation] = useState("");
  const [checkingRestoreStatus, setCheckingRestoreStatus] = useState(false);
  const [serverStatusReviewedId, setServerStatusReviewedId] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const operationLock = useRef(false);
  const reviewAccountIdRef = useRef<string | null>(null);

  const busy = exporting || restoring;

  // Read the journal on every mount and account change. Android WebView
  // restarts must not silently discard an uncertain/in-flight restore hold.
  useEffect(() => {
    let mounted = true;
    const applyUser = (userId: string | null) => {
      if (!mounted) return;
      reviewAccountIdRef.current = userId;
      setReviewAccountId(userId);
      setServerStatusReviewedId(null);
      setRestoreHold(userId ? readRestoreHold(getRestoreHoldStorage(), userId) : null);
    };
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!error) applyUser(data.user?.id ?? null);
    }).catch(() => {});
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      applyUser(session?.user?.id ?? null);
    });
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key.startsWith(RESTORE_HOLD_PREFIX)) {
        void supabase.auth.getUser().then(({ data, error }) => {
          if (!error) applyUser(data.user?.id ?? null);
        }).catch(() => {});
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      mounted = false;
      subscription.unsubscribe();
      window.removeEventListener("storage", onStorage);
    };
  }, []);

  // Discard decrypted preview data if the account signs out or switches.
  // A normal token refresh for the SAME user must not interrupt the dialog.
  useEffect(() => {
    if (!previewUserId) return;
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      const changedAccount = event === "SIGNED_OUT" ||
        (["SIGNED_IN", "TOKEN_REFRESHED", "USER_UPDATED"].includes(event) &&
         session?.user?.id !== previewUserId);
      if (!changedAccount) return;
      setPendingBackup(null);
      setPreviewUserId(null);
      setRestorePassword("");
      setRestoreConfirmation("");
      setLegacyUnencrypted(false);
      setConfirmOpen(false);
    });
    return () => subscription.unsubscribe();
  }, [previewUserId]);

  async function doExport() {
    if (operationLock.current) return;
    if (backupPassword.length < 12) { toast.error("أدخل كلمة مرور مستقلة للنسخة من 12 حرفا على الأقل"); return; }
    if (backupPassword !== confirmPassword) { toast.error("كلمتا مرور النسخة غير متطابقتين"); return; }
    operationLock.current = true;
    setExporting(true);
    try {
      const { data, error } = await supabase.rpc("export_user_backup");
      if (error) throw error;
      const backup = validateBackupV2(data);
      if (!backup) {
        toast.error("تعذر إنشاء النسخة", { description: "الاستجابة الواردة ليست نسخة احتياطية صالحة (v2)." });
        return;
      }
      const now = new Date();
      const pad = (n: number) => String(n).padStart(2, "0");
      const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
      const encrypted = await encryptBackup(backup, backupPassword);
      const blob = new Blob([JSON.stringify(encrypted)], { type: "application/json" });
      const outcome = await exportFile(blob, `rasd-encrypted-backup-${stamp}.json`);
      createAuditEntry("backup", "إنشاء ملف نسخة مشفرة (v2)", { meta: { version: 2, encrypted: true } });
      setBackupPassword(""); setConfirmPassword("");
      if (outcome === "share_sheet_opened") {
        toast.info("اختر وجهة الحفظ من Android، ثم تأكد من وجود الملف خارج التطبيق");
      } else {
        toast.info("بدأ تنزيل الملف المشفر؛ تحقق من اكتماله في مجلد التنزيلات");
      }
    } catch {
      toast.error("فشل تنزيل النسخة الاحتياطية", { description: "تحقق من اتصالك وتسجيل الدخول ثم حاول مرة أخرى." });
    } finally {
      operationLock.current = false;
      setExporting(false);
    }
  }

  async function onFile(f: File) {
    if (operationLock.current || restoreHold !== null) return;
    // Keep a corrupt/hostile file from allocating excessive memory in WebView.
    if (f.size > 50 * 1024 * 1024) {
      toast.error("الملف يتجاوز الحد الآمن للمعالجة (50 ميجابايت)");
      return;
    }
    if (!isBackupJsonFile(f.name)) {
      toast.error("ملف غير صالح", { description: "اختر ملفًا بامتداد JSON فقط." });
      return;
    }
    operationLock.current = true;
    try {
      const text = await f.text();
      let raw: unknown;
      try {
        raw = JSON.parse(text);
      } catch {
        toast.error("ملف غير صالح", { description: "تعذر قراءة الملف — يجب أن يكون ملف JSON صالحاً." });
        return;
      }
      const encrypted = isEncryptedBackup(raw);
      if (encrypted && !restorePassword) {
        toast.error("أدخل كلمة مرور النسخة المستوردة قبل اختيار الملف");
        return;
      }
      const payload = isEncryptedBackup(raw) ? await decryptBackup(raw, restorePassword) : raw;
      const backup = validateBackupV2(payload);
      if (!backup) {
        toast.error("نسخة غير مدعومة", { description: "الملف ليس نسخة احتياطية صالحة من رصد (الإصدار 2)." });
        return;
      }
      // Bind the preview to the authenticated account *before* user consent.
      // The account must be checked again immediately before the destructive RPC.
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        toast.error("لا يمكن التحقق من الحساب الحالي. أعد تسجيل الدخول ثم اختر الملف.");
        return;
      }
      setPreviewUserId(authData.user.id);
      setLegacyUnencrypted(!encrypted);
      setPendingBackup(backup);
      setRestoreConfirmation("");
      setConfirmOpen(true);
    } catch (err) {
      toast.error("تعذر فتح النسخة", { description: err instanceof Error ? err.message : "ملف غير صالح" });
    } finally {
      operationLock.current = false;
    }
  }

  function clearPreparedRestore() {
    setConfirmOpen(false);
    setPendingBackup(null);
    setPreviewUserId(null);
    setRestorePassword("");
    setLegacyUnencrypted(false);
    setRestoreConfirmation("");
  }

  async function runPostRestoreRefresh() {
    return await afterSuccessfulBackupRestore({
      native: Capacitor.isNativePlatform(),
      clearNativeReminders,
      refreshActiveViews: async () => {
        await qc.invalidateQueries({ refetchType: "none" });
        await qc.refetchQueries({ type: "active" }, { throwOnError: true });
      },
      syncNativeReminders: async () => {
        const { data, error } = await supabase.auth.getUser();
        if (error || !data.user) throw new Error("Active session required");
        await syncNativeReminders(data.user.id, { askPermission: false });
      },
    });
  }

  async function doRestore() {
    if (!pendingBackup || !previewUserId || restoreHold !== null ||
        operationLock.current || restoreConfirmation.trim() !== "استعادة") return;
    operationLock.current = true;
    setRestoring(true);
    let restoreConfirmed = false;
    let restoreRequestReserved = false;
    try {
      // Non-destructive capability probe: prior Android/web versions continue
      // to work if the database migration has not been deployed yet.
      const operationId = crypto.randomUUID();
      const probe = await supabase.rpc("get_restore_operation_status", { p_operation_id: operationId });
      const mode = selectRestoreApiMode(probe, operationId);
      if (mode === "unavailable") {
        toast.error("تعذر التحقق من جاهزية خادم الاستعادة", {
          description: "لم نرسل أي عملية استعادة. تحقق من الإنترنت وحالة ترقية قاعدة البيانات.",
        });
        return;
      }
      if (mode === "legacy") {
        toast.info("خادم النسخ الاحتياطي لم يُحدَّث بعد", {
          description: "سيُستخدم مسار الاستعادة السابق مع حارس الأمان المحلي حتى اكتمال ترقية قاعدة البيانات.",
        });
      }

      const response = await runGuardedBackupRestore(
        previewUserId,
        async () => {
          const { data, error } = await supabase.auth.getUser();
          if (error) throw error;
          return data.user?.id ?? null;
        },
        async () => mode === "once"
          ? await supabase.rpc("restore_user_backup_once", {
              p_backup: pendingBackup as never,
              p_operation_id: operationId,
            })
          : await supabase.rpc("restore_user_backup", { p_backup: pendingBackup as never }),
        {
          // Persist UUID and pending state *together* before the new RPC.
          // A crash must preserve which exact operation the server handled.
          beforeSend: () => {
            const reserved = reserveRestoreHold(
              getRestoreHoldStorage(), previewUserId,
              mode === "once" ? operationId : undefined,
            );
            if (reserved) restoreRequestReserved = true;
            return reserved;
          },
          expectedOperationId: mode === "once" ? operationId : undefined,
          onOutcome: (outcome) => {
            settleRestoreHold(getRestoreHoldStorage(), previewUserId, outcome);
            if (reviewAccountIdRef.current === previewUserId) {
              setRestoreHold(readRestoreHold(getRestoreHoldStorage(), previewUserId));
            }
          },
        },
      );

      if (response === "blocked") {
        const hold = readRestoreHold(getRestoreHoldStorage(), previewUserId);
        if (reviewAccountIdRef.current === previewUserId) setRestoreHold(hold);
        clearPreparedRestore();
        toast.error("لم يتم إرسال الاستعادة", {
          description: hold
            ? "هناك استعادة سابقة تحتاج مراجعة، أو تعذر حفظ حالة الأمان. لا تكرر الاستعادة قبل التحقق."
            : "تعذر التحقق من الحساب أو تغيّر الحساب منذ معاينة الملف. سجّل الدخول مجددًا وأعد اختيار الملف.",
        });
        return;
      }
      if (response === "rejected") {
        clearPreparedRestore();
        toast.error("رفض الخادم ملف الاستعادة", {
          description: "ألغى الخادم العملية. تحقق من صلاحية النسخة والمخطط قبل اختيارها مجددًا.",
        });
        return;
      }
      if (response === "unconfirmed") {
        // A timeout/fetch error or a missing success marker is not evidence
        // that PostgreSQL rolled back. Drop the payload and block another
        // destructive request from this settings session until reviewed.
        clearPreparedRestore();
        if (reviewAccountIdRef.current === previewUserId) {
          setRestoreHold(readRestoreHold(getRestoreHoldStorage(), previewUserId));
        }
        toast.warning("تعذر تأكيد نتيجة الاستعادة", {
          description: "قد تكون البيانات استعيدت فعليًا. لا تكرر الاستعادة؛ راجع أرصدة وسجلات الحساب عند عودة الاتصال.",
        });
        return;
      }

      // The RPC explicitly returned ok=true. The server-side transaction
      // committed; later view/native errors cannot turn this into a failure.
      restoreConfirmed = true;
      clearPreparedRestore();
      try {
        createAuditEntry("restore", "استعادة نسخة احتياطية (v2)", { meta: { version: 2 } });
      } catch { /* optional local log cannot invalidate an already committed restore */ }

      const after = await runPostRestoreRefresh();
      if (!after.viewUpdated || !after.remindersCleared || !after.remindersSynced) {
        const issues = [
          !after.viewUpdated ? "لم تكتمل إعادة تحميل البيانات المعروضة." : "",
          (!after.remindersCleared || !after.remindersSynced) ?
            "لم يتم تأكيد تحديث تنبيهات Android؛ راجع الإشعارات عند عودة الاتصال." : "",
        ].filter(Boolean).join(" ");
        toast.warning("تمت استعادة البيانات، لكن يلزم التحقق من بعض وظائف الجهاز", {
          description: issues + " لا تكرر عملية الاستعادة.",
        });
      } else {
        toast.success("تمت الاستعادة بنجاح", {
          description: "تم تحديث البيانات ومراجعة جدول التنبيهات المحلي إذا كان مفعّلًا.",
        });
      }
    } catch {
      // A local exception after a confirmed SQL response is not a failed
      // restore. Never invite retrying the destructive call.
      clearPreparedRestore();
      if (!restoreConfirmed && restoreRequestReserved && previewUserId) {
        settleRestoreHold(getRestoreHoldStorage(), previewUserId, "unconfirmed");
        if (reviewAccountIdRef.current === previewUserId) {
          setRestoreHold(readRestoreHold(getRestoreHoldStorage(), previewUserId));
        }
      }
      if (restoreConfirmed || restoreRequestReserved) {
        toast.warning(
          restoreConfirmed ? "تمت الاستعادة، لكن تعذر إكمال تحديث العرض" : "تعذر تأكيد نتيجة الاستعادة",
          { description: "لا تكرر عملية الاستعادة. تحقق من سجلات الحساب والاتصال أولًا." },
        );
      } else {
        toast.error("تعذر تجهيز طلب الاستعادة", {
          description: "لم يُرسل طلب الاستعادة. تحقق من الاتصال ثم افتح الملف مجددًا.",
        });
      }
    } finally {
      operationLock.current = false;
      setRestoring(false);
    }
  }

  async function verifyPendingRestoreOnServer() {
    const userId = reviewAccountId;
    if (!userId || busy || checkingRestoreStatus) return;
    const operationId = readRestoreOperationId(getRestoreHoldStorage(), userId);
    if (!operationId) return;
    setCheckingRestoreStatus(true);
    setServerStatusReviewedId(null);
    try {
      const first = await supabase.auth.getUser();
      if (first.error || first.data.user?.id !== userId) {
        toast.error("الحساب الحالي لا يطابق حساب طلب الاستعادة.");
        return;
      }
      const response = await supabase.rpc("get_restore_operation_status", { p_operation_id: operationId });
      const status = classifyServerRestoreStatus(response, operationId);
      const second = await supabase.auth.getUser();
      if (second.error || second.data.user?.id !== userId || reviewAccountIdRef.current !== userId) {
        toast.error("تغير الحساب قبل اكتمال فحص الاستعادة.");
        return;
      }
      if (status === "committed") {
        settleRestoreHold(getRestoreHoldStorage(), userId, "committed");
        setRestoreHold(readRestoreHold(getRestoreHoldStorage(), userId));
        setReviewConfirmation("");
        const after = await runPostRestoreRefresh();
        if (!after.viewUpdated || !after.remindersCleared || !after.remindersSynced) {
          toast.warning("أكد الخادم اكتمال الاستعادة، لكن بعض وظائف الجهاز بحاجة للمراجعة.");
        } else {
          toast.success("أكد الخادم اكتمال الاستعادة وتم تحديث العرض والتنبيهات.");
        }
      } else if (status === "not_found") {
        // A missing commit marker is not proof that the request will never
        // reach PostgreSQL. Keep the hold until explicit human verification.
        setServerStatusReviewedId(operationId);
        toast.warning("لا يوجد إثبات لاكتمال العملية على الخادم", {
          description: "قد يكون الطلب السابق ما زال في الطريق. لا تكرر الاستعادة دون التأكد من البيانات ومن انتهاء الطلب.",
        });
      } else {
        toast.warning("تعذر التحقق من نتيجة العملية عبر الخادم. لا تكرر الاستعادة.");
      }
    } catch {
      toast.warning("تعذر الاتصال بخدمة التحقق من الاستعادة. الحظر الاحترازي مستمر.");
    } finally {
      setCheckingRestoreStatus(false);
    }
  }

  async function acknowledgeReviewedRestore() {
    if (busy || checkingRestoreStatus || !reviewAccountId || reviewConfirmation.trim() !== "راجعت البيانات") return;
    const operationId = readRestoreOperationId(getRestoreHoldStorage(), reviewAccountId);
    if (operationId && serverStatusReviewedId !== operationId) {
      toast.error("تحقق من نتيجة العملية على الخادم قبل رفع الحظر.");
      return;
    }
    const { data, error } = await supabase.auth.getUser();
    if (error || data.user?.id !== reviewAccountId) {
      toast.error("تعذر تأكيد الحساب الحالي. أعد تسجيل الدخول.");
      return;
    }
    if (!acknowledgeRestoreHold(getRestoreHoldStorage(), reviewAccountId)) {
      toast.error("تعذر رفع حظر الأمان. تحقق من صلاحية التخزين المحلي.");
      return;
    }
    setRestoreHold(readRestoreHold(getRestoreHoldStorage(), reviewAccountId));
    setReviewConfirmation("");
    setServerStatusReviewedId(null);
    toast.info("تم رفع حظر الاستعادة بعد تأكيدك مراجعة بيانات الحساب.");
  }

  return (
    <div className="rounded-2xl border bg-card p-4 sm:p-5 space-y-4">
      <div className="flex items-center gap-3">
        <div className="grid h-10 w-10 place-items-center rounded-xl bg-primary/10 text-primary">
          <CloudDownload className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold flex items-center gap-2">
            النسخ الاحتياطي v2 <Badge variant="secondary" className="text-[10px]">موصى به</Badge>
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            نسخة خادمية كاملة من بياناتك المالية عبر الخادم — تصدير واستعادة آمنة
          </p>
        </div>
      </div>

      {restoreHold !== null && (
        <Alert variant="destructive" role="alert">
          <ShieldAlert className="h-4 w-4" />
          <AlertDescription className="text-xs leading-relaxed space-y-2">
            {restoreHold === "unavailable" ? (
              <p>تعذر الوصول إلى سجل أمان الاستعادة المحلي أو تعذر قراءته؛ الاستعادة معطلة احترازيًا حتى يعمل تخزين المتصفح.</p>
            ) : (
              <>
                <p>
                  {restoreHold === "pending"
                    ? "هناك طلب استعادة بدأ ولم تصل نتيجة نهائية إلى هذا الجهاز، وربما أكمله الخادم."
                    : "نتيجة طلب استعادة سابق غير مؤكدة."}
                  {" "}لا تكرر الاستعادة. بعد استقرار الاتصال، راجع المحافظ والعمليات والأرصدة والسجلات بعناية.
                  يظل الحظر فعالًا حتى بعد إعادة تحميل التطبيق أو إعادة فتحه على هذا الجهاز.
                </p>
                {reviewAccountId && readRestoreOperationId(getRestoreHoldStorage(), reviewAccountId) && (
                  <Button size="sm" variant="outline" onClick={verifyPendingRestoreOnServer}
                    disabled={busy || checkingRestoreStatus}>
                    {checkingRestoreStatus ? "جارٍ التحقق من الخادم..." : "التحقق من نتيجة الاستعادة على الخادم"}
                  </Button>
                )}
                <p>بعد مراجعة أرصدة الحساب وسجلاته والتأكد أن الطلب القديم انتهى، اكتب «راجعت البيانات» لرفع الحظر. عودة الإنترنت وحدها ليست إثباتًا.</p>
                {reviewAccountId && readRestoreOperationId(getRestoreHoldStorage(), reviewAccountId) && serverStatusReviewedId !== readRestoreOperationId(getRestoreHoldStorage(), reviewAccountId) && (
                  <p className="font-medium">يلزم التحقق من نتيجة العملية عبر الزر أعلاه قبل السماح بالإقرار اليدوي.</p>
                )}
                <Input aria-label="تأكيد مراجعة الحساب" placeholder="راجعت البيانات"
                  value={reviewConfirmation} onChange={(e) => setReviewConfirmation(e.target.value)}
                  disabled={busy || checkingRestoreStatus} />
                <Button size="sm" variant="outline" onClick={acknowledgeReviewedRestore}
                  disabled={busy || checkingRestoreStatus || !reviewAccountId ||
                    (Boolean(readRestoreOperationId(getRestoreHoldStorage(), reviewAccountId)) &&
                      serverStatusReviewedId !== readRestoreOperationId(getRestoreHoldStorage(), reviewAccountId)) ||
                    reviewConfirmation.trim() !== "راجعت البيانات"}>
                  تأكيد المراجعة ورفع الحظر
                </Button>
              </>
            )}
          </AlertDescription>
        </Alert>
      )}

      <Alert>
        <FileWarning className="h-4 w-4" />
        <AlertDescription className="text-xs">
          المرفقات والملفات المرفوعة غير مشمولة حاليًا في النسخة الاحتياطية.
        </AlertDescription>
      </Alert>

      <div className="space-y-2 rounded-xl border p-3">
        <p className="text-xs font-semibold">تشفير النسخة قبل التصدير (AES-256-GCM)</p>
        <p className="text-xs text-muted-foreground">اختر كلمة مرور مستقلة لا تقل عن 12 حرفا. لن يتم حفظها في التطبيق؛ فقدانها يعني تعذر استعادة النسخة.</p>
        <Input type="password" autoComplete="new-password" placeholder="كلمة مرور النسخة" aria-label="كلمة مرور النسخة" value={backupPassword} onChange={(e) => setBackupPassword(e.target.value)} />
        <Input type="password" autoComplete="new-password" placeholder="تأكيد كلمة المرور" aria-label="تأكيد كلمة مرور النسخة" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
      </div>
      <div className="space-y-2">
        <p className="text-xs text-muted-foreground">لاستعادة ملف مشفر، أدخل كلمة مروره هنا قبل اختياره. يمكن استيراد ملفات v2 القديمة غير المشفرة مع تحذير.</p>
        <Input type="password" autoComplete="off" placeholder="كلمة مرور الملف المراد استعادته" aria-label="كلمة مرور ملف الاستعادة" value={restorePassword} onChange={(e) => setRestorePassword(e.target.value)} />
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        <Button onClick={doExport} disabled={busy}>
          {exporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
          تنزيل نسخة احتياطية
        </Button>
        <Button variant="outline" onClick={() => fileRef.current?.click()} disabled={busy || restoreHold !== null}>
          {restoring ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
          استعادة نسخة احتياطية
        </Button>
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          e.target.value = "";
        }}
      />

      {/* Destructive confirmation */}
      <Dialog
        open={confirmOpen}
        onOpenChange={(v) => {
          if (!v && !restoring) clearPreparedRestore();
        }}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShieldAlert className="h-5 w-5 text-warning" /> تأكيد الاستعادة
            </DialogTitle>
            <DialogDescription className="sr-only">تأكيد استبدال البيانات الحالية بالنسخة الاحتياطية</DialogDescription>
          </DialogHeader>

          {legacyUnencrypted && <Alert variant="destructive"><FileWarning className="h-4 w-4" /><AlertDescription className="text-xs">هذا الملف غير مشفر. تجنب مشاركته، وبعد الاستعادة أنشئ نسخة مشفرة جديدة.</AlertDescription></Alert>}
          <Alert variant="destructive">
            <ShieldAlert className="h-4 w-4" />
            <AlertDescription className="text-xs leading-relaxed">
              سيتم استبدال بياناتك المالية الحالية بالكامل بمحتوى النسخة الاحتياطية المحددة.
              هذه العملية لا يمكن التراجع عنها.
              {pendingBackup?.exported_at && (
                <>
                  <br />
                  تاريخ النسخة: {new Date(pendingBackup.exported_at).toLocaleString("ar")}
                </>
              )}
            </AlertDescription>
          </Alert>

          {pendingBackup && (
            <div className="rounded-xl border p-3 text-xs space-y-1">
              <p className="font-semibold">
                محتوى الملف: {countBackupV2Rows(pendingBackup).toLocaleString("ar-SA")} سجل في {Object.keys(pendingBackup.data).length} مجموعة بيانات
              </p>
              <p className="text-muted-foreground">
                محافظ: {pendingBackup.data.wallets.length}، ديون: {pendingBackup.data.person_ledger.length}، مصروفات: {pendingBackup.data.expenses.length}، استثمارات: {pendingBackup.data.investments.length}.
              </p>
              {countBackupV2Rows(pendingBackup) === 0 && (
                <p className="font-semibold text-destructive">
                  تحذير: النسخة تحتوي على صفر سجلات مالية. الاستعادة ستزيل السجلات الحالية المشمولة في النسخ الاحتياطي.
                </p>
              )}
            </div>
          )}
          <p className="text-xs text-muted-foreground">
            ملاحظة: المرفقات والملفات المرفوعة غير مشمولة حاليًا في النسخة الاحتياطية.
          </p>

          <div className="space-y-2">
            <label htmlFor="restore-confirmation" className="text-xs font-medium">
              لتأكيد استبدال البيانات اكتب كلمة «استعادة»:
            </label>
            <Input
              id="restore-confirmation"
              autoComplete="off"
              placeholder="استعادة"
              value={restoreConfirmation}
              onChange={(e) => setRestoreConfirmation(e.target.value)}
              disabled={restoring}
            />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={clearPreparedRestore} disabled={restoring}>
              إلغاء
            </Button>
            <Button variant="destructive" onClick={doRestore} disabled={restoring || restoreHold !== null || !previewUserId || restoreConfirmation.trim() !== "استعادة"}>
              {restoring ? <RefreshCw className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
              {restoring ? "جارٍ الاستعادة…" : "تأكيد الاستبدال والاستعادة"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
