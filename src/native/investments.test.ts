import {describe,expect,test} from "bun:test";
import {appendWallet,balanceHalalas,emptyLocalLedger,isLocalLedger,migrateLocalLedger} from "./model";
import {appendInvestmentTrade,createLocalInvestment,grossValueHalalas,investmentPosition,parseMilliQuantity,updateInvestmentPrice} from "./investments";
const start=()=>appendWallet(emptyLocalLedger(),"بنك","1000");
function gold(){const w=start();return createLocalInvestment(w,{name:"ذهب استثماري",type:"gold",intent:"trade",marketPrice:"350"});}
describe("native offline investments: no double-counting of capital as income",()=>{
  test("buying gold reduces cash but does not create an expense",()=>{
    let l=gold();const wid=l.wallets[0].id,iid=l.investments[0].id;
    l=appendInvestmentTrade(l,{investmentId:iid,side:"buy",quantity:"2.500",unitPrice:"300",walletId:wid});
    expect(balanceHalalas(l,wid)).toBe(25000);
    expect(investmentPosition(l,iid)).toMatchObject({
      quantityMilli:2500,costHalalas:75000,marketValueHalalas:87500,unrealizedPnlHalalas:12500});
    expect(l.entries).toHaveLength(0);
  });
  test("partial sale uses average cost, realized gain only, no false income entry",()=>{
    let l=gold();const wid=l.wallets[0].id,iid=l.investments[0].id;
    l=appendInvestmentTrade(l,{investmentId:iid,side:"buy",quantity:"2.000",unitPrice:"300",walletId:wid});
    l=appendInvestmentTrade(l,{investmentId:iid,side:"sell",quantity:"0.500",unitPrice:"400",walletId:wid});
    expect(investmentPosition(l,iid)).toMatchObject({
      quantityMilli:1500,costHalalas:45000,proceedsHalalas:20000,realizedPnlHalalas:5000});
    expect(balanceHalalas(l,wid)).toBe(60000);
    expect(l.entries).toEqual([]);
  });
  test("selling all quantity clears exact remaining cost basis and rejects oversell",()=>{
    let l=gold();const iid=l.investments[0].id;
    l=appendInvestmentTrade(l,{investmentId:iid,side:"buy",quantity:"0.001",unitPrice:"315",walletId:null});
    expect(()=>appendInvestmentTrade(l,{investmentId:iid,side:"sell",quantity:"0.002",unitPrice:"400",walletId:null})).toThrow();
    l=appendInvestmentTrade(l,{investmentId:iid,side:"sell",quantity:"0.001",unitPrice:"400",walletId:null});
    expect(investmentPosition(l,iid).costHalalas).toBe(0);
    expect(investmentPosition(l,iid).quantityMilli).toBe(0);
  });
  test("invalid milli-quantities and rounding-to-zero are rejected",()=>{
    for(const raw of ["-1","0","1.1234","1e4","NaN"])expect(()=>parseMilliQuantity(raw)).toThrow();
    expect(parseMilliQuantity("0.001")).toBe(1);
    expect(()=>grossValueHalalas(1,1)).toThrow();
  });
  test("market price editable but unavailable values are not invented",()=>{
    let l=gold();const id=l.investments[0].id;
    l=updateInvestmentPrice(l,id,"");
    expect(investmentPosition(l,id).marketValueHalalas).toBeNull();
    l=updateInvestmentPrice(l,id,"350.25");
    expect(l.investments[0].marketPriceHalalas).toBe(35025);
  });
  test("record validation rejects orphan trade, inconsistent gross and forged negative stock",()=>{
    let l=gold();const id=l.investments[0].id;
    l=appendInvestmentTrade(l,{investmentId:id,side:"buy",quantity:"1",unitPrice:"100",walletId:null});
    const t=l.investmentTrades[0];
    expect(isLocalLedger({...l,investmentTrades:[{...t,grossHalalas:123}]})).toBe(false);
    expect(isLocalLedger({...l,investmentTrades:[{...t,investmentId:crypto.randomUUID()}]})).toBe(false);
    expect(isLocalLedger({...l,investmentTrades:[{...t,side:"sell"}]})).toBe(false);
  });
  test("existing v2 debts and settlements survive v3 migration",()=>{
    const l=gold();
    const v2={app:"rasd-android",schema:2,wallets:l.wallets,entries:[],debts:[],debtPayments:[]};
    const newer=migrateLocalLedger(v2);
    expect(newer.schema).toBe(3);
    expect(newer.wallets).toEqual(l.wallets);
    expect(newer.investments).toEqual([]);
    expect(newer.investmentTrades).toEqual([]);
  });
});
