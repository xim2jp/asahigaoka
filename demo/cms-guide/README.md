# CMS操作案内動画（高齢管理者向け・モバイル）

スマホの管理画面で **ログイン → 日付・件名・要約を入力 → AIに記事を書かせる → 写真を選ぶ → 下書き保存 → 公開** までを、無音・大きなテロップ付きで案内する縦型（9:16）動画。

`.claude/skills/promo-video-toolkit`（スキル）と `.claude/agents/promo-video-producer.md`（エージェント）の手法を適用。**「Remotion等の重い描画は使わず、本物のUIを Playwright で再現録画し、外側にテロップ・イントロ/アウトロをコードで被せる」**ハイブリッド構成。本番DB・本番AIには一切接続せず、モックで完結するため**コスト0・再現可能・量産可能**。

## 成果物

| ファイル | 内容 |
|---------|------|
| `output/cms-guide-mobile.mp4` | 完成動画（824×1828 / 約58秒 / H.264 yuv420p +faststart / 無音） |
| `output/poster.jpg` | 埋め込み用ポスター画像（公開保存の見せ場フレーム） |

無音・自動再生を前提に、全カットに大きな日本語テロップ＋手順番号＋タップ箇所のオレンジ枠ハイライトを焼き込み済み。

## 構成（絵コンテ・手法割り当て）

| # | 画面 | テロップ（手順） | 手法 |
|---|------|----------------|------|
| 0 | イントロカード | スマホでかんたんお知らせ投稿／全5ステップ | DOMオーバーレイ |
| ① | ログイン画面 | メール・パスワードを入力 →「ログイン」 | 実UI録画 |
| ② | 記事一覧 | 「新規作成」を押す | 実UI録画＋ハイライト |
| ③ | 新規作成 | 日付（開始日）を入れる | 実UI録画＋ハイライト |
| ④ | 新規作成 | 件名（タイトル）を入れる | 実UI録画＋ハイライト |
| ⑤ | 新規作成 | かんたんなメモ（要約）を書く | 実UI録画＋ハイライト |
| ⑥ | 新規作成 | 「AIに依頼」→ 本文・SNS文が自動入力 | 実UI録画＋AIレスポンスをモック |
| ⑦ | 新規作成 | 写真（アイキャッチ）を選ぶ | 実UI録画＋ダミー画像 |
| ⑧ | 新規作成 | 「投稿（下書き保存）」を押す | 実UI録画＋ハイライト |
| ⑨ | 記事一覧 | 保存した記事を押して開く | 実UI録画＋ハイライト |
| ⑩ | 記事カード | スイッチを「公開中」にする | 実UI録画＋ハイライト |
| ⑪ | 記事カード | 「保存」を押して公開完了 | 実UI録画＋ハイライト |
| – | アウトロカード | これで公開完了です／サポート窓口案内 | DOMオーバーレイ |

> 注：タスクの指定どおり「件名はユーザーが入力 → AIが本文を書く」の流れにするため、**画像添付の前にテキストAI生成**を実行している（画像を先に添付すると画像解析AIが件名ごと自動生成する仕様のため）。

## 再生成方法（UI変更時はこれを再実行するだけ）

```bash
cd ~/asahigaoka
npm install                              # 初回のみ
npx playwright install chromium          # 初回のみ
# 録画（webm を test-results 配下に出力）
npx playwright test --config=demo/cms-guide/playwright.record.config.ts
# 仕上げ（2倍アップスケール・フェード・mp4化）
SRC="test-results/record-guide-CMS操作案内動画の録画/video.webm"
ffmpeg -y -i "$SRC" \
  -vf "scale=824:1828:flags=lanczos,fps=30,fade=t=in:st=0:d=0.4,format=yuv420p" \
  -an -c:v libx264 -crf 21 -preset slow -movflags +faststart \
  demo/cms-guide/output/cms-guide-mobile.mp4
```

## 構成ファイル

| ファイル | 役割 |
|---------|------|
| `record-guide.spec.ts` | 録画本体（操作手順＋テロップ／ハイライト／イントロ・アウトロ） |
| `playwright.record.config.ts` | 録画専用設定（スマホ縦・video:on・ローカル配信） |
| `mock-supabase-client.js` | 本番DB/認証を置き換えるモック（シード記事入り） |
| `mock-config.js` | 外部APIエンドポイントをダミー化 |
| `sample-festival.jpg` | アイキャッチ用ダミー画像（実写・実在人物なし） |

本番のHTML・CSS・`mobile-admin.js` はそのまま読み込み、**バックエンドだけ** `page.route()` でモックに差し替えている。よって動画に映るUIは本物。

## 制作中に発見・修正した本番バグ

`admin/js/mobile-admin.js` の `handleImageUpload()` が `#image-preview` の `innerHTML` を丸ごと置換しており、`#image-preview-img` 要素を破壊していた。その結果、画像を添付して保存すると `resetForm() → removeImage()` が `null.src` で例外を投げ、**`switchTab('list')` と一覧再読込に到達せず「保存しても画面が変わらない（公開に進めない）」**状態だった。まさに本動画が案内する「画像をセットして保存」の導線が壊れていたため、既存要素を更新する形に修正済み（削除ボタンのリスナーも保持される）。
