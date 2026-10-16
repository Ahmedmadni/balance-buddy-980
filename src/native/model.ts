// Device-only finance model. Schema v2 migrates v1 vaults/backups without loss.
// All monetary values use integer halalas; no Supabase data is accessed here.
export const LOCAL_SCHEMA_VERSION = 2 as const;
export type LedgerKind = "income" | "expense";
export type DebtSide = "receivable" | "payable";
export interface LocalWallet {
  id: string; name: string; currency: "SAR"; openingHalalas: number; createdAt: string;
}
export interface LocalEntry {
  id: string; walletId: string; kind: LedgerKind; amountHalalas: number;
  category: string; note: string; occurredAt: string; createdAt: string;
}
export interface LocalDebt {
  id: string;
  contactName: string;
  side: DebtSide;
  principalHalalas: number;
  // The initial loan/borrowing may be historical; walletId null means
  // do not mirror any cash movement into an on-device wallet.
  walletId: string | null;
  note: string;
  occurredAt: string;
  createdAt: string;
}
export interface LocalDebtPayment {
  id: string; debtId: string; amountHalalas: number;
  // Optional wallet: the payment may have taken place outside tracked wallets.
  walletId: string | null;
  note: string; occurredAt: string; createdAt: string;
}
export interface LocalLedger {
  app: "rasd-android"; schema: typeof LOCAL_SCHEMA_VERSION;
  wallets: LocalWallet[]; entries: LocalEntry[];
  debts: LocalDebt[]; debtPayments: LocalDebtPayment[];
}
export interface LegacyLocalLedgerV1 {
  app: "rasd-android"; schema: 1;
  wallets: LocalWallet[]; entries: LocalEntry[];
}
const MAX_RECORDS=50_000;
const MAX_HALALAS=1_000_000_000_000;
export function emptyLocalLedger(): LocalLedger {
  return {app:"rasd-android",schema:2,wallets:[],entries:[],debts:[],debtPayments:[]};
}
export function parseHalalas(text: string): number {
  if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(text.trim())) {
    throw new Error("أدخل مبلغاً موجباً بريال سعودي، بحد أقصى منزلتين عشريتين");
  }
  const [major,decimal=""]=text.trim().split(".");
  const cents=Number(major)*100+Number(decimal.padEnd(2,"0"));
  if (!Number.isSafeInteger(cents)||cents<=0||cents>MAX_HALALAS) throw new Error("المبلغ خارج الحد المقبول");
  return cents;
}
function validId(id: unknown): id is string {
  return typeof id==="string" && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id) && id.length<=64;
}
function safeText(value: unknown, max: number): value is string {
  return typeof value==="string" && value.length<=max;
}
function validDate(value:unknown): value is string {
  return safeText(value,40) && Number.isFinite(Date.parse(value));
}
function validHalalas(n:unknown, allowZero=false):n is number {
  return typeof n==="number" && Number.isSafeInteger(n) && n<=MAX_HALALAS &&
    (allowZero?n>=-MAX_HALALAS:n>0);
}
function validateCore(v:Partial<LegacyLocalLedgerV1>, ids:Set<string>):boolean {
  if(!Array.isArray(v.wallets)||!Array.isArray(v.entries)||
    v.wallets.length>MAX_RECORDS||v.entries.length>MAX_RECORDS) return false;
  for(const w of v.wallets){
    if(!w||!validId(w.id)||ids.has(w.id)||!safeText(w.name,120)||!w.name.trim()
      ||w.currency!=="SAR"||!validHalalas(w.openingHalalas,true)
      ||!validDate(w.createdAt))return false;
    ids.add(w.id);
  }
  for(const e of v.entries){
    if(!e||!validId(e.id)||ids.has(e.id)||!ids.has(e.walletId)
      ||!["income","expense"].includes(e.kind)||!validHalalas(e.amountHalalas)
      ||!safeText(e.category,100)||!safeText(e.note,300)
      ||!validDate(e.occurredAt)||!validDate(e.createdAt))return false;
    ids.add(e.id);
  }
  return true;
}
export function isLocalLedger(value: unknown): value is LocalLedger {
  if (!value || typeof value!=="object" || Array.isArray(value)) return false;
  const v=value as Partial<LocalLedger>;
  if(v.app!=="rasd-android"||v.schema!==2) return false;
  const ids=new Set<string>();
  if(!validateCore(v,ids)||!Array.isArray(v.debts)||!Array.isArray(v.debtPayments)
    ||v.debts.length>MAX_RECORDS||v.debtPayments.length>MAX_RECORDS)return false;
  const wallets=new Set(v.wallets!.map(w=>w.id));
  const debts=new Map<string,LocalDebt>();
  for(const d of v.debts){
    if(!d||!validId(d.id)||ids.has(d.id)||!safeText(d.contactName,120)
      ||!d.contactName.trim()||!["receivable","payable"].includes(d.side)
      ||!validHalalas(d.principalHalalas)||!safeText(d.note,300)
      ||!(d.walletId===null||(typeof d.walletId==="string"&&wallets.has(d.walletId)))
      ||!validDate(d.occurredAt)||!validDate(d.createdAt))return false;
    ids.add(d.id);debts.set(d.id,d);
  }
  const sums=new Map<string,number>();
  for(const p of v.debtPayments){
    if(!p||!validId(p.id)||ids.has(p.id)||!debts.has(p.debtId)
      ||!validHalalas(p.amountHalalas)||!safeText(p.note,300)
      ||!(p.walletId===null||(typeof p.walletId==="string"&&wallets.has(p.walletId)))
      ||!validDate(p.occurredAt)||!validDate(p.createdAt))return false;
    ids.add(p.id);
    const total=(sums.get(p.debtId)??0)+p.amountHalalas;
    if(total>debts.get(p.debtId)!.principalHalalas)return false;
    sums.set(p.debtId,total);
  }
  return true;
}
// Existing local users can still unlock and restore a v1 encrypted backup.
// No implicit mutation of the archived v1 file; next encrypted vault commit
// persists v2 automatically.
export function migrateLocalLedger(value:unknown):LocalLedger {
  if(isLocalLedger(value))return structuredClone(value);
  if(!value||typeof value!=="object"||Array.isArray(value))
    throw new Error("ملف الخزنة غير صالح");
  const v=value as Partial<LegacyLocalLedgerV1>;
  if(v.app==="rasd-android"&&v.schema===1&&validateCore(v,new Set<string>())){
    return {...(structuredClone(v) as LegacyLocalLedgerV1),schema:2,debts:[],debtPayments:[]};
  }
  throw new Error("إصدار ملف الخزنة غير صالح أو البيانات تالفة");
}
export function balanceHalalas(ledger: LocalLedger, walletId: string): number {
  const wallet=ledger.wallets.find(w=>w.id===walletId);
  if (!wallet) throw new Error("المحفظة غير موجودة");
  // Debts are assets/liabilities, not taxable earned income or expenses.
  const entries=ledger.entries.filter(e=>e.walletId===walletId).reduce(
    (sum,e)=>sum+(e.kind==="income"?e.amountHalalas:-e.amountHalalas),0,
  );
  const origins=ledger.debts.filter(d=>d.walletId===walletId).reduce(
    (sum,d)=>sum+(d.side==="receivable"?-d.principalHalalas:d.principalHalalas),0,
  );
  const debtSide=new Map(ledger.debts.map(d=>[d.id,d.side]));
  const settlements=ledger.debtPayments.filter(p=>p.walletId===walletId).reduce(
    (sum,p)=>sum+(debtSide.get(p.debtId)==="receivable"?p.amountHalalas:-p.amountHalalas),0,
  );
  const total=wallet.openingHalalas+entries+origins+settlements;
  if (!Number.isSafeInteger(total)) throw new Error("الرصيد تجاوز الحدود الآمنة للحساب");
  return total;
}
export function appendWallet(ledger:LocalLedger,name:string,opening:string):LocalLedger {
  const now=new Date().toISOString();
  if(!name.trim()||name.trim().length>120)throw new Error("اسم المحفظة غير صالح");
  const openingHalalas=opening.trim()==="0"?0:parseHalalas(opening);
  const next:LocalLedger={...ledger,wallets:[...ledger.wallets,{
    id:crypto.randomUUID(),name:name.trim(),currency:"SAR",openingHalalas,createdAt:now,
  }]};
  if(!isLocalLedger(next))throw new Error("سجل المحفظة غير صالح");
  return next;
}
export function appendEntry(ledger:LocalLedger,data:{
  walletId:string;kind:LedgerKind;amount:string;category:string;note:string;
}):LocalLedger {
  if(!ledger.wallets.some(w=>w.id===data.walletId))throw new Error("اختر محفظة موجودة");
  if(!["income","expense"].includes(data.kind))throw new Error("نوع العملية غير صالح");
  const amountHalalas=parseHalalas(data.amount);
  if(!safeText(data.note,300)||!safeText(data.category,100))throw new Error("التفاصيل طويلة للغاية");
  const now=new Date().toISOString();
  const next:LocalLedger={...ledger,entries:[...ledger.entries,{
    id:crypto.randomUUID(),walletId:data.walletId,kind:data.kind,amountHalalas,
    category:data.category.trim(),note:data.note.trim(),occurredAt:now,createdAt:now,
  }]};
  if(!isLocalLedger(next))throw new Error("بيانات العملية غير صالحة");
  return next;
}
