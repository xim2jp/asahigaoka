# バグ修正: 記事保存時の情報漏れ - サマリー

## 問題の概要

お知らせCMSシステムの記事管理画面で、以下の情報が保存されていませんでした：
- **アイキャッチ画像（featured_image_url）**
- **SEO関連メタタグ**（meta_title, meta_description, meta_keywords, slug）
- **イベント日時情報**（event_start_datetime, event_end_datetime, has_start_time, has_end_time）

## 原因分析

### 1. アイキャッチ画像が保存されない原因

**ファイル**: `/admin/js/article-editor.js`

**問題**:
- `handleImageUpload()` メソッドでアイキャッチ画像をアップロードしたが、アップロード時に `this.featuredImageUrl` に URL を保存していなかった
- 記事保存時（`saveArticle()`）に `featured_image_url` を `articleData` に含めていなかった
- 新規記事作成時に画像をアップロードしても、その URL が保存されなかった

### 2. SEO関連メタタグが保存されない原因

**ファイル**: `.spec/supabase-schema.sql`

**問題**:
- articles テーブルのスキーマに SEO関連カラムが定義されていなかった
- 以下のカラムが欠落していた：
  - `meta_title`
  - `meta_description`
  - `meta_keywords`
  - `slug`
  - `event_start_datetime`
  - `event_end_datetime`
  - `has_start_time`
  - `has_end_time`

フロント側では正しくデータを取得・送信していましたが、データベース側でカラムが存在しないため保存されませんでした。

## 実施した修正

### 1. article-editor.js の修正

#### 1.1 プロパティの追加 (line 12)
```javascript
this.featuredImageUrl = null; // アイキャッチ画像URL
```

#### 1.2 loadArticle メソッドの修正 (line 153)
既存記事読み込み時に、featured_image_url を this.featuredImageUrl に保存

```javascript
if (this.currentArticle.featured_image_url) {
  this.featuredImageUrl = this.currentArticle.featured_image_url;
  // ... 画像プレビュー表示
}
```

#### 1.3 saveArticle メソッドの修正 (line 537)
保存時に featured_image_url を articleData に含める

```javascript
const articleData = {
  // ... 既存フィールド
  featured_image_url: this.featuredImageUrl || null
};
```

#### 1.4 イベントハンドラーの分離 (line 98-107)
featured-image と attachments 用のハンドラーを分離

```javascript
// アイキャッチ画像アップロード
const featuredImageInput = document.getElementById('featured-image');
if (featuredImageInput) {
  featuredImageInput.addEventListener('change', (e) => this.handleFeaturedImageUpload(e));
}

// 添付ファイルアップロード
const attachmentsInput = document.getElementById('attachments');
if (attachmentsInput) {
  attachmentsInput.addEventListener('change', (e) => this.handleAttachmentsUpload(e));
}
```

#### 1.5 handleImageUpload メソッドの分割
- `handleFeaturedImageUpload()`：アイキャッチ画像専用
- `handleAttachmentsUpload()`：添付ファイル専用

**重要な変更**:
```javascript
// アップロード時に URL を保存
this.featuredImageUrl = result.data.file_url;
```

### 2. スキーマの修正

**ファイル**: `.spec/supabase-schema.sql`

articles テーブルに以下のカラムを追加：

```sql
-- SEO関連カラム
meta_title VARCHAR(60),
meta_description VARCHAR(160),
meta_keywords VARCHAR(255),
slug VARCHAR(255),

-- イベント関連カラム
event_start_datetime TIMESTAMP WITH TIME ZONE,
event_end_datetime TIMESTAMP WITH TIME ZONE,
has_start_time BOOLEAN DEFAULT FALSE,
has_end_time BOOLEAN DEFAULT FALSE
```

### 3. Migration ファイルの作成

**ファイル**: `.spec/migrations/001_add_seo_and_event_columns.sql`

Supabase にスキーマ変更を反映するための migration ファイルを作成

## 次のステップ（ユーザー実施）

### ⚠️ 重要: Database Migration の実行

以下の手順で、Supabase データベースにカラムを追加してください。

#### 方法1: Supabase Web UI（推奨）

1. https://app.supabase.com にログイン
2. プロジェクト「asahigaoka」を選択
3. 左メニュー → SQL Editor
4. 「New query」をクリック
5. 以下の SQL を貼り付け：

