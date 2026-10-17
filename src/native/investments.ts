import { isLocalLedger, parseHalalas, type LocalLedger,
  type LocalInvestment, type LocalInvestmentType, type InvestmentIntent,
  type InvestmentTradeSide, type LocalInvestmentTrade } from "./model";

export function parseMilliQuantity(input:string):number{
  const raw=input.trim();
  if(!/^(?:0|[1-9]\d{0,9})(?:\.\d{1,3})?$/.test(raw))
    throw new Error("أدخل كمية صحيحة بحد أقصى ثلاثة منازل عشرية");
  const [whole,fraction=""]=raw.split(".");
  const result=Number(whole)*1000+Number(fraction.padEnd(3,"0"));
  if(!Number.isSafeInteger(result)||result<=0)throw new Error("الكمية غير صالحة");
  return result;
}
export function grossValueHalalas(quantityMilli:number, unitPriceHalalas:number):number{
  if(!Number.isSafeInteger(quantityMilli)||quantityMilli<=0
    ||!Number.isSafeInteger(unitPriceHalalas)||unitPriceHalalas<=0)
    throw new Error("الكمية أو السعر غير صالح");
  const value=Math.round(quantityMilli*unitPriceHalalas/1000);
  if(!Number.isSafeInteger(value)||value<=0||value>1_000_000_000_000)
    throw new Error("قيمة العملية يجب أن تكون أكبر من صفر وضمن الحدود");
  return value;
}
export interface InvestmentPosition {
  quantityMilli:number; costHalalas:number; proceedsHalalas:number;
  realizedPnlHalalas:number; marketValueHalalas:number|null;
  unrealizedPnlHalalas:number|null;
}
export function investmentPosition(ledger:LocalLedger,investmentId:string):InvestmentPosition{
  const inv=ledger.investments.find(x=>x.id===investmentId);
  if(!inv)throw new Error("الأصل غير موجود");
  let quantityMilli=0,costHalalas=0,proceedsHalalas=0,realizedPnlHalalas=0;
  // Append order is part of ledger validation: selling cannot precede buying.
  for(const tx of ledger.investmentTrades){
    if(tx.investmentId!==investmentId)continue;
    if(tx.side==="buy"){
      quantityMilli+=tx.quantityMilli;
      costHalalas+=tx.grossHalalas;
    }else{
      if(tx.quantityMilli>quantityMilli||quantityMilli<=0)
        throw new Error("البيع يتجاوز الكمية المتاحة");
      const basis=tx.quantityMilli===quantityMilli?costHalalas:
        Math.round(costHalalas*tx.quantityMilli/quantityMilli);
      costHalalas-=basis;
      quantityMilli-=tx.quantityMilli;
      proceedsHalalas+=tx.grossHalalas;
      realizedPnlHalalas+=tx.grossHalalas-basis;
    }
  }
  const marketValueHalalas=inv.marketPriceHalalas===null?null:
    quantityMilli===0?0:grossValueHalalas(quantityMilli,inv.marketPriceHalalas);
  return {
    quantityMilli,costHalalas,proceedsHalalas,realizedPnlHalalas,
    marketValueHalalas,unrealizedPnlHalalas:marketValueHalalas===null?null:marketValueHalalas-costHalalas,
  };
}
export function createLocalInvestment(ledger:LocalLedger,data:{
  name:string;type:LocalInvestmentType;intent:InvestmentIntent;marketPrice:string;
}):LocalLedger{
  if(!data.name.trim()||data.name.trim().length>120
    ||!["gold","stocks","fund","other"].includes(data.type)
    ||!["trade","hold"].includes(data.intent))throw new Error("بيانات الأصل غير صالحة");
  const price=data.marketPrice.trim()?parseHalalas(data.marketPrice):null;
  const inv:LocalInvestment={id:crypto.randomUUID(),name:data.name.trim(),type:data.type,
    intent:data.intent,marketPriceHalalas:price,createdAt:new Date().toISOString()};
  const next:LocalLedger={...ledger,investments:[...ledger.investments,inv]};
  if(!isLocalLedger(next))throw new Error("تعذر إنشاء الأصل");
  return next;
}
export function updateInvestmentPrice(ledger:LocalLedger,investmentId:string,price:string):LocalLedger{
  if(!ledger.investments.some(x=>x.id===investmentId))throw new Error("الأصل غير موجود");
  const marketPriceHalalas=price.trim()?parseHalalas(price):null;
  const next:LocalLedger={...ledger,investments:ledger.investments.map(inv=>
    inv.id===investmentId?{...inv,marketPriceHalalas}:inv)};
  if(!isLocalLedger(next))throw new Error("تعذر تحديث سعر السوق");
  return next;
}
export function appendInvestmentTrade(ledger:LocalLedger,data:{
  investmentId:string;side:InvestmentTradeSide;quantity:string;
  unitPrice:string;walletId:string|null;
}):LocalLedger{
  if(!ledger.investments.some(inv=>inv.id===data.investmentId)
    ||!["buy","sell"].includes(data.side))throw new Error("الاستثمار أو نوع العملية غير صالح");
  if(data.walletId!==null&&!ledger.wallets.some(w=>w.id===data.walletId))
    throw new Error("المحفظة المرتبطة غير موجودة");
  const quantityMilli=parseMilliQuantity(data.quantity);
  const unitPriceHalalas=parseHalalas(data.unitPrice);
  const grossHalalas=grossValueHalalas(quantityMilli,unitPriceHalalas);
  if(data.side==="sell"&&quantityMilli>investmentPosition(ledger,data.investmentId).quantityMilli)
    throw new Error("لا يمكن بيع كمية أكبر من الكمية المملوكة");
  const now=new Date().toISOString();
  const tx:LocalInvestmentTrade={id:crypto.randomUUID(),investmentId:data.investmentId,
    side:data.side,quantityMilli,unitPriceHalalas,grossHalalas,walletId:data.walletId,
    occurredAt:now,createdAt:now};
  const next:LocalLedger={...ledger,investmentTrades:[...ledger.investmentTrades,tx]};
  if(!isLocalLedger(next))throw new Error("تعذر حفظ العملية الاستثمارية");
  return next;
}
