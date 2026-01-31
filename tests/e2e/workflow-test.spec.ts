import { test, expect } from '@playwright/test';

const ADMIN_URL = 'https://asahigaoka-nerima.tokyo/admin';
const EMAIL = 'shinichi.noguchi@gmail.com';
const PASSWORD = 'Niww2t3p!';
const TEST_IMAGE = '/tmp/claude-1000/-home-s-noguchi-asahigaoka/debe6b6d-1d92-4a29-bbe5-01ae75361f67/scratchpad/test-image.png';

const TEST_TITLE = `E2E検証_${Date.now()}`;
const TODAY = new Date().toISOString().split('T')[0];

test.describe.serial('スマホ版フルワークフロー検証', () => {
  test.setTimeout(180000); // 3分

  test('記事作成→AI清書→画像→投稿→ステータス変更', async ({ browser }) => {
    const context = await browser.newContext({
      viewport: { width: 375, height: 812 },
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15'
    });
    const page = await context.newPage();

    // コンソールログを収集
    const consoleLogs: string[] = [];
    page.on('console', msg => {
      consoleLogs.push(`[${msg.type()}] ${msg.text()}`);
    });

    // ==========================================
    // Step 1: ログイン
    // ==========================================
    console.log('\n=== Step 1: ログイン ===');
    await page.goto(`${ADMIN_URL}/login.html`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/mobile\.html/, { timeout: 15000 });
    console.log('  ✅ ログイン成功');

    // ==========================================
    // Step 2: 新規作成タブ → フォーム入力
    // ==========================================
    console.log('\n=== Step 2: フォーム入力 ===');
    await page.click('.tab-btn[data-tab="create"]');
    await page.waitForTimeout(500);

    await page.fill('#new-date-from', TODAY);
    await page.fill('#new-title', TEST_TITLE);
    await page.fill('#new-summary', '練馬区旭丘一丁目町会のE2Eテスト記事です。町会では地域の絆を深めるため、様々な活動を行っています。春のお花見会、夏の盆踊り、秋の防災訓練、冬の餅つき大会など四季折々のイベントを通じて、世代を超えた交流を促進しています。');
    console.log(`  ✅ フォーム入力完了（件名: ${TEST_TITLE}）`);

    // ==========================================
    // Step 3: AIに清書依頼
    // ==========================================
    console.log('\n=== Step 3: AIに清書依頼 ===');
    await page.click('#btn-ai-generate');

    // ローディング表示を待つ
    try {
      await page.waitForSelector('.loading-overlay.active', { timeout: 5000 });
      console.log('  ⏳ AI生成中...');
    } catch {
      console.log('  ⚠️ ローディング表示なし');
    }

    // ローディング完了待ち（AI生成は最大2分）
    await page.waitForSelector('.loading-overlay.active', { state: 'hidden', timeout: 120000 });

    const contentValue = await page.locator('#new-content').inputValue();
    const excerptValue = await page.locator('#new-excerpt').inputValue();
    console.log(`  本文(${contentValue.length}文字): ${contentValue.substring(0, 60)}...`);
    console.log(`  SNSサマリ(${excerptValue.length}文字): ${excerptValue.substring(0, 60)}...`);
    expect(contentValue.length).toBeGreaterThan(0);
    console.log('  ✅ AI生成完了');

    // ==========================================
    // Step 4: 画像アップロード
    // ==========================================
    console.log('\n=== Step 4: 画像アップロード ===');
    const fileInput = page.locator('#new-image');
    await fileInput.setInputFiles(TEST_IMAGE);
    // アップロード完了待ち
    await page.waitForSelector('#image-preview.has-image', { timeout: 15000 });
    console.log('  ✅ 画像アップロード＆プレビュー表示');

    // ==========================================
    // Step 5: 記事投稿（下書き保存）
    // ==========================================
    console.log('\n=== Step 5: 記事投稿（下書き保存） ===');
    await page.click('.btn-save');
    await page.waitForSelector('.loading-overlay.active', { state: 'hidden', timeout: 15000 });
    await expect(page.getByText('記事を下書き保存しました')).toBeVisible({ timeout: 5000 });
    console.log('  ✅ 下書き保存成功');

    // 記事一覧に反映されたか
    await page.waitForSelector('.article-card', { timeout: 10000 });
    const listText = await page.locator('#article-list').textContent();
    expect(listText).toContain(TEST_TITLE);
    console.log('  ✅ 記事一覧に反映');

    // ==========================================
    // Step 6: ステータスを公開に変更
    // ==========================================
    console.log('\n=== Step 6: ステータスを公開中に変更 ===');

    // テスト記事のカードを見つけて展開
    const cards = page.locator('.article-card');
    const cardCount = await cards.count();
    let targetIdx = -1;
    for (let i = 0; i < cardCount; i++) {
      const title = await cards.nth(i).locator('.article-card-title').textContent();
      if (title?.includes('E2E検証')) {
        targetIdx = i;
        break;
      }
    }
    expect(targetIdx).toBeGreaterThanOrEqual(0);
    const targetCard = cards.nth(targetIdx);

    // カード展開
    await targetCard.locator('.article-card-header').click();
    await page.waitForTimeout(500);
    await expect(targetCard).toHaveClass(/expanded/);

    // 現在のステータス確認
    const toggle = targetCard.locator('.status-toggle');
    const wasDraft = !(await toggle.isChecked());
    console.log(`  現在のステータス: ${wasDraft ? '下書き' : '公開中'}`);

    // 公開に変更
    if (wasDraft) {
      await targetCard.locator('.toggle-slider').click();
      await page.waitForTimeout(500);
    }

    // コンソールログクリア（SNS投稿結果を見やすくする）
    const beforeSaveLogCount = consoleLogs.length;

    // 保存ボタンクリック
    await targetCard.locator('.btn-save-edit').click();
    console.log('  保存ボタンクリック');

    // ローディング完了待ち
    await page.waitForSelector('.loading-overlay.active', { state: 'hidden', timeout: 30000 });

    // 少し待ってSNS投稿の完了を待つ
    await page.waitForTimeout(5000);

    // コンソールログを確認
    const newLogs = consoleLogs.slice(beforeSaveLogCount);
    console.log('\n  --- ブラウザコンソールログ ---');
    for (const log of newLogs) {
      console.log(`  ${log}`);
    }
    console.log('  --- ここまで ---\n');

    // 成功アラートが出たか
    const alertVisible = await page.locator('.mobile-alert.success').isVisible().catch(() => false);
    console.log(`  保存成功メッセージ: ${alertVisible ? '✅' : '❌'}`);

    // X投稿関連のログを確認
    const xLogs = newLogs.filter(l => l.includes('X') || l.includes('x_published') || l.includes('x-post') || l.includes('投稿'));
    if (xLogs.length > 0) {
      console.log('  X投稿関連ログ:');
      xLogs.forEach(l => console.log(`    ${l}`));
    } else {
      console.log('  ⚠️ X投稿関連のコンソールログなし');
    }

    // ==========================================
    // Step 7: ステータスを下書きに変更
    // ==========================================
    console.log('\n=== Step 7: ステータスを下書きに戻す ===');

    // ページをリロードして最新状態取得
    await page.goto(`${ADMIN_URL}/mobile.html`);
    await page.waitForSelector('.article-card', { timeout: 10000 });

    // テスト記事を再度探す
    const cards2 = page.locator('.article-card');
    const cardCount2 = await cards2.count();
    let targetIdx2 = -1;
    for (let i = 0; i < cardCount2; i++) {
      const title = await cards2.nth(i).locator('.article-card-title').textContent();
      if (title?.includes('E2E検証')) {
        targetIdx2 = i;
        break;
      }
    }
    expect(targetIdx2).toBeGreaterThanOrEqual(0);
    const targetCard2 = cards2.nth(targetIdx2);

    // カード展開
    await targetCard2.locator('.article-card-header').click();
    await page.waitForTimeout(500);

    // 公開中→下書きに変更
    const toggle2 = targetCard2.locator('.status-toggle');
    const isPublished = await toggle2.isChecked();
    console.log(`  現在のステータス: ${isPublished ? '公開中' : '下書き'}`);

    if (isPublished) {
      await targetCard2.locator('.toggle-slider').click();
      await page.waitForTimeout(500);
    }

    // 保存
    await targetCard2.locator('.btn-save-edit').click();
    await page.waitForSelector('.loading-overlay.active', { state: 'hidden', timeout: 15000 });
    await expect(page.locator('.mobile-alert.success')).toBeVisible({ timeout: 5000 });
    console.log('  ✅ 下書きに変更して保存完了');

    // ==========================================
    // 結果サマリ
    // ==========================================
    console.log('\n========================================');
    console.log('全ステップ完了');
    console.log('========================================\n');

    await context.close();
  });
});
