import { expect, test as base } from "@playwright/test";

export const test = base.extend<{ runtimeFailures: string[] }>({
  runtimeFailures: [
    async ({ page }, use) => {
      const failures: string[] = [];

      page.on("pageerror", (error) => {
        failures.push(`pageerror: ${error.message}`);
      });
      page.on("console", (message) => {
        if (message.type() === "error") failures.push(`console.error: ${message.text()}`);
      });
      page.on("response", (response) => {
        if (response.status() >= 500) {
          failures.push(`http ${response.status()}: ${response.url()}`);
        }
      });

      await use(failures);
      expect(failures, "the page emitted runtime failures").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect } from "@playwright/test";
