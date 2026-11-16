import { defineConfig, devices } from '@playwright/test'

// 可为测试选择独立端口，避免占用正在开发的页面。
const port = process.env.HANDCRAFT_E2E_PORT || '5173'
const origin = `http://localhost:${port}`

/** 浏览器真实直连测试后端；保持与开发环境相同的跨域 Cookie 和 CSRF 流程。 */
export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 45_000,
  expect: { timeout: 8_000 },
  reporter: 'list',
  use: {
    baseURL: origin,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], channel: 'msedge' } }],
  webServer: {
    command: `npm run dev -- --host localhost --port ${port} --strictPort`,
    url: origin,
    reuseExistingServer: false,
    env: { VITE_API_BASE_URL: 'http://localhost:18080/api' },
  },
})
