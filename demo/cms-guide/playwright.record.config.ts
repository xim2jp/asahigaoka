import { defineConfig } from '@playwright/test';

/**
 * 操作案内動画の録画専用設定。
 * プロジェクトルートを静的配信し、スマホ縦（9:16）で録画する。
 */
export default defineConfig({
  testDir: __dirname,
  testMatch: 'record-guide.spec.ts',
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: 'list',
  timeout: 120000,

  use: {
    baseURL: 'http://127.0.0.1:8123',
    headless: true,
    viewport: { width: 412, height: 915 },     // Android 相当の縦画面（モバイルレイアウト）
    isMobile: true,
    hasTouch: true,
    userAgent:
      'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.0 Mobile/15E148 Safari/604.1',
    // 録画を有効化（ビューポートと同寸にしてパディングを防ぐ。仕上げで2倍にアップスケール）
    video: {
      mode: 'on',
      size: { width: 412, height: 915 }
    },
    actionTimeout: 15000,
  },

  // プロジェクトルートを配信（/admin/... にアクセスできる）
  webServer: {
    command: 'python3 -m http.server 8123 --directory ../..',
    cwd: __dirname,
    url: 'http://127.0.0.1:8123/admin/login.html',
    reuseExistingServer: true,
    timeout: 30000,
  },
});
