import {test,expect,type Page} from "@playwright/test";
const PASSWORD="Strong-Android-AutoLock-2026";
async function createDeviceVault(page:Page){
  await page.goto("/");
  await page.getByLabel("كلمة سر الخزنة (12 حرفًا على الأقل)").fill(PASSWORD);
  await page.getByLabel("تأكيد كلمة السر").fill(PASSWORD);
  await page.getByRole("button",{name:"إنشاء خزنة محلية"}).click();
  await expect(page.getByRole("heading",{name:"المحافظ والأرصدة"})).toBeVisible();
  await page.getByLabel("اسم المحفظة").fill("مدخرات سرية");
  await page.getByLabel("الرصيد الافتتاحي (ريال)").fill("3000");
  await page.getByRole("button",{name:"إضافة محفظة"}).click();
  await expect(page.getByText("مدخرات سرية").first()).toBeVisible();
}
async function unlockDevice(page:Page){
  await page.getByLabel("كلمة سر الخزنة (12 حرفًا على الأقل)").fill(PASSWORD);
  await page.getByRole("button",{name:"فتح الخزنة"}).click();
  await expect(page.getByText("مدخرات سرية").first()).toBeVisible();
}
test("Android background immediately revokes decrypted session without losing encrypted data",async({page})=>{
  await createDeviceVault(page);
  await page.evaluate(()=>{
    Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"hidden"});
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await expect(page.getByRole("heading",{name:"افتح خزنتك"})).toBeVisible();
  await expect(page.getByText("مدخرات سرية")).toHaveCount(0);
  await expect(page.getByTestId("wallet-balance")).toHaveCount(0);
  await page.evaluate(()=>{
    Object.defineProperty(document,"visibilityState",{configurable:true,get:()=>"visible"});
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await unlockDevice(page);
  await page.getByRole("button",{name:"قفل الخزنة"}).click();
  await expect(page.getByRole("heading",{name:"افتح خزنتك"})).toBeVisible();
  await unlockDevice(page);
});
test("Android inactivity closes the wallet after two minutes",async({page})=>{
  await page.clock.install();
  await createDeviceVault(page);
  await page.clock.fastForward(125_000);
  await expect(page.getByRole("heading",{name:"افتح خزنتك"})).toBeVisible();
  await expect(page.getByTestId("wallet-balance")).toHaveCount(0);
  await unlockDevice(page);
});
test("Android pagehide does not leave plaintext finance data visible",async({page})=>{
  await createDeviceVault(page);
  await page.evaluate(()=>window.dispatchEvent(new Event("pagehide")));
  await expect(page.getByRole("heading",{name:"افتح خزنتك"})).toBeVisible();
  await expect(page.getByText("مدخرات سرية")).toHaveCount(0);
});
