import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { App } from "@capacitor/app";
import { Capacitor } from "@capacitor/core";
import { Wallet, LockKeyhole, ShieldCheck, Plus, ArrowDownLeft, ArrowUpRight, HandCoins, Save, FileDown, FileUp, KeyRound, LogOut } from "lucide-react";
import {
  createVault, parseVaultFile, sealVault, setNewPassword, unlockWithPassword, unlockWithDeviceKey,
  unlockWithRecoveryCode, type RasdVaultFile, type OpenedVault,
} from "../src/lib/offline/crypto";
import {
  emptyLedger, parseSAR, walletBalanceMinor, type LocalLedger, type LocalWallet,
} from "../src/lib/offline/ledger";
import {
  inspectDeviceVault, recoverDeviceVault, saveDeviceVault, shareEncryptedBackup,
  restoreDeviceBackup, hasRestoreSafetyCopy, exportRestoreSafetyCopy, retireRestoreSafetyCopy,
} from "../src/lib/offline/device-store";
import { previewEncryptedBackup, isRestoreConfirmation, type BackupPreview } from "../src/lib/offline/backup-restore";
import { type VaultCandidate, type VaultFileName } from "../src/lib/offline/vault-transaction";
import {
  probeDeviceUnlock, enableDeviceUnlock, unlockDeviceKey, disableDeviceUnlock,
  type DeviceUnlockProbe,
} from "../src/lib/offline/device-unlock";
import { AppPatternGrid } from "./AppPatternGrid";
import {
  enrollAppLock, removeAppLock, unlockAppLock, probeAppLock, invalidateAppLocks,
  supportsAppLockPlatform, validAppCredential, type AppLockMethod, type AppLockProbe,
} from "../src/lib/offline/app-lock";
import logoSrc from "../assets/logo.svg";
import "./styles.css";

type Stage = "loading" | "setup" | "locked" | "open" | "show-recovery" | "recover-vault" | "failed";
type Tab = "home" | "wallets" | "entries" | "debts" | "backup";
const today = () => new Date().toISOString().slice(0,10);
const stamp = () => new Date().toISOString();
const fmt = (halalas: number) => (halalas / 100).toLocaleString("en-US", {
  minimumFractionDigits: 2, maximumFractionDigits: 2,
}) + " ر.س";
const errorText = (e: unknown) => e instanceof Error ? e.message : "تعذّر تنفيذ العملية على الجهاز.";

