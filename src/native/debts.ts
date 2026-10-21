import {isLocalLedger,parseHalalas,type DebtSide,type LocalLedger,type LocalDebt} from "./model";
export function remainingDebtHalalas(ledger:LocalLedger,debtId:string):number{
  const debt=ledger.debts.find(d=>d.id===debtId);
  if(!debt)throw new Error("الدين غير موجود");
  const paid=ledger.debtPayments.filter(p=>p.debtId===debtId)
    .reduce((sum,p)=>sum+p.amountHalalas,0);
  return debt.principalHalalas-paid;
}
export function debtTotalsHalalas(ledger:LocalLedger):{receivable:number;payable:number}{
  return ledger.debts.reduce((sum,d)=>{
    sum[d.side]+=remainingDebtHalalas(ledger,d.id);
    return sum;
  },{receivable:0,payable:0});
}
export function createLocalDebt(ledger:LocalLedger,data:{
  contactName:string;side:DebtSide;amount:string;walletId:string|null;note:string;
}):LocalLedger{
  if(!["receivable","payable"].includes(data.side)||!data.contactName.trim()
    ||data.contactName.trim().length>120||data.note.length>300)
    throw new Error("بيانات الدين غير صحيحة");
  if(data.walletId!==null&&!ledger.wallets.some(w=>w.id===data.walletId))
    throw new Error("المحفظة المرتبطة غير موجودة");
  const amount=parseHalalas(data.amount),now=new Date().toISOString();
  const newDebt:LocalDebt={
    id:crypto.randomUUID(),contactName:data.contactName.trim(),side:data.side,
    principalHalalas:amount,walletId:data.walletId,note:data.note,
    occurredAt:now,createdAt:now,
  };
  const next:LocalLedger={...ledger,debts:[...ledger.debts,newDebt]};
  if(!isLocalLedger(next))throw new Error("تعذر حفظ الدين");
  return next;
}
export function settleLocalDebt(ledger:LocalLedger,data:{
  debtId:string;amount:string;walletId:string|null;note:string;
}):LocalLedger{
  const debt=ledger.debts.find(d=>d.id===data.debtId);
  if(!debt)throw new Error("الدين غير موجود");
  if(data.walletId!==null&&!ledger.wallets.some(w=>w.id===data.walletId))
    throw new Error("المحفظة المرتبطة غير موجودة");
  if(data.note.length>300)throw new Error("البيان طويل جداً");
  const amount=parseHalalas(data.amount);
  if(amount>remainingDebtHalalas(ledger,data.debtId))
    throw new Error("لا يمكن تحصيل أو سداد أكثر من المتبقي للدين");
  const now=new Date().toISOString();
  const next:LocalLedger={...ledger,debtPayments:[...ledger.debtPayments,{
    id:crypto.randomUUID(),debtId:debt.id,amountHalalas:amount,
    walletId:data.walletId,note:data.note,occurredAt:now,createdAt:now,
  }]};
  if(!isLocalLedger(next))throw new Error("تعذر حفظ التحصيل أو السداد");
  return next;
}
