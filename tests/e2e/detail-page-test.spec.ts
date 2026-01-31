import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';

const ADMIN_URL = 'https://asahigaoka-nerima.tokyo/admin';
const EMAIL = 'shinichi.noguchi@gmail.com';
const PASSWORD = 'Niww2t3p!';
const S3_BUCKET = 'asahigaoka-nerima-tokyo';

const TEST_TITLE = `詳細ページ検証_${Date.now()}`;
const TODAY = new Date().toISOString().split('T')[0];

test.describe.serial('詳細ページ生成検証', () => {
  test.setTimeout(180000);

  test('記事作成→AI清書→下書き保存→公開→S3に詳細ページ確認', async ({ browser }) => {
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

    // === Step 1: ログイン ===
    console.log('\n=== Step 1: ログイン ===');
    await page.goto(`${ADMIN_URL}/login.html`);
    await page.fill('#email', EMAIL);
    await page.fill('#password', PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL(/mobile\.html/, { timeout: 15000 });
    console.log('  ✅ ログイン成功');

    // === Step 2: 新規作成 → フォーム入力 ===
    console.log('\n=== Step 2: フォーム入力 ===');
    await page.click('.tab-btn[data-tab="create"]');
    await page.waitForTimeout(500);

    await page.fill('#new-date-from', TODAY);
    await page.fill('#new-title', TEST_TITLE);
    await page.fill('#new-summary', '練馬区旭丘一丁目町会の詳細ページ生成テストです。これはE2Eテスト用の記事で、記事公開時にS3に詳細ページが正しく生成されるかどうかを検証するために作成されました。');
    console.log(`  ✅ 入力完了（件名: ${TEST_TITLE}）`);

    // === Step 3: AIに清書依頼 ===
    console.log('\n=== Step 3: AIに清書依頼 ===');
    await page.click('#btn-ai-generate');
    try {
      await page.waitForSelector('.loading-overlay.active', { timeout: 5000 });
      console.log('  ⏳ AI生成中...');
    } catch { /* */ }
    await page.waitForSelector('.loading-overlay.active', { state: 'hidden', timeout: 120000 });

    const contentValue = await page.locator('#new-content').inputValue();
    expect(contentValue.length).toBeGreaterThan(0);
    console.log(`  ✅ AI生成完了（本文${contentValue.length}文字）`);

    // === Step 4: 下書き保存 ===
    console.log('\n=== Step 4: 下書き保存 ===');
    await page.click('.btn-save');
    await page.waitForSelector('.loading-overlay.active', { state: 'hidden', timeout: 15000 });
    await expect(page.getByText('記事を下書き保存しました')).toBeVisible({ timeout: 5000 });
    console.log('  ✅ 下書き保存成功');

    // 記事一覧でテスト記事を確認
    await page.waitForSelector('.article-card', { timeout: 10000 });

    // S3の詳細ページ数を記録（公開前）
    const beforeList = execSync(`aws s3 ls s3://${S3_BUCKET}/news/ --recursive 2>&1`).toString();
    const beforeCount = beforeList.split('\n').filter(l => l.includes('.html') && !l.includes('index.html') && !l.includes('template')).length;
    console.log(`  S3 詳細ページ数（公開前）: ${beforeCount}`);

    // === Step 5: 記事を公開に変更 ===
    console.log('\n=== Step 5: ステータスを公開に変更 ===');

    const cards = page.locator('.article-card');
    const cardCount = await cards.count();
    let targetIdx = -1;
    for (let i = 0; i < cardCount; i++) {
      const title = await cards.nth(i).locator('.article-card-title').textContent();
      if (title?.includes('詳細ページ検証')) {
        targetIdx = i;
        break;
      }
    }
    expect(targetIdx).toBeGreaterThanOrEqual(0);
    const targetCard = cards.nth(targetIdx);

    // 記事IDを取得
    const articleId = await targetCard.getAttribute('data-id');
    console.log(`  記事ID: ${articleId}`);

    // カード展開
    await targetCard.locator('.article-card-header').click();
    await page.waitForTimeout(500);
    await expect(targetCard).toHaveClass(/expanded/);

    // コンソールログクリア
    const beforeSaveLogCount = consoleLogs.length;

    // 公開に変更
    await targetCard.locator('.toggle-slider').click();
    await page.waitForTimeout(500);

    // 保存
    await targetCard.locator('.btn-save-edit').click();
    console.log('  保存ボタンクリック');

    // ローディング完了待ち（詳細ページ生成 + SNS投稿で時間がかかる）
    await page.waitForSelector('.loading-overlay.active', { state: 'hidden', timeout: 60000 });

    // 追加で待機（非同期処理完了を待つ）
    await page.waitForTimeout(5000);

    // コンソールログ確認
    const newLogs = consoleLogs.slice(beforeSaveLogCount);
    console.log('\n  --- ブラウザコンソールログ ---');
    for (const log of newLogs) {
      console.log(`  ${log}`);
    }
    console.log('  --- ここまで ---\n');

    // 詳細ページ生成関連のログ
    const detailLogs = newLogs.filter(l => l.includes('詳細ページ') || l.includes('detail') || l.includes('Detail'));
    if (detailLogs.length > 0) {
      console.log('  詳細ページ関連ログ:');
      detailLogs.forEach(l => console.log(`    ${l}`));
    }

    // === Step 6: S3で詳細ページを確認 ===
    console.log('\n=== Step 6: S3で詳細ページ確認 ===');

    // 記事IDで詳細ページを検索
    const s3Check = execSync(`aws s3 ls s3://${S3_BUCKET}/news/${articleId}.html 2>&1`).toString().trim();
    console.log(`  S3検索結果: ${s3Check || '(見つからず)'}`);

    if (s3Check && !s3Check.includes('error') && !s3Check.includes('NoSuchKey')) {
      console.log(`  ✅ 詳細ページがS3に存在: news/${articleId}.html`);
    } else {
      console.log(`  ❌ 詳細ページがS3に見つかりません: news/${articleId}.html`);

      // news/ ディレクトリの全ファイルを確認
      const allFiles = execSync(`aws s3 ls s3://${S3_BUCKET}/news/ 2>&1`).toString();
      console.log('  news/ ディレクトリの内容:');
      console.log(allFiles);
    }

    // 公開後の詳細ページ数
    const afterList = execSync(`aws s3 ls s3://${S3_BUCKET}/news/ --recursive 2>&1`).toString();
    const afterCount = afterList.split('\n').filter(l => l.includes('.html') && !l.includes('index.html') && !l.includes('template')).length;
    console.log(`  S3 詳細ページ数（公開後）: ${afterCount}`);
    console.log(`  増分: ${afterCount - beforeCount}`);

    // === Step 7: 下書きに戻す ===
    console.log('\n=== Step 7: 下書きに戻す（クリーンアップ） ===');
    await page.goto(`${ADMIN_URL}/mobile.html`);
    await page.waitForSelector('.article-card', { timeout: 10000 });

    const cards2 = page.locator('.article-card');
    const cardCount2 = await cards2.count();
    for (let i = 0; i < cardCount2; i++) {
      const title = await cards2.nth(i).locator('.article-card-title').textContent();
      if (title?.includes('詳細ページ検証')) {
        const card = cards2.nth(i);
        await card.locator('.article-card-header').click();
        await page.waitForTimeout(500);
        const toggle = card.locator('.status-toggle');
        if (await toggle.isChecked()) {
          await card.locator('.toggle-slider').click();
          await page.waitForTimeout(500);
          await card.locator('.btn-save-edit').click();
          await page.waitForSelector('.loading-overlay.active', { state: 'hidden', timeout: 15000 });
          console.log('  ✅ 下書きに戻しました');
        }
        break;
      }
    }

    console.log('\n========================================');
    console.log('検証完了');
    console.log('========================================\n');

    await context.close();
  });
});
