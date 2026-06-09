import { test, Page } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

/**
 * 操作案内動画 録画スクリプト（高齢管理者向け）
 * フロー：モバイルでログイン → 開始日・件名・要約を入力 → AIに記事を書かせる
 *        → アイキャッチ画像を設定 → 下書き保存 → 公開トグルON → 保存（公開）
 *
 * 本番DB/AIには接続せず、モッククライアント＋page.route() で完結する。
 * 大きな日本語テロップ・手順番号・タップ箇所のハイライトを被せ、無音でも分かる構成。
 */

const DIR = __dirname;
const MOCK_CLIENT = fs.readFileSync(path.join(DIR, 'mock-supabase-client.js'), 'utf-8');
const MOCK_CONFIG = fs.readFileSync(path.join(DIR, 'mock-config.js'), 'utf-8');
const SAMPLE_IMAGE = path.join(DIR, 'sample-festival.jpg');

// 高齢ユーザー向けにゆっくり見せるための待ち時間（ミリ秒）
const READ = 2600;   // テロップを読む時間
const BEAT = 900;    // 操作の合間の一拍

async function setupMocks(page: Page) {
  // バックエンドクライアントと設定をモックに差し替え（本物のUIはそのまま）
  await page.route('**/js/supabase-client.js', route =>
    route.fulfill({ contentType: 'application/javascript', body: MOCK_CLIENT })
  );
  await page.route('**/js/config.js', route =>
    route.fulfill({ contentType: 'application/javascript', body: MOCK_CONFIG })
  );
  // Supabase SDK(CDN) は不要なので空に
  await page.route('**/cdn.jsdelivr.net/**', route =>
    route.fulfill({ contentType: 'application/javascript', body: '/* stubbed */' })
  );
  // その他の外部APIは成功扱い（公開時のページ生成・SNS投稿など）※先に登録（後勝ちのため汎用を先に）
  await page.route('https://demo.invalid/**', route =>
    route.fulfill({ contentType: 'application/json', body: JSON.stringify({ status: 'success' }) })
  );
  // テキストAI生成：町会記事の文面を返す（汎用ルートより後に登録して優先させる）
  await page.route('**/generate-article', route =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          text350:
            '旭丘一丁目町会では、今年も夏祭りを開催します。会場は旭丘公園、模擬店や盆踊り、子ども向けゲームコーナーをご用意します。ご家族そろってお気軽にお越しください。当日は地域の皆さまとの交流の場として、どなたでもご参加いただけます。雨天の場合は翌日に順延します。',
          text80: '【夏祭り開催】旭丘公園で模擬店・盆踊り・ゲームコーナー。ご家族でぜひお越しください！ #旭丘一丁目'
        }
      })
    })
  );
}

// ---- テロップ／ハイライト用オーバーレイ ----
async function installOverlay(page: Page) {
  await page.evaluate(() => {
    const style = document.createElement('style');
    style.textContent = `
      #demo-caption {
        position: fixed; left: 0; right: 0; bottom: 0; z-index: 999999;
        background: linear-gradient(transparent, rgba(20,40,22,0.92) 28%);
        color: #fff; padding: 64px 28px 34px; text-align: center;
        font-family: -apple-system, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif;
        pointer-events: none; transition: opacity .35s; opacity: 0;
      }
      #demo-caption .step {
        display: inline-block; background: #FF9800; color: #fff;
        font-weight: 800; font-size: 26px; border-radius: 999px;
        padding: 6px 22px; margin-bottom: 16px; box-shadow: 0 3px 10px rgba(0,0,0,.3);
      }
      #demo-caption .text { font-size: 38px; font-weight: 800; line-height: 1.45;
        text-shadow: 0 2px 8px rgba(0,0,0,.6); }
      #demo-caption .sub { font-size: 25px; font-weight: 600; margin-top: 12px; color:#ffe7b3; }
      #demo-highlight {
        position: fixed; z-index: 999998; border: 5px solid #FF9800; border-radius: 14px;
        box-shadow: 0 0 0 9999px rgba(0,0,0,0.04), 0 0 22px 6px rgba(255,152,0,.85);
        pointer-events: none; transition: all .4s ease; opacity: 0;
      }
      @keyframes demoPulse { 0%,100%{ box-shadow:0 0 0 9999px rgba(0,0,0,.04),0 0 18px 4px rgba(255,152,0,.7);} 50%{ box-shadow:0 0 0 9999px rgba(0,0,0,.04),0 0 30px 12px rgba(255,152,0,1);} }
      #demo-highlight.on { opacity: 1; animation: demoPulse 1.1s infinite; }
      #demo-card {
        position: fixed; inset: 0; z-index: 1000000; display: flex; flex-direction: column;
        align-items: center; justify-content: center; text-align: center;
        background: linear-gradient(135deg, #2c5530 0%, #4CAF50 100%); color: #fff;
        font-family: -apple-system, "Hiragino Kaku Gothic ProN", "Noto Sans JP", sans-serif;
        padding: 40px; transition: opacity .5s; opacity: 0; pointer-events: none;
      }
      #demo-card .badge {
        width: 132px; height: 132px; border-radius: 50%; margin: 0 auto 22px;
        background: rgba(255,255,255,0.16); border: 5px solid rgba(255,255,255,0.9);
        display: flex; align-items: center; justify-content: center;
        font-size: 64px; font-weight: 900; color: #fff;
      }
      #demo-card .big { font-size: 52px; font-weight: 900; line-height: 1.4; }
      #demo-card .small { font-size: 30px; font-weight: 600; margin-top: 22px; color:#eaffea; }
      #demo-card .steps { font-size: 28px; font-weight: 700; margin-top: 28px; line-height: 1.9; text-align:left; }
    `;
    document.head.appendChild(style);

    const cap = document.createElement('div');
    cap.id = 'demo-caption';
    cap.innerHTML = '<div class="step"></div><div class="text"></div><div class="sub"></div>';
    document.body.appendChild(cap);

    const hi = document.createElement('div');
    hi.id = 'demo-highlight';
    document.body.appendChild(hi);
  });
}

