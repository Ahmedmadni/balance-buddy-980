import { expect, test } from "./fixtures";

test("Android يعرض مسار المتصفح بدلاً من زر Google غير الجاهز", async ({ page }) => {
  // A dev-only visual branch, not a fake native bridge or authenticated session.
  await page.goto("/auth?__rasdNativeUiTest=1");
  await expect(page.getByRole("button", { name: "فتح حساب رصد في المتصفح" })).toBeVisible();
  await expect(page.getByRole("button", { name: "متابعة باستخدام جوجل" })).toHaveCount(0);
  await expect(page.getByText("جلسة المتصفح مستقلة ولن تسجّل دخولك إلى تطبيق Android تلقائيًا.")).toBeVisible();
});

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

for (const scheme of ["light", "dark"] as const) {
  for (const surface of ["web", "android-native"] as const) {
  test(`تباين نص شاشة الدخول في الوضع ${scheme} على ${surface} واضح وقابل للقراءة`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto("/auth");
    const heading = page.getByRole("heading", { name: "مرحباً بك" });
    await expect(heading).toBeVisible();
    await page.waitForFunction((mode) => document.documentElement.classList.contains("dark") === (mode === "dark"), scheme);
    if (surface === "android-native") {
      // Exercise the native-shell CSS palette without needing a signed device.
      await page.evaluate(() => document.documentElement.classList.add("rasd-native-app"));
    }
    const contrast = await heading.evaluate((node) => {
      const card = node.closest(".rounded-2xl");
      if (!card) return 0;
      const rgb = (css: string) => {
        const canvas = document.createElement("canvas");
        canvas.width = canvas.height = 1;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return [0, 0, 0];
        ctx.fillStyle = css;
        ctx.fillRect(0, 0, 1, 1);
        return Array.from(ctx.getImageData(0, 0, 1, 1).data.slice(0, 3)).map((n) => n / 255);
      };
      const luminance = (c: number[]) => {
        const linear = c.map((v) => v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
        return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
      };
      const foreground = luminance(rgb(getComputedStyle(node).color));
      const background = luminance(rgb(getComputedStyle(card).backgroundColor));
      return (Math.max(foreground, background) + 0.05) / (Math.min(foreground, background) + 0.05);
    });
    expect(contrast).toBeGreaterThan(4.5);
  });
  }
}


test("الطباعة في الصفحات العامة لا تصبح فارغة بسبب قواعد التقارير", async ({ page }) => {
  await page.goto("/auth");
  await page.emulateMedia({ media: "print" });
  const title = page.getByRole("heading", { name: "مرحباً بك" });
  await expect(title).toBeAttached();
  const style = await title.evaluate((node) => getComputedStyle(node).visibility);
  expect(style).toBe("visible");
});

test("تنسيق التقرير المطبوع يخفي بقية الواجهة ويظهر الجداول العربية كاملة", async ({ page }) => {
  await page.goto("/auth");
  await page.evaluate(() => {
    document.documentElement.classList.add("rasd-report-page");
    const container = document.createElement("section");
    container.id = "rasd-report-print";
    container.innerHTML = '<h2>تقرير تجريبي</h2><table><thead><tr><th>الوصف</th></tr></thead><tbody><tr><td><span class="truncate">قيمة طويلة تظهر بالكامل عند الطباعة</span></td></tr></tbody></table>';
    document.body.appendChild(container);
  });
  await page.emulateMedia({ media: "print" });

  const status = await page.evaluate(() => ({
    report: getComputedStyle(document.querySelector("#rasd-report-print")!).visibility,
    details: getComputedStyle(document.querySelector("#rasd-report-print .truncate")!).whiteSpace,
    tableHeader: getComputedStyle(document.querySelector("#rasd-report-print thead")!).display,
    authHeading: getComputedStyle([...document.querySelectorAll("h1, h2")]
      .find((node) => node.textContent?.includes("مرحباً بك"))!).visibility,
  }));
  expect(status.report).toBe("visible");
  expect(status.details).toBe("normal");
  expect(status.tableHeader).toBe("table-header-group");
  expect(status.authHeading).toBe("hidden");
  await page.evaluate(() => document.documentElement.classList.add("rasd-app-inactive"));
  const backgroundBlur = await page.evaluate(() => getComputedStyle(document.body).filter);
  expect(backgroundBlur).toBe("none");
});
