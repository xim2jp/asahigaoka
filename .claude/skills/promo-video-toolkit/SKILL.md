# Promo Video Toolkit Skill

SaaS のプロモーション動画（**LPヒーロー動画・プロダクトデモ動画・SNS縦型広告・explainer/説明動画**）を、**低コストで量産できるハイブリッド手法**で企画・生成・納品するための知識集。Remotion（コード生成）・画面録画・AI動画生成・AIナレーションを**用途別に使い分ける**。

> **このSkillのゴール**：野口さんが量産する月額 SaaS ごとに、①LPに埋め込む短い訴求動画、②実画面のデモ動画、③SNS広告用の縦型動画、④課題→解決の explainer を、**1名運用・追加コスト最小**で作れる手順を持つ。

## いつこのSkillを参照するか

- **営業サイト企画/構築（Phase 4 / `docs/15-marketing-site`）**：LPヒーロー動画・デモ動画の企画時（→ `video-strategy.md`）
- **動画実装**：Remotion でコード生成する時（→ `remotion.md`）／実画面を録画する時（→ `screen-recording.md`）／AIでB-roll・実写風映像を作る時（→ `ai-video-generation.md`）
- **音声**：ナレーション・BGM・字幕を付ける時（→ `audio-and-voiceover.md`）
- **納品・配信**：Web埋め込み・SNS各社の仕様・計測（→ `delivery-and-distribution.md`）

## 重要原則（必読）

### 1. ハイブリッド＝「正確さ」「コスト」「映え」の三択を用途で割り当てる

1つの手法に固執しない。動画の目的ごとに**最適な生成手段が違う**。

| 手法 | 強み | 弱み | 主な用途 | コスト |
|------|------|------|---------|--------|
| **Remotion**（React で動画をコード生成） | 画面/データ/字幕/ブランドを**正確に**・差分更新・量産・**ほぼ無料** | 実写風・有機的な映像は苦手 | LPヒーロー・explainer・SNS縦型のテンプレ量産 | ほぼ0（自前 or Lambda 従量） |
| **画面録画**（実UIを録画→編集） | **本物の操作**を見せられる・信頼性 | 撮り直し・UI変更で陳腐化 | プロダクトデモ・オンボーディング・ヘルプ | 0（OBS/Playwright） |
| **AI動画生成**（Veo/Sora/Runway/Kling 等） | 実写風・抽象映像・雰囲気の演出 | **秒課金で高コスト**・画面の正確再現不可・ブランド統制が弱い | ヒーローのB-roll・SNS広告の冒頭フック | 高（秒単位課金） |

> **野口さんの基本配分：Remotion ＋ 画面録画で骨格を作り（ほぼ無料）、AI動画生成は冒頭フックやB-rollに"差し色"として最小利用**。AI動画を主役にするのは、クライアントが費用負担する案件 or 高ROIが見込める場面に限定。

### 2. 野口さんスタックとの適合＝Remotion を第一候補に

野口さんの中心スタックは **Next.js / React / TypeScript**。**Remotion は React で動画を書く**ため、既存スキル・コンポーネント・ブランドトークン（`design-system.md`）をそのまま流用できる。データ連動（料金・実績数値）も型安全に差し込める。詳細は `remotion.md`。

### 3. 動画は「最初の3秒」と「無音前提」で設計する

LP埋め込みも SNS も**自動再生・ミュート**が前提。

- **冒頭3秒でフック**：何のSaaSで何が良くなるかを一目で
- **字幕（テロップ）必須**：音声オフでも意味が通る（音声は補助）
- **ループ前提**：LPヒーローは短尺の無音ループが効く

### 4. ブランドと整合させる（visual-director の決定が source of truth）

色・タイポ・トーン・ロゴの動かし方は、`docs/12-brand-design/design-system.md` と `docs/15-marketing-site/visual-style-guide.md` に従う。動画都合でブランドを崩さない。Remotion なら**デザイントークンをコードで共有**できるため整合が取りやすい。

### 5. 財務制約：まず無料、課金は要衡量

民事再生中・1名運用・一括払い前提。**ランニングで積み上がる秒課金（AI動画）と従量レンダリングに注意**。

> **基本方針：Remotion（OSS・無料）＋ 画面録画（OBS/Playwright・無料）＋ 字幕。AIナレーション（ElevenLabs 等）と AI動画生成は、尺・本数を見積もってから使う。** コスト試算は `ai-video-generation.md` / `audio-and-voiceover.md`。

## このSkillの構成

