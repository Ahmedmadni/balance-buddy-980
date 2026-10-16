import {describe,expect,test} from "bun:test";
import {appendWallet,appendEntry,emptyLocalLedger} from "./model";
import {createLocalDebt,settleLocalDebt} from "./debts";
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
    expect(result.schema).toBe(2);
  });
});
