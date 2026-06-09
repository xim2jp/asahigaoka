# 納品・配信：エンコード・Web埋め込み・SNS仕様・計測

作った動画を**軽く・正しく・各媒体の仕様に合わせて**出す。LP埋め込みは Core Web Vitals を壊さないことが最優先。

## 1. エンコード（書き出し最適化）

ffmpeg で配信用に最適化（Remotion/録画の出力を仕上げ）：

```bash
# Web/SNS 汎用 H.264（互換性最優先）
ffmpeg -i in.mov -c:v libx264 -crf 23 -preset slow -pix_fmt yuv420p \
  -c:a aac -b:a 128k -movflags +faststart out.mp4

# 軽量化したい LP 埋め込み用（解像度/ビットレート抑制）
ffmpeg -i in.mp4 -vf "scale=1280:-2" -c:v libx264 -crf 26 -an out-lp.mp4

# 次世代コーデック（対応ブラウザ向けに併用）
ffmpeg -i in.mp4 -c:v libvpx-vp9 -crf 32 -b:v 0 out.webm
```

- `+faststart`：メタデータを先頭へ（ストリーミング再生が即始まる）— **必須**
- `yuv420p`：古い環境でも再生できる安全な色形式
- LP用は**無音**なら音声トラックを削る（`-an`）
- 解像度は用途に：LP横=1080p/720p、SNS縦=1080×1920

## 2. LP への埋め込み（CWV を壊さない）

`marketing-site-builder` と連携。**重い自動再生動画はLCP/CLSの天敵**：

```tsx
<video
  className="aspect-video w-full"
  autoPlay muted loop playsInline       // 自動再生はミュート＋playsInline 必須（iOS）
  preload="none"                         // 初期ロードを軽く
  poster="/video/hero-poster.webp"       // 即表示する軽い静止画（LCP対策）
  width={1280} height={720}              // CLS 防止に寸法明示
>
  <source src="/video/hero.webm" type="video/webm" />
  <source src="/video/hero.mp4" type="video/mp4" />
</video>
```

- **poster を必ず**：動画ロード前に軽い画像を見せ、LCP/体感を改善
- **`preload="none"` or `metadata`**：ファーストビューの帯域を食わせない
- 長尺/重い動画は自前配信より**動画ホスティング（後述）**でストリーミング
- ヒーローは数秒の短尺ループに留め、巨大ファイルを置かない（`core-web-vitals.md`）
- 動画ファイルは CDN（Vercel/ホスティング）から配信

## 3. 配信先別の仕様（投稿前に最新確認）

仕様は変わるため**投稿直前に各公式で確認**。代表的な目安：

| 配信先 | 比率 | 尺目安 | 備考 |
|--------|------|-------|------|
| LP 埋め込み | 16:9 | 6–15秒ループ | 自動再生ミュート・poster 必須 |
| YouTube（本編） | 16:9 | 制限緩い | 概要欄にCTA・字幕(.srt)・チャプター |
| YouTube Shorts | 9:16 | 〜3分（短いほど可） | |
| Instagram Reels / Feed | 9:16 / 1:1 / 4:5 | 〜90秒目安 | 安全マージン・キャプション |
| TikTok | 9:16 | 15–60秒が主 | フック最重視 |
| X(Twitter) | 16:9 / 1:1 | 短尺 | 自動再生ミュート |
| LinkedIn（B2B） | 16:9 / 1:1 | 〜90秒 | B2B SaaS と相性良 |

- **縦・横・正方は別書き出し**（後変換で崩さない。`video-strategy.md` で別構図設計）
- 各SNSは再エンコードされる→**高めの品質で入稿**（劣化前提）

## 4. 動画ホスティングの選択

| 方法 | 向く場面 | 注意 |
|------|---------|------|
| **自前（public/ + CDN）** | 短尺ヒーローループ | 帯域・CWV に注意、長尺不可 |
| **YouTube 埋め込み** | 長尺デモ・無料 | 関連動画/広告・ブランド外要素。`youtube-nocookie` で軽減 |
| **Vimeo / Mux 等** | 広告なし・プレイヤー制御・分析 | 有料。Tier B 案件向き |

> 野口Profile：短尺ヒーローは自前＋poster、長尺デモは YouTube（無料）。広告なし要件があれば費用負担確認のうえ Mux/Vimeo。

## 5. SEO/AI検索（seo-specialist と連携）

- 動画掲載ページに **`VideoObject` 構造化データ**（name/description/thumbnailUrl/uploadDate/duration/contentUrl）
- **トランスクリプト**を本文 or キャプションで提供（検索・AI検索が内容を理解）
- サムネ（poster）を魅力的に。YouTube はタイトル/概要/タグ最適化

## 6. 計測（効果検証）

- **視聴維持率/離脱ポイント**（YouTube アナリティクス等）→ どこで離脱するか＝改善点
- LP は GA4 で**動画視聴イベント**（再生/一定%到達）と CV 相関
- SNS は各プラットフォームのインサイト（視聴・保存・プロフ遷移）
- A/B：冒頭フック違い・尺違いを比較（SNS広告）

## チェックリスト

- [ ] `+faststart`・yuv420p・適切な CRF で書き出した
- [ ] LP は poster・preload制御・寸法明示で CWV を壊さない
- [ ] 縦/横/正方を別書き出し（後変換していない）
- [ ] 配信先の比率・尺・安全マージンを最新仕様で確認
- [ ] ホスティング選択（自前/YouTube/有料）が要件とコストに合う
- [ ] VideoObject 構造化データ・トランスクリプトを付与
- [ ] 視聴維持率・CV を計測する導線がある

## 出典・一次ソース

- web.dev「動画の最適化」: https://web.dev/articles/video
- MDN `<video>`: https://developer.mozilla.org/docs/Web/HTML/Element/video
- ffmpeg: https://ffmpeg.org/documentation.html
- Google「動画の構造化データ(VideoObject)」: https://developers.google.com/search/docs/appearance/structured-data/video
- ※ 各SNSの推奨比率・尺は変動。投稿直前に各プラットフォームのヘルプで再確認
