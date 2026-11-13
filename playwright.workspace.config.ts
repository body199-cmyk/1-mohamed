import {defineConfig} from '@playwright/test';
export default defineConfig({testDir:'./e2e/workspace',timeout:30000,workers:1,retries:0,reporter:'list',
 use:{baseURL:'http://127.0.0.1:39126',locale:'ar-EG',headless:true,
  launchOptions:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH?{executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH}:{}},
 webServer:{command:'node tools/workspace-test-server.mjs',url:'http://127.0.0.1:39126',reuseExistingServer:false}});