function OfflineRasd() {
  const [stage, setStage] = useState<Stage>("loading");
  const [tab, setTab] = useState<Tab>("home");
  const [file, setFile] = useState<RasdVaultFile | null>(null);
  const [deviceAccess, setDeviceAccess] = useState<DeviceUnlockProbe>({
    supported: false, enabled: false, matchesVault: false,
  });
  const opened = useRef<OpenedVault | null>(null);
  const fileRef = useRef<RasdVaultFile | null>(null);
  const busyRef = useRef(false);
  const lockEpoch = useRef(0);
  const [appLockEpoch, setAppLockEpoch] = useState(0);
  const [appLockMethod, setAppLockMethod] = useState<AppLockMethod>("pin");
  const [appLockSecret, setAppLockSecret] = useState("");
  const [appLockConfirm, setAppLockConfirm] = useState("");
  const [appLockMaster, setAppLockMaster] = useState("");
  const [currentMaster, setCurrentMaster] = useState("");
  const [deviceMaster, setDeviceMaster] = useState("");
  const [appLockStatus, setAppLockStatus] = useState<Record<AppLockMethod, AppLockProbe>>({
    pin: { enabled:false, blocked:false }, pattern: { enabled:false, blocked:false },
  });
  const clearAppLockForm = useCallback(() => {
    setAppLockSecret(""); setAppLockConfirm(""); setAppLockMaster("");
    setAppLockEpoch(old => old+1);
  }, []);
  const refreshAppLock = useCallback(async (snapshot: RasdVaultFile) => {
    try {
      const [pin,pattern] = await Promise.all([probeAppLock(snapshot,"pin"),probeAppLock(snapshot,"pattern")]);
      if (fileRef.current === snapshot) {
        setAppLockStatus({pin,pattern});
        setAppLockMethod(old => (old==="pin" ? pin.enabled || !pattern.enabled : pattern.enabled || !pin.enabled) ? old : old==="pin"?"pattern":"pin");
      }
    } catch {
      if (fileRef.current === snapshot) setAppLockStatus({
        pin:{enabled:false,blocked:false},pattern:{enabled:false,blocked:false},
      });
    }
  }, []);
  const [ledger, setLedger] = useState<LocalLedger>(emptyLedger());
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [verify, setVerify] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryInput, setRecoveryInput] = useState("");
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);
  const [recoveryCandidates, setRecoveryCandidates] = useState<VaultCandidate[]>([]);
  const [recoverySource, setRecoverySource] = useState<VaultFileName>("pending");
  const verifiedCandidate = useRef<{ source: VaultFileName; file: RasdVaultFile; value: OpenedVault } | null>(null);
  const [verifiedSummary, setVerifiedSummary] = useState<{ wallets: number; entries: number; debts: number } | null>(null);
  const [recoveryDecision, setRecoveryDecision] = useState("");
  const [importing, setImporting] = useState<RasdVaultFile | null>(null);
  const [importPassword, setImportPassword] = useState("");
  const [importConfirm, setImportConfirm] = useState("");
  const [importMethod, setImportMethod] = useState<"password"|"recovery">("password");
  const [importMaster, setImportMaster] = useState("");
  const [importPreview, setImportPreview] = useState<BackupPreview|null>(null);
  const importRevision = useRef(0);
  const [safetyPresent, setSafetyPresent] = useState(false);
  const [safetyMaster, setSafetyMaster] = useState("");
  const [safetyConfirmation, setSafetyConfirmation] = useState("");
  const [safetyShareOpened, setSafetyShareOpened] = useState(false);
  const clearImport = useCallback(() => {
    importRevision.current++;
    setImporting(null); setImportPassword(""); setImportConfirm(""); setImportMaster("");
    setImportPreview(null); setImportMethod("password");
    setSafetyMaster(""); setSafetyConfirmation(""); setSafetyShareOpened(false);
  }, []);
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [wallet, setWallet] = useState("");
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [direction, setDirection] = useState<"owed_to_me" | "i_owe">("owed_to_me");
  const [date, setDate] = useState(today());
  const [dueDate, setDueDate] = useState("");

  const lock = useCallback(() => {
    lockEpoch.current++;
    clearAppLockForm();
    clearImport();
    setVerify(""); setRecoveryInput(""); setImportPassword(""); setImportConfirm(""); setCurrentMaster(""); setDeviceMaster("");
    setName(""); setAmount(""); setNote("");
    opened.current?.keyBytes.fill(0);
    opened.current = null;
    verifiedCandidate.current?.value.keyBytes.fill(0);
    verifiedCandidate.current = null;
    setVerifiedSummary(null);
    setLedger(emptyLedger());
    setPassword("");
    setStage(old => old === "open" ? "locked" : old);
  }, [clearAppLockForm, clearImport]);

  useEffect(() => {
    let active = true;
    if (stage === "open" && tab === "backup") {
      void hasRestoreSafetyCopy().then(present=>{if(active)setSafetyPresent(present);})
        .catch(e=>{if(active)setError(errorText(e));});
    }
    return ()=>{active=false;};
  }, [stage,tab,file]);
  useEffect(() => {
    let active = true;
    if (file) void probeDeviceUnlock(file).then(status => {
      if (active) setDeviceAccess(status);
    });
    if (file) void refreshAppLock(file);
    return () => { active = false; };
  }, [file, refreshAppLock]);

  useEffect(() => {
    let active = true;
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      setStage("failed");
      setError("هذه النسخة محلية ومخصصة لتطبيق Android المثبّت فقط.");
      return;
    }
    void inspectDeviceVault().then(snapshot => {
      if (!active) return;
      if (snapshot.kind === "empty") {
        setStage("setup");
      } else if (snapshot.kind === "ready") {
        fileRef.current = snapshot.file;
        setFile(snapshot.file);
        setStage("locked");
      } else if (snapshot.kind === "recovery_required") {
        setRecoveryCandidates(snapshot.candidates);
        setRecoverySource(snapshot.candidates[0].source);
        setError("رصد اكتشف عملية حفظ غير مكتملة. لن يعرض أرصدة قديمة تلقائيًا. اختر النسخة وافتحها ثم أكد الاستعادة.");
        setStage("recover-vault");
      } else {
        setError("كل ملفات الخزنة المحلية غير سليمة. لم تُمسح أي نسخة؛ استخدم نسخة احتياطية خارجية معتمدة.");
        setStage("failed");
      }
    }).catch(e => { if (active) { setError(errorText(e)); setStage("failed"); }});
    let listener: { remove: () => Promise<void> } | undefined;
    let backgroundTimeout: ReturnType<typeof setTimeout> | undefined;
    let inactiveAt: number | null = null;
    void App.addListener("appStateChange", ({ isActive }) => {
      if (!isActive) {
        inactiveAt = Date.now();
        backgroundTimeout = setTimeout(lock, 60000);
      } else {
        // Android suspends JavaScript timers in the background. Enforce the
        // elapsed timeout *on resume* before sensitive data can be reused.
        if (inactiveAt !== null && Date.now() - inactiveAt >= 60000) lock();
        inactiveAt = null;
        if (backgroundTimeout) clearTimeout(backgroundTimeout);
        backgroundTimeout = undefined;
      }
    }).then(l => { if (active) listener = l; else void l.remove(); });
    return () => { active = false; if (backgroundTimeout) clearTimeout(backgroundTimeout); void listener?.remove(); };
  }, [lock]);

  async function action(fn: () => Promise<void>) {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true); setError(""); setInfo("");
    try { await fn(); } catch (e) { setError(errorText(e)); }
    finally { setBusy(false); busyRef.current = false; }
  }
  function adopt(v: RasdVaultFile, value: OpenedVault) {
    clearAppLockForm();
    opened.current?.keyBytes.fill(0);
    opened.current = value;
    fileRef.current = v;
    setFile(v);
    setLedger(value.ledger);
    setPassword("");
    setVerify("");
    setRecoveryInput("");
    setStage("open");
    setTab("home");
  }
  function setRecoveryChoice(source: VaultFileName) {
    verifiedCandidate.current?.value.keyBytes.fill(0);
    verifiedCandidate.current = null;
    setVerifiedSummary(null);
    setRecoveryDecision("");
    setRecoverySource(source);
    setPassword("");
    setRecoveryInput("");
  }

  function checkRecoveryCandidate() {
    void action(async () => {
      const epoch=lockEpoch.current;
      const picked = recoveryCandidates.find(c => c.source === recoverySource);
      if (!picked) throw new Error("اختر ملفًا موجودًا للاسترداد.");
      if (verifiedCandidate.current) verifiedCandidate.current.value.keyBytes.fill(0);
      verifiedCandidate.current = null;
      setVerifiedSummary(null);
      const unlocked = recoveryInput.trim().startsWith("RSD-")
        ? await unlockWithRecoveryCode(picked.file, recoveryInput.trim())
        : await unlockWithPassword(picked.file, password);
      if (lockEpoch.current !== epoch) { unlocked.keyBytes.fill(0); throw new Error("انتهت جلسة فحص الاسترداد."); }
      verifiedCandidate.current = { source: picked.source, file: picked.file, value: unlocked };
      setVerifiedSummary({
        wallets: unlocked.ledger.wallets.length,
        entries: unlocked.ledger.entries.length,
        debts: unlocked.ledger.debts.length,
      });
      setPassword("");
      setRecoveryInput("");
      setRecoveryDecision("");
      setInfo("تم التحقق من سلامة النسخة بالتشفير. راجع عدد السجلات قبل الاعتماد.");
    });
  }

  function confirmRecoveryCandidate() {
    void action(async () => {
      const verified = verifiedCandidate.current;
      if (!verified || recoveryDecision.trim() !== "اعتماد")
        throw new Error("افحص النسخة واكتب «اعتماد» لتأكيد استعادتها.");
      const epoch=lockEpoch.current;
      const authorized=()=>lockEpoch.current===epoch && verifiedCandidate.current===verified;
      // Check identity and session before entering the serialized durable write.
      await revokeLocalShortcuts();
      await recoverDeviceVault(verified.source, verified.file, authorized);
      const mayAdopt=authorized();
      verifiedCandidate.current = null;
      setRecoveryCandidates([]);
      setVerifiedSummary(null);
      setRecoveryDecision("");
      if (!mayAdopt) {
        verified.value.keyBytes.fill(0);
        fileRef.current=verified.file; setFile(verified.file); lock(); setStage("locked");
        return;
      }
      adopt(verified.file, verified.value);
      setInfo("تم اعتماد نسخة محلية بعد التحقق. قد تكون بعض العمليات الأحدث غير موجودة؛ راجع السجلات قبل الاستخدام.");
    });
  }

  async function commit(next: LocalLedger) {
    const session=opened.current, snapshot=fileRef.current, epoch=lockEpoch.current;
    if (!session || !snapshot) throw new Error("افتح الخزنة أولًا.");
    const authorized=()=>lockEpoch.current===epoch && opened.current===session && fileRef.current===snapshot;
    const result = await sealVault(snapshot, session.keyBytes, next);
    await saveDeviceVault(result,authorized);
    const mayAdopt=authorized();
    fileRef.current = result;
    setFile(result);
    // A transaction already in durable storage cannot be cancelled. Never
    // redisplay the financial ledger after a concurrent lock.
    if (!mayAdopt) { lock(); setStage("locked"); return; }
    session.ledger = next;
    setLedger(next);
    setName(""); setAmount(""); setNote("");
    setInfo("تم الحفظ محليًا على الهاتف بعد تشفير البيانات.");
  }
  function create() {
    void action(async () => {
      if (password !== verify) throw new Error("كلمتا المرور غير متطابقتين.");
      const created = await createVault(password);
      await saveDeviceVault(created.file);
      fileRef.current = created.file;
      setFile(created.file);
      opened.current = { keyBytes: created.keyBytes, ledger: created.ledger };
      setLedger(created.ledger);
      setRecoveryCode(created.recoveryCode);
      setPassword(""); setVerify("");
      setRecoveryConfirmed(false);
      setStage("show-recovery");
    });
  }
  function adoptIfCurrent(snapshot: RasdVaultFile, value: OpenedVault, epoch: number) {
    if (lockEpoch.current !== epoch || fileRef.current !== snapshot) {
      value.keyBytes.fill(0);
      throw new Error("انتهت محاولة الفتح؛ أعد المحاولة.");
    }
    adopt(snapshot,value);
  }
  function unlock() {
    void action(async () => {
      const snapshot = fileRef.current, epoch = lockEpoch.current;
      if (!snapshot) throw new Error("الخزنة غير موجودة.");
      const value = await unlockWithPassword(snapshot, password);
      adoptIfCurrent(snapshot,value,epoch);
    });
  }
  function unlockWithDevice() {
    void action(async () => {
      const snapshot = fileRef.current, epoch = lockEpoch.current;
      if (!snapshot) throw new Error("الخزنة غير موجودة.");
      const rawKey = await unlockDeviceKey(snapshot);
      try {
        const value = await unlockWithDeviceKey(snapshot, rawKey);
        adoptIfCurrent(snapshot,value,epoch);
        setInfo("تم فتح رصد عبر قفل Android الآمن.");
      } finally {
        rawKey.fill(0);
      }
    });
  }
  function configureAppLock(remove: boolean) {
    void action(async () => {
      const snapshot = fileRef.current, session = opened.current, epoch = lockEpoch.current;
      if (!snapshot || !session) throw new Error("افتح الخزنة أولًا.");
      const stillAuthorized = () => lockEpoch.current === epoch && opened.current === session && fileRef.current === snapshot;
      try {
        if (remove) await removeAppLock(snapshot,appLockMethod,appLockMaster,stillAuthorized);
        else await enrollAppLock(snapshot,appLockMethod,appLockSecret,appLockConfirm,appLockMaster,stillAuthorized);
        if (stillAuthorized()) setInfo(remove ? "تم إلغاء وسيلة الدخول." : "تم إعداد وسيلة الدخول المستقلة.");
      } finally {
        clearAppLockForm();
        await refreshAppLock(snapshot);
      }
    });
  }
  function unlockWithAppLock() {
    void action(async () => {
      const snapshot = fileRef.current, epoch = lockEpoch.current;
      if (!snapshot) throw new Error("الخزنة غير موجودة.");
      let raw: Uint8Array | undefined;
      try {
        raw = await unlockAppLock(snapshot,appLockMethod,appLockSecret);
        const value = await unlockWithDeviceKey(snapshot,raw);
        adoptIfCurrent(snapshot,value,epoch);
      } finally {
        raw?.fill(0); clearAppLockForm();
        await refreshAppLock(snapshot);
      }
    });
  }
  async function revokeLocalShortcuts() {
    if (supportsAppLockPlatform()) await invalidateAppLocks();
    await disableDeviceUnlock();
  }
  function configureDeviceUnlock(remove: boolean) {
    void action(async () => {
      const snapshot = fileRef.current, session = opened.current, epoch = lockEpoch.current;
      if (!snapshot || !session) throw new Error("الخزنة مغلقة.");
      const authorized = () => lockEpoch.current === epoch && opened.current === session && fileRef.current === snapshot;
      const authenticated = await unlockWithPassword(snapshot,deviceMaster);
      try {
        if (!authorized()) throw new Error("انتهت جلسة إعداد قفل Android.");
        if (remove) await disableDeviceUnlock();
        else await enableDeviceUnlock(snapshot, authenticated.keyBytes);
        if (!authorized()) {
          if (!remove) await disableDeviceUnlock();
          throw new Error("انتهت جلسة إعداد قفل Android.");
        }
        const status = await probeDeviceUnlock(snapshot);
        setDeviceAccess(status);
        if (!remove && !status.matchesVault) throw new Error("لم يؤكد Android ربط المفتاح بالخزنة الحالية.");
        setInfo(remove ? "تم إلغاء فتح قفل الجهاز." : "تم تفعيل فتح رصد بقفل Android.");
      } finally {
        authenticated.keyBytes.fill(0); setDeviceMaster("");
      }
    });
  }
  function recover() {
    void action(async () => {
      const snapshot=fileRef.current, epoch=lockEpoch.current;
      if (!snapshot) throw new Error("الخزنة غير موجودة.");
      if (password.length < 12 || password !== verify)
        throw new Error("أدخل كلمة مرور جديدة من 12 حرفًا على الأقل وأكدها.");
      const authorized=()=>lockEpoch.current===epoch && fileRef.current===snapshot;
      const value = await unlockWithRecoveryCode(snapshot, recoveryInput.trim());
      let adopted=false;
      try {
        if (!authorized()) throw new Error("انتهت جلسة الاسترداد.");
        const updated = await setNewPassword(snapshot, value.keyBytes, password);
        if (!authorized()) throw new Error("انتهت جلسة الاسترداد.");
        await revokeLocalShortcuts();
        await saveDeviceVault(updated,authorized);
        if (!authorized()) {
          fileRef.current=updated;setFile(updated);lock();setStage("locked");
          return;
        }
        adopt(updated,value); adopted=true;
        setInfo("تم فتح الخزنة برمز الاسترداد وتغيير كلمة المرور بنجاح.");
      } finally { if(!adopted)value.keyBytes.fill(0); }
    });
  }
  function changePassword() {
    void action(async () => {
      const snapshot = fileRef.current, session = opened.current, epoch = lockEpoch.current;
      if (!snapshot || !session) throw new Error("الخزنة مغلقة.");
      if (password !== verify) throw new Error("كلمتا المرور غير متطابقتين.");
      const authenticated = await unlockWithPassword(snapshot,currentMaster);
      try {
        const updated = await setNewPassword(snapshot, authenticated.keyBytes, password);
        if (lockEpoch.current !== epoch || opened.current !== session || fileRef.current !== snapshot)
          throw new Error("انتهت جلسة تغيير كلمة المرور.");
        await revokeLocalShortcuts();
        if (lockEpoch.current !== epoch || opened.current !== session || fileRef.current !== snapshot)
          throw new Error("انتهت جلسة تغيير كلمة المرور.");
        const authorized=()=>lockEpoch.current===epoch && opened.current===session && fileRef.current===snapshot;
        await saveDeviceVault(updated,authorized);
        const mayAdopt=authorized();
        fileRef.current = updated; setFile(updated);
        if(!mayAdopt){lock();setStage("locked");return;}
        setPassword(""); setVerify("");
        setInfo("تم تغيير كلمة المرور وإلغاء اختصارات الدخول. رمز الاسترداد السابق ما زال صالحًا.");
      } finally {
        authenticated.keyBytes.fill(0);
        setCurrentMaster("");
      }
    });
  }
  function addWallet() {
    void action(async () => {
      if (!name.trim()) throw new Error("أدخل اسم المحفظة.");
      const opening = amount.trim() ? parseSAR(amount) : 0;
      const w: LocalWallet = { id: crypto.randomUUID(), name: name.trim(), openingMinor: opening, createdAt: stamp() };
      await commit({ ...ledger, wallets: [...ledger.wallets, w] });
    });
  }
  function addEntry() {
    void action(async () => {
      if (!wallet || !ledger.wallets.some(w => w.id === wallet))
        throw new Error("اختر محفظة موجودة.");
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new Error("أدخل تاريخًا صحيحًا.");
      await commit({ ...ledger, entries: [...ledger.entries, {
        id: crypto.randomUUID(), walletId: wallet, kind, amountMinor: parseSAR(amount),
        note: note.trim(), date, createdAt: stamp(),
      }] });
    });
  }
  function addDebt() {
    void action(async () => {
      if (!name.trim()) throw new Error("أدخل اسم الطرف.");
      if (dueDate && !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) throw new Error("تاريخ الاستحقاق غير صحيح.");
      await commit({ ...ledger, debts: [...ledger.debts, {
        id: crypto.randomUUID(), person: name.trim(), direction, amountMinor: parseSAR(amount),
        note: note.trim(), dueDate: dueDate || null, createdAt: stamp(),
      }] });
    });
  }
  async function chooseBackup(event: React.ChangeEvent<HTMLInputElement>) {
    const input = event.target.files?.[0];
    event.target.value = "";
    if (!input || busyRef.current) return;
    clearImport(); setError(""); setInfo("");
    const epoch = lockEpoch.current, revision = importRevision.current;
    try {
      if (input.size > 32 * 1024 * 1024) throw new Error("ملف النسخة كبير جدًا.");
      const backup = parseVaultFile(await input.text());
      if (lockEpoch.current !== epoch || importRevision.current !== revision) return;
      setImporting(backup);
      setInfo("ملف مشفر صالح مبدئيًا. تحقق من محتواه قبل الاستعادة.");
    } catch (e) { if (importRevision.current === revision) setError(errorText(e)); }
  }
  function previewBackup() {
    void action(async () => {
      if (!importing) throw new Error("اختر ملف النسخة أولًا.");
      const epoch = lockEpoch.current, revision = importRevision.current;
      setImportPreview(null); setImportConfirm("");
      const preview = await previewEncryptedBackup(importing,{kind:importMethod,secret:importMethod==="recovery"?importPassword.trim():importPassword});
      if (lockEpoch.current !== epoch || importRevision.current !== revision) throw new Error("انتهت جلسة المعاينة.");
      setImportPreview(preview);
    });
  }
  function restoreBackup() {
    void action(async () => {
      if (!importing || !importPreview) throw new Error("تحقق من النسخة واعرض معاينتها أولًا.");
      const snapshot = fileRef.current, session = opened.current, epoch = lockEpoch.current, revision = importRevision.current;
      const authorized = () => lockEpoch.current === epoch && opened.current === session && fileRef.current === snapshot && importRevision.current === revision;
      const recovered = await restoreDeviceBackup({
        backup:importing, preview:importPreview, credential:{kind:importMethod,secret:importMethod==="recovery"?importPassword.trim():importPassword},
        expectedCurrent:snapshot,currentMaster:importMaster,confirmation:importConfirm,stillAuthorized:authorized,
        revokeShortcuts:revokeLocalShortcuts,
      });
      const mayAdopt = authorized();
      clearImport();
      if (!mayAdopt) {
        recovered.keyBytes.fill(0);
        fileRef.current=importing; setFile(importing); lock(); setStage("locked");
        setInfo("حُفظت النسخة المشفرة. افتح الخزنة مجددًا للتحقق من بياناتها.");
        return;
      }
      adopt(importing,recovered);
      setInfo("اكتملت استعادة النسخة المشفرة محليًا. راجع المحافظ والأرصدة.");
    });
  }
  function manageSafetyCopy(retire: boolean) {
    void action(async()=>{
      const snapshot=fileRef.current, session=opened.current, epoch=lockEpoch.current, revision=importRevision.current;
      if (!snapshot || !session) throw new Error("افتح الخزنة أولًا.");
      const authorized=()=>lockEpoch.current===epoch && opened.current===session && fileRef.current===snapshot && importRevision.current===revision;
      if(retire) {
        if(!safetyShareOpened) throw new Error("صدّر نسخة الأمان أولًا.");
        await retireRestoreSafetyCopy(snapshot,safetyMaster,safetyConfirmation,authorized);
        setSafetyPresent(false); setSafetyShareOpened(false); setSafetyConfirmation("");
        setInfo("تم تحرير ملف الأمان المستقل بناءً على تأكيدك حفظه خارجيًا.");
      } else {
        await exportRestoreSafetyCopy(snapshot,safetyMaster,authorized);
        if(authorized()) {
          setSafetyShareOpened(true);
          setInfo("فُتحت نافذة المشاركة. تحقق بنفسك من حفظ نسخة الأمان قبل تحريرها.");
        }
      }
      setSafetyMaster("");
    });
  }
  const importForm = importing && <>
    <Field label="وسيلة التحقق من النسخة"><select disabled={busy} value={importMethod} onChange={e=>{importRevision.current++;setImportMethod(e.target.value as "password"|"recovery");setImportPassword("");setImportPreview(null);setImportConfirm("");}}>
      <option value="password">كلمة المرور</option><option value="recovery">رمز الاسترداد</option>
    </select></Field>
    <Field label={importMethod==="password"?"كلمة مرور النسخة":"رمز استرداد النسخة"}><input disabled={busy} type="password" value={importPassword} onChange={e=>{importRevision.current++;setImportPassword(e.target.value);setImportPreview(null);setImportConfirm("");}}/></Field>
    <button className="secondary full" disabled={busy||!importPassword} onClick={previewBackup}>فحص ومعاينة النسخة</button>
    {!!importPreview && <>
      <p role="status">تم التحقق من النسخة: {importPreview.summary.wallets} محافظ، {importPreview.summary.entries} حركات، {importPreview.summary.debts} ديون. إجمالي الأرصدة: {fmt(importPreview.summary.balanceMinor)}.</p>
      {!!file && <Field label="كلمة المرور الرئيسية للخزنة الحالية"><input disabled={busy} type="password" autoComplete="current-password" value={importMaster} onChange={e=>setImportMaster(e.target.value)}/></Field>}
      <Field label="للتأكيد، اكتب «استبدال» أو RESTORE"><input disabled={busy} value={importConfirm} onChange={e=>setImportConfirm(e.target.value)} /></Field>
      <button className="danger full" disabled={busy||!isRestoreConfirmation(importConfirm)||!!file&&!importMaster} onClick={restoreBackup}><FileUp size={18}/> استعادة النسخة المشفرة</button>
    </>}
  </>;
  const totalBalance = ledger.wallets.reduce((sum,w) => sum + walletBalanceMinor(w, ledger.entries),0);
  const owed = ledger.debts.filter(d=>d.direction==="owed_to_me").reduce((s,d)=>s+d.amountMinor,0);
  const payable = ledger.debts.filter(d=>d.direction==="i_owe").reduce((s,d)=>s+d.amountMinor,0);
  const loginSection = stage === "setup" || stage === "locked" || stage === "show-recovery";

  return <div className="app" dir="rtl">
    <header className="masthead">
      <div className="brand"><img src={logoSrc} alt="" /><div><strong>رصد</strong><small>النسخة المحلية — Android</small></div></div>
      {stage === "open" && <button className="subtle" onClick={lock}><LogOut size={18}/> قفل</button>}
    </header>
    <main className="content">
      <div className="offline-note">بياناتك محفوظة ومشفّرة على الجهاز. لا يلزم تسجيل Google أو الاتصال بالإنترنت.</div>
      <div className="migration-note">نسخة محلية تجريبية مستقلة: بياناتك الموجودة سابقًا في Supabase لا تُحذف، لكنها لا تنتقل تلقائيًا إلى هذه النسخة.</div>
      {!!error && <div className="message error" role="alert">{error}</div>}
      {!!info && <div className="message good" role="status">{info}</div>}
      {stage === "loading" && <section className="panel"><p>جار فتح مخزن البيانات المحلي…</p></section>}
      {stage === "failed" && <section className="panel"><h2>تعذر فتح مخزن رصد المحلي</h2><p>لن يتم إنشاء خزنة جديدة فوق ملف غير قابل للقراءة. راجع سلامة الجهاز والنسخ الاحتياطية.</p></section>}
      {stage === "recover-vault" && <section className="panel signin">
        <div className="centered"><ShieldCheck size={32}/><h1>استرداد حفظ غير مكتمل</h1></div>
        <p>تعثر آخر حفظ على الجهاز. توجد ملفات مشفرة يمكن فحصها، لكن لن يعتمد رصد أي ملف تلقائيًا؛ قد تختلف الأرصدة والعمليات بين النسخ.</p>
        <Field label="اختر الملف الذي تريد فحصه">
          <select value={recoverySource} onChange={e=>setRecoveryChoice(e.target.value as VaultFileName)}>
            {recoveryCandidates.map(c=><option key={c.source} value={c.source}>{
              c.source==="pending"?"الملف المؤقت — ربما يحوي أحدث عملية":
              c.source==="previous"?"نسخة الأمان السابقة — ربما أقدم من آخر عملية":
              "الملف الرئيسي — آخر بيانات محفوظة يمكن قراءتها"
            }</option>)}
          </select>
        </Field>
        <Field label="كلمة مرور النسخة المحددة">
          <input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/>
        </Field>
        <Field label="أو رمز الاسترداد (اختياري بدل كلمة المرور)">
          <input dir="ltr" autoCapitalize="none" value={recoveryInput} onChange={e=>setRecoveryInput(e.target.value.trim())}/>
        </Field>
        <button className="secondary full" disabled={busy} onClick={checkRecoveryCandidate}>فحص وفك تشفير النسخة المحددة</button>
        {!!verifiedSummary && <>
          <div className="message good" role="status">
            نسخة قابلة لفك التشفير: {verifiedSummary.wallets} محافظ، {verifiedSummary.entries} حركات، {verifiedSummary.debts} ديون.
            تحقق من عدد السجلات قبل استبدال الملف الرئيسي.
          </div>
          <Field label="للتأكيد اكتب «اعتماد»"><input value={recoveryDecision} onChange={e=>setRecoveryDecision(e.target.value)}/></Field>
          <button className="danger full" disabled={busy||recoveryDecision.trim()!=="اعتماد"} onClick={confirmRecoveryCandidate}>
            اعتماد النسخة المحددة بعد المراجعة
          </button>
        </>}
        <p className="muted">إن لم تتأكد من النسخة الصحيحة فلا تعتمد أيًا منها. احتفظ بالجهاز وملفات الخزنة كما هي، أو استخدم نسخة احتياطية موثوقة.</p>
      </section>}
      {loginSection && <section className="panel signin">
        <div className="centered"><LockKeyhole size={32}/><h1>{stage==="setup"?"إنشاء خزنتك المحلية":stage==="show-recovery"?"احفظ رمز استرداد الخزنة":"فتح رصد"}</h1></div>
        {stage === "setup" && <>
          <p>أنشئ كلمة مرور رئيسية قوية. لن تُرسل إلى أي خادم ولا يمكن استرجاعها بدون رمز الاسترداد.</p>
          <Field label="كلمة المرور الرئيسية (12 حرفًا على الأقل)"><input type="password" autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)} /></Field>
          <Field label="تأكيد كلمة المرور"><input type="password" autoComplete="new-password" value={verify} onChange={e=>setVerify(e.target.value)} /></Field>
          <button className="primary full" disabled={busy} onClick={create}><ShieldCheck size={18}/> إنشاء خزنة مشفرة</button>
        </>}
        {stage === "show-recovery" && <>
          <p>اكتب هذا الرمز واحتفظ به خارج الهاتف. يظهر مرة واحدة فقط. إذا نسيت كلمة المرور وفقدت الرمز، لا توجد جهة تستطيع فك تشفير بياناتك.</p>
          <code className="recovery-code" dir="ltr">{recoveryCode}</code>
          <label className="check"><input type="checkbox" checked={recoveryConfirmed} onChange={e=>setRecoveryConfirmed(e.target.checked)}/> حفظت الرمز في مكان آمن بعيدًا عن الهاتف</label>
          <button className="primary full" disabled={!recoveryConfirmed} onClick={()=>{setRecoveryCode("");setStage("open");setTab("home")}}>فتح رصد</button>
        </>}
        {stage === "locked" && <>
          <Field label="كلمة المرور"><input type="password" autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} onKeyDown={e=>{if(e.key==="Enter")unlock()}}/></Field>
          <button className="primary full" disabled={busy} onClick={unlock}><LockKeyhole size={18}/> فتح الخزنة</button>
          {deviceAccess.matchesVault && deviceAccess.supported &&
            <button className="secondary full" disabled={busy} onClick={unlockWithDevice}>
              <ShieldCheck size={18}/> فتح ببصمة أو رمز/نمط قفل الهاتف
            </button>}
          {(appLockStatus.pin.enabled || appLockStatus.pattern.enabled) && <section className="app-lock-controls">
            <h3>فتح رصد برمز أو نمط مستقل</h3>
            <Field label="طريقة الفتح"><select disabled={busy} value={appLockMethod} onChange={e=>{clearAppLockForm();setAppLockMethod(e.target.value as AppLockMethod)}}>
              <option value="pin" disabled={!appLockStatus.pin.enabled}>رمز PIN</option>
              <option value="pattern" disabled={!appLockStatus.pattern.enabled}>النمط</option>
            </select></Field>
            {appLockStatus[appLockMethod].blocked ? <p>أُوقفت هذه الوسيلة بعد محاولات خاطئة. افتح بكلمة المرور الرئيسية وأعد إعدادها.</p> :
              appLockStatus[appLockMethod].enabled && <>
                {appLockMethod==="pin" ? <Field label="رمز رصد"><input type="password" inputMode="numeric" maxLength={12} autoComplete="off" value={appLockSecret} onChange={e=>setAppLockSecret(e.target.value)}/></Field> :
                  <AppPatternGrid key={appLockEpoch} value={appLockSecret} onChange={setAppLockSecret} disabled={busy} label="ارسم نمط رصد"/>}
                <button className="secondary full" disabled={busy||!appLockSecret} onClick={unlockWithAppLock}>فتح بالرمز أو النمط</button>
              </>}
          </section>}
          <details><summary>نسيت كلمة المرور؟ استخدم رمز الاسترداد</summary>
            <p>الاسم وتاريخ الميلاد وأسئلة الأقارب ليست بديلًا آمنًا للمفتاح السري.</p>
            <Field label="رمز الاسترداد"><input dir="ltr" autoCapitalize="none" value={recoveryInput} onChange={e=>setRecoveryInput(e.target.value.trim())}/></Field>
            <Field label="كلمة مرور جديدة (12 حرفًا على الأقل)"><input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></Field>
            <Field label="تأكيد الجديدة"><input type="password" value={verify} onChange={e=>setVerify(e.target.value)}/></Field>
            <button className="secondary full" disabled={busy} onClick={recover}><KeyRound size={18}/> استرداد وتغيير كلمة المرور</button>
          </details>
        </>}
      </section>}
      {stage === "open" && <>
        {tab === "home" && <>
          <div className="summary-card"><span>إجمالي أرصدة المحافظ</span><strong>{fmt(totalBalance)}</strong><small>العملة: ريال سعودي — جميع الحسابات محلية</small></div>
          <div className="stats"><div><small>المبالغ المستحقة لك</small><b>{fmt(owed)}</b></div><div><small>المبالغ المستحقة عليك</small><b>{fmt(payable)}</b></div></div>
          <section className="panel"><h2>آخر العمليات</h2>{ledger.entries.length===0?<p className="muted">لا توجد عمليات بعد. أضف محفظة أولًا، ثم سجّل الإيرادات والمصروفات.</p>:ledger.entries.slice(-6).reverse().map(e=><div className="item" key={e.id}><span>{e.kind==="income"?"إيراد":"مصروف"} — {ledger.wallets.find(w=>w.id===e.walletId)?.name}<small>{e.note||e.date}</small></span><b>{fmt(e.amountMinor)}</b></div>)}</section>
        </>}
        {tab === "wallets" && <section className="panel"><h2><Wallet size={22}/> المحافظ</h2>
          <Field label="اسم المحفظة"><input value={name} maxLength={180} onChange={e=>setName(e.target.value)}/></Field>
          <Field label="رصيد افتتاحي بالريال (اختياري)"><input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></Field>
          <button className="primary full" disabled={busy} onClick={addWallet}><Plus size={18}/> إضافة محفظة</button>
          {ledger.wallets.map(w=><div className="item" key={w.id}><span>{w.name}</span><b>{fmt(walletBalanceMinor(w,ledger.entries))}</b></div>)}
        </section>}
        {tab === "entries" && <section className="panel"><h2><ArrowUpRight size={22}/> الحركات المالية</h2>
          <Field label="المحفظة"><select value={wallet} onChange={e=>setWallet(e.target.value)}><option value="">اختر محفظة</option>{ledger.wallets.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}</select></Field>
          <Field label="النوع"><select value={kind} onChange={e=>setKind(e.target.value as "income"|"expense")}><option value="expense">مصروف</option><option value="income">إيراد</option></select></Field>
          <Field label="المبلغ بالريال"><input inputMode="decimal" value={amount} onChange={e=>setAmount(e.target.value)}/></Field>
          <Field label="التاريخ"><input type="date" value={date} onChange={e=>setDate(e.target.value)}/></Field>
          <Field label="البيان"><input value={note} maxLength={400} onChange={e=>setNote(e.target.value)}/></Field>
          <button className="primary full" disabled={busy||!ledger.wallets.length} onClick={addEntry}><Save size={18}/> حفظ الحركة محليًا</button>
          {ledger.entries.slice().reverse().map(e=><div className="item" key={e.id}><span>{e.kind==="income"?"إيراد":"مصروف"} — {ledger.wallets.find(w=>w.id===e.walletId)?.name}<small>{e.note||e.date}</small></span><b>{fmt(e.amountMinor)}</b></div>)}
        </section>}
        {tab === "debts" && <section className="panel"><h2><HandCoins size={22}/> الديون</h2>
          <Field label="اسم الطرف"><input value={name} maxLength={180} onChange={e=>setName(e.target.value)}/></Field>
          <Field label="النوع"><select value={direction} onChange={e=>setDirection(e.target.value as "owed_to_me"|"i_owe")}><option value="owed_to_me">مستحق لي</option><option value="i_owe">مستحق عليّ</option></select></Field>
          <Field label="المبلغ بالريال"><input value={amount} inputMode="decimal" onChange={e=>setAmount(e.target.value)}/></Field>
          <Field label="الاستحقاق (اختياري)"><input type="date" value={dueDate} onChange={e=>setDueDate(e.target.value)}/></Field>
          <Field label="ملاحظات"><input value={note} maxLength={400} onChange={e=>setNote(e.target.value)}/></Field>
          <button className="primary full" disabled={busy} onClick={addDebt}><Save size={18}/> حفظ الدين</button>
          {ledger.debts.slice().reverse().map(d=><div className="item" key={d.id}><span>{d.person}<small>{d.direction==="owed_to_me"?"مستحق لي":"مستحق عليّ"}{d.dueDate?" • "+d.dueDate:""}</small></span><b>{fmt(d.amountMinor)}</b></div>)}
        </section>}
        {tab === "backup" && <section className="panel"><h2><FileDown size={22}/> النسخ الاحتياطي والاستعادة</h2>
          {supportsAppLockPlatform() && <section className="app-lock-controls">
            <h3>رمز ونمط رصد المستقلان</h3>
            <p>اختصار اختياري على هذا الجهاز فقط؛ لا يغني عن كلمة المرور أو رمز الاسترداد. يحتاج حماية Keystore عتادية.</p>
            <Field label="وسيلة الدخول"><select disabled={busy} value={appLockMethod} onChange={e=>{clearAppLockForm();setAppLockMethod(e.target.value as AppLockMethod)}}>
              <option value="pin">رمز PIN (6–12 رقمًا)</option><option value="pattern">نمط (6 نقاط على الأقل)</option>
            </select></Field>
            <p>{appLockStatus[appLockMethod].blocked?"متوقف — أعد الإعداد بكلمة المرور":appLockStatus[appLockMethod].enabled?"مفعّل":"غير مفعّل"}</p>
            <Field label="كلمة المرور الرئيسية الحالية"><input type="password" autoComplete="current-password" value={appLockMaster} onChange={e=>setAppLockMaster(e.target.value)}/></Field>
            {appLockMethod==="pin" ? <>
              <Field label="الرمز الجديد"><input type="password" inputMode="numeric" autoComplete="off" maxLength={12} value={appLockSecret} onChange={e=>setAppLockSecret(e.target.value)}/></Field>
              <Field label="تأكيد الرمز"><input type="password" inputMode="numeric" autoComplete="off" maxLength={12} value={appLockConfirm} onChange={e=>setAppLockConfirm(e.target.value)}/></Field>
            </> : <div key={appLockEpoch}>
              <AppPatternGrid value={appLockSecret} onChange={setAppLockSecret} disabled={busy} label="ارسم النمط الجديد"/>
              <AppPatternGrid value={appLockConfirm} onChange={setAppLockConfirm} disabled={busy} label="أعد رسم النمط للتأكيد"/>
            </div>}
            <button className="secondary full" disabled={busy||!appLockMaster||appLockSecret!==appLockConfirm||!validAppCredential(appLockMethod,appLockSecret)} onClick={()=>configureAppLock(false)}>حفظ أو تغيير وسيلة الدخول</button>
            {appLockStatus[appLockMethod].enabled && <button className="danger full" disabled={busy||!appLockMaster} onClick={()=>configureAppLock(true)}>إلغاء وسيلة الدخول</button>}
            <hr/>
          </section>}
          <h3>قفل Android والبصمة / الوجه</h3>
          {deviceAccess.supported ? <>
            <p>يمكنك فتح خزنة رصد باستخدام بصمة قوية أو قفل شاشة Android (رمز أو نمط أو كلمة مرور). Android Keystore وحده يحتفظ بمفتاح الفتح المشفر؛ لا نخزّن بصمتك أو رمز قفل هاتفك.</p>
            <Field label="كلمة المرور الرئيسية لإعداد قفل الجهاز"><input type="password" autoComplete="current-password" value={deviceMaster} onChange={e=>setDeviceMaster(e.target.value)}/></Field>
            {deviceAccess.matchesVault ?
              <button className="secondary full" disabled={busy||!deviceMaster} onClick={()=>configureDeviceUnlock(true)}>إلغاء فتح قفل الجهاز</button> :
              <button className="secondary full" disabled={busy||!deviceMaster} onClick={()=>configureDeviceUnlock(false)}>
                <ShieldCheck size={18}/> تفعيل فتح قفل الجهاز
              </button>}
          </> : <p className="muted">لفتح رصد بالبصمة أو قفل الجهاز، تحتاج Android 11 أو أحدث وقفل شاشة آمنًا مفعّلًا. سيظل الدخول بكلمة المرور الرئيسية متاحًا.</p>}
          <hr/>
          <p>الملف المُصدّر مشفّر بالكامل، ويمكنك اختيار Google Drive أو تطبيق الملفات في نافذة مشاركة Android. لا تتم أي مزامنة تلقائية.</p>
          <button className="primary full" disabled={busy||!file} onClick={()=>void action(async()=>{if(!fileRef.current)throw Error("الخزنة مغلقة");await shareEncryptedBackup(fileRef.current);setInfo("تم فتح نافذة المشاركة. تأكد بنفسك من حفظ الملف في المكان المختار.");})}><FileDown size={18}/> تصدير نسخة مشفرة</button>
          <hr/>
          <h3>تغيير كلمة المرور الرئيسية</h3>
          <Field label="كلمة المرور الحالية"><input type="password" autoComplete="current-password" value={currentMaster} onChange={e=>setCurrentMaster(e.target.value)}/></Field>
          <Field label="الجديدة (12 حرفًا على الأقل)"><input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></Field>
          <Field label="تأكيد الجديدة"><input type="password" value={verify} onChange={e=>setVerify(e.target.value)}/></Field>
          <button className="secondary full" disabled={busy} onClick={changePassword}><KeyRound size={18}/> تغيير كلمة المرور</button>
          <hr/><h3>استيراد نسخة مشفرة</h3>
          <p>الاستيراد يستبدل بيانات الخزنة المحلية الحالية بعد فك تشفير النسخة وتأكيدك. خذ نسخة احتياطية من بياناتك الحالية أولًا.</p>
          <input aria-label="اختيار ملف نسخة رصد" className="file-picker" type="file" disabled={busy} accept=".rasd,.json,application/json" onChange={e=>void chooseBackup(e)} />
          {importForm}
          {safetyPresent && <>
            <hr/><h3>نسخة الأمان قبل الاستعادة</h3>
            <p>نسخة مستقلة مشفرة من الخزنة السابقة. لا تُحذف بالحفظ العادي. تحتاج كلمة مرورها القديمة أو رمز استردادها عند استعادتها.</p>
            <Field label="كلمة المرور الرئيسية الحالية"><input disabled={busy} type="password" value={safetyMaster} onChange={e=>setSafetyMaster(e.target.value)}/></Field>
            <button className="secondary full" disabled={busy||!safetyMaster} onClick={()=>manageSafetyCopy(false)}><FileDown size={18}/> تصدير نسخة الأمان</button>
            {safetyShareOpened && <>
              <p>بعد التأكد من وجود الملف خارج التطبيق، يمكنك تحرير مكان نسخة الأمان للاستعادة التالية.</p>
              <Field label="اكتب «حفظت النسخة» بعد التحقق من حفظها"><input disabled={busy} value={safetyConfirmation} onChange={e=>setSafetyConfirmation(e.target.value)}/></Field>
              <button className="danger full" disabled={busy||!safetyMaster||safetyConfirmation.trim()!=="حفظت النسخة"} onClick={()=>manageSafetyCopy(true)}>تحرير نسخة الأمان المحلية</button>
            </>}
          </>}
        </section>}
      </>}
      {(stage==="setup"||stage==="locked") && <details className="panel secondary-panel">
        <summary>لدي نسخة رصد محلية مشفرة وأريد استعادتها</summary>
        <p>ملف <code>.rasd</code> الناتج من هذه النسخة المحلية فقط. لا يمكن استيراد نسخة Supabase القديمة تلقائيًا.</p>
        <input aria-label="اختيار ملف نسخة رصد" className="file-picker" type="file" disabled={busy} accept=".rasd,.json,application/json" onChange={e=>void chooseBackup(e)}/>
        {importForm}
      </details>}
    </main>
    {stage === "open" && <nav className="bottom-tabs" aria-label="تنقل رصد المحلي">
      {([["home","الرئيسية",Wallet],["wallets","المحافظ",Wallet],["entries","الحركات",ArrowDownLeft],["debts","الديون",HandCoins],["backup","النسخ",FileDown]] as const).map(([id,label,Icon])=>
        <button key={id} aria-label={"تبويب "+label} aria-current={tab===id?"page":undefined} onClick={()=>{if(busyRef.current)return;clearAppLockForm();clearImport();setCurrentMaster("");setDeviceMaster("");setPassword("");setVerify("");setTab(id);setError("");setInfo("");setName("");setAmount("");setNote("")}} className={tab===id?"active":""}><Icon size={20}/><span>{label}</span></button>
      )}
    </nav>}
    <footer>رصد — خزنة محلية مشفرة • إصدار تجريبي مستقل • لا يستخدم خادمًا لحفظ البيانات</footer>
  </div>;
}
function Field({label,children}:{label:string,children:React.ReactNode}) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
createRoot(document.getElementById("root")!).render(<OfflineRasd />);
