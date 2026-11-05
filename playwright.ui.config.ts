import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    browserName: "chromium",
    baseURL: "http://127.0.0.1:39125",
    locale: "ar-EG",
    headless: true,
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npm run start --workspace=web -- --port 39125",
    url: "http://127.0.0.1:39125/demo/master-data",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
