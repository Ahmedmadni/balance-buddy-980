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

for (const width of [320, 360, 393, 430]) {
  test(`واجهة الدخول العربية لا تتجاوز عرض شاشة ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 780 });
    await page.goto("/auth");
    await expect(page.getByRole("heading", { name: "مرحباً بك" })).toBeVisible();
    await expect(page.getByRole("button", { name: "متابعة باستخدام جوجل" })).toBeVisible();
    const measurements = await page.evaluate(() => ({
      documentWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      rtl: document.documentElement.dir,
    }));
    expect(measurements.documentWidth).toBeLessThanOrEqual(measurements.viewportWidth + 2);
    expect(measurements.rtl).toBe("rtl");
  });
}
