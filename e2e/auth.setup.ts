import { expect, test as setup } from "@playwright/test";

setup("إنشاء جلسة حساب الاختبار", async ({ page, request }) => {
  const supabaseUrl = process.env.VITE_SUPABASE_URL;
  const anonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  const email = process.env.E2E_EMAIL;
  const password = process.env.E2E_PASSWORD;

  expect(supabaseUrl).toBeTruthy();
  expect(anonKey).toBeTruthy();
  expect(email).toBeTruthy();
  expect(password).toBeTruthy();

  const response = await request.post(`${supabaseUrl}/auth/v1/token?grant_type=password`, {
    headers: { apikey: anonKey! },
    data: { email, password },
  });

  expect(response.ok()).toBeTruthy();
  const session = await response.json();
  const projectRef = new URL(supabaseUrl!).hostname.split(".")[0];
  const storageKey = `sb-${projectRef}-auth-token`;

  await page.goto("/auth");
  await page.evaluate(({ key, value }) => localStorage.setItem(key, JSON.stringify(value)), {
    key: storageKey,
    value: session,
  });
  await page.context().storageState({ path: "e2e/.auth/user.json" });
});
