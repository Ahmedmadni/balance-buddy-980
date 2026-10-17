import {useState,type FormEvent} from "react";
import {type LocalLedger,type LocalInvestmentType,type InvestmentIntent,
  type InvestmentTradeSide} from "./model";
import {createLocalInvestment,appendInvestmentTrade,updateInvestmentPrice,
  investmentPosition} from "./investments";

const formatMoney=(x:number)=>(x/100).toLocaleString("ar-SA",
  {minimumFractionDigits:2,maximumFractionDigits:2})+" ر.س";
const formatQuantity=(x:number)=>(x/1000).toLocaleString("en-US",
  {minimumFractionDigits:0,maximumFractionDigits:3});
const kinds:Record<LocalInvestmentType,string>={
  gold:"ذهب (جرام)",stocks:"أسهم (سهم)",fund:"صندوق استثمار (وحدة)",other:"استثمار آخر (وحدة)",
};
export function InvestmentsSection({ledger,loading,onChange}:{
  ledger:LocalLedger;loading:boolean;
  onChange:(change:(old:LocalLedger)=>LocalLedger)=>Promise<void>;
}){
  const [name,setName]=useState("");
  const [type,setType]=useState<LocalInvestmentType>("gold");
  const [intent,setIntent]=useState<InvestmentIntent>("hold");
  const [initialPrice,setInitialPrice]=useState("");
  const [investmentId,setInvestmentId]=useState("");
  const [side,setSide]=useState<InvestmentTradeSide>("buy");
  const [quantity,setQuantity]=useState("");
  const [unitPrice,setUnitPrice]=useState("");
  const [walletId,setWalletId]=useState("none");
  const [newMarketPrice,setNewMarketPrice]=useState("");
  const chosen=ledger.investments.find(i=>i.id===investmentId)??ledger.investments[0];
  async function add(e:FormEvent){
    e.preventDefault();
    await onChange(old=>createLocalInvestment(old,{name,type,intent,marketPrice:initialPrice}));
    setName("");setInitialPrice("");
  }
  async function addTrade(e:FormEvent){
    e.preventDefault();
    if(!chosen)return;
    await onChange(old=>appendInvestmentTrade(old,{
      investmentId:chosen.id,side,quantity,unitPrice,
      walletId:walletId==="none"?null:walletId,
    }));
    setQuantity("");setUnitPrice("");
  }
  async function priceChange(e:FormEvent){
    e.preventDefault();
    if(!chosen)return;
    await onChange(old=>updateInvestmentPrice(old,chosen.id,newMarketPrice));
    setNewMarketPrice("");
  }
  return <section className="card" data-testid="local-investments">
    <h2>الاستثمارات والذهب</h2>
    <p className="muted">الاستثمارات محفوظة محليًا. السعر الحالي يدوي فقط بالريال السعودي؛ لا توجد أسعار لحظية أو جلب بيانات عبر الإنترنت. الشراء والبيع لا يُسجَّلان تلقائيًا كمصروف أو إيراد.</p>
    <h3>إضافة أصل</h3>
    <form onSubmit={e=>void add(e)}>
      <label htmlFor="inv-name">اسم الاستثمار</label>
      <input id="inv-name" required maxLength={120} value={name}
        onChange={e=>setName(e.target.value)} placeholder="ذهب ادخار أو سهم معين"/>
      <label htmlFor="inv-type">نوع الاستثمار</label>
      <select id="inv-type" value={type} onChange={e=>setType(e.target.value as LocalInvestmentType)}>
        {Object.entries(kinds).map(([value,label])=><option key={value} value={value}>{label}</option>)}
      </select>
      <label htmlFor="inv-intent">غرض الاحتفاظ</label>
      <select id="inv-intent" value={intent} onChange={e=>setIntent(e.target.value as InvestmentIntent)}>
        <option value="hold">اقتناء / ادخار</option><option value="trade">بغرض التجارة</option>
      </select>
      <label htmlFor="inv-price">سعر السوق الحالي بالريال للوحدة (اختياري)</label>
      <input id="inv-price" inputMode="decimal" value={initialPrice} onChange={e=>setInitialPrice(e.target.value)}/>
      <button type="submit" disabled={loading}>إضافة الاستثمار</button>
    </form>
    <h3>المراكز الحالية</h3>
    {ledger.investments.length===0?<p className="muted">لا توجد أصول محلية مسجلة.</p>:
      ledger.investments.map(inv=>{
        const pos=investmentPosition(ledger,inv.id);
        return <div className="entry" key={inv.id} data-testid="investment-position">
          <div className="row"><strong>{inv.name}</strong>
            <span>{formatQuantity(pos.quantityMilli)} {inv.type==="gold"?"جرام":"وحدة"}</span></div>
          <div className="muted">{kinds[inv.type]} · {inv.intent==="trade"?"للتجارة":"للاقتناء / الادخار"}</div>
          <div className="row">
            <span>التكلفة المتبقية <strong data-testid="investment-cost" data-halalas={pos.costHalalas}>{formatMoney(pos.costHalalas)}</strong></span>
            <span>القيمة السوقية <strong data-testid="investment-market" data-halalas={pos.marketValueHalalas??"unknown"}>{pos.marketValueHalalas===null?"غير محددة":formatMoney(pos.marketValueHalalas)}</strong></span>
          </div>
          <div className="row">
            <span>الربح/الخسارة المحققة <strong data-testid="investment-realized" data-halalas={pos.realizedPnlHalalas}>{formatMoney(pos.realizedPnlHalalas)}</strong></span>
            <span>غير المحققة: {pos.unrealizedPnlHalalas===null?"غير محددة":formatMoney(pos.unrealizedPnlHalalas)}</span>
          </div>
        </div>;
      })}
    {chosen&&<><h3>شراء أو بيع</h3>
      <form onSubmit={e=>void addTrade(e)}>
        <label htmlFor="trade-investment">الاستثمار</label>
        <select id="trade-investment" value={chosen.id} onChange={e=>setInvestmentId(e.target.value)}>
          {ledger.investments.map(inv=><option key={inv.id} value={inv.id}>{inv.name}</option>)}
        </select>
        <label htmlFor="trade-side">نوع الحركة</label>
        <select id="trade-side" value={side} onChange={e=>setSide(e.target.value as InvestmentTradeSide)}>
          <option value="buy">شراء</option><option value="sell">بيع</option>
        </select>
        <label htmlFor="trade-quantity">الكمية بالجرام أو الوحدة (حتى 3 منازل)</label>
        <input id="trade-quantity" required inputMode="decimal" value={quantity}
          onChange={e=>setQuantity(e.target.value)}/>
        <label htmlFor="trade-unit-price">سعر الشراء أو البيع للوحدة بالريال</label>
        <input id="trade-unit-price" required inputMode="decimal" value={unitPrice}
          onChange={e=>setUnitPrice(e.target.value)}/>
        <label htmlFor="trade-wallet">المحفظة المرتبطة بالحركة</label>
        <select id="trade-wallet" value={walletId} onChange={e=>setWalletId(e.target.value)}>
          <option value="none">بدون محفظة (عملية سابقة أو خارج المحافظ)</option>
          {ledger.wallets.map(w=><option key={w.id} value={w.id}>{w.name}</option>)}
        </select>
        <button type="submit" disabled={loading}>تسجيل {side==="buy"?"الشراء":"البيع"}</button>
      </form>
      <h3>تحديث السعر يدويًا</h3>
      <form onSubmit={e=>void priceChange(e)}>
        <label htmlFor="price-investment">الاستثمار المختار</label>
        <select id="price-investment" value={chosen.id} onChange={e=>setInvestmentId(e.target.value)}>
          {ledger.investments.map(inv=><option key={inv.id} value={inv.id}>{inv.name}</option>)}
        </select>
        <label htmlFor="market-price-update">السعر الحالي بالريال للوحدة (اتركه فارغًا لمسح السعر)</label>
        <input id="market-price-update" inputMode="decimal" value={newMarketPrice}
          onChange={e=>setNewMarketPrice(e.target.value)}/>
        <button type="submit" disabled={loading}>تحديث السعر</button>
      </form>
    </>}
    <p className="muted">لا تشمل هذه المرحلة رسوم السمسرة أو تجزئة الأسهم أو ضرائب العمليات أو مراكز البيع على المكشوف، ولا تعطي وحدها حكمًا نهائيًا لزكاة الاستثمارات.</p>
  </section>;
}
