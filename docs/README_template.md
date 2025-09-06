# ページテンプレート使用ガイドライン

## 概要
本ドキュメントは、東京都練馬区旭丘一丁目町会のウェブサイトにおける、ページテンプレートの使用方法とルールを定めたものです。

## テンプレートファイル構成

### 基本テンプレート
- **`template.html`** - 基本HTMLテンプレート
- **`css/template.css`** - 共通CSSスタイル
- **`js/template.js`** - 共通JavaScript機能

## 新規ページ作成手順

### 1. テンプレートファイルをコピー
```bash
cp template.html [新規ページ名].html
```

### 2. 必須更新項目

#### 2.1 ページタイトル
```html
<title>ページタイトル - 東京都練馬区旭丘一丁目町会</title>
```
- 形式: `[ページ名] - 東京都練馬区旭丘一丁目町会`

#### 2.2 ページヒーローセクション
```html
<section class="page-hero">
  <div class="page-hero-content">
    <h2 class="page-title">ページタイトル</h2>
    <p class="page-subtitle">ページの説明文がここに入ります</p>
  </div>
</section>
```
**注意**: 背景画像は`template.css`で統一管理されているため、個別に変更しないこと

#### 2.3 ナビゲーションのアクティブ状態
現在のページに対応するナビゲーションリンクに `text-primary` クラスを追加し、`text-gray-700` を削除
```html
<!-- 例: お知らせページの場合 -->
<a href="news.html" class="text-primary hover:text-primary transition-colors">お知らせ</a>
```

### 3. 追加CSS/JSファイル
ページ固有のスタイルやスクリプトが必要な場合：

```html
<!-- ページ固有のCSS -->
<link rel="stylesheet" href="css/[ページ名].css" />

<!-- ページ固有のJS（bodyタグ終了前） -->
<script src="js/[ページ名].js"></script>
```

## 共通要素のルール

### ヘッダー
- **変更禁止** - すべてのページで統一
- ロゴ、サイト名、キャッチフレーズは固定
- ナビゲーションメニューの項目順序は維持

### フッター
- **変更禁止** - すべてのページで統一
- 連絡先情報、SNSリンク、コピーライトは固定

### AIチャットボット
- **変更禁止** - すべてのページに必須
- 位置: 右下固定
- 機能: template.jsで制御

## スタイルガイド

### カラーパレット
```css
primary: #57b5e7    /* メインカラー（青） */
secondary: #8dd3c7  /* サブカラー（緑） */
```

### ボタンスタイル
```html
<!-- プライマリボタン -->
<button class="btn-primary">ボタンテキスト</button>

<!-- セカンダリボタン -->
<button class="btn-secondary">ボタンテキスト</button>
```

### カードコンポーネント
```html
<div class="card">
  <h3>カードタイトル</h3>
  <p>カード内容</p>
</div>
```

### セクション構造
```html
<section class="py-16">
  <div class="max-w-6xl mx-auto px-6">
    <h3 class="section-title">セクションタイトル</h3>
    <p class="section-subtitle">セクション説明</p>
    <!-- コンテンツ -->
  </div>
</section>
```

## レスポンシブ対応

### ブレークポイント
- モバイル: ~767px
- タブレット: 768px~1023px
- デスクトップ: 1024px~

### 必須対応項目
1. モバイルメニューの動作確認
2. テキストサイズの調整
3. 画像のレスポンシブ対応
4. グリッドレイアウトの崩し

## ファイル命名規則

### HTMLファイル
- 小文字英数字のみ使用
- 単語区切りはハイフン
- 例: `about.html`, `news-detail.html`

### CSS/JSファイル
- HTMLファイル名と対応
- 例: `news.html` → `css/news.css`, `js/news.js`

### 画像ファイル
- 配置: `images/` ディレクトリ
- 命名: `[カテゴリ]-[説明].jpg`
- 例: `event-summer-festival.jpg`

## チェックリスト

新規ページ作成時の確認項目：

- [ ] ページタイトルを更新した
- [ ] ヒーローセクションのタイトルと説明を更新した
- [ ] ナビゲーションのアクティブ状態を設定した
- [ ] モバイル表示を確認した
- [ ] AIチャットボットが動作することを確認した
- [ ] template.cssとtemplate.jsを読み込んでいる
- [ ] フッターのリンクが正しく動作する
- [ ] ページ固有のCSS/JSファイルを適切に命名した

## 注意事項

1. **Tailwind CSSの使用**
   - 基本的なスタイリングにはTailwind CSSを使用
   - カスタムスタイルが必要な場合のみ、個別CSSファイルを作成

2. **JavaScript依存関係**
   - template.jsは必須
   - ページ固有のJSはtemplate.jsの後に読み込む

3. **画像最適化**
   - 画像は適切なサイズに圧縮
   - 可能な限りWebP形式を使用

4. **アクセシビリティ**
   - 適切なalt属性の設定
   - aria-labelの使用
   - キーボードナビゲーション対応

## 更新履歴

- 2024-12-XX: 初版作成

## 問い合わせ

テンプレートに関する質問や改善提案は、町会のウェブ担当者までご連絡ください。