import {balanceHalalas,type LocalLedger} from "./model";
import {debtTotalsHalalas} from "./debts";
import {investmentPosition} from "./investments";

// Offline illustration, not an automatic religious ruling.
// Investments are only included after an explicit user selection.
// Debt deductibility and receivables collectibility must be user-supplied.
export interface LocalZakatOptions {
  nisabMethod:"gold"|"silver";
  nisabGramPriceHalalas:number;
  includedInvestmentIds:readonly string[];
  collectibleReceivableHalalas:number;
  eligiblePayableHalalas:number;
  lunarHaulConfirmed:boolean;
}
export interface LocalZakatPreview {
  status:"estimated"|"below_nisab"|"haul_unconfirmed";
  cashHalalas:number;investmentsHalalas:number;
  receivablesHalalas:number;deductibleHalalas:number;
  netHalalas:number;nisabHalalas:number;
  estimateHalalas:number|null;
}
function safeNonNegative(value:number):boolean{
  return Number.isSafeInteger(value)&&value>=0&&value<=1_000_000_000_000;
}
export function previewLocalZakat(ledger:LocalLedger,opts:LocalZakatOptions):LocalZakatPreview {
  if(!["gold","silver"].includes(opts.nisabMethod)
    ||!Number.isSafeInteger(opts.nisabGramPriceHalalas)
    ||opts.nisabGramPriceHalalas<=0||opts.nisabGramPriceHalalas>1_000_000_000_000
    ||typeof opts.lunarHaulConfirmed!=="boolean"
    ||!Array.isArray(opts.includedInvestmentIds))throw new Error("إعدادات النصاب غير صالحة");
  const outstanding=debtTotalsHalalas(ledger);
  if(!safeNonNegative(opts.collectibleReceivableHalalas)
    ||opts.collectibleReceivableHalalas>outstanding.receivable
    ||!safeNonNegative(opts.eligiblePayableHalalas)
    ||opts.eligiblePayableHalalas>outstanding.payable)
    throw new Error("مبلغ الديون المختار أكبر من الرصيد الفعلي أو غير صالح");
  const ids=new Set(opts.includedInvestmentIds);
  if(ids.size!==opts.includedInvestmentIds.length)throw new Error("أصل مكرر في قائمة الزكاة");
  const allIds=new Set(ledger.investments.map(inv=>inv.id));
  let investmentsHalalas=0;
  for(const id of ids){
    if(!allIds.has(id))throw new Error("أصل غير موجود في الخزنة");
    const val=investmentPosition(ledger,id).marketValueHalalas;
    if(val===null)throw new Error("أدخل السعر السوقي أولًا لكل أصل تختار إدخاله");
    investmentsHalalas+=val;
  }
  let cashHalalas=0;
  for(const w of ledger.wallets){
    const balance=balanceHalalas(ledger,w.id);
    if(balance<0)throw new Error("يوجد رصيد محفظة سالب؛ يلزم مراجعته قبل التقدير");
    cashHalalas+=balance;
  }
  const raw=cashHalalas+investmentsHalalas+
    opts.collectibleReceivableHalalas-opts.eligiblePayableHalalas;
  const netHalalas=Math.max(0,raw);
  const nisabHalalas=(opts.nisabMethod==="gold"?85:595)*opts.nisabGramPriceHalalas;
  if(![cashHalalas,investmentsHalalas,raw,nisabHalalas,netHalalas].every(
    n=>Number.isSafeInteger(n)&&Math.abs(n)<=1_000_000_000_000))
    throw new Error("تجاوزت قيمة التقدير الحدود الآمنة");
  const common={cashHalalas,investmentsHalalas,
    receivablesHalalas:opts.collectibleReceivableHalalas,
    deductibleHalalas:opts.eligiblePayableHalalas,
    netHalalas,nisabHalalas};
  if(netHalalas<nisabHalalas)return{...common,status:"below_nisab",estimateHalalas:0};
  if(!opts.lunarHaulConfirmed)return{...common,status:"haul_unconfirmed",estimateHalalas:null};
  return {...common,status:"estimated",estimateHalalas:Math.round(netHalalas*25/1000)};
}
