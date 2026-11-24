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
import { loadDeviceVault, saveDeviceVault, shareEncryptedBackup } from "../src/lib/offline/device-store";
import {
  probeDeviceUnlock, enableDeviceUnlock, unlockDeviceKey, disableDeviceUnlock,
  type DeviceUnlockProbe,
} from "../src/lib/offline/device-unlock";
import logoSrc from "../assets/logo.svg";
import "./styles.css";

type Stage = "loading" | "setup" | "locked" | "open" | "show-recovery" | "failed";
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
  const [ledger, setLedger] = useState<LocalLedger>(emptyLedger());
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);
  const [password, setPassword] = useState("");
  const [verify, setVerify] = useState("");
  const [recoveryCode, setRecoveryCode] = useState("");
  const [recoveryInput, setRecoveryInput] = useState("");
  const [recoveryConfirmed, setRecoveryConfirmed] = useState(false);
  const [importing, setImporting] = useState<RasdVaultFile | null>(null);
  const [importPassword, setImportPassword] = useState("");
  const [importConfirm, setImportConfirm] = useState("");
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [wallet, setWallet] = useState("");
  const [kind, setKind] = useState<"income" | "expense">("expense");
  const [direction, setDirection] = useState<"owed_to_me" | "i_owe">("owed_to_me");
  const [date, setDate] = useState(today());
  const [dueDate, setDueDate] = useState("");

  const lock = useCallback(() => {
    opened.current?.keyBytes.fill(0);
    opened.current = null;
    setLedger(emptyLedger());
    setPassword("");
    setStage(old => old === "open" ? "locked" : old);
  }, []);

  useEffect(() => {
    let active = true;
    if (file) void probeDeviceUnlock(file).then(status => {
      if (active) setDeviceAccess(status);
    });
    return () => { active = false; };
  }, [file]);

  useEffect(() => {
    let active = true;
    if (!Capacitor.isNativePlatform() || Capacitor.getPlatform() !== "android") {
      setStage("failed");
      setError("هذه النسخة محلية ومخصصة لتطبيق Android المثبّت فقط.");
      return;
    }
    void loadDeviceVault().then(v => {
      if (!active) return;
      fileRef.current = v;
      setFile(v);
      setStage(v ? "locked" : "setup");
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
  async function commit(next: LocalLedger) {
    if (!opened.current || !fileRef.current) throw new Error("افتح الخزنة أولًا.");
    const result = await sealVault(fileRef.current, opened.current.keyBytes, next);
    await saveDeviceVault(result);
    fileRef.current = result;
    setFile(result);
    opened.current.ledger = next;
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
  function unlock() {
    void action(async () => {
      if (!fileRef.current) throw new Error("الخزنة غير موجودة.");
      const value = await unlockWithPassword(fileRef.current, password);
      adopt(fileRef.current, value);
    });
  }
  function unlockWithDevice() {
    void action(async () => {
      if (!fileRef.current) throw new Error("الخزنة غير موجودة.");
      const rawKey = await unlockDeviceKey(fileRef.current);
      try {
        const value = await unlockWithDeviceKey(fileRef.current, rawKey);
        adopt(fileRef.current, value);
        setInfo("تم فتح رصد عبر قفل Android الآمن.");
      } finally {
        rawKey.fill(0);
      }
    });
  }
  function setUpDeviceUnlock() {
    void action(async () => {
      if (!opened.current || !fileRef.current)
        throw new Error("افتح الخزنة بكلمة المرور الرئيسية أولًا.");
      await enableDeviceUnlock(fileRef.current, opened.current.keyBytes);
      const status = await probeDeviceUnlock(fileRef.current);
      setDeviceAccess(status);
      if (!status.matchesVault) throw new Error("لم يؤكد Android ربط المفتاح بالخزنة الحالية.");
      setInfo("فُعّل فتح رصد بقفل الجهاز. كلمة المرور الرئيسية ورمز الاسترداد ما زالا صالحين.");
    });
  }
  function turnOffDeviceUnlock() {
    void action(async () => {
      if (!opened.current || !fileRef.current) throw new Error("الخزنة مغلقة.");
      await disableDeviceUnlock();
      setDeviceAccess(await probeDeviceUnlock(fileRef.current));
      setInfo("أُلغي فتح قفل الجهاز. الخزنة ما زالت محمية بكلمة المرور الرئيسية.");
    });
  }
  function recover() {
    void action(async () => {
      if (!fileRef.current) throw new Error("الخزنة غير موجودة.");
      const value = await unlockWithRecoveryCode(fileRef.current, recoveryInput.trim());
      if (password.length < 12 || password !== verify)
        throw new Error("أدخل كلمة مرور جديدة من 12 حرفًا على الأقل وأكدها.");
      const updated = await setNewPassword(fileRef.current, value.keyBytes, password);
      await saveDeviceVault(updated);
      adopt(updated, value);
      setInfo("تم فتح الخزنة برمز الاسترداد وتغيير كلمة المرور بنجاح.");
    });
  }
  function changePassword() {
    void action(async () => {
      if (!opened.current || !fileRef.current) throw new Error("الخزنة مغلقة.");
      if (password !== verify) throw new Error("كلمتا المرور غير متطابقتين.");
      const updated = await setNewPassword(fileRef.current, opened.current.keyBytes, password);
      await saveDeviceVault(updated);
      fileRef.current = updated; setFile(updated);
      setPassword(""); setVerify("");
      setInfo("تم تغيير كلمة المرور. رمز الاسترداد السابق ما زال صالحًا.");
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
    setError(""); setImporting(null);
    const input = event.target.files?.[0];
    if (!input) return;
    try {
      if (input.size > 32 * 1024 * 1024) throw new Error("ملف النسخة كبير جدًا.");
      setImporting(parseVaultFile(await input.text()));
      setImportConfirm("");
      setImportPassword("");
      setInfo("ملف مشفر صالح مبدئيًا. يلزم إدخال كلمة مرور النسخة قبل استبدال أي بيانات.");
    } catch (e) { setError(errorText(e)); }
    event.target.value = "";
  }
  function restoreBackup() {
    void action(async () => {
      if (!importing) throw new Error("اختر ملف النسخة أولًا.");
      if (fileRef.current && importConfirm.trim() !== "استبدال")
        throw new Error("اكتب «استبدال» لتأكيد استبدال الخزنة المحلية الحالية.");
      const recovered = await unlockWithPassword(importing, importPassword);
      await saveDeviceVault(importing);
      adopt(importing, recovered);
      setImporting(null); setImportPassword(""); setImportConfirm("");
      setInfo("اكتملت استعادة النسخة المشفرة محليًا. راجع المحافظ والأرصدة.");
    });
  }
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
          <h3>قفل Android والبصمة / الوجه</h3>
          {deviceAccess.supported ? <>
            <p>يمكنك فتح خزنة رصد باستخدام بصمة قوية أو قفل شاشة Android (رمز أو نمط أو كلمة مرور). Android Keystore وحده يحتفظ بمفتاح الفتح المشفر؛ لا نخزّن بصمتك أو رمز قفل هاتفك.</p>
            {deviceAccess.matchesVault ?
              <button className="secondary full" disabled={busy} onClick={turnOffDeviceUnlock}>إلغاء فتح قفل الجهاز</button> :
              <button className="secondary full" disabled={busy} onClick={setUpDeviceUnlock}>
                <ShieldCheck size={18}/> تفعيل فتح قفل الجهاز
              </button>}
          </> : <p className="muted">لفتح رصد بالبصمة أو قفل الجهاز، تحتاج Android 11 أو أحدث وقفل شاشة آمنًا مفعّلًا. سيظل الدخول بكلمة المرور الرئيسية متاحًا.</p>}
          <hr/>
          <p>الملف المُصدّر مشفّر بالكامل، ويمكنك اختيار Google Drive أو تطبيق الملفات في نافذة مشاركة Android. لا تتم أي مزامنة تلقائية.</p>
          <button className="primary full" disabled={busy||!file} onClick={()=>void action(async()=>{if(!fileRef.current)throw Error("الخزنة مغلقة");await shareEncryptedBackup(fileRef.current);setInfo("تم فتح نافذة المشاركة. تأكد بنفسك من حفظ الملف في المكان المختار.");})}><FileDown size={18}/> تصدير نسخة مشفرة</button>
          <hr/>
          <h3>تغيير كلمة المرور الرئيسية</h3>
          <Field label="الجديدة (12 حرفًا على الأقل)"><input type="password" value={password} onChange={e=>setPassword(e.target.value)}/></Field>
          <Field label="تأكيد الجديدة"><input type="password" value={verify} onChange={e=>setVerify(e.target.value)}/></Field>
          <button className="secondary full" disabled={busy} onClick={changePassword}><KeyRound size={18}/> تغيير كلمة المرور</button>
          <hr/><h3>استيراد نسخة مشفرة</h3>
          <p>الاستيراد يستبدل بيانات الخزنة المحلية الحالية بعد فك تشفير النسخة وتأكيدك. خذ نسخة احتياطية من بياناتك الحالية أولًا.</p>
          <input className="file-picker" type="file" accept=".rasd,.json,application/json" onChange={e=>void chooseBackup(e)} />
          {!!importing && <>
            <Field label="كلمة مرور النسخة"><input type="password" value={importPassword} onChange={e=>setImportPassword(e.target.value)}/></Field>
            <Field label="للتأكيد، اكتب «استبدال»"><input value={importConfirm} onChange={e=>setImportConfirm(e.target.value)} /></Field>
            <button className="danger full" disabled={busy} onClick={restoreBackup}><FileUp size={18}/> استعادة واستبدال البيانات المحلية</button>
          </>}
        </section>}
      </>}
      {(stage==="setup"||stage==="locked") && <details className="panel secondary-panel">
        <summary>لدي نسخة رصد محلية مشفرة وأريد استعادتها</summary>
        <p>ملف <code>.rasd</code> الناتج من هذه النسخة المحلية فقط. لا يمكن استيراد نسخة Supabase القديمة تلقائيًا.</p>
        <input className="file-picker" type="file" accept=".rasd,.json,application/json" onChange={e=>void chooseBackup(e)}/>
        {!!importing && <>
          <Field label="كلمة مرور النسخة"><input type="password" value={importPassword} onChange={e=>setImportPassword(e.target.value)}/></Field>
          {!!fileRef.current && <Field label="اكتب «استبدال» لتأكيد الاستعادة"><input value={importConfirm} onChange={e=>setImportConfirm(e.target.value)}/></Field>}
          <button className="danger full" disabled={busy} onClick={restoreBackup}>استعادة النسخة المشفرة</button>
        </>}
      </details>}
    </main>
    {stage === "open" && <nav className="bottom-tabs" aria-label="تنقل رصد المحلي">
      {([["home","الرئيسية",Wallet],["wallets","المحافظ",Wallet],["entries","الحركات",ArrowDownLeft],["debts","الديون",HandCoins],["backup","النسخ",FileDown]] as const).map(([id,label,Icon])=>
        <button key={id} onClick={()=>{setTab(id);setError("");setInfo("");setName("");setAmount("");setNote("")}} className={tab===id?"active":""}><Icon size={20}/><span>{label}</span></button>
      )}
    </nav>}
    <footer>رصد — خزنة محلية مشفرة • إصدار تجريبي مستقل • لا يستخدم خادمًا لحفظ البيانات</footer>
  </div>;
}
function Field({label,children}:{label:string,children:React.ReactNode}) {
  return <label className="field"><span>{label}</span>{children}</label>;
}
createRoot(document.getElementById("root")!).render(<OfflineRasd />);
