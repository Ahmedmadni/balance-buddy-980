import { expect, test } from "@playwright/test";

test("صفحة الدخول تعرض خيار جوجل", async ({ page }) => {
  await page.goto("/auth");

  await expect(page.getByRole("heading", { name: "مرحباً بك" })).toBeVisible();
  await expect(page.getByRole("button", { name: "متابعة باستخدام جوجل" })).toBeVisible();
});

test("المسارات المحمية تعيد الزائر إلى الدخول", async ({ page }) => {
  await page.goto("/app");

  await expect(page).toHaveURL(/\/auth(?:\?|$)/, { timeout: 20_000 });
});

for (const path of ["privacy", "terms", "cookies", "data-export"]) {
  test(`صفحة ${path} القانونية متاحة`, async ({ page }) => {
    await page.goto(`/legal/${path}`);

    await expect(page.locator("main")).toBeVisible();
  });
}
