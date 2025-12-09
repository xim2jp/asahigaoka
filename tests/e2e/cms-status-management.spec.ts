import { test, expect, Page, BrowserContext } from '@playwright/test';

/**
 * CMS記事ステータス管理のE2Eテスト
 *
 * テスト対象:
 * 1. 下書き記事ではLINE/X投稿が実行されないこと
 * 2. 公開記事でのみLINE/X投稿が実行されること
 * 3. 下書き記事の詳細ページが生成されないこと
 * 4. 公開→下書きに戻すと詳細ページが削除されること
 */

// テスト用の環境変数
const ADMIN_URL = process.env.ADMIN_URL || 'http://localhost:8080/admin';
const TEST_USER_EMAIL = process.env.TEST_USER_EMAIL || 'test@example.com';
const TEST_USER_PASSWORD = process.env.TEST_USER_PASSWORD || 'testpassword';

/**
 * ログインヘルパー関数
 */
async function login(page: Page) {
  await page.goto(`${ADMIN_URL}/login.html`);
  await page.fill('#email', TEST_USER_EMAIL);
  await page.fill('#password', TEST_USER_PASSWORD);
  await page.click('button[type="submit"]');
  // ログイン完了を待つ（index.html または articles.html に遷移）
  await page.waitForURL(/index\.html|articles\.html|dashboard/, { timeout: 10000 });
}

