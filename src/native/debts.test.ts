import {describe,expect,test} from "bun:test";
import {appendWallet,appendEntry,balanceHalalas,emptyLocalLedger,isLocalLedger,migrateLocalLedger} from "./model";
import {createLocalDebt,settleLocalDebt,remainingDebtHalalas,debtTotalsHalalas} from "./debts";
const wallet=()=>appendWallet(emptyLocalLedger(),"نقد","1000.00");
describe("Android local debts never misclassify lending as income",()=>{
  test("receivable loan reduces wallet, partial collection restores it without creating revenue",()=>{
    let l=wallet(),w=l.wallets[0].id;
    l=createLocalDebt(l,{contactName:"عمرو",side:"receivable",amount:"400.00",walletId:w,note:"سلفة"});
    const debt=l.debts[0];expect(balanceHalalas(l,w)).toBe(60000);
    l=settleLocalDebt(l,{debtId:debt.id,amount:"150.25",walletId:w,note:"تحصيل"});
    expect(balanceHalalas(l,w)).toBe(75025);
    expect(remainingDebtHalalas(l,debt.id)).toBe(24975);
    expect(debtTotalsHalalas(l)).toEqual({receivable:24975,payable:0});
    expect(l.entries).toEqual([]);
    expect(isLocalLedger(l)).toBe(true);
  });
  test("borrowing adds cash but is not earned income; repayment removes cash",()=>{
    let l=wallet(),w=l.wallets[0].id;
    l=createLocalDebt(l,{contactName:"سارة",side:"payable",amount:"90",walletId:w,note:""});
    expect(balanceHalalas(l,w)).toBe(109000);
    l=settleLocalDebt(l,{debtId:l.debts[0].id,amount:"90",walletId:w,note:""});
    expect(balanceHalalas(l,w)).toBe(100000);
    expect(debtTotalsHalalas(l)).toEqual({receivable:0,payable:0});
    expect(l.entries).toHaveLength(0);
  });
  test("historical debt without wallet remains liability/asset but does not move cash",()=>{
    const source=wallet(),w=source.wallets[0].id;
    const l=createLocalDebt(source,{contactName:"أحمد",side:"receivable",amount:"30",walletId:null,note:"سابق"});
    expect(balanceHalalas(l,w)).toBe(100000);
    expect(debtTotalsHalalas(l).receivable).toBe(3000);
  });
  test("does not permit overpayment or a second settlement after fully paid",()=>{
    let l=wallet();
    l=createLocalDebt(l,{contactName:"دائن",side:"payable",amount:"30",walletId:null,note:""});
    const id=l.debts[0].id;
    expect(()=>settleLocalDebt(l,{debtId:id,amount:"30.01",walletId:null,note:""})).toThrow("أكثر");
    l=settleLocalDebt(l,{debtId:id,amount:"30",walletId:null,note:""});
    expect(()=>settleLocalDebt(l,{debtId:id,amount:"0.01",walletId:null,note:""})).toThrow("أكثر");
  });
  test("rejects orphan payment and overpaid backup before vault restore",()=>{
    let l=wallet();
    l=createLocalDebt(l,{contactName:"زيد",side:"receivable",amount:"50",walletId:null,note:""});
    const id=l.debts[0].id;
    l=settleLocalDebt(l,{debtId:id,amount:"5",walletId:null,note:""});
    expect(isLocalLedger({...l,debtPayments:[{...l.debtPayments[0],debtId:crypto.randomUUID()}]})).toBe(false);
    expect(isLocalLedger({...l,debtPayments:[{...l.debtPayments[0],amountHalalas:5001}]})).toBe(false);
  });
  test("migrates prior v1 encrypted vault data without losing transactions",()=>{
    let l=wallet();
    l=appendEntry(l,{walletId:l.wallets[0].id,kind:"expense",amount:"10",category:"طعام",note:""});
    const legacy={app:"rasd-android",schema:1,wallets:l.wallets,entries:l.entries};
    const newer=migrateLocalLedger(legacy);
    expect(newer.schema).toBe(2);
    expect(newer.debts).toEqual([]);
    expect(newer.debtPayments).toEqual([]);
    expect(balanceHalalas(newer,newer.wallets[0].id)).toBe(99000);
    expect(()=>migrateLocalLedger({...legacy,entries:[{id:"invalid"}]})).toThrow();
  });
  test("settlements in a different wallet mirror movement exactly once",()=>{
    let l=wallet();
    l=appendWallet(l,"بنك","0");
    l=createLocalDebt(l,{contactName:"مستلف",side:"receivable",amount:"100",walletId:l.wallets[0].id,note:""});
    l=settleLocalDebt(l,{debtId:l.debts[0].id,amount:"100",walletId:l.wallets[1].id,note:""});
    expect(balanceHalalas(l,l.wallets[0].id)).toBe(90000);
    expect(balanceHalalas(l,l.wallets[1].id)).toBe(10000);
  });
});