async function caption(page: Page, step: string, text: string, sub = '') {
  await page.evaluate(({ step, text, sub }) => {
    const cap = document.getElementById('demo-caption')!;
    (cap.querySelector('.step') as HTMLElement).textContent = step;
    (cap.querySelector('.text') as HTMLElement).textContent = text;
    const subEl = cap.querySelector('.sub') as HTMLElement;
    subEl.textContent = sub;
    subEl.style.display = sub ? 'block' : 'none';
    cap.style.opacity = '1';
  }, { step, text, sub });
}

async function highlight(page: Page, selector: string | null) {
  await page.evaluate((selector) => {
    const hi = document.getElementById('demo-highlight')!;
    if (!selector) { hi.classList.remove('on'); return; }
    const el = document.querySelector(selector);
    if (!el) { hi.classList.remove('on'); return; }
    const r = el.getBoundingClientRect();
    const pad = 8;
    hi.style.left = (r.left - pad) + 'px';
    hi.style.top = (r.top - pad) + 'px';
    hi.style.width = (r.width + pad * 2) + 'px';
    hi.style.height = (r.height + pad * 2) + 'px';
    hi.classList.add('on');
  }, selector);
}

async function showCard(page: Page, html: string) {
  await page.evaluate((html) => {
    let card = document.getElementById('demo-card');
    if (!card) { card = document.createElement('div'); card.id = 'demo-card'; document.body.appendChild(card); }
    card.innerHTML = html;
    card.style.display = 'flex';
    // 次フレームでフェードイン
    requestAnimationFrame(() => { card!.style.opacity = '1'; });
  }, html);
}

async function hideCard(page: Page) {
  await page.evaluate(() => {
    const card = document.getElementById('demo-card');
    if (card) { card.style.opacity = '0'; card.style.display = 'none'; }
  });
}

