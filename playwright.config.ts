import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  timeout: 45000,
  fullyParallel: false,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3000",
    channel: "msedge",
    headless: true,
    locale: "ar-EG",
  },
  webServer: {
    command: "npm.cmd run start --workspace=web",
    url: "http://localhost:3000/demo/trips",
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});
