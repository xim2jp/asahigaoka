# Remotion：React で動画をコード生成

**Remotion** は React で動画を記述し、フレームごとにレンダリングして MP4 等に書き出す OSS。野口さんの **Next.js / TypeScript / Tailwind / design-system** をそのまま流用でき、データ連動・量産・ブランド統制に強い。**LPヒーロー・explainer・SNS縦型のテンプレ量産の主力**。

## なぜ Remotion か（野口Profile 適合）

- **既存スタック流用**：React コンポーネント・Tailwind・デザイントークンを動画に再利用
- **データ連動**：料金・実績数値・機能名を props で型安全に差し込み → 案件ごとに文言/色だけ替えて量産
- **低コスト**：OSS。ローカル/CI レンダリングは無料。Remotion Lambda は従量（後述）
- **差分更新**：文言変更＝コード変更。撮り直し不要
- **ライセンス注意**：Remotion は企業規模により有償ライセンスの条件がある（個人・小規模は無料枠）。利用前に公式ライセンスを確認

## セットアップ

```bash
# 単体プロジェクト
npm create video@latest         # テンプレ選択（Hello World / Blank 等）

# 既存 Next.js に組み込む場合は @remotion/player でプレビュー、レンダリングは別途
npm i remotion @remotion/cli @remotion/player
```

推奨配置：リポジトリ直下 `remotion/`（独立）か、Next.js 内 `src/remotion/`（Player 埋め込み前提）。

## 基本構造

```tsx
// remotion/Root.tsx — コンポジション登録
import { Composition } from 'remotion';
import { HeroVideo } from './HeroVideo';

export const RemotionRoot: React.FC = () => (
  <>
    <Composition
      id="HeroVideo"
      component={HeroVideo}
      durationInFrames={15 * 30}   // 15秒 @30fps
      fps={30}
      width={1920}
      height={1080}                // 9:16 SNS版は width={1080} height={1920}
      defaultProps={{
        title: 'シフト作成、3時間が10分に。',
        accent: '#4f46e5',         // design-system のブランドカラー
      }}
    />
  </>
);
```

```tsx
// remotion/HeroVideo.tsx — 時間に応じたアニメーション
import { AbsoluteFill, useCurrentFrame, useVideoConfig, interpolate, spring, Img, staticFile } from 'remotion';

export const HeroVideo: React.FC<{ title: string; accent: string }> = ({ title, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // フェードイン＋せり上がり（spring で自然な動き）
  const opacity = interpolate(frame, [0, 20], [0, 1], { extrapolateRight: 'clamp' });
  const y = spring({ frame, fps, from: 30, to: 0, config: { damping: 200 } });

  return (
    <AbsoluteFill style={{ backgroundColor: '#0b0b12', justifyContent: 'center', padding: 120 }}>
      <Img src={staticFile('hero-screenshot.png')} style={{ borderRadius: 24 }} />
      <h1 style={{ color: 'white', fontSize: 84, opacity, transform: `translateY(${y}px)`,
                   borderLeft: `8px solid ${accent}`, paddingLeft: 24 }}>
        {title}
      </h1>
    </AbsoluteFill>
  );
};
```

## 主要API（押さえる最小セット）

- `useCurrentFrame()` / `useVideoConfig()`：現在フレーム・fps/解像度
- `interpolate(frame, [in], [out])`：値の線形補間（フェード・移動）
- `spring({frame, fps})`：物理ばねで自然なイージング
- `<Sequence from={n} durationInFrames={m}>`：カットを時間軸に並べる
- `<Series>`：カットを順番に連結
- `<AbsoluteFill>`：全画面レイヤー
- `<Audio>` / `<Video>` / `<Img>` / `<OffthreadVideo>`：音声・動画・画像の取り込み
- `staticFile('...')`：`public/` 配下アセット参照
- `delayRender()` / `continueRender()`：データ取得を待ってからレンダリング

## ブランド整合（design-system 連携）

デザイントークンを共有して「動画都合でブランドを崩さない」：

```tsx
// remotion/brand.ts — design-system.md の値をコード化（単一の真実）
export const brand = {
  primary: '#4f46e5',
  ink: '#0b0b12',
  font: 'Inter, "Noto Sans JP", sans-serif',
  radius: 24,
} as const;
```

日本語フォントは `@remotion/google-fonts` か `staticFile` で読み込み、レンダリング前にロード完了を保証する。

## データ連動（量産の肝）

料金・実績を props で渡し、案件ごとに JSON を差し替えるだけで動画を再生成：

```bash
npx remotion render HeroVideo out/hero.mp4 \
  --props='{"title":"在庫管理を自動化","accent":"#16a34a"}'
```

CMS や `feature-list.md` の値を読んで複数バリエーションを一括生成も可能（ループでレンダリング）。

## プレビュー（Next.js 埋め込み）

```tsx
'use client';
import { Player } from '@remotion/player';
import { HeroVideo } from '@/remotion/HeroVideo';

export function VideoPreview() {
  return (
    <Player component={HeroVideo} durationInFrames={450} fps={30}
            compositionWidth={1920} compositionHeight={1080}
            controls autoPlay loop style={{ width: '100%' }}
            inputProps={{ title: '...', accent: '#4f46e5' }} />
  );
}
```

## レンダリング（書き出し）

```bash
# ローカル（無料・要 Chromium。CI でも可）
npx remotion render HeroVideo out/hero.mp4 --codec=h264

# 縦型SNS版
npx remotion render HeroVerticalVideo out/hero-9x16.mp4

# 静止サムネ（poster 用）
npx remotion still HeroVideo out/poster.png --frame=20
```

- **CI（GitHub Actions）**：headless Chromium で自動レンダリング → アーティファクト化
- **Remotion Lambda**：大量/高速並列レンダリングを AWS Lambda で。**従量課金**（秒・並列数）なので本数×尺でコスト試算してから使う。少数なら CI/ローカルで十分

## チェックリスト

- [ ] 16:9 と 9:16 のコンポジションを別途用意した
- [ ] design-system のトークンを `brand.ts` で共有しブランド整合
- [ ] 日本語フォントのロード完了を保証（文字化け/遅延描画なし）
- [ ] 文言/色/画面キャプチャを props 化して量産できる
- [ ] レンダリングは無料手段（ローカル/CI）優先、Lambda は試算後
- [ ] Remotion のライセンス条件（企業規模）を確認した
- [ ] サムネ（poster）も still で書き出した

## 出典・一次ソース

- Remotion 公式ドキュメント: https://www.remotion.dev/docs
- Remotion ライセンス: https://www.remotion.dev/docs/license
- @remotion/player: https://www.remotion.dev/docs/player
- Remotion Lambda: https://www.remotion.dev/docs/lambda
- レンダリング CLI: https://www.remotion.dev/docs/cli/render
