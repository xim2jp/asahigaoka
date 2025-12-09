import { defineConfig, devices } from '@playwright/test';

/**
 * 旭丘一丁目町会CMS E2Eテスト設定
 */
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',

  use: {
    // 管理画面のベースURL
    baseURL: process.env.ADMIN_URL || 'http://localhost:8080/admin',

    // トレースを収集（失敗時のみ）
    trace: 'on-first-retry',

    // スクリーンショットを収集（失敗時のみ）
    screenshot: 'only-on-failure',

    // ヘッドレスモード
    headless: true,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  // ローカル開発サーバー（必要に応じて）
  // webServer: {
  //   command: 'python -m http.server 8080',
  //   url: 'http://localhost:8080',
  //   reuseExistingServer: !process.env.CI,
  // },
});