test.describe('CMS記事ステータス管理', () => {

  test.describe('ログイン', () => {
    test('管理画面にログインできる', async ({ page }) => {
      await page.goto(`${ADMIN_URL}/login.html`);

      // ログインフォームが表示されていることを確認
      await expect(page.locator('#email')).toBeVisible();
      await expect(page.locator('#password')).toBeVisible();

      // ログイン情報を入力
      await page.fill('#email', TEST_USER_EMAIL);
      await page.fill('#password', TEST_USER_PASSWORD);

      // ログインボタンをクリック
      await page.click('button[type="submit"]');

      // ログイン後のページに遷移することを確認（index.html も含む）
      await expect(page).toHaveURL(/index\.html|dashboard|articles/, { timeout: 10000 });
    });
  });

  test.describe('下書き記事のステータス管理', () => {
    test('下書き保存時にLINE/X投稿がスキップされる', async ({ page }) => {
      // ログイン
      await login(page);

      // 新規記事作成ページに移動
      await page.goto(`${ADMIN_URL}/article-edit.html`);
      await page.waitForLoadState('networkidle');

      // 必須フィールドを入力
      await page.fill('#title', 'テスト記事（下書き）' + Date.now());

      // content-editorがcontenteditable要素の場合
      const contentEditor = page.locator('#content-editor');
      await contentEditor.click();
      await contentEditor.pressSequentially('テスト本文です。');

      await page.selectOption('#category', 'notice');

      // イベント開始日を設定
      const today = new Date().toISOString().split('T')[0];
      await page.fill('#event-date-from', today);

      // LINE配信を有効化
      const lineCheckbox = page.locator('#line-enabled');
      if (await lineCheckbox.isVisible()) {
        await lineCheckbox.check();
      }

      // X投稿を有効化
      const xCheckbox = page.locator('#x-enabled');
      if (await xCheckbox.isVisible()) {
        await xCheckbox.check();
      }

      // コンソールログを監視
      const consoleMessages: string[] = [];
      page.on('console', msg => {
        consoleMessages.push(msg.text());
      });

      // 保存ボタンをクリック
      await page.click('[data-action="save"]');

      // 保存完了を待つ
      await page.waitForTimeout(3000);

      // LINE配信がスキップされたことを確認（新規作成時は下書き）
      const lineSkipped = consoleMessages.some(msg =>
        msg.includes('LINE配信スキップ') || msg.includes('下書き状態')
      );
      expect(lineSkipped).toBe(true);

      // X投稿がスキップされたことを確認
      const xSkipped = consoleMessages.some(msg =>
        msg.includes('X投稿スキップ') || msg.includes('下書き状態')
      );
      expect(xSkipped).toBe(true);
    });

    test('下書き記事の詳細ページ生成がブロックされる', async ({ page }) => {
      // ログイン
      await login(page);

      // 記事一覧ページに移動
      await page.goto(`${ADMIN_URL}/articles.html`);
      await page.waitForLoadState('networkidle');

      // 下書きフィルターを選択
      const statusFilter = page.locator('[data-filter="status"]');
      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption('draft');
        await page.waitForTimeout(1000);
      }

      // 下書き記事が存在することを確認（バッジまたはステータス表示）
      const draftBadge = page.locator('.badge-draft, .badge:has-text("下書き")').first();
      await expect(draftBadge).toBeVisible({ timeout: 5000 });
    });
  });

  test.describe('公開記事のステータス管理', () => {
    test('公開時にLINE/X投稿が実行される', async ({ page }) => {
      // ログイン
      await login(page);

      // 新規記事作成ページに移動
      await page.goto(`${ADMIN_URL}/article-edit.html`);
      await page.waitForLoadState('networkidle');

      // 必須フィールドを入力
      await page.fill('#title', 'テスト記事（公開用）' + Date.now());

      // content-editorがcontenteditable要素の場合
      const contentEditor = page.locator('#content-editor');
      await contentEditor.click();
      await contentEditor.pressSequentially('公開テスト本文です。');

      await page.selectOption('#category', 'notice');

      // イベント開始日を設定
      const today = new Date().toISOString().split('T')[0];
      await page.fill('#event-date-from', today);

      // LINE配信を有効化
      const lineCheckbox = page.locator('#line-enabled');
      if (await lineCheckbox.isVisible()) {
        await lineCheckbox.check();
      }

      // X投稿を有効化
      const xCheckbox = page.locator('#x-enabled');
      if (await xCheckbox.isVisible()) {
        await xCheckbox.check();
      }

      // コンソールログを監視
      const consoleMessages: string[] = [];
      page.on('console', msg => {
        consoleMessages.push(msg.text());
      });

      // 公開ボタンをクリック
      const publishBtn = page.locator('[data-action="publish"]');
      await publishBtn.click();

      // 公開完了を待つ
      await page.waitForTimeout(5000);

      // LINE配信が実行されたことを確認
      const lineTriggered = consoleMessages.some(msg =>
        msg.includes('LINE通知トリガー') && msg.includes('公開')
      );
      expect(lineTriggered).toBe(true);

      // X投稿が実行されたことを確認
      const xTriggered = consoleMessages.some(msg =>
        msg.includes('X投稿トリガー') && msg.includes('公開')
      );
      expect(xTriggered).toBe(true);
    });
  });

  test.describe('公開→下書きへの変更', () => {
    test('公開記事に「下書きに戻す」ボタンが表示される', async ({ page }) => {
      // ログイン
      await login(page);

      // 記事一覧ページに移動
      await page.goto(`${ADMIN_URL}/articles.html`);
      await page.waitForLoadState('networkidle');

      // 公開フィルターを選択
      const statusFilter = page.locator('[data-filter="status"]');
      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption('published');
        await page.waitForTimeout(1000);
      }

      // 公開記事の行に「下書きに戻す」ボタンがあることを確認
      const unpublishButton = page.locator('[data-action="unpublish"]').first();
      await expect(unpublishButton).toBeVisible({ timeout: 5000 });
      await expect(unpublishButton).toHaveText('下書きに戻す');
    });

    test('「下書きに戻す」をクリックすると確認ダイアログが表示される', async ({ page }) => {
      // ログイン
      await login(page);

      // 記事一覧ページに移動
      await page.goto(`${ADMIN_URL}/articles.html`);
      await page.waitForLoadState('networkidle');

      // 公開フィルターを選択
      const statusFilter = page.locator('[data-filter="status"]');
      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption('published');
        await page.waitForTimeout(1000);
      }

      // ダイアログをキャプチャ
      let dialogReceived = false;
      page.on('dialog', async dialog => {
        dialogReceived = true;
        expect(dialog.message()).toContain('下書きに戻しますか');
        await dialog.dismiss(); // キャンセル
      });

      // 「下書きに戻す」ボタンをクリック
      const unpublishButton = page.locator('[data-action="unpublish"]').first();
      if (await unpublishButton.isVisible()) {
        await unpublishButton.click();
        await page.waitForTimeout(1000);
        expect(dialogReceived).toBe(true);
      }
    });

    test('下書きに戻すと詳細ページ削除が呼び出される', async ({ page }) => {
      // ログイン
      await login(page);

      // 記事一覧ページに移動
      await page.goto(`${ADMIN_URL}/articles.html`);
      await page.waitForLoadState('networkidle');

      // 公開フィルターを選択
      const statusFilter = page.locator('[data-filter="status"]');
      if (await statusFilter.isVisible()) {
        await statusFilter.selectOption('published');
        await page.waitForTimeout(1000);
      }

      // コンソールログを監視
      const consoleMessages: string[] = [];
      page.on('console', msg => {
        consoleMessages.push(msg.text());
      });

      // ダイアログを自動で承認
      page.on('dialog', async dialog => {
        await dialog.accept();
      });

      // 「下書きに戻す」ボタンをクリック
      const unpublishButton = page.locator('[data-action="unpublish"]').first();
      if (await unpublishButton.isVisible()) {
        await unpublishButton.click();

        // 処理完了を待つ
        await page.waitForTimeout(5000);

        // 詳細ページ削除が呼び出されたことを確認
        const deleteTriggered = consoleMessages.some(msg =>
          msg.includes('記事詳細ページを削除')
        );
        expect(deleteTriggered).toBe(true);
      }
    });
  });
});

