import {test,expect} from "@playwright/test";
const PASS="Document-Backup-Password-2026";
test("offline local backup offers both Android share and Save As choices",async({page})=>{
  await page.goto("/");
  await page.getByLabel("كلمة سر الخزنة (12 حرفًا على الأقل)").fill(PASS);
  await page.getByLabel("تأكيد كلمة السر").fill(PASS);
  await page.getByRole("button",{name:"إنشاء خزنة محلية"}).click();
  const saveAs=page.getByRole("button",{name:"حفظ باسم — الهاتف أو Google Drive"});
  await expect(saveAs).toBeVisible();
  await expect(saveAs).toBeDisabled();
  await page.getByLabel("كلمة مرور مستقلة للنسخة (12 حرفًا على الأقل)")
    .fill("Backup-Strong-Password-2026");
  await expect(saveAs).toBeEnabled();
  await expect(page.getByRole("button",{name:"مشاركة النسخة المشفرة"})).toBeEnabled();
  await expect(page.getByRole("button",{name:"حفظ نسخة مشفرة داخل التطبيق"})).toBeEnabled();
});
