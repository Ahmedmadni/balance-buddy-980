import { defineConfig, devices } from "@playwright/test";
import { loadEnv } from "vite";

const fileEnv = loadEnv("", process.cwd(), "");

for (const [key, value] of Object.entries(fileEnv)) {
  if (process.env[key] === undefined) process.env[key] = value;
}

const externalBaseUrl = process.env.E2E_BASE_URL;
const bunExecutable = process.env.BUN_EXECUTABLE ?? "bun";
const hasAuthenticatedCredentials = Boolean(process.env.E2E_EMAIL && process.env.E2E_PASSWORD);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: externalBaseUrl ?? "http://127.0.0.1:4173",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
  },
  webServer: externalBaseUrl
    ? undefined
    : {
        command: `${JSON.stringify(bunExecutable)} run dev -- --host 127.0.0.1 --port 4173`,
        url: "http://127.0.0.1:4173/auth",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
  projects: [
    {
      name: "public-chromium",
      testMatch: /public\.spec\.ts/,
      use: { ...devices["Desktop Chrome"] },
    },
    ...(hasAuthenticatedCredentials
      ? [
          {
            name: "auth-setup",
            testMatch: /auth\.setup\.ts/,
          },
          {
            name: "authenticated-chromium",
            testMatch: /authenticated\.spec\.ts/,
            dependencies: ["auth-setup"],
            use: {
              ...devices["Desktop Chrome"],
              storageState: "e2e/.auth/user.json",
            },
          },
        ]
      : []),
  ],
});
