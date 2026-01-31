import { test, expect, Page } from '@playwright/test';

const ADMIN_URL = process.env.ADMIN_URL || 'https://asahigaoka-nerima.tokyo/admin';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'shinichi.noguchi@gmail.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'Niww2t3p!';

/**
 * スマホビューポートでログイン
 */
async function mobileLogin(page: Page) {
  await page.goto(`${ADMIN_URL}/login.html`);
  await page.fill('#email', TEST_USER_EMAIL);
  await page.fill('#password', TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');
  // スマホ判定で mobile.html に遷移するはず
  await page.waitForURL(/mobile\.html|index\.html/, { timeout: 15000 });
}

/**
 * PC版でログイン
 */
async function pcLogin(page: Page) {
  await page.goto(`${ADMIN_URL}/login.html`);
  await page.fill('#email', TEST_USER_EMAIL);
  await page.fill('#password', TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL(/index\.html|mobile\.html/, { timeout: 15000 });
}

// ============================================================
// 1. ログイン時のデバイス判定テスト
// ============================================================
test.describe('ログイン時のデバイス判定', () => {

  test('スマホ（375px）でログインすると mobile.html に遷移する', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
    });
    const page = await context.newPage();

    await page.goto(`${ADMIN_URL}/login.html`);
    await page.fill('#email', TEST_USER_EMAIL);
    await page.fill('#password', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL(/mobile\.html/, { timeout: 15000 });
    expect(page.url()).toContain('mobile.html');

    await context.close();
  });

  test('PC（1280px）でログインすると index.html に遷移する', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 1280, height: 800 }
    });
    const page = await context.newPage();

    await page.goto(`${ADMIN_URL}/login.html`);
    await page.fill('#email', TEST_USER_EMAIL);
    await page.fill('#password', TEST_USER_PASSWORD);
    await page.click('button[type="submit"]');

    await page.waitForURL(/index\.html/, { timeout: 15000 });
    expect(page.url()).toContain('index.html');

    await context.close();
  });
});

// ============================================================
// 2. スマホ版管理画面 - 基本表示テスト
// ============================================================
test.describe('スマホ版管理画面 - 基本表示', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('mobile.html が正しく読み込まれ、主要UIが表示される', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }
    });
    const page = await context.newPage();
    await mobileLogin(page);

    // ヘッダー
    await expect(page.locator('.mobile-header h1')).toContainText('旭丘一丁目町会');

    // タブナビゲーション
    await expect(page.locator('.tab-btn[data-tab="list"]')).toBeVisible();
    await expect(page.locator('.tab-btn[data-tab="create"]')).toBeVisible();

    // ログアウトボタン
    await expect(page.locator('#btn-logout')).toBeVisible();

    await context.close();
  });

  test('ユーザー名が表示される', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }
    });
    const page = await context.newPage();
    await mobileLogin(page);

    const userName = page.locator('#user-name');
    await expect(userName).not.toBeEmpty();

    await context.close();
  });
});

// ============================================================
// 3. 記事一覧タブ
// ============================================================
test.describe('スマホ版 - 記事一覧', () => {

  test('記事一覧が表示される（最大30件）', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }
    });
    const page = await context.newPage();
    await mobileLogin(page);

    // 記事カードが表示されるまで待つ
    await page.waitForSelector('.article-card', { timeout: 10000 });

    const cards = page.locator('.article-card');
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
    expect(count).toBeLessThanOrEqual(30);

    await context.close();
  });

  test('記事カードにタイトル・日付・ステータスが表示される', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }
    });
    const page = await context.newPage();
    await mobileLogin(page);

    await page.waitForSelector('.article-card', { timeout: 10000 });

    const firstCard = page.locator('.article-card').first();
    await expect(firstCard.locator('.article-card-title')).not.toBeEmpty();
    await expect(firstCard.locator('.article-card-date')).toBeVisible();
    await expect(firstCard.locator('.status-dot')).toBeVisible();

    await context.close();
  });

  test('記事カードをタップすると展開される', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }
    });
    const page = await context.newPage();
    await mobileLogin(page);

    await page.waitForSelector('.article-card', { timeout: 10000 });

    const firstCard = page.locator('.article-card').first();
    const header = firstCard.locator('.article-card-header');
    await header.click();

    // 展開されたことを確認
    await expect(firstCard).toHaveClass(/expanded/);

    // 編集フィールドが表示される
    await expect(firstCard.locator('.edit-title')).toBeVisible();
    await expect(firstCard.locator('.edit-content')).toBeVisible();
    await expect(firstCard.locator('.status-toggle')).toBeVisible();
    await expect(firstCard.locator('.btn-save-edit')).toBeVisible();

    await context.close();
  });

  test('インライン編集で件名を変更して保存できる', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }
    });
    const page = await context.newPage();
    await mobileLogin(page);

    await page.waitForSelector('.article-card', { timeout: 10000 });

    // 最初のカードを展開
    const firstCard = page.locator('.article-card').first();
    await firstCard.locator('.article-card-header').click();
    await expect(firstCard).toHaveClass(/expanded/);

    // 元のタイトルを記録
    const titleInput = firstCard.locator('.edit-title');
    const originalTitle = await titleInput.inputValue();

    // タイトルを一時的に変更
    const testSuffix = `_test_${Date.now()}`;
    await titleInput.fill(originalTitle + testSuffix);

    // 保存
    await firstCard.locator('.btn-save-edit').click();

    // ローディングが消えるのを待つ
    await page.waitForSelector('.loading-overlay.active', { state: 'hidden', timeout: 10000 });

    // 成功メッセージを確認
    await expect(page.locator('.mobile-alert.success')).toBeVisible({ timeout: 5000 });

    // 元に戻す：リスト再読込後に最初のカードを展開して元のタイトルに戻す
    await page.waitForSelector('.article-card', { timeout: 10000 });
    const updatedCard = page.locator('.article-card').first();
    await updatedCard.locator('.article-card-header').click();
    await expect(updatedCard).toHaveClass(/expanded/);

    await updatedCard.locator('.edit-title').fill(originalTitle);
    await updatedCard.locator('.btn-save-edit').click();
    await page.waitForSelector('.loading-overlay.active', { state: 'hidden', timeout: 10000 });

    await context.close();
  });
});

