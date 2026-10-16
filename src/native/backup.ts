import {encryptRasdBackup,decryptRasdBackup,isEncryptedRasdBackup,type EncryptedRasdBackup} from "../lib/backup/encrypted-v2";
import {isLocalLedger,migrateLocalLedger,type LocalLedger} from "./model";
const FOLDER="rasd-backups";
const NAME=/^rasd-android-[A-Za-z0-9-]{10,100}\.json$/;
const MAX_BYTES=25*1024*1024;
export async function createBackup(ledger:LocalLedger,password:string){
  if(!isLocalLedger(ledger))throw new Error("البيانات المحلية غير صالحة");
  return {name:`rasd-android-${new Date().toISOString().replace(/[:.]/g,"-")}-${crypto.randomUUID().slice(0,8)}.json`,
    encrypted:await encryptRasdBackup(ledger,password)};
}
function validate(name:string,backup:EncryptedRasdBackup){
  if(!NAME.test(name)||!isEncryptedRasdBackup(backup))throw new Error("ملف النسخة غير صالح");
  const text=JSON.stringify(backup);
  if(new Blob([text]).size>MAX_BYTES)throw new Error("الملف يتجاوز 25MB");
  return text;
}
export async function saveBackupInsideApp(name:string,backup:EncryptedRasdBackup){
  const data=validate(name,backup);
  const {Filesystem,Directory,Encoding}=await import("@capacitor/filesystem");
  await Filesystem.writeFile({directory:Directory.Data,path:`${FOLDER}/${name}`,
    encoding:Encoding.UTF8,data,recursive:true});
  const check=await Filesystem.readFile({directory:Directory.Data,path:`${FOLDER}/${name}`,encoding:Encoding.UTF8});
  if(typeof check.data!=="string"||check.data!==data)throw new Error("فشل التحقق من الملف المحفوظ");
}
export async function listDeviceBackups():Promise<string[]>{
  const {Filesystem,Directory}=await import("@capacitor/filesystem");
  try{
    const result=await Filesystem.readdir({directory:Directory.Data,path:FOLDER});
    return result.files.map(file=>file.name).filter(name=>NAME.test(name)).sort().reverse();
  }catch(error){
    if(/not found|does not exist|ENOENT|no such/i.test(String(error)))return [];
    throw error;
  }
}
export async function loadDeviceBackup(name:string):Promise<EncryptedRasdBackup>{
  if(!NAME.test(name))throw new Error("اسم الملف غير صالح");
  const {Filesystem,Directory,Encoding}=await import("@capacitor/filesystem");
  const result=await Filesystem.readFile({directory:Directory.Data,path:`${FOLDER}/${name}`,encoding:Encoding.UTF8});
  if(typeof result.data!=="string"||new Blob([result.data]).size>MAX_BYTES)throw new Error("الملف كبير أو تالف");
  const parsed:unknown=JSON.parse(result.data);
  if(!isEncryptedRasdBackup(parsed))throw new Error("النسخة غير مشفرة أو غير مدعومة");
  return parsed;
}
export async function shareBackup(name:string,backup:EncryptedRasdBackup):Promise<void>{
  const data=validate(name,backup);
  const {Filesystem,Directory,Encoding}=await import("@capacitor/filesystem");
  const {Share}=await import("@capacitor/share");
  await Filesystem.writeFile({directory:Directory.Cache,path:name,data,encoding:Encoding.UTF8});
  const file=await Filesystem.getUri({directory:Directory.Cache,path:name});
  await Share.share({title:"نسخة رصد المشفرة",text:"اختر Drive أو ملفات الجهاز لحفظ النسخة",
    files:[file.uri],dialogTitle:"احفظ أو شارك النسخة المشفرة"});
}
export async function decryptBackup(backup:unknown,password:string):Promise<LocalLedger>{
  if(!isEncryptedRasdBackup(backup))throw new Error("النسخة غير صالحة");
  const result=await decryptRasdBackup(backup,password);
  // Older Android local encrypted backups used schema v1. Reject invalid data,
  // but migrate valid v1 wallets/entries to the new schema without data loss.
  return migrateLocalLedger(result);
}
export async function readBackupFile(file:File,password:string):Promise<LocalLedger>{
  if(file.size>MAX_BYTES)throw new Error("النسخة تتجاوز 25MB");
  return decryptBackup(JSON.parse(await file.text()),password);
}