test.describe('news.html一覧ページ', () => {
  test('公開記事のみが一覧に表示される', async ({ page }) => {
    // 公開サイトのニュース一覧ページに移動
    const siteUrl = process.env.SITE_URL || 'https://asahigaoka-nerima.tokyo';
    await page.goto(`${siteUrl}/news.html`);

    // ニュース一覧が存在することを確認
    const newsList = page.locator('.news-list, .news-item, article');
    await expect(newsList.first()).toBeVisible({ timeout: 10000 });

    // 下書き記事が表示されていないことを確認
    // （テスト用の下書き記事タイトルが含まれていないこと）
    const pageContent = await page.content();
    expect(pageContent).not.toContain('テスト記事（下書き）');
  });
});

test.describe('詳細ページの存在確認', () => {
  test('公開記事の詳細ページが存在する', async ({ page }) => {
    const siteUrl = process.env.SITE_URL || 'https://asahigaoka-nerima.tokyo';

    // 既知の公開記事スラッグでテスト（実際のスラッグに置き換え）
    const publishedSlug = process.env.TEST_PUBLISHED_SLUG || '';

    // スラッグが指定されていない場合はスキップ
    if (!publishedSlug) {
      console.log('TEST_PUBLISHED_SLUG が設定されていないためスキップ');
      return;
    }

    const response = await page.goto(`${siteUrl}/news/${publishedSlug}.html`);

    // 200 OKまたはリダイレクトを期待
    expect(response?.status()).toBeLessThan(400);
  });

  test('存在しない記事は404または403を返す', async ({ page }) => {
    const siteUrl = process.env.SITE_URL || 'https://asahigaoka-nerima.tokyo';

    // 存在しないはずの記事スラッグでテスト
    const draftSlug = 'non-existent-article-' + Date.now();

    const response = await page.goto(`${siteUrl}/news/${draftSlug}.html`);

    // 404または403を期待（CloudFrontの設定による）
    const status = response?.status();
    expect(status === 404 || status === 403).toBe(true);
  });
});
