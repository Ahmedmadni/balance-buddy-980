import {useState,type FormEvent} from "react";
import {type DebtSide,type LocalLedger} from "./model";
import {createLocalDebt,debtTotalsHalalas,remainingDebtHalalas,settleLocalDebt} from "./debts";
export function DebtsSection({ledger,loading,onChange}:{
  ledger:LocalLedger;
  loading:boolean;
  onChange:(change:(old:LocalLedger)=>LocalLedger)=>Promise<void>;
}){
  const [contact,setContact]=useState("");
  const [side,setSide]=useState<DebtSide>("receivable");
  const [principal,setPrincipal]=useState("");
  const [originWallet,setOriginWallet]=useState("none");
  const [debtNote,setDebtNote]=useState("");
  const [settlingId,setSettlingId]=useState("");
  const [payment,setPayment]=useState("");
  const [paymentWallet,setPaymentWallet]=useState("none");
  const [paymentNote,setPaymentNote]=useState("");
  const [showClosed,setShowClosed]=useState(false);
  const totals=debtTotalsHalalas(ledger);
  const money=(amount:number)=>(amount/100).toLocaleString("ar-SA",{
    minimumFractionDigits:2,maximumFractionDigits:2,
  })+" ر.س";
  const active=ledger.debts.filter(d=>remainingDebtHalalas(ledger,d.id)>0);
  const shown=showClosed?ledger.debts:active;
  const target=active.find(d=>d.id===settlingId)??active[0];
  async function addDebt(e:FormEvent){
    e.preventDefault();
    await onChange(old=>createLocalDebt(old,{
      contactName:contact,side,amount:principal,
      walletId:originWallet==="none"?null:originWallet,note:debtNote,
    }));
    setContact("");setPrincipal("");setDebtNote("");
  }
  async function settle(e:FormEvent){
    e.preventDefault();
    if(!target)return;
    await onChange(old=>settleLocalDebt(old,{
      debtId:target.id,amount:payment,
      walletId:paymentWallet==="none"?null:paymentWallet,note:paymentNote,
    }));
    setPayment("");setPaymentNote("");
  }
  return <section className="card" data-testid="local-debts">
    <h2>الديون والتحصيل والسداد</h2>
    <p className="muted">ديونك محفوظة على الجهاز فقط. السلف والتحصيلات لا تُحتسب دخلاً أو مصروفًا، وإنما تؤثر في رصيد المحفظة عند ربط حركة نقدية بها.</p>
    <div className="row">
      <div>لي عند الآخرين <strong data-testid="total-receivable" data-halalas={totals.receivable} dir="ltr">{money(totals.receivable)}</strong></div>
      <div>عليّ للآخرين <strong data-testid="total-payable" data-halalas={totals.payable} dir="ltr">{money(totals.payable)}</strong></div>
    </div>
    <h3>إضافة دين</h3>
    <form onSubmit={e=>void addDebt(e)}>
      <label htmlFor="debt-contact">اسم الشخص</label>
      <input id="debt-contact" required maxLength={120} value={contact} onChange={e=>setContact(e.target.value)} placeholder="اسم الدائن أو المدين"/>
      <label htmlFor="debt-side">نوع الدين</label>
      <select id="debt-side" value={side} onChange={e=>setSide(e.target.value as DebtSide)}>
        <option value="receivable">لي عند الآخرين (أقرضت)</option>
        <option value="payable">عليّ للآخرين (اقترضت)</option>
      </select>
      <label htmlFor="debt-principal">مبلغ الدين (ريال)</label>
      <input id="debt-principal" required inputMode="decimal" value={principal} onChange={e=>setPrincipal(e.target.value)}/>
      <label htmlFor="debt-wallet">المحفظة التي تحرك فيها أصل المبلغ</label>
      <select id="debt-wallet" value={originWallet} onChange={e=>setOriginWallet(e.target.value)}>
        <option value="none">بدون محفظة — دين تاريخي/خارج المحافظ</option>
        {ledger.wallets.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
      </select>
      <label htmlFor="debt-note">ملاحظات</label>
      <input id="debt-note" maxLength={300} value={debtNote} onChange={e=>setDebtNote(e.target.value)}/>
      <button disabled={loading} type="submit">حفظ الدين</button>
    </form>
    <h3>الديون المسجلة</h3>
    <label className="row" htmlFor="show-closed-debts">
      <span>عرض الديون المسددة بالكامل</span>
      <input id="show-closed-debts" type="checkbox" style={{width:"auto",minHeight:"auto"}} checked={showClosed}
        onChange={e=>setShowClosed(e.target.checked)}/>
    </label>
    {shown.length===0?<p className="muted">لا توجد ديون {showClosed?"مسجلة":"قائمة"}.</p>:
      shown.map(d=>{
        const remaining=remainingDebtHalalas(ledger,d.id);
        return <div className="entry row" key={d.id}>
          <div><strong>{d.contactName}</strong><div className="muted">{d.side==="receivable"?"لي عليه":"عليّ له"} · {d.note||"بدون ملاحظة"}</div></div>
          <div><strong dir="ltr">{money(remaining)}</strong><div className="muted">{remaining===0?"مسدد بالكامل":`من أصل ${money(d.principalHalalas)}`}</div></div>
        </div>;
      })}
    {target&&<><h3>تسجيل تحصيل أو سداد</h3>
      <form onSubmit={e=>void settle(e)}>
        <label htmlFor="settlement-debt">اختر الدين</label>
        <select id="settlement-debt" value={target.id} onChange={e=>setSettlingId(e.target.value)}>
          {active.map(d=><option key={d.id} value={d.id}>
            {d.contactName} — {d.side==="receivable"?"تحصيل":"سداد"} — {money(remainingDebtHalalas(ledger,d.id))}
          </option>)}
        </select>
        <label htmlFor="settlement-amount">قيمة {target.side==="receivable"?"التحصيل":"السداد"} (ريال)</label>
        <input id="settlement-amount" inputMode="decimal" required value={payment} onChange={e=>setPayment(e.target.value)}/>
        <label htmlFor="settlement-wallet">المحفظة التي تحرك فيها المبلغ</label>
        <select id="settlement-wallet" value={paymentWallet} onChange={e=>setPaymentWallet(e.target.value)}>
          <option value="none">بدون محفظة — تحصيل أو سداد خارج المحافظ</option>
          {ledger.wallets.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <label htmlFor="settlement-note">ملاحظات السداد</label>
        <input id="settlement-note" maxLength={300} value={paymentNote} onChange={e=>setPaymentNote(e.target.value)}/>
        <button disabled={loading} type="submit">تسجيل {target.side==="receivable"?"التحصيل":"السداد"}</button>
      </form>
    </>}
  </section>;
}
