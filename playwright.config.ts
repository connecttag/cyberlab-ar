import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/browser",
  fullyParallel: false,
  workers: 2,
  reporter: "list",
  use: {
    baseURL: "http://127.0.0.1:5173",
    trace: "retain-on-failure",
    channel: "chrome"
  },
  outputDir: "output/playwright/results",
  webServer: [
    {
      command: "npm run dev",
      url: "http://127.0.0.1:5173",
      reuseExistingServer: !process.env.CI
    },
    {
      command: "npm run preview -w @cyberlab/web -- --port 4173",
      url: "http://127.0.0.1:4173",
      reuseExistingServer: !process.env.CI
    }
  ],
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"] } },
    { name: "phone", use: { ...devices["Pixel 7"] } }
  ]
});
