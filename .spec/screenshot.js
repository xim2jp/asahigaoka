const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');

async function takeScreenshots() {
    const browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const context = await browser.newContext({
        viewport: { width: 1400, height: 900 },
        deviceScaleFactor: 1
    });
    const page = await context.newPage();

    // デバッグ用
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    const screenshotDir = path.join(__dirname, 'screenshots');
    if (!fs.existsSync(screenshotDir)) {
        fs.mkdirSync(screenshotDir);
    }

    const baseUrl = 'https://asahigaoka-nerima.tokyo';

    // 1. ログイン画面
    console.log('1. ログイン画面を撮影中...');
    await page.goto(`${baseUrl}/admin/login.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({
        path: path.join(screenshotDir, '01_login.png'),
        fullPage: true
    });
    console.log('   完了: 01_login.png');

    // 2. ログイン実行
    console.log('2. ログイン中...');
    await page.fill('#email', 'block1@asahigaoka-nerima.tokyo');
    await page.fill('#password', 'Soyuk@i09');
    await page.click('button[type="submit"]');

    // ログイン完了まで待機
    await page.waitForURL('**/admin/index.html', { timeout: 30000 });
    await page.waitForTimeout(2000);
    console.log('   ログイン成功');

    // 3. 記事一覧画面
    console.log('3. 記事一覧画面を撮影中...');
    await page.goto(`${baseUrl}/admin/articles.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({
        path: path.join(screenshotDir, '02_articles.png'),
        fullPage: true
    });
    console.log('   完了: 02_articles.png');

    // 4. 記事編集画面（基本情報タブ）
    console.log('4. 記事編集画面（基本情報）を撮影中...');
    await page.goto(`${baseUrl}/admin/article-edit.html`, { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    await page.screenshot({
        path: path.join(screenshotDir, '03_article_edit_basic.png'),
        fullPage: true
    });
    console.log('   完了: 03_article_edit_basic.png');

    // 5. 記事編集画面（SEO/SNSタブ）
    console.log('5. 記事編集画面（SEO/SNS設定）を撮影中...');
    // SEO/SNSタブをクリック
    const seoTab = await page.$('button[data-tab="seo-sns"]');
    if (seoTab) {
        await seoTab.click();
        await page.waitForTimeout(1000);
    }
    await page.screenshot({
        path: path.join(screenshotDir, '04_article_edit_seo_sns.png'),
        fullPage: true
    });
    console.log('   完了: 04_article_edit_seo_sns.png');

    await browser.close();
    console.log('\n全てのスクリーンショットを撮影完了しました！');
    console.log('保存先: ' + screenshotDir);
}

takeScreenshots().catch(err => {
    console.error('エラー:', err);
    process.exit(1);
});
