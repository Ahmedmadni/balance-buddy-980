import {defineConfig,devices} from "@playwright/test";
export default defineConfig({
  testDir:"./e2e-native",
  fullyParallel:false,
  retries:process.env.CI?1:0,
  reporter:process.env.CI?[["github"],["html",{open:"never"}]]:"list",
  use:{baseURL:"http://127.0.0.1:4179",...devices["Desktop Chrome"],viewport:{width:375,height:812},
    screenshot:"only-on-failure",trace:"on-first-retry"},
  webServer:{command:"bunx vite preview --config vite.native.config.ts --host 127.0.0.1 --port 4179 --strictPort",
    url:"http://127.0.0.1:4179/",reuseExistingServer:!process.env.CI,timeout:60_000},
});