// ============================================================
// 4. 新規作成タブ
// ============================================================
test.describe('スマホ版 - 新規作成', () => {

  test('新規作成タブに切り替えるとフォームが表示される', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }
    });
    const page = await context.newPage();
    await mobileLogin(page);

    // 新規作成タブをクリック
    await page.click('.tab-btn[data-tab="create"]');

    // フォームが表示される
    await expect(page.locator('#new-date-from')).toBeVisible();
    await expect(page.locator('#new-title')).toBeVisible();
    await expect(page.locator('#new-summary')).toBeVisible();
    await expect(page.locator('#btn-ai-generate')).toBeVisible();
    await expect(page.locator('#new-content')).toBeVisible();
    await expect(page.locator('#new-excerpt')).toBeVisible();

    await context.close();
  });

  test('必須項目未入力で保存するとエラーが表示される', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }
    });
    const page = await context.newPage();
    await mobileLogin(page);

    await page.click('.tab-btn[data-tab="create"]');

    // 何も入力せずに投稿ボタンを押す（HTML5 validation を迂回）
    await page.evaluate(() => {
      document.getElementById('create-form')?.setAttribute('novalidate', '');
    });
    await page.click('.btn-save');

    // エラーアラートが表示される
    await expect(page.locator('.mobile-alert.error')).toBeVisible({ timeout: 5000 });

    await context.close();
  });

  test('記事を下書き保存して記事一覧に反映される', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }
    });
    const page = await context.newPage();
    await mobileLogin(page);

    // 新規作成タブへ
    await page.click('.tab-btn[data-tab="create"]');

    const testTitle = `E2Eテスト記事_${Date.now()}`;
    const today = new Date().toISOString().split('T')[0];

    // フォーム入力
    await page.fill('#new-date-from', today);
    await page.fill('#new-title', testTitle);
    await page.fill('#new-summary', 'テスト要約文です');
    await page.fill('#new-content', 'テスト本文です。');
    await page.fill('#new-excerpt', 'テストSNSサマリ');

    // 投稿（下書き保存）
    await page.click('.btn-save');

    // ローディング完了待ち
    await page.waitForSelector('.loading-overlay.active', { state: 'hidden', timeout: 15000 });

    // 成功メッセージ
    await expect(page.locator('.mobile-alert.success')).toBeVisible({ timeout: 5000 });

    // 記事一覧タブに自動切替されているはず
    await expect(page.locator('#tab-list')).toHaveClass(/active/);

    // 作成した記事がリストに存在する
    await page.waitForSelector('.article-card', { timeout: 10000 });
    const pageContent = await page.locator('#article-list').textContent();
    expect(pageContent).toContain(testTitle);

    await context.close();
  });
});

// ============================================================
// 5. タブ切り替え・ログアウト
// ============================================================
test.describe('スマホ版 - ナビゲーション', () => {

  test('タブ切り替えが正しく動作する', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }
    });
    const page = await context.newPage();
    await mobileLogin(page);

    // 初期状態：記事一覧タブがアクティブ
    await expect(page.locator('.tab-btn[data-tab="list"]')).toHaveClass(/active/);
    await expect(page.locator('#tab-list')).toHaveClass(/active/);

    // 新規作成タブに切替
    await page.click('.tab-btn[data-tab="create"]');
    await expect(page.locator('.tab-btn[data-tab="create"]')).toHaveClass(/active/);
    await expect(page.locator('#tab-create')).toHaveClass(/active/);
    await expect(page.locator('#tab-list')).not.toHaveClass(/active/);

    // 記事一覧に戻す
    await page.click('.tab-btn[data-tab="list"]');
    await expect(page.locator('#tab-list')).toHaveClass(/active/);
    await expect(page.locator('#tab-create')).not.toHaveClass(/active/);

    await context.close();
  });

  test('ログアウトすると login.html に遷移する', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }
    });
    const page = await context.newPage();
    await mobileLogin(page);

    await page.click('#btn-logout');

    await page.waitForURL(/login\.html/, { timeout: 10000 });
    expect(page.url()).toContain('login.html');

    await context.close();
  });

  test('PC版管理画面へのリンクが存在する', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 }
    });
    const page = await context.newPage();
    await mobileLogin(page);

    const pcLink = page.locator('.pc-link a');
    await expect(pcLink).toBeVisible();
    await expect(pcLink).toHaveAttribute('href', 'index.html');

    await context.close();
  });
});
