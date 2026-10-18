import {useCallback,useEffect,useMemo,useRef,useState,type FormEvent} from "react";
import {LocalVaultSession,isLocalVaultCreated} from "./vault";
import {DebtsSection} from "./DebtsSection";
import {InvestmentsSection} from "./InvestmentsSection";
import {ZakatPreviewSection} from "./ZakatPreviewSection";
import {appendEntry,appendWallet,balanceHalalas,type LedgerKind,type LocalLedger} from "./model";
import {createBackup,saveBackupInsideApp,shareBackup,listDeviceBackups,loadDeviceBackup,readBackupFile,decryptBackup} from "./backup";
function currency(n:number){return (n/100).toLocaleString("ar-SA",{minimumFractionDigits:2,maximumFractionDigits:2})+" ر.س";}
export function NativeApp(){
  const [exists,setExists]=useState<boolean|null>(null);
  const [session,setSession]=useState<LocalVaultSession|null>(null);
  const [ledger,setLedger]=useState<LocalLedger|null>(null);
  const [secret,setSecret]=useState("");
  const [confirm,setConfirm]=useState("");
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState("");
  const [notice,setNotice]=useState("");
  const [walletName,setWalletName]=useState("");
  const [opening,setOpening]=useState("0");
  const [walletId,setWalletId]=useState("");
  const [kind,setKind]=useState<LedgerKind>("expense");
  const [amount,setAmount]=useState("");
  const [category,setCategory]=useState("");
  const [note,setNote]=useState("");
  const [backupPassword,setBackupPassword]=useState("");
  const [saved,setSaved]=useState<string[]>([]);
  const [restoreName,setRestoreName]=useState("");
  const [restoreFile,setRestoreFile]=useState<File|null>(null);
  const [confirmRestore,setConfirmRestore]=useState("");
  const sessionRef=useRef<LocalVaultSession|null>(null);
  const securityEpoch=useRef(0);
  const lastInteractionAt=useRef(Date.now());
  const lockVault=useCallback(()=>{
    securityEpoch.current+=1;
    sessionRef.current?.lock();
    sessionRef.current=null;
    setSession(null);setLedger(null);
    setSecret("");setConfirm("");setBackupPassword("");
    setRestoreFile(null);setRestoreName("");setConfirmRestore("");
    setError("");setNotice("");setLoading(false);
  },[]);
  useEffect(()=>{
    // Lock immediately when the WebView leaves the screen. Hidden pages
    // must never remain unlocked waiting for JavaScript timers to resume.
    const onHidden=()=>{if(document.visibilityState==="hidden")lockVault();};
    const onPageHide=()=>lockVault();
    const onActivity=()=>{lastInteractionAt.current=Date.now();};
    document.addEventListener("visibilitychange",onHidden);
    window.addEventListener("pagehide",onPageHide);
    window.addEventListener("pointerdown",onActivity,{passive:true});
    window.addEventListener("keydown",onActivity);
    window.addEventListener("touchstart",onActivity,{passive:true});
    const timer=window.setInterval(()=>{
      if(sessionRef.current&&Date.now()-lastInteractionAt.current>=120_000)lockVault();
    },5_000);
    let disposed=false;
    let nativeListener:{remove:()=>Promise<void>}|null=null;
    // Capacitor native event covers OEM WebViews where visibilitychange
    // does not fire reliably on backgrounding.
    void import("@capacitor/core").then(async({Capacitor})=>{
      if(!Capacitor.isNativePlatform())return;
      const {App}=await import("@capacitor/app");
      const listener=await App.addListener("appStateChange",({isActive})=>{
        if(!isActive)lockVault();
      });
      if(disposed)await listener.remove();
      else nativeListener=listener;
    }).catch(()=>lockVault());
    return()=>{
      disposed=true;
      nativeListener?.remove().catch(()=>{});
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange",onHidden);
      window.removeEventListener("pagehide",onPageHide);
      window.removeEventListener("pointerdown",onActivity);
      window.removeEventListener("keydown",onActivity);
      window.removeEventListener("touchstart",onActivity);
      // React remounts (including StrictMode) must not leave a vault open.
      lockVault();
    };
  },[lockVault]);
  useEffect(()=>{void isLocalVaultCreated().then(setExists).catch(e=>setError(String(e)));},[]);
  const wallets=ledger?.wallets??[];
  const selected=wallets.find(w=>w.id===walletId)??wallets[0];
  const entries=useMemo(()=>ledger?.entries.filter(e=>e.walletId===selected?.id).slice().reverse()??[],[ledger,selected?.id]);
  async function run(action:()=>Promise<void>){
    if(loading)return;
    const startedAt=securityEpoch.current;
    setLoading(true);setError("");setNotice("");
    try{await action();}catch(e){
      if(startedAt===securityEpoch.current)
        setError(e instanceof Error?e.message:String(e));
    }finally{
      if(startedAt===securityEpoch.current)setLoading(false);
    }
  }
  async function openVault(event:FormEvent){
    event.preventDefault();await run(async()=>{
      const openingEpoch=securityEpoch.current;
      const s=exists?await LocalVaultSession.unlock(secret):(async()=>{
        if(secret!==confirm)throw new Error("كلمتا السر غير متطابقتين");
        return LocalVaultSession.create(secret);
      })();
      const sessionNow=await s;
      if(openingEpoch!==securityEpoch.current||document.visibilityState==="hidden"){
        sessionNow.lock();return;
      }
      const data=sessionNow.snapshot();
      sessionRef.current=sessionNow;
      lastInteractionAt.current=Date.now();
      setSession(sessionNow);setLedger(data);setWalletId(data.wallets[0]?.id??"");
      setSecret("");setConfirm("");setExists(true);
      await listDeviceBackups().then(setSaved);
    });
  }
  async function addWallet(event:FormEvent){
    event.preventDefault();if(!session)return;
    await run(async()=>{const next=await session.commit(old=>appendWallet(old,walletName,opening));
      setLedger(next);setWalletId(next.wallets.at(-1)?.id??"");setWalletName("");setOpening("0");setNotice("تم حفظ المحفظة محليًا");});
  }
  async function addTransaction(event:FormEvent){
    event.preventDefault();if(!session||!selected)return;
    await run(async()=>{const next=await session.commit(old=>appendEntry(old,{
      walletId:selected.id,kind,amount,category,note,
    }));setLedger(next);setAmount("");setNote("");setNotice("تم تسجيل العملية محليًا");});
  }
  async function exportBackup(share:boolean){
    if(!session)return;
    await run(async()=>{
      const snapshot=session.snapshot();
      const {name,encrypted}=await createBackup(snapshot,backupPassword);
      await saveBackupInsideApp(name,encrypted);
      if(sessionRef.current!==session)return;
      setSaved(await listDeviceBackups());
      if(sessionRef.current!==session)return;
      if(share){
        await shareBackup(name,encrypted);
        if(sessionRef.current!==session)return;
        setNotice("تم فتح قائمة المشاركة؛ اختر Google Drive أو تطبيق الملفات وأكمل الحفظ هناك. فتح القائمة لا يعني اكتمال الرفع.");
      } else setNotice("حُفظت النسخة المشفرة داخل مساحة التطبيق. شاركها إلى Drive/ملفات الجهاز لحمايتها إذا حُذف التطبيق.");
      if(sessionRef.current===session)setBackupPassword("");
    });
  }
  async function restore(){
    if(!session)return;
    await run(async()=>{
      if(confirmRestore!=="استعادة")throw new Error("اكتب استعادة لتأكيد استبدال البيانات");
      if(!backupPassword)throw new Error("أدخل كلمة مرور ملف النسخة");
      const source=restoreFile?await readBackupFile(restoreFile,backupPassword):
        restoreName?await decryptBackup(await loadDeviceBackup(restoreName),backupPassword):
        null;
      if(!source)throw new Error("اختر ملفاً محفوظاً أو ملفاً من الجهاز");
      // Fail closed: keep a verified recovery copy BEFORE destructive overwrite.
      const checkpoint=await createBackup(session.snapshot(),backupPassword);
      await saveBackupInsideApp(checkpoint.name,checkpoint.encrypted);
      const next=await session.replace(source);
      setLedger(next);setWalletId(next.wallets[0]?.id??"");
      setRestoreFile(null);setRestoreName("");setBackupPassword("");setConfirmRestore("");
      setSaved(await listDeviceBackups());setNotice("تمت الاستعادة. حُفظت نقطة رجوع مشفرة داخل التطبيق.");
    });
  }
  return <main>
    <header className="row"><h1>رصد</h1><span className="muted">Android · محلي بالكامل</span></header>
    {error&&<div role="alert" className="card error">{error}</div>}
    {notice&&<div role="status" className="card">{notice}</div>}
    {exists===null?<p>جارٍ تجهيز مساحة الجهاز...</p>:
      !session?<section className="card">
        <h2>{exists?"افتح خزنتك":"ابدأ بدون حساب"}</h2>
        <p className="muted">لا حاجة إلى تسجيل Google أو Supabase. بياناتك المالية تُشفَّر وتُخزَّن على هذا الجهاز فقط.</p>
        <form onSubmit={openVault}>
          <label htmlFor="vault-secret">كلمة سر الخزنة (12 حرفًا على الأقل)</label>
          <input id="vault-secret" type="password" autoComplete={exists?"current-password":"new-password"}
            minLength={12} required value={secret} onChange={e=>setSecret(e.target.value)}/>
          {!exists&&<><label htmlFor="vault-confirm">تأكيد كلمة السر</label>
          <input id="vault-confirm" type="password" autoComplete="new-password" required
            value={confirm} onChange={e=>setConfirm(e.target.value)}/></>}
          <button disabled={loading} type="submit">{exists?"فتح الخزنة":"إنشاء خزنة محلية"}</button>
        </form>
        <p className="muted">الرقم السري القصير والبصمة قيد التطوير لربطهما بـ Android Keystore. لا نخزّن PIN ضعيفًا لحماية أموالك.</p>
        <p className="muted">تُقفل الخزنة عند مغادرة التطبيق أو بعد دقيقتين دون نشاط. عند فقدان الهاتف دون نسخة مشفرة خارج التطبيق لا يمكن استعادة بياناتك.</p>
      </section>:
      <>
        <div className="row"><span className="muted">لا توجد مزامنة أو حساب سحابي في هذا الوضع</span>
        <button type="button" onClick={lockVault}>قفل الخزنة</button></div>
        <section className="card"><h2>المحافظ والأرصدة</h2>
          {wallets.length===0?<p className="muted">ابدأ بإنشاء أول محفظة مالية.</p>:
          wallets.map(w=><div className="entry row" key={w.id}>
            <span>{w.name}</span><strong data-testid="wallet-balance" data-halalas={balanceHalalas(ledger!,w.id)} dir="ltr">{currency(balanceHalalas(ledger!,w.id))}</strong>
          </div>)}
          <form onSubmit={addWallet}><label htmlFor="wallet-name">اسم المحفظة</label>
          <input id="wallet-name" placeholder="نقدي، حساب بنكي..." value={walletName} maxLength={120}
            required onChange={e=>setWalletName(e.target.value)}/>
          <label htmlFor="opening-balance">الرصيد الافتتاحي (ريال)</label>
          <input id="opening-balance" inputMode="decimal" value={opening} required onChange={e=>setOpening(e.target.value)}/>
          <button disabled={loading} type="submit">إضافة محفظة</button></form>
        </section>
        {wallets.length>0&&<section className="card"><h2>دخل ومصروف</h2>
          <form onSubmit={addTransaction}>
            <label htmlFor="entry-wallet">المحفظة</label><select id="entry-wallet" value={selected?.id??""} onChange={e=>setWalletId(e.target.value)}>
              {wallets.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
            </select>
            <label htmlFor="entry-kind">نوع العملية</label><select id="entry-kind" value={kind} onChange={e=>setKind(e.target.value as LedgerKind)}>
              <option value="expense">مصروف</option><option value="income">دخل</option>
            </select>
            <label htmlFor="entry-amount">المبلغ بالريال</label><input id="entry-amount" value={amount} inputMode="decimal" required onChange={e=>setAmount(e.target.value)}/>
            <label htmlFor="entry-category">التصنيف</label><input id="entry-category" value={category} maxLength={100} onChange={e=>setCategory(e.target.value)}/>
            <label htmlFor="entry-note">البيان</label><input id="entry-note" value={note} maxLength={300} onChange={e=>setNote(e.target.value)}/>
            <button type="submit" disabled={loading}>حفظ العملية</button>
          </form>
          <h2>آخر العمليات</h2>
          {entries.slice(0,25).map(e=><div key={e.id} className="entry row">
            <div><div>{e.category||e.note||"بدون وصف"}</div><small className="muted">{e.occurredAt.slice(0,10)}</small></div>
            <strong dir="ltr">{e.kind==="income"?"+":"−"}{currency(e.amountHalalas)}</strong>
          </div>)}
        </section>}
        <DebtsSection ledger={ledger!} loading={loading} onChange={async change=>{
          if(!session)return;
          await run(async()=>{
            const next=await session.commit(change);
            setLedger(next);setNotice("تم حفظ حركة الدين محليًا");
          });
        }}/>
        <InvestmentsSection ledger={ledger!} loading={loading} onChange={async change=>{
          if(!session)return;
          await run(async()=>{
            const next=await session.commit(change);
            setLedger(next);setNotice("تم حفظ حركة الاستثمار داخل الخزنة المشفرة");
          });
        }}/>
        <ZakatPreviewSection ledger={ledger!}/>
        <section className="card"><h2>النسخ الاحتياطي المشفر</h2>
          <p className="muted">كل ملف يُشفَّر AES-256 قبل الحفظ أو المشاركة. لا يُرسل الملف تلقائيًا لأي جهة.</p>
          <label htmlFor="backup-password">كلمة مرور مستقلة للنسخة (12 حرفًا على الأقل)</label>
          <input id="backup-password" type="password" minLength={12} value={backupPassword}
            onChange={e=>setBackupPassword(e.target.value)} placeholder="ضرورية للحفظ أو الاستعادة"/>
          <div className="row">
            <button type="button" disabled={loading||backupPassword.length<12} onClick={()=>void exportBackup(false)}>
              حفظ نسخة مشفرة داخل التطبيق
            </button>
            <button type="button" disabled={loading||backupPassword.length<12} onClick={()=>void exportBackup(true)}>
              مشاركة / حفظ في Google Drive
            </button>
          </div>
          <p className="muted">مهم: النسخة داخل التطبيق تُحذف عند إزالة التطبيق. للحفظ الآمن اختر Google Drive أو ملفات الجهاز من قائمة Android. رفع Drive ليس تلقائياً.</p>
          <h2>استعادة نسخة سابقة</h2>
          {saved.length>0&&<><label htmlFor="saved-backup">نسخة موجودة داخل التطبيق</label><select id="saved-backup" value={restoreName}
            onChange={e=>{setRestoreName(e.target.value);setRestoreFile(null);}}>
            <option value="">اختر النسخة</option>{saved.map(name=><option key={name} value={name}>{name}</option>)}
          </select></>}
          <label htmlFor="import-backup">أو اختر ملف JSON مشفرًا من الجهاز أو Drive</label>
          <input id="import-backup" type="file" accept=".json,application/json" onChange={e=>{setRestoreFile(e.target.files?.[0]??null);setRestoreName("");}}/>
          <label htmlFor="restore-confirmation">تأكيد الاستعادة (اكتب: استعادة)</label>
          <input id="restore-confirmation" value={confirmRestore} onChange={e=>setConfirmRestore(e.target.value)}/>
          <button type="button" disabled={loading||confirmRestore!=="استعادة"||!backupPassword}
            onClick={()=>void restore()}>استعادة بعد إنشاء نقطة رجوع</button>
        </section>
        <div className="card muted">هذه نسخة Android المحلية التجريبية: تدعم المحافظ والدخل والمصاريف والديون والتحصيل والسداد والاستثمارات والذهب والنسخ المشفرة.
          تتوفر معاينة زكاة توضيحية فقط؛ وظائف الزكاة الكاملة والعملات المتعددة والمزامنة ليست جاهزة بعد.
          نسخة الويب الحالية تستمر على Supabase دون تغيير.</div>
      </>}
  </main>;
}
