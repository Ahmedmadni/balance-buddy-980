// On-device schema v1: restricted, auditable MVP. No Supabase dependency.
export const LOCAL_SCHEMA_VERSION = 1 as const;
export type LedgerKind = "income" | "expense";
export interface LocalWallet {
  id: string; name: string; currency: "SAR"; openingHalalas: number; createdAt: string;
}
export interface LocalEntry {
  id: string; walletId: string; kind: LedgerKind; amountHalalas: number;
  category: string; note: string; occurredAt: string; createdAt: string;
}
export interface LocalLedger {
  app: "rasd-android"; schema: typeof LOCAL_SCHEMA_VERSION;
  wallets: LocalWallet[]; entries: LocalEntry[];
}
const MAX_RECORDS=50_000;
export function emptyLocalLedger(): LocalLedger {
  return { app:"rasd-android", schema:1, wallets:[], entries:[] };
}
export function parseHalalas(text: string): number {
  if (!/^(?:0|[1-9]\d{0,11})(?:\.\d{1,2})?$/.test(text.trim())) {
    throw new Error("أدخل مبلغاً موجباً بريال سعودي، بحد أقصى منزلتين عشريتين");
  }
  const [major,decimal=""]=text.trim().split(".");
  const cents=Number(major)*100+Number(decimal.padEnd(2,"0"));
  if (!Number.isSafeInteger(cents)||cents<=0) throw new Error("المبلغ يجب أن يكون أكبر من صفر");
  return cents;
}
function validId(id: unknown): id is string {
  return typeof id==="string" && /^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(id) && id.length<=64;
}
function safeText(value: unknown, max: number): value is string {
  return typeof value==="string" && value.length<=max;
}
export function isLocalLedger(value: unknown): value is LocalLedger {
  if (!value || typeof value!=="object" || Array.isArray(value)) return false;
  const v=value as Partial<LocalLedger>;
  if (v.app!=="rasd-android" || v.schema!==1 || !Array.isArray(v.wallets)||!Array.isArray(v.entries)
    || v.wallets.length>MAX_RECORDS||v.entries.length>MAX_RECORDS) return false;
  const ids=new Set<string>();
  for (const w of v.wallets) {
    if (!w || !validId(w.id) || ids.has(w.id) || !safeText(w.name,120) || !w.name.trim()
      || w.currency!=="SAR" || !Number.isSafeInteger(w.openingHalalas)
      || Math.abs(w.openingHalalas)>1_000_000_000_000
      || !safeText(w.createdAt,40) || !Number.isFinite(Date.parse(w.createdAt))) return false;
    ids.add(w.id);
  }
  const entries=new Set<string>();
  for (const e of v.entries) {
    if (!e || !validId(e.id)||entries.has(e.id)||!ids.has(e.walletId)
      || !["income","expense"].includes(e.kind)
      || !Number.isSafeInteger(e.amountHalalas) || e.amountHalalas<=0
      || e.amountHalalas>1_000_000_000_000
      || !safeText(e.category,100)||!safeText(e.note,300)
      || !safeText(e.occurredAt,40)||!Number.isFinite(Date.parse(e.occurredAt))
      || !safeText(e.createdAt,40)||!Number.isFinite(Date.parse(e.createdAt))) return false;
    entries.add(e.id);
  }
  return true;
}
export function balanceHalalas(ledger: LocalLedger, walletId: string): number {
  const wallet=ledger.wallets.find(w=>w.id===walletId);
  if (!wallet) throw new Error("المحفظة غير موجودة");
  const total=ledger.entries.filter(e=>e.walletId===walletId).reduce(
    (sum,e)=>sum+(e.kind==="income"?e.amountHalalas:-e.amountHalalas), wallet.openingHalalas,
  );
  if (!Number.isSafeInteger(total)) throw new Error("الرصيد تجاوز الحدود الآمنة للحساب");
  return total;
}
export function appendWallet(ledger: LocalLedger, name: string, opening: string): LocalLedger {
  const now=new Date().toISOString();
  if (!name.trim()||name.trim().length>120) throw new Error("اسم المحفظة غير صالح");
  const openingHalalas=opening.trim()==="0"?0:parseHalalas(opening);
  const next={...ledger,wallets:[...ledger.wallets,{id:crypto.randomUUID(),name:name.trim(),currency:"SAR" as const,openingHalalas,createdAt:now}]};
  if (!isLocalLedger(next)) throw new Error("سجل المحفظة غير صالح"); return next;
}
export function appendEntry(
  ledger: LocalLedger,
  data:{walletId:string;kind:LedgerKind;amount:string;category:string;note:string},
): LocalLedger {
  if (!ledger.wallets.some(w=>w.id===data.walletId)) throw new Error("اختر محفظة موجودة");
  const amountHalalas=parseHalalas(data.amount);
  if (!safeText(data.note,300)||!safeText(data.category,100)) throw new Error("التفاصيل طويلة للغاية");
  const now=new Date().toISOString();
  const next={...ledger,entries:[...ledger.entries,{
    id:crypto.randomUUID(),walletId:data.walletId,kind:data.kind,amountHalalas,
    category:data.category.trim(),note:data.note.trim(),occurredAt:now,createdAt:now,
  }]};
  if (!isLocalLedger(next)) throw new Error("بيانات العملية غير صالحة"); return next;
}
