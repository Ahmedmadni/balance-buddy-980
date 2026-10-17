import {describe,expect,test} from "bun:test";
import {appendWallet,emptyLocalLedger} from "./model";
import {createLocalDebt} from "./debts";
import {appendInvestmentTrade,createLocalInvestment} from "./investments";
import {previewLocalZakat,type LocalZakatOptions} from "./zakat-preview";
const opts=(changes:Partial<LocalZakatOptions>={}):LocalZakatOptions=>({
 nisabMethod:"gold",nisabGramPriceHalalas:30_000,includedInvestmentIds:[],
 collectibleReceivableHalalas:0,eligiblePayableHalalas:0,
 lunarHaulConfirmed:false,...changes,
});
describe("local offline zakat preview is user-confirmed and conservative",()=>{
  test("never claims a zakat amount without user confirming haul",()=>{
    const l=appendWallet(emptyLocalLedger(),"نقد","50000");
    const result=previewLocalZakat(l,opts());
    expect(result.status).toBe("haul_unconfirmed");
    expect(result.estimateHalalas).toBeNull();
    expect(result.nisabHalalas).toBe(2_550_000);
  });
  test("2.5 percent only for above-nisab, haul-confirmed amount",()=>{
    const l=appendWallet(emptyLocalLedger(),"نقد","50000");
    expect(previewLocalZakat(l,opts({lunarHaulConfirmed:true}))).toMatchObject({
      status:"estimated",netHalalas:5_000_000,estimateHalalas:125_000,
    });
  });
  test("below nisab returns zero even when haul confirmed",()=>{
    const l=appendWallet(emptyLocalLedger(),"نقد","100");
    expect(previewLocalZakat(l,opts({lunarHaulConfirmed:true})).estimateHalalas).toBe(0);
  });
  test("hold and trade investments require explicit selection and manual price",()=>{
    let l=appendWallet(emptyLocalLedger(),"نقد","30000");
    l=createLocalInvestment(l,{name:"ذهب ادخار",type:"gold",intent:"hold",marketPrice:"400"});
    l=appendInvestmentTrade(l,{investmentId:l.investments[0].id,side:"buy",
      quantity:"10",unitPrice:"300",walletId:l.wallets[0].id});
    expect(previewLocalZakat(l,opts()).investmentsHalalas).toBe(0);
    expect(previewLocalZakat(l,opts({includedInvestmentIds:[l.investments[0].id]})).investmentsHalalas).toBe(400000);
  });
  test("unknown market price or duplicate ID fails closed",()=>{
    let l=appendWallet(emptyLocalLedger(),"نقد","1000");
    l=createLocalInvestment(l,{name:"صندوق",type:"fund",intent:"hold",marketPrice:""});
    const id=l.investments[0].id;
    expect(()=>previewLocalZakat(l,opts({includedInvestmentIds:[id]}))).toThrow("السعر");
    expect(()=>previewLocalZakat(l,opts({includedInvestmentIds:[id,id]}))).toThrow("مكرر");
    expect(()=>previewLocalZakat(l,opts({includedInvestmentIds:["unknown"]}))).toThrow("غير موجود");
  });
  test("receivables and payables are only counted in manually eligible amounts",()=>{
    let l=appendWallet(emptyLocalLedger(),"نقد","1000");
    l=createLocalDebt(l,{contactName:"شخص",side:"receivable",amount:"200",walletId:null,note:""});
    l=createLocalDebt(l,{contactName:"شخص",side:"payable",amount:"150",walletId:null,note:""});
    expect(previewLocalZakat(l,opts({collectibleReceivableHalalas:10000,eligiblePayableHalalas:5000})).netHalalas).toBe(105000);
    expect(()=>previewLocalZakat(l,opts({eligiblePayableHalalas:15001}))).toThrow();
  });
});
