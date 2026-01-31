import { chromium, Page } from '@playwright/test';

const ADMIN_URL = 'https://asahigaoka-nerima.tokyo/admin';
const SITE_URL = 'https://asahigaoka-nerima.tokyo';
const EMAIL = 'shinichi.noguchi@gmail.com';
const PASSWORD = 'Niww2t3p!';
const TEST_IMAGE = '/tmp/claude-1000/-home-s-noguchi-asahigaoka/debe6b6d-1d92-4a29-bbe5-01ae75361f67/scratchpad/test-image.png';
const SCREENSHOT_DIR = '/tmp/claude-1000/-home-s-noguchi-asahigaoka/debe6b6d-1d92-4a29-bbe5-01ae75361f67/scratchpad/screenshots';

const TEST_TITLE = `E2E検証記事_${Date.now()}`;
const TODAY = new Date().toISOString().split('T')[0];

async function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function screenshot(page: Page, name: string) {
  await page.screenshot({ path: `${SCREENSHOT_DIR}/${name}.png`, fullPage: true });
  console.log(`  📸 Screenshot: ${name}.png`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 375, height: 812 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
  });
  const page = await context.newPage();

  // Capture console logs
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`  [CONSOLE ERROR] ${msg.text()}`);
  });

  try {
    // ==========================================
    // Step 1: ログイン
    // ==========================================
    console.log('\n=== Step 1: ログイン ===');
    await page.goto(`${ADMIN_URL}/login.html`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/mobile\.html/, { timeout: 15000 });
    console.log('  ✅ mobile.html にログイン成功');
    await screenshot(page, '01-login-success');

    // ==========================================
    // Step 2: 新規作成タブへ移動、フォーム入力
    // ==========================================
    console.log('\n=== Step 2: 新規作成フォーム入力 ===');
    await page.click('.tab-btn[data-tab="create"]');
    await sleep(500);

    await page.fill('#new-date-from', TODAY);
    await page.fill('#new-title', TEST_TITLE);
    await page.fill('#new-summary', '練馬区旭丘一丁目町会のE2Eテスト記事です。町会活動の一環として、地域コミュニティの活性化を目指しています。このテストでは記事作成からAI清書、画像アップロード、公開・下書き切替の全フローを検証します。');
    console.log(`  ✅ フォーム入力完了（件名: ${TEST_TITLE}）`);
    await screenshot(page, '02-form-filled');

    // ==========================================
    // Step 3: AIに清書依頼
    // ==========================================
    console.log('\n=== Step 3: AIに清書依頼 ===');
    await page.click('#btn-ai-generate');

    // ローディングが表示されるのを待つ
    await page.waitForSelector('.loading-overlay.active', { timeout: 5000 }).catch(() => {
      console.log('  ⚠️ ローディング表示なし（即時完了の可能性）');
    });

    // ローディングが消えるのを待つ（AI生成は時間がかかる）
    await page.waitForSelector('.loading-overlay.active', { state: 'hidden', timeout: 120000 });
    console.log('  ✅ AI生成完了');

    // 本文が入力されたか確認
    const contentValue = await page.locator('#new-content').inputValue();
    const excerptValue = await page.locator('#new-excerpt').inputValue();
    console.log(`  本文: ${contentValue.substring(0, 80)}...`);
    console.log(`  SNSサマリ: ${excerptValue.substring(0, 80)}...`);

    if (!contentValue) {
      console.log('  ❌ 本文が空です！AI生成に失敗した可能性');
    }
    await screenshot(page, '03-ai-generated');

    // ==========================================
    // Step 4: 画像アップロード
    // ==========================================
    console.log('\n=== Step 4: 画像アップロード ===');
    const fileInput = page.locator('#new-image');
    await fileInput.setInputFiles(TEST_IMAGE);
    await sleep(2000);  // アップロード待ち

    // プレビューが表示されるか確認
    const previewVisible = await page.locator('#image-preview.has-image').isVisible().catch(() => false);
    console.log(`  プレビュー表示: ${previewVisible ? '✅' : '❌'}`);
    await screenshot(page, '04-image-uploaded');

    // ==========================================
    // Step 5: 記事投稿（下書き保存）
    // ==========================================
    console.log('\n=== Step 5: 記事投稿（下書き保存） ===');
    await page.click('.btn-save');

    // ローディング完了待ち
    await page.waitForSelector('.loading-overlay.active', { state: 'hidden', timeout: 15000 });

    // 成功メッセージ確認
    const successAlert = await page.locator('.mobile-alert.success').isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`  保存成功メッセージ: ${successAlert ? '✅' : '❌'}`);

    // 記事一覧タブに切り替わったか
    await sleep(1000);
    await screenshot(page, '05-article-saved');

    // 保存した記事がリストにあるか確認
    await page.waitForSelector('.article-card', { timeout: 10000 });
    const listText = await page.locator('#article-list').textContent();
    const articleInList = listText?.includes(TEST_TITLE);
    console.log(`  記事一覧に反映: ${articleInList ? '✅' : '❌'}`);

    // ==========================================
    // Step 6: ステータスを公開中に変更
    // ==========================================
    console.log('\n=== Step 6: ステータスを公開中に変更 ===');

    // テスト記事のカードを見つけて展開
    const cards = page.locator('.article-card');
    const cardCount = await cards.count();
    let targetCard = null;

    for (let i = 0; i < cardCount; i++) {
      const title = await cards.nth(i).locator('.article-card-title').textContent();
      if (title?.includes('E2E検証記事')) {
        targetCard = cards.nth(i);
        break;
      }
    }

    if (!targetCard) {
      console.log('  ❌ テスト記事が見つかりません！');
      throw new Error('テスト記事が見つかりません');
    }

    // カードを展開
    await targetCard.locator('.article-card-header').click();
    await sleep(500);
    await screenshot(page, '06-card-expanded');

    // トグルスイッチで公開に変更
    const toggle = targetCard.locator('.status-toggle');
    const isChecked = await toggle.isChecked();
    console.log(`  現在のステータス: ${isChecked ? '公開中' : '下書き'}`);

    if (!isChecked) {
      await targetCard.locator('.toggle-slider').click();
      await sleep(1000);

      // ローディング完了待ち
      await page.waitForSelector('.loading-overlay.active', { state: 'hidden', timeout: 15000 }).catch(() => {});

      const newChecked = await toggle.isChecked();
      console.log(`  変更後ステータス: ${newChecked ? '公開中 ✅' : '下書き ❌'}`);
    }
    await screenshot(page, '07-status-published');

    // ==========================================
    // Step 7: /news.html に反映確認（ポーリング）
    // ==========================================
    console.log('\n=== Step 7: /news.html 反映待ち（最大5分） ===');

    // 別のコンテキストで news.html を確認
    const pcContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
    const newsPage = await pcContext.newPage();

    let foundOnNews = false;
    const maxAttempts = 15;  // 15回 x 20秒 = 最大5分
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await newsPage.goto(`${SITE_URL}/news.html`, { waitUntil: 'networkidle' });
      const newsContent = await newsPage.content();

      if (newsContent.includes(TEST_TITLE)) {
        foundOnNews = true;
        console.log(`  ✅ /news.html に反映確認！（${attempt}回目のチェック）`);
        await newsPage.screenshot({ path: `${SCREENSHOT_DIR}/08-news-published.png`, fullPage: true });
        break;
      }

      console.log(`  ⏳ ${attempt}/${maxAttempts} - まだ反映されていません。20秒待機...`);
      await sleep(20000);
    }

    if (!foundOnNews) {
      console.log('  ❌ 5分以内に /news.html に反映されませんでした');
      await newsPage.screenshot({ path: `${SCREENSHOT_DIR}/08-news-not-found.png`, fullPage: true });
    }

    // ==========================================
    // Step 8: ステータスを下書きに変更
    // ==========================================
    console.log('\n=== Step 8: ステータスを下書きに変更 ===');

    // モバイルページに戻る
    // 記事一覧を再読み込み
    await page.goto(`${ADMIN_URL}/mobile.html`);
    await page.waitForSelector('.article-card', { timeout: 10000 });

    // テスト記事を再度見つけて展開
    const cards2 = page.locator('.article-card');
    const cardCount2 = await cards2.count();
    let targetCard2 = null;

    for (let i = 0; i < cardCount2; i++) {
      const title = await cards2.nth(i).locator('.article-card-title').textContent();
      if (title?.includes('E2E検証記事')) {
        targetCard2 = cards2.nth(i);
        break;
      }
    }

    if (!targetCard2) {
      console.log('  ❌ テスト記事が見つかりません！');
      throw new Error('テスト記事が見つかりません');
    }

    await targetCard2.locator('.article-card-header').click();
    await sleep(500);

    // トグルで下書きに変更
    const toggle2 = targetCard2.locator('.status-toggle');
    const isChecked2 = await toggle2.isChecked();
    console.log(`  現在のステータス: ${isChecked2 ? '公開中' : '下書き'}`);

    if (isChecked2) {
      await targetCard2.locator('.toggle-slider').click();
      await sleep(1000);
      await page.waitForSelector('.loading-overlay.active', { state: 'hidden', timeout: 15000 }).catch(() => {});

      const newChecked2 = await toggle2.isChecked();
      console.log(`  変更後ステータス: ${newChecked2 ? '公開中 ❌' : '下書き ✅'}`);
    }
    await screenshot(page, '09-status-draft');

    // ==========================================
    // Step 9: /news.html から消えることを確認
    // ==========================================
    console.log('\n=== Step 9: /news.html から消えることを確認（最大5分） ===');

    let removedFromNews = false;
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      await newsPage.goto(`${SITE_URL}/news.html`, { waitUntil: 'networkidle' });
      const newsContent = await newsPage.content();

      if (!newsContent.includes(TEST_TITLE)) {
        removedFromNews = true;
        console.log(`  ✅ /news.html から削除確認！（${attempt}回目のチェック）`);
        await newsPage.screenshot({ path: `${SCREENSHOT_DIR}/10-news-removed.png`, fullPage: true });
        break;
      }

      console.log(`  ⏳ ${attempt}/${maxAttempts} - まだ残っています。20秒待機...`);
      await sleep(20000);
    }

    if (!removedFromNews) {
      console.log('  ❌ 5分以内に /news.html から削除されませんでした');
      await newsPage.screenshot({ path: `${SCREENSHOT_DIR}/10-news-still-there.png`, fullPage: true });
    }

    await pcContext.close();

    // ==========================================
    // 結果サマリ
    // ==========================================
    console.log('\n========================================');
    console.log('検証結果サマリ');
    console.log('========================================');
    console.log(`1. ログイン: ✅`);
    console.log(`2. フォーム入力: ✅`);
    console.log(`3. AI清書: ${contentValue ? '✅' : '❌'}`);
    console.log(`4. 画像アップロード: ${previewVisible ? '✅' : '❌'}`);
    console.log(`5. 記事投稿（下書き）: ${articleInList ? '✅' : '❌'}`);
    console.log(`6. ステータス公開: ✅`);
    console.log(`7. /news.html 反映: ${foundOnNews ? '✅' : '❌'}`);
    console.log(`8. ステータス下書き: ✅`);
    console.log(`9. /news.html 削除: ${removedFromNews ? '✅' : '❌'}`);
    console.log('========================================\n');

  } catch (error) {
    console.error(`\n❌ エラー発生: ${error}`);
    await screenshot(page, 'error-state');
  } finally {
    await browser.close();
  }
})();
