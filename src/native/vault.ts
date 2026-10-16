// Password-encrypted IndexedDB vault; no plaintext stored on device.
// A future platform keystore-backed PIN flow must replace the strong password
// requirement before PIN-only unlock is offered.
import { emptyLocalLedger, isLocalLedger, type LocalLedger } from "./model";
const DB_NAME="rasd-android-finance-v1";
const STORE="vault";
const ITEM="local-ledger";
const ITERATIONS=310_000;
interface VaultRow {
  id:typeof ITEM; version:1; salt:number[]; iv:number[]; ciphertext:ArrayBuffer; sequence:number;
}
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve,reject)=>{
    if (typeof indexedDB==="undefined") { reject(new Error("التخزين المحلي غير متاح")); return; }
    const req=indexedDB.open(DB_NAME,1);
    req.onupgradeneeded=()=>{if(!req.result.objectStoreNames.contains(STORE))req.result.createObjectStore(STORE,{keyPath:"id"});};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error ?? new Error("تعذر فتح قاعدة الجهاز"));
  });
}
async function readRow():Promise<VaultRow|null>{
  const db=await openDatabase();
  try{return await new Promise((resolve,reject)=>{
    const tx=db.transaction(STORE,"readonly");
    const req=tx.objectStore(STORE).get(ITEM);
    req.onsuccess=()=>resolve((req.result as VaultRow|undefined)??null);
    req.onerror=()=>reject(req.error);
  });}finally{db.close();}
}
async function writeRow(row:VaultRow, expectedSequence:number|null):Promise<void>{
  const db=await openDatabase();
  try{
    await new Promise<void>((resolve,reject)=>{
      const tx=db.transaction(STORE,"readwrite");
      const store=tx.objectStore(STORE);
      const get=store.get(ITEM);
      get.onsuccess=()=>{
        const existing=get.result as VaultRow|undefined;
        if ((existing?.sequence ?? null)!==expectedSequence) {
          tx.abort(); reject(new Error("تغيرت البيانات في نافذة أخرى. أعد فتح الخزنة.")); return;
        }
        store.put(row);
      };
      get.onerror=()=>{tx.abort();reject(get.error);};
      tx.oncomplete=()=>resolve();
      tx.onerror=()=>reject(tx.error);
      tx.onabort=()=>reject(new Error("لم تُحفظ العملية المحلية؛ لم تتغير البيانات السابقة"));
    });
  }finally{db.close();}
}
function toBytes(data:number[]):Uint8Array {
  return Uint8Array.from(data);
}
async function derive(password:string,salt:Uint8Array):Promise<CryptoKey>{
  const secret=await crypto.subtle.importKey("raw",new TextEncoder().encode(password),"PBKDF2",false,["deriveKey"]);
  return crypto.subtle.deriveKey(
    {name:"PBKDF2",hash:"SHA-256",iterations:ITERATIONS,salt:salt as BufferSource},
    secret,{name:"AES-GCM",length:256},false,["encrypt","decrypt"],
  );
}
async function protect(key:CryptoKey,model:LocalLedger):Promise<{iv:number[];ciphertext:ArrayBuffer}>{
  const iv=crypto.getRandomValues(new Uint8Array(12));
  const bytes=new TextEncoder().encode(JSON.stringify(model));
  const ciphertext=await crypto.subtle.encrypt({name:"AES-GCM",iv:iv as BufferSource},key,bytes as BufferSource);
  return {iv:[...iv],ciphertext};
}
export async function isLocalVaultCreated():Promise<boolean>{
  return (await readRow())!==null;
}
export class LocalVaultSession {
  private queue:Promise<unknown>=Promise.resolve();
  private constructor(
    private readonly key:CryptoKey,private readonly salt:number[],
    private sequence:number,private model:LocalLedger,
  ){}
  static async create(password:string):Promise<LocalVaultSession>{
    if(password.length<12)throw new Error("استخدم كلمة سر قوية لا تقل عن 12 حرفاً؛ الرقم السري القصير غير آمن دون Keystore");
    if(await isLocalVaultCreated())throw new Error("الخزنة موجودة بالفعل؛ افتحها بدلاً من إنشاء أخرى");
    const salt=[...crypto.getRandomValues(new Uint8Array(16))];
    const key=await derive(password,toBytes(salt));
    const model=emptyLocalLedger();
    const encrypted=await protect(key,model);
    await writeRow({id:ITEM,version:1,salt,sequence:1,...encrypted},null);
    return new LocalVaultSession(key,salt,1,model);
  }
  static async unlock(password:string):Promise<LocalVaultSession>{
    const row=await readRow();
    if(!row||row.version!==1||row.salt.length!==16||row.iv.length!==12)
      throw new Error("الخزنة غير موجودة أو إصدارها غير مدعوم");
    const key=await derive(password,toBytes(row.salt));
    let parsed:unknown;
    try{
      const bytes=await crypto.subtle.decrypt(
        {name:"AES-GCM",iv:toBytes(row.iv) as BufferSource},key,row.ciphertext as BufferSource,
      );
      parsed=JSON.parse(new TextDecoder().decode(bytes));
    }catch{throw new Error("كلمة السر غير صحيحة أو ملف الخزنة تالف");}
    if(!isLocalLedger(parsed))throw new Error("بنية سجلات الخزنة غير صالحة");
    return new LocalVaultSession(key,row.salt,row.sequence,parsed);
  }
  snapshot():LocalLedger{return structuredClone(this.model);}
  async replace(restored:LocalLedger):Promise<LocalLedger>{
    if(!isLocalLedger(restored))throw new Error("ملف الاستعادة غير صالح");
    return this.commit(()=>structuredClone(restored));
  }
  async commit(change:(old:LocalLedger)=>LocalLedger):Promise<LocalLedger>{
    const operation=this.queue.then(async()=>{
      const changed=change(this.snapshot());
      if(!isLocalLedger(changed))throw new Error("معلومات غير صالحة؛ لم يتغير أي شيء");
      const encrypted=await protect(this.key,changed);
      const newSequence=this.sequence+1;
      await writeRow({
        id:ITEM,version:1,salt:this.salt,sequence:newSequence,...encrypted,
      },this.sequence);
      this.sequence=newSequence;
      this.model=changed;
      return this.snapshot();
    });
    this.queue=operation.catch(()=>{});
    return operation;
  }
}