test('CMS操作案内動画の録画', async ({ page }) => {
  test.setTimeout(120000);
  page.on('console', m => console.log('[browser]', m.type(), m.text()));
  page.on('pageerror', e => console.log('[pageerror]', e.message));
  page.on('dialog', async d => { console.log('[dialog]', d.message()); await d.accept(); });
  await setupMocks(page);

  // ===== イントロカード =====
  await page.goto('/admin/login.html');
  await installOverlay(page);
  await showCard(page,
    `<div class="badge" style="font-size:54px;padding-left:8px;">▶</div>
     <div class="big">スマホでかんたん<br>お知らせ投稿</div>
     <div class="small">旭丘一丁目町会 管理画面の使い方</div>
     <div class="steps">① ログイン<br>② 日付・件名を入力<br>③ AIに記事を書いてもらう<br>④ 写真を選ぶ<br>⑤ 公開する</div>`);
  await page.waitForTimeout(4200);
  await hideCard(page);
  await page.waitForTimeout(700);

  // ===== ① ログイン =====
  await caption(page, '手順 ①', 'メールアドレスとパスワードを入力', 'いつものIDとパスワードでOK');
  await highlight(page, '#email');
  await page.waitForTimeout(BEAT);
  await page.fill('#email', 'kanri@asahigaoka.example');
  await page.waitForTimeout(700);
  await highlight(page, '#password');
  await page.fill('#password', '••••••••');
  await page.waitForTimeout(READ);

  await caption(page, '手順 ①', '「ログイン」を押す', '');
  await highlight(page, 'button[type="submit"]');
  await page.waitForTimeout(BEAT);
  await page.click('button[type="submit"]');
  await page.waitForURL(/mobile\.html/, { timeout: 15000 });
  // mobile.html へ遷移したのでオーバーレイを再設置
  await page.waitForSelector('.tab-nav', { timeout: 10000 });
  await installOverlay(page);
  await page.waitForTimeout(BEAT);

  await caption(page, '手順 ①', 'ログインできました', '記事の一覧が表示されます');
  await page.waitForSelector('.article-card', { timeout: 10000 });
  await page.waitForTimeout(READ);

  // ===== ② 新規作成タブ =====
  await caption(page, '手順 ②', '「新規作成」を押す', '新しいお知らせを書く画面へ');
  await highlight(page, '.tab-btn[data-tab="create"]');
  await page.waitForTimeout(BEAT);
  await page.click('.tab-btn[data-tab="create"]');
  await page.waitForSelector('#new-date-from', { state: 'visible' });
  await page.waitForTimeout(READ);

  // ===== ③ 開始日 =====
  await caption(page, '手順 ③', '日付を入れる', '行事やお知らせの「開始日」');
  await highlight(page, '#new-date-from');
  await page.waitForTimeout(BEAT);
  await page.fill('#new-date-from', '2026-08-01');
  await page.waitForTimeout(READ);

  // ===== ④ 件名 =====
  await caption(page, '手順 ④', '件名（タイトル）を入れる', '');
  await highlight(page, '#new-title');
  await page.waitForTimeout(BEAT);
  await page.fill('#new-title', '夏祭り開催のお知らせ');
  await page.waitForTimeout(READ);

  // ===== ⑤ 要約（AIへの下書き） =====
  await caption(page, '手順 ⑤', 'かんたんなメモを書く', 'AIへの下書き。一言でOK');
  await highlight(page, '#new-summary');
  await page.waitForTimeout(BEAT);
  await page.fill('#new-summary', '8月1日に旭丘公園で夏祭り。模擬店と盆踊りあり。');
  await page.waitForTimeout(READ);

  // ===== ⑥ AIに依頼 =====
  await caption(page, '手順 ⑥', '「AIに依頼」を押す', 'メモから記事を書いてくれます');
  await highlight(page, '#btn-ai-generate');
  await page.waitForTimeout(BEAT);
  await page.click('#btn-ai-generate');
  // ローディング→生成完了
  await page.waitForFunction(() => {
    const el = document.getElementById('new-content') as HTMLTextAreaElement;
    return el && el.value.trim().length > 0;
  }, { timeout: 15000 });
  await highlight(page, '#new-content');
  await caption(page, '手順 ⑥', 'AIが記事を書きました！', '本文とSNS文が自動で入ります');
  await page.evaluate(() => document.getElementById('new-content')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(READ + 1200);

  // ===== ⑦ アイキャッチ画像 =====
  await caption(page, '手順 ⑦', '写真を選ぶ', '記事に載せるアイキャッチ画像');
  await page.evaluate(() => document.getElementById('image-upload-area')?.scrollIntoView({ block: 'center' }));
  await highlight(page, '#image-upload-area');
  await page.waitForTimeout(BEAT);
  await page.setInputFiles('#new-image', SAMPLE_IMAGE);
  await page.waitForSelector('#image-preview.has-image', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(READ);

  // ===== ⑧ 下書き保存 =====
  await caption(page, '手順 ⑧', '「投稿（下書き保存）」を押す', 'まず下書きとして保存');
  await page.evaluate(() => document.querySelector('.btn-save')?.scrollIntoView({ block: 'center' }));
  await highlight(page, '.btn-save');
  await page.waitForTimeout(BEAT);
  await page.click('.btn-save');
  await page.waitForSelector('.article-card', { timeout: 10000 });
  await page.waitForTimeout(READ);

  // ===== ⑨ 記事を開く =====
  await caption(page, '手順 ⑨', '保存した記事を押して開く', '一番上に追加されています');
  const firstCard = page.locator('.article-card').first();
  await firstCard.scrollIntoViewIfNeeded();
  await highlight(page, '.article-card:first-child .article-card-header');
  await page.waitForTimeout(BEAT);
  await firstCard.locator('.article-card-header').click();
  await page.waitForTimeout(BEAT);
  await page.evaluate(() => document.querySelector('.article-card.expanded .toggle-switch')?.scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(READ);

  // ===== ⑩ 公開トグル =====
  await caption(page, '手順 ⑩', 'スイッチを「公開中」にする', 'タップで下書き→公開に切替');
  await highlight(page, '.article-card.expanded .toggle-switch');
  await page.waitForTimeout(BEAT);
  await page.locator('.article-card.expanded .toggle-slider').click();
  await page.waitForTimeout(READ);

  // ===== ⑪ 保存（公開） =====
  await caption(page, '手順 ⑪', '「保存」を押して公開完了！', 'これでホームページに載ります');
  await page.evaluate(() => document.querySelector('.article-card.expanded .btn-save-edit')?.scrollIntoView({ block: 'center' }));
  await highlight(page, '.article-card.expanded .btn-save-edit');
  await page.waitForTimeout(BEAT);
  await page.locator('.article-card.expanded .btn-save-edit').click();
  await page.waitForSelector('.mobile-alert.success', { timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(READ);
  await highlight(page, null);

  // ===== アウトロカード =====
  await showCard(page,
    `<div class="badge">✓</div>
     <div class="big">これで公開完了です</div>
     <div class="small">むずかしい操作はありません<br>スマホひとつでお知らせを発信できます</div>
     <div class="steps">こまったら町会のサポート窓口へ<br>お気軽にお問い合わせください</div>`);
  await page.waitForTimeout(4500);
});
