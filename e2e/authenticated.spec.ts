import { expect, test } from "@playwright/test";

const routes = [
  ["/app", "لوحة التحكم"],
  ["/app/wallets", "المحافظ والحسابات"],
  ["/app/people", "الديون"],
  ["/app/expenses", "المصاريف"],
  ["/app/investments", "الأصول والاستثمارات"],
  ["/app/reports", "التقارير"],
] as const;

for (const [path, heading] of routes) {
  test(`${heading} تفتح بحساب الاختبار`, async ({ page }) => {
    await page.goto(path);

    await expect(page.getByRole("heading", { name: heading })).toBeVisible();
  });
}