```
promo-video-toolkit/
├── SKILL.md                      # 本ファイル
└── references/
    ├── video-strategy.md         # 動画タイプ別の設計（尺/比率/構成テンプレ/CV/ストーリーボード）
    ├── remotion.md               # Remotion（React で動画コード生成）実装・Next.js統合・データ連動・レンダリング
    ├── screen-recording.md       # 画面録画ベースのデモ動画（Playwright/OBS・台本・テロップ）
    ├── ai-video-generation.md    # AI動画生成（Veo/Sora/Runway/Kling/Pika 等）選定・プロンプト・コスト
    ├── audio-and-voiceover.md    # AIナレーション・BGM/SE・字幕・ラウドネス・ライセンス
    └── delivery-and-distribution.md # エンコード/最適化・Web埋め込み・SNS仕様・配信・計測
```

## エージェント別の使い方ガイド

### marketing-site-builder

- LPヒーロー動画・デモ動画の**埋め込み**を担当（`<video>` の自動再生/ミュート/ループ、`poster`、遅延読み込み）
- 動画そのものの企画・生成は `promo-video-producer` に委譲
- 重い動画でLCPを悪化させない（`delivery-and-distribution.md`）

### visual-director

- 動画のビジュアル方針（色・モーション量・トーン）は visual-style-guide に従う
- **静止画＝visual-director / 動画＝promo-video-producer** と役割分担（重複しない）

### implementation-worker

- Remotion プロジェクトを `remotion/`（or `src/remotion/`）に構築し、CIでレンダリング
- アプリ内オンボーディング動画・ヘルプ動画の組み込み

### test-planner / tester

- 埋め込み動画が再生され、LCP/CLS を悪化させないか確認
- 字幕（テロップ/キャプション）が表示されるか

### seo-specialist との関係

- 動画ページに `VideoObject` 構造化データ、サムネ、トランスクリプトを付与（検索/AI検索の動画露出）

### promo-video-producer（専用エージェント）

動画の企画〜生成〜納品を横断的に担当。詳細は `agents/promo-video-producer.md` 参照。

## 参照ファイルの読み方

| ファイル | 必読タイミング |
|---------|--------------|
| `video-strategy.md` | 企画・絵コンテ（最初に読む） |
| `remotion.md` | コード生成で作る時 |
| `screen-recording.md` | 実画面デモを作る時 |
| `ai-video-generation.md` | AI映像を使う時・コスト試算 |
| `audio-and-voiceover.md` | ナレーション/BGM/字幕付与時 |
| `delivery-and-distribution.md` | 書き出し・埋め込み・配信・計測時 |

## 野口さん固有のチェック

- [ ] Remotion ＋ 画面録画（無料）で骨格を作り、AI動画は差し色に留めているか
- [ ] AI動画生成・AIナレーションの**本数×尺のコスト試算**をしてから使っているか
- [ ] ブランド（design-system / visual-style-guide）に整合しているか
- [ ] 無音・自動再生前提（冒頭3秒フック・テロップ必須）で設計したか
- [ ] LP埋め込みが Core Web Vitals（LCP/CLS）を悪化させない構成か
- [ ] 1案件のテンプレを次案件で**流用・量産**できる形（Remotion コンポーネント化）になっているか

## アンチパターン（よくある失敗）

1. **AI動画生成を主役にしてコスト爆発**：秒課金が積み上がる。骨格は無料手法で
2. **音声ありき設計**：自動再生はミュート。テロップなしは無意味
3. **冒頭が遅い**：最初の3秒で価値が伝わらず離脱
4. **画面の正確再現をAI動画にやらせる**：UIが崩れる。実画面は録画 or Remotion で
5. **ブランド無視のテンプレ動画**：没個性。design-system のトークンを反映
6. **重い動画でLP速度を破壊**：未圧縮/巨大解像度をそのまま埋め込み
7. **1本作って使い捨て**：Remotion でテンプレ化せず毎回ゼロから
8. **BGM/素材のライセンス未確認**：商用利用不可素材で公開
9. **縦横を後で変換**：SNS縦型と LP横型は最初から別構図で設計
10. **字幕の焼き込みのみ**：プラットフォーム用に別途キャプション/トランスクリプトも用意（A11y・SEO）

## 出典・一次ソース方針

技術情報は**一次ソース**を基準とする（Remotion 公式 `remotion.dev`、各AI動画/音声サービスの公式ドキュメント、各SNSの仕様ページ、web.dev の動画最適化）。AI動画/音声のモデル・料金・仕様は更新が非常に速いため、利用直前に各 references の出典URLで最新を再確認すること。各 references ファイル末尾に出典URLを明記している。