```sql
ALTER TABLE IF EXISTS public.articles
ADD COLUMN IF NOT EXISTS meta_title VARCHAR(60),
ADD COLUMN IF NOT EXISTS meta_description VARCHAR(160),
ADD COLUMN IF NOT EXISTS meta_keywords VARCHAR(255),
ADD COLUMN IF NOT EXISTS slug VARCHAR(255),
ADD COLUMN IF NOT EXISTS event_start_datetime TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS event_end_datetime TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS has_start_time BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_end_time BOOLEAN DEFAULT FALSE;

CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug ON public.articles(slug) WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.articles.meta_title IS 'SEO用メタタイトル（60文字以内）';
COMMENT ON COLUMN public.articles.meta_description IS 'SEO用メタディスクリプション（160文字以内）';
COMMENT ON COLUMN public.articles.meta_keywords IS 'SEO用メタキーワード';
COMMENT ON COLUMN public.articles.slug IS '記事URL用スラッグ';
COMMENT ON COLUMN public.articles.event_start_datetime IS 'イベント開始日時';
COMMENT ON COLUMN public.articles.event_end_datetime IS 'イベント終了日時';
COMMENT ON COLUMN public.articles.has_start_time IS 'イベント開始時刻を指定したか';
COMMENT ON COLUMN public.articles.has_end_time IS 'イベント終了時刻を指定したか';
```

6. 「Run」をクリック

#### 方法2: Supabase CLI（Git 連携推奨）

```bash
cd /home/s-noguchi/asahigaoka
supabase db push
```

### 動作確認

Migration 実行後、以下の手順で動作確認してください：

1. **管理画面にアクセス**
   - http://localhost/admin/article-edit.html にアクセス

2. **新規記事作成テスト**
   - タイトルを入力
   - 下書き本文を入力
   - イベント開始日を設定
   - アイキャッチ画像をアップロード
   - SEO設定タブで、メタタイトル、メタディスクリプション、メタキーワード、スラッグを入力
   - 「下書き保存」をクリック

3. **データベース確認**
   - Supabase Dashboard の「Table Editor」で articles テーブルを確認
   - アップロードした画像、SEO メタデータ、イベント日時が正しく保存されているか確認

4. **記事編集テスト**
   - 作成した記事を開く
   - アイキャッチ画像が表示される
   - SEO メタデータが表示される
   - イベント日時が表示される

## 関連ドキュメント

- `MIGRATION_GUIDE.md` - Migration 実行の詳細ガイド
- `supabase-schema.sql` - 更新されたスキーマ定義

## 修正ファイル一覧

1. **修正**:
   - `/admin/js/article-editor.js` - アイキャッチ画像保存ロジック追加、メソッド分割

2. **新規作成**:
   - `.spec/migrations/001_add_seo_and_event_columns.sql` - Migration ファイル
   - `.spec/MIGRATION_GUIDE.md` - Migration ガイド
   - `.spec/BUGFIX_SUMMARY.md` - このドキュメント

3. **更新**:
   - `.spec/supabase-schema.sql` - スキーマにカラムを追加

## テスト環境での検証

修正後、以下のテストシナリオを実施してください：

### シナリオ1: 新規記事作成（すべてのフィールド）
- [ ] タイトルを入力
- [ ] 下書き本文を入力
- [ ] イベント開始日を設定
- [ ] イベント開始時刻を入力
- [ ] イベント終了日を設定（オプション）
- [ ] アイキャッチ画像をアップロード
- [ ] SEO メタタイトルを入力
- [ ] SEO メタディスクリプションを入力
- [ ] SEO メタキーワードを入力
- [ ] スラッグを入力
- [ ] 「下書き保存」をクリック
- [ ] データベースで値が保存されているか確認

### シナリオ2: 既存記事編集
- [ ] 作成した記事を開く
- [ ] すべてのデータが表示されているか確認
- [ ] 各フィールドを編集
- [ ] 「下書き保存」をクリック
- [ ] データベースで更新されているか確認

### シナリオ3: 公開
- [ ] 記事を「保存して公開」
- [ ] 公開ステータスが「published」に更新されているか確認
- [ ] SEO メタデータが保持されているか確認

## トラブルシューティング

### エラー: "column not found"
- Migration が正しく実行されていない可能性があります
- Supabase Dashboard の SQL Editor でカラムが存在するか確認

### エラー: "permission denied"
- Supabase の認証情報を確認
- 権限不足の場合は、admin ロールで実行

### アイキャッチ画像が表示されない
- ブラウザのコンソール（F12）で エラーメッセージを確認
- Supabase Storage の「articles-images」バケットが存在するか確認

## 注意事項

- これらの修正は、既存の記事には影響を与えません（NULL 値がセットされます）
- 本番環境での実行前に、テスト環境で十分な検証を実施してください
- データベースのバックアップは事前に取得することをお勧めします
