import { expect, test } from "./fixtures";

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


for (const [path, table] of [
  ["/app", "expenses"],
  ["/app/expenses", "expenses"],
  ["/app/investments", "investments"],
] as const) {
  test(`financial relationship read succeeds on ${path}`, async ({ page }) => {
    const result = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === `/rest/v1/${table}` && (url.searchParams.get("select") ?? "").includes("!");
    });
    await page.goto(path);
    const response = await result;
    expect(response.status()).toBe(200);
    const rows: unknown = await response.json();
    expect(Array.isArray(rows)).toBe(true);
  });
}
