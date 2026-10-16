import {describe,expect,test} from "bun:test";
import {emptyLocalLedger,parseHalalas,isLocalLedger,appendWallet,appendEntry,balanceHalalas} from "./model";
describe("Android local-only finance ledger model",()=>{
  test("no cloud account or external data is required",()=>expect(emptyLocalLedger()).toEqual({app:"rasd-android",schema:1,wallets:[],entries:[]}));
  test("money must be exact halalas, never floating point",()=>{
    expect(parseHalalas("0.01")).toBe(1);
    expect(parseHalalas("1000.25")).toBe(100025);
    for(const x of ["1.234","-2","1e3","0","abc"])expect(()=>parseHalalas(x)).toThrow();
  });
  test("wallets and expense/income journal calculate balances",()=>{
    let l=appendWallet(emptyLocalLedger(),"نقد", "125.20");
    const w=l.wallets[0];
    l=appendEntry(l,{walletId:w.id,kind:"income",amount:"40",category:"دخل",note:""});
    l=appendEntry(l,{walletId:w.id,kind:"expense",amount:"10.50",category:"طعام",note:""});
    expect(balanceHalalas(l,w.id)).toBe(15470);
    expect(isLocalLedger(l)).toBe(true);
  });
  test("rejects orphan transactions and corrupted records on restore",()=>{
    const l=appendWallet(emptyLocalLedger(),"حساب", "0");
    const bad={...l, entries:[{id:crypto.randomUUID(),walletId:crypto.randomUUID(),kind:"expense",amountHalalas:10,category:"",note:"",occurredAt:new Date().toISOString(),createdAt:new Date().toISOString()}]};
    expect(isLocalLedger(bad)).toBe(false);
    expect(()=>appendEntry(l,{walletId:crypto.randomUUID(),kind:"expense",amount:"2",category:"",note:""})).toThrow();
  });
  test("does not accept duplicate wallet identifiers",()=>{
    const l=appendWallet(emptyLocalLedger(),"نقد", "0");
    expect(isLocalLedger({...l,wallets:[...l.wallets,l.wallets[0]]})).toBe(false);
  });
});
