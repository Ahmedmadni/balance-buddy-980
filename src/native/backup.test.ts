import {describe,expect,test} from "bun:test";
import {appendWallet,appendEntry,emptyLocalLedger} from "./model";
import {createLocalDebt,settleLocalDebt} from "./debts";
import {createLocalInvestment,appendInvestmentTrade} from "./investments";
import {createBackup,decryptBackup} from "./backup";
import {encryptRasdBackup} from "../lib/backup/encrypted-v2";

const key="Backup-Password-Only-2026";
describe("Android encrypted local backup contract",()=>{
  test("encrypts debt rows and restores exact original amounts",async()=>{
    let l=appendWallet(emptyLocalLedger(),"نقد","300");
    const w=l.wallets[0].id;
    l=createLocalDebt(l,{contactName:"أحمد تجريبي",side:"receivable",amount:"120.10",walletId:w,note:""});
    l=settleLocalDebt(l,{debtId:l.debts[0].id,amount:"20",walletId:w,note:""});
    const {encrypted}=await createBackup(l,key);
    expect(JSON.stringify(encrypted)).not.toContain("أحمد تجريبي");
    expect(await decryptBackup(encrypted,key)).toEqual(l);
    await expect(decryptBackup(encrypted,"Not-The-Right-Password-2026")).rejects.toThrow();
  });
  test("v3 encrypted backup contains gold, holdings and transactions without exposed names",async()=>{
    let l=appendWallet(emptyLocalLedger(),"البنك","1500");
    l=createLocalInvestment(l,{name:"ذهب ادخار خاص",type:"gold",intent:"hold",marketPrice:"335"});
    l=appendInvestmentTrade(l,{investmentId:l.investments[0].id,side:"buy",
      quantity:"2.500",unitPrice:"300",walletId:l.wallets[0].id});
    const {encrypted}=await createBackup(l,key);
    expect(JSON.stringify(encrypted)).not.toContain("ذهب ادخار خاص");
    expect(await decryptBackup(encrypted,key)).toEqual(l);
  });
  test("previous v2 backup with debts migrates to v3 with all records unchanged",async()=>{
    let l=appendWallet(emptyLocalLedger(),"قديم","150");
    l=createLocalDebt(l,{contactName:"شخص محفوظ",side:"receivable",
      amount:"75",walletId:l.wallets[0].id,note:""});
    l=settleLocalDebt(l,{debtId:l.debts[0].id,amount:"12.50",walletId:l.wallets[0].id,note:""});
    const old={app:"rasd-android",schema:2,wallets:l.wallets,entries:l.entries,
      debts:l.debts,debtPayments:l.debtPayments};
    const encrypted=await encryptRasdBackup(old,key);
    const restored=await decryptBackup(encrypted,key);
    expect(restored.schema).toBe(3);
    expect(restored.debts).toEqual(l.debts);
    expect(restored.debtPayments).toEqual(l.debtPayments);
    expect(restored.investments).toEqual([]);
    expect(restored.investmentTrades).toEqual([]);
  });
  test("previous v1 encrypted backup migrates without losing wallets or income",async()=>{
    let l=appendWallet(emptyLocalLedger(),"قديم","15");
    l=appendEntry(l,{walletId:l.wallets[0].id,kind:"income",amount:"1.75",category:"",note:""});
    const old={app:"rasd-android",schema:1,wallets:l.wallets,entries:l.entries};
    const ciphertext=await encryptRasdBackup(old,key);
    const result=await decryptBackup(ciphertext,key);
    expect(result.wallets).toEqual(old.wallets);
    expect(result.entries).toEqual(old.entries);
    expect(result.debts).toEqual([]);
    expect(result.debtPayments).toEqual([]);
    expect(result.investments).toEqual([]);
    expect(result.investmentTrades).toEqual([]);
    expect(result.schema).toBe(3);
  });
});
