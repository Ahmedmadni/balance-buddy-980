import {test,expect} from "@playwright/test";
import {appendWallet,emptyLocalLedger} from "../src/native/model";
import {createLocalDebt} from "../src/native/debts";
import {encryptRasdBackup} from "../src/lib/backup/encrypted-v2";

const DEVICE_PASSWORD="Android-Device-Vault-Password-2026";
const BACKUP_PASSWORD="Restored-Backup-Password-2026";
test("encrypted external backup is inspected before replacing local financial data",async({page})=>{
  await page.goto("/");
  await page.getByLabel("كلمة سر الخزنة (12 حرفًا على الأقل)").fill(DEVICE_PASSWORD);
  await page.getByLabel("تأكيد كلمة السر").fill(DEVICE_PASSWORD);
  await page.getByRole("button",{name:"إنشاء خزنة محلية"}).click();
  await expect(page.getByRole("heading",{name:"المحافظ والأرصدة"})).toBeVisible();
  await page.getByLabel("اسم المحفظة").fill("محفظة لا يجب حذفها بالخطأ");
  await page.getByLabel("الرصيد الافتتاحي (ريال)").fill("500");
  await page.getByRole("button",{name:"إضافة محفظة"}).click();

  let archived=appendWallet(emptyLocalLedger(),"محفظة أرشيفية","75");
  archived=createLocalDebt(archived,{contactName:"شخص قديم",side:"receivable",
    amount:"25",walletId:null,note:"أرشيف"});
  const encrypted=await encryptRasdBackup(archived,BACKUP_PASSWORD);
  await page.locator("#import-backup").setInputFiles({
    name:"rasd-android-2026-10-19-test.json",
    mimeType:"application/json",buffer:Buffer.from(JSON.stringify(encrypted)),
  });
  const button=page.getByRole("button",{name:"استعادة بعد إنشاء نقطة رجوع"});
  await expect(button).toBeDisabled();
  await page.getByLabel("كلمة مرور مستقلة للنسخة (12 حرفًا على الأقل)").fill(BACKUP_PASSWORD);
  await page.getByRole("button",{name:"معاينة محتويات النسخة المشفرة"}).click();
  const preview=page.getByTestId("restore-preview");
  await expect(preview).toContainText("المحافظ: 1");
  await expect(preview).toContainText("الديون: 1");
  await expect(page.getByText("محفظة لا يجب حذفها بالخطأ").first()).toBeVisible();
  await expect(button).toBeDisabled();
  await page.getByLabel("تأكيد الاستعادة (اكتب: استعادة)").fill("استعادة");
  await expect(button).toBeEnabled();

  // Any change of the backup password must discard the unencrypted preview.
  await page.getByLabel("كلمة مرور مستقلة للنسخة (12 حرفًا على الأقل)").fill("Other-Password-2026");
  await expect(preview).toHaveCount(0);
  await expect(button).toBeDisabled();
  await page.getByLabel("كلمة مرور مستقلة للنسخة (12 حرفًا على الأقل)").fill(BACKUP_PASSWORD);
  await page.getByRole("button",{name:"معاينة محتويات النسخة المشفرة"}).click();
  await expect(preview).toBeVisible();
  await button.click();
  await expect(page.getByText("محفظة أرشيفية").first()).toBeVisible();
  await expect(page.getByText("محفظة لا يجب حذفها بالخطأ")).toHaveCount(0);
  await expect(page.getByTestId("total-receivable")).toHaveAttribute("data-halalas","2500");
  await page.reload();
  await page.getByLabel("كلمة سر الخزنة (12 حرفًا على الأقل)").fill(DEVICE_PASSWORD);
  await page.getByRole("button",{name:"فتح الخزنة"}).click();
  await expect(page.getByText("محفظة أرشيفية").first()).toBeVisible();
});

test("background hides backup preview and forbids late restoration",async({page})=>{
  await page.goto("/");
  await page.getByLabel("كلمة سر الخزنة (12 حرفًا على الأقل)").fill(DEVICE_PASSWORD);
  await page.getByLabel("تأكيد كلمة السر").fill(DEVICE_PASSWORD);
  await page.getByRole("button",{name:"إنشاء خزنة محلية"}).click();
  const archived=appendWallet(emptyLocalLedger(),"سجل مشفر","85");
  const backup=await encryptRasdBackup(archived,BACKUP_PASSWORD);
  await page.locator("#import-backup").setInputFiles({
    name:"rasd-android-2026-10-19-test.json",mimeType:"application/json",
    buffer:Buffer.from(JSON.stringify(backup)),
  });
  await page.getByLabel("كلمة مرور مستقلة للنسخة (12 حرفًا على الأقل)").fill(BACKUP_PASSWORD);
  await page.getByRole("button",{name:"معاينة محتويات النسخة المشفرة"}).click();
  await expect(page.getByTestId("restore-preview")).toBeVisible();
  await page.evaluate(()=>{
    Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"hidden"});
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByTestId("restore-preview")).toHaveCount(0);
  await expect(page.getByRole("heading",{name:"افتح خزنتك"})).toBeVisible();
});
