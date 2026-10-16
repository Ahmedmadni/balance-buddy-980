import { expect, test } from "./fixtures";

test("صفحة الدخول تعرض خيار جوجل", async ({ page }) => {
  await page.goto("/auth");

  await expect(page.getByRole("heading", { name: "مرحباً بك" })).toBeVisible();
  await expect(page.getByRole("button", { name: "متابعة باستخدام جوجل" })).toBeVisible();
});

test("المسارات المحمية تعيد الزائر إلى الدخول", async ({ page }) => {
  await page.goto("/app");

  await expect(page).toHaveURL(/\/auth(?:\?|$)/, { timeout: 30_000 });
});

for (const path of ["privacy", "terms", "cookies", "data-export"]) {
  test(`صفحة ${path} القانونية متاحة`, async ({ page }) => {
    await page.goto(`/legal/${path}`);

    await expect(page.locator("main")).toBeVisible();
  });
}

test("شريط الخصوصية يلائم شاشة هاتف صغيرة ولا يحجب أزرار الموافقة", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 640 });
  await page.addInitScript(() => {
    window.localStorage.removeItem("rasd.consent.v1");
  });
  await page.goto("/auth");
  const banner = page.getByTestId("consent-banner");
  await expect(banner).toBeVisible();
  const box = await banner.boundingBox();
  expect(box).not.toBeNull();
  expect(box!.x).toBeGreaterThanOrEqual(0);
  expect(box!.x + box!.width).toBeLessThanOrEqual(320);
  expect(box!.y + box!.height).toBeLessThanOrEqual(640);
  await expect(banner.getByRole("button", { name: "قبول الكل" })).toBeVisible();
  await expect(banner.getByRole("button", { name: "رفض غير الأساسي" })).toBeVisible();
  await banner.getByRole("button", { name: "رفض غير الأساسي" }).click();
  await expect(banner).toHaveCount(0);
  await page.reload();
  await expect(page.getByTestId("consent-banner")).toHaveCount(0);
});
