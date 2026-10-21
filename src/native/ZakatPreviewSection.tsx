import {useState,type FormEvent} from "react";
import {parseHalalas,type LocalLedger} from "./model";
import {debtTotalsHalalas} from "./debts";
import {investmentPosition} from "./investments";
import {previewLocalZakat,type LocalZakatPreview} from "./zakat-preview";

function nonnegativeHalalas(text:string):number {
 return text.trim()===""||text.trim()==="0"?0:parseHalalas(text);
}
const amount=(n:number)=>(n/100).toLocaleString("ar-SA",
  {minimumFractionDigits:2,maximumFractionDigits:2})+" ر.س";
export function ZakatPreviewSection({ledger}: {ledger:LocalLedger}){
 const [nisabMethod,setNisabMethod]=useState<"gold"|"silver">("gold");
 const [nisabPrice,setNisabPrice]=useState("");
 const [selectedIds,setSelectedIds]=useState<string[]>([]);
 const [receivables,setReceivables]=useState("0");
 const [payables,setPayables]=useState("0");
 const [haul,setHaul]=useState(false);
 const [preview,setPreview]=useState<LocalZakatPreview|null>(null);
 const [error,setError]=useState("");
 const totals=debtTotalsHalalas(ledger);
 function calculate(e:FormEvent){
  e.preventDefault();setError("");setPreview(null);
  try{
   const result=previewLocalZakat(ledger,{
    nisabMethod,nisabGramPriceHalalas:parseHalalas(nisabPrice),
    includedInvestmentIds:selectedIds.filter(id=>ledger.investments.some(inv=>inv.id===id)),
    collectibleReceivableHalalas:nonnegativeHalalas(receivables),
    eligiblePayableHalalas:nonnegativeHalalas(payables),
    lunarHaulConfirmed:haul,
   });
   setPreview(result);
  }catch(e){setError(e instanceof Error?e.message:String(e));}
 }
 return <section className="card" data-testid="local-zakat-preview">
  <h2>مراجعة زكاة المال — تقدير اختياري</h2>
  <p className="muted">معاينة حسابية فقط، وليست فتوى أو إثباتًا لوجوب الزكاة. حدد أصولك الزكوية بنفسك، وتأكد من النصاب والحول وطبيعة الديون وفق الرأي الشرعي الذي تتبعه. لا تُرسل أي بيانات إلى الإنترنت.</p>
  <form onSubmit={calculate}>
   <label htmlFor="nisab-method">معيار النصاب</label>
   <select id="nisab-method" value={nisabMethod} onChange={e=>{setNisabMethod(e.target.value as "gold"|"silver");setPreview(null);}}>
    <option value="gold">ذهب — 85 جرام</option>
    <option value="silver">فضة — 595 جرام</option>
   </select>
   <label htmlFor="nisab-price">سعر جرام {nisabMethod==="gold"?"الذهب":"الفضة"} بالريال (أدخله يدويًا)</label>
   <input id="nisab-price" inputMode="decimal" required value={nisabPrice} onChange={e=>{setNisabPrice(e.target.value);setPreview(null);}}/>
   <h3>الاستثمارات المراد إدخال قيمتها</h3>
   <p className="muted">لا تدخل الأصول تلقائيًا بسبب اختلاف الحكم باختلاف طبيعة الأصل ونية الاقتناء. حدد فقط ما تحقق من دخوله في وعائك الزكوي.</p>
   {ledger.investments.length===0?<p className="muted">لا توجد استثمارات مسجلة.</p>:
    ledger.investments.map(inv=><label className="row" key={inv.id} htmlFor={`zakat-inv-${inv.id}`}>
     <span>{inv.name} — {inv.intent==="trade"?"للتجارة":"للاقتناء"}
      <small className="muted"> ({investmentPosition(ledger,inv.id).marketValueHalalas===null?"سعر غير محدد":"سعر يدوي"})</small>
     </span>
     <input id={`zakat-inv-${inv.id}`} type="checkbox" style={{width:"auto",minHeight:"auto"}}
      checked={selectedIds.includes(inv.id)} onChange={e=>{
       setSelectedIds(old=>e.target.checked?[...old,inv.id]:old.filter(id=>id!==inv.id));setPreview(null);
      }}/>
    </label>)}
   <p className="muted">إجمالي الديون المستحقة لك: {amount(totals.receivable)} · المستحقة عليك: {amount(totals.payable)}</p>
   <label htmlFor="zakat-collectible">المستحقات القابلة للتحصيل والمؤهلة للزكاة (ريال)</label>
   <input id="zakat-collectible" inputMode="decimal" value={receivables} onChange={e=>{setReceivables(e.target.value);setPreview(null);}}/>
   <label htmlFor="zakat-deductible">الالتزامات المؤهلة للخصم حسب حالتك (ريال)</label>
   <input id="zakat-deductible" inputMode="decimal" value={payables} onChange={e=>{setPayables(e.target.value);setPreview(null);}}/>
   <label htmlFor="zakat-haul" className="row">
    <span>أؤكد تحقق الحول الهجري وفق تاريخ ووضعي المالي</span>
    <input id="zakat-haul" type="checkbox" style={{width:"auto",minHeight:"auto"}} checked={haul}
     onChange={e=>{setHaul(e.target.checked);setPreview(null);}}/>
   </label>
   <button type="submit">احسب المعاينة</button>
  </form>
  {error&&<p role="alert" className="error">{error}</p>}
  {preview&&<div className="entry" data-testid="zakat-result">
   <div className="row"><span>الأرصدة النقدية</span><strong>{amount(preview.cashHalalas)}</strong></div>
   <div className="row"><span>قيمة الأصول المحددة</span><strong>{amount(preview.investmentsHalalas)}</strong></div>
   <div className="row"><span>الوعاء التقديري بعد الإضافات والخصومات</span><strong data-testid="zakat-base" data-halalas={preview.netHalalas}>{amount(preview.netHalalas)}</strong></div>
   <div className="row"><span>قيمة النصاب المدخل</span><strong>{amount(preview.nisabHalalas)}</strong></div>
   {preview.status==="haul_unconfirmed"?
    <p className="muted">لم يُؤكد الحول؛ لن يعرض التطبيق مبلغ زكاة مستحقًا.</p>:
    preview.status==="below_nisab"?
    <p className="muted">المبلغ المحدد أقل من النصاب المحسوب بالمدخلات الحالية.</p>:
    <div className="row"><span>تقدير بنسبة 2.5%</span>
     <strong data-testid="zakat-estimate" data-halalas={preview.estimateHalalas??""}>{amount(preview.estimateHalalas??0)}</strong></div>}
  </div>}
 </section>;
}
