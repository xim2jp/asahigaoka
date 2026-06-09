# 画面録画ベースのデモ動画

実際の SaaS 画面を録画して見せる手法。**「本物の操作」と「成果が出る瞬間」を信頼性高く伝える**プロダクトデモ・オンボーディング・ヘルプ動画の主力。コストはほぼ0。

## 手法の選択

| 方法 | 向く場面 | 特徴 |
|------|---------|------|
| **OBS Studio**（手動録画） | 人がデモ操作する説明動画 | 無料・高品質・マウス/ウィンドウ選択・配信も可 |
| **Playwright 録画**（自動操作） | UI変更で**作り直しが頻発**するデモ・量産 | スクリプトで再現可能・UI変更時に再実行で更新 |
| **OS標準**（macOS スクショ収録 / Win ゲームバー） | 単発・軽い収録 | 手軽 |
| **ブラウザ拡張/専用ツール** | クリック強調・自動ズーム | 有料が多い。まずは無料手段で |

> **野口さんの肝**：Playwright で録画を**コード化**しておくと、UI変更のたびに再実行するだけでデモ動画が更新でき、E2E 資産（`e2e-browser-testing` Skill）と共用できる。

## Playwright で操作を録画（再現可能・量産向き）

```ts
// playwright.config.ts（録画を有効化）
use: {
  video: 'on',                       // 失敗時のみなら 'retain-on-failure'
  viewport: { width: 1920, height: 1080 },
  // デモ用に動きをゆっくり見せたい場合は launchOptions: { slowMo: 300 }
}
```

```ts
// tests/demo/shift-demo.spec.ts
import { test } from '@playwright/test';

test('シフト自動生成デモ', async ({ page }) => {
  await page.goto('/dashboard');
  await page.getByRole('button', { name: 'AIでシフト作成' }).click();
  await page.getByLabel('対象期間').fill('2026-07');
  await page.getByRole('button', { name: '生成' }).click();
  await page.getByText('シフトを作成しました').waitFor();
  // 録画は webm で test-results 配下に出力される
});
```

- 出力 webm → `delivery-and-distribution.md` の ffmpeg で mp4 化・トリミング
- デモ用 seed データ（きれいな状態の店舗・スタッフ）を用意し、毎回同じ絵を再現
- カーソル軌跡を見せたい場合は実ブラウザの操作を素直に。クリック強調は後段の編集 or Remotion オーバーレイで

## OBS（手動・高品質）

- 解像度 1920×1080・60fps→編集で30fpsに、ビットレート高め
- **ウィンドウキャプチャ**で対象アプリだけ（通知・他タブを映さない）
- 録画前に：通知OFF・ブックマークバー非表示・ダミーデータ整備・ズーム125%目安で文字を大きく
- マウスをゆっくり、クリック前に一拍

## 録画後の仕上げ（陳腐化しない・見やすく）

Remotion や ffmpeg で被せる/編集する：
- **不要な待ち時間カット・1.2〜1.5倍速**（ロード待ちは退屈）
- **テロップ**で「今なにを・なぜ嬉しいか」（無音前提）
- **ズーム/ハイライト**で注目箇所を強調（クリック箇所に丸/矢印）
- **イントロ/アウトロ**（ロゴ・タイトル・CTA）は Remotion で付ける → ブランド整合
- 機微情報（実顧客名・メール・金額）はモザイク or ダミーに差し替え

## Remotion と組み合わせる（推奨ハイブリッド）

録画 webm/mp4 を Remotion に取り込み、テロップ・イントロ・CTAをコードで重ねる：

```tsx
import { OffthreadVideo, staticFile, Sequence } from 'remotion';
// 0–3s: Remotion のタイトル → 3s以降: 画面録画 → 末尾: CTA
<Sequence from={90}>
  <OffthreadVideo src={staticFile('recordings/shift-demo.mp4')} />
</Sequence>
```

→ 録画は中身（本物の操作）、Remotion は外側（ブランド・テロップ・CTA）。量産も効く。

## チェックリスト

- [ ] 録画前にダミーデータ整備・通知OFF・文字を大きく
- [ ] 機微情報が映っていない（顧客名/金額/メール）
- [ ] 不要な待ち時間をカット・適切に倍速
- [ ] テロップで無音でも操作意図が分かる
- [ ] 注目箇所をズーム/ハイライト
- [ ] イントロ/アウトロ・CTAを Remotion でブランド整合
- [ ] UI変更時に更新できる手段（Playwright 録画 or 手順書）がある

## 出典・一次ソース

- Playwright「Videos」: https://playwright.dev/docs/videos
- OBS Studio: https://obsproject.com
- Remotion OffthreadVideo: https://www.remotion.dev/docs/offthreadvideo
- ffmpeg ドキュメント: https://ffmpeg.org/documentation.html
