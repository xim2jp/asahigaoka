# Database Migration ガイド

## Migration: SEO関連カラムの追加

### 概要
articles テーブルに SEO最適化機能用のカラムを追加します。

### 対象のカラム

#### SEO関連カラム（新規追加）
- `meta_title` (VARCHAR(60)): 検索結果に表示されるメタタイトル
- `meta_description` (VARCHAR(160)): 検索結果に表示される説明文
- `meta_keywords` (VARCHAR(255)): SEO用キーワード
- `slug` (VARCHAR(255)): 記事URL用スラッグ

#### イベント関連カラム（既に実装済み）
- ✅ `event_start_datetime` - 既存
- ✅ `event_end_datetime` - 既存
- ✅ `has_start_time` - 既存
- ✅ `has_end_time` - 既存

### 実行手順

#### 方法1: Supabase Web UI から実行（推奨）

1. [Supabase ダッシュボード](https://app.supabase.com)にログイン
2. プロジェクト「asahigaoka」を選択
3. 左側メニューから「SQL Editor」を選択
4. 「New query」をクリック
5. 以下の SQL をコピー&ペースト
6. 「Run」ボタンをクリック

```sql
ALTER TABLE IF EXISTS public.articles
ADD COLUMN IF NOT EXISTS meta_title VARCHAR(60),
ADD COLUMN IF NOT EXISTS meta_description VARCHAR(160),
ADD COLUMN IF NOT EXISTS meta_keywords VARCHAR(255),
ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug ON public.articles(slug) WHERE deleted_at IS NULL;
```

#### 方法2: Supabase CLI から実行

```bash
cd /home/s-noguchi/asahigaoka
supabase db push
```

#### 方法3: psql コマンドで実行（オプション）

```bash
psql -h swaringqrzthsdpsyoft.supabase.co \
     -U postgres \
     -d postgres \
     -f .spec/migrations/001_add_seo_and_event_columns.sql
```

### 検証

Migration 実行後、以下のコマンドで正しくカラムが追加されたか確認できます：

```sql
-- Supabase SQL Editor で実行
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'articles'
ORDER BY ordinal_position;
```

以下のカラムが表示されることを確認してください：
- meta_title
- meta_description
- meta_keywords
- slug
- event_start_datetime
- event_end_datetime
- has_start_time
- has_end_time

### トラブルシューティング

#### エラー: "column already exists"
- 既に同じカラムが存在する場合は、無視されます（`IF NOT EXISTS` で保護されています）

#### エラー: "permission denied"
- Supabase の認証情報を確認
- psql の場合は、正しいパスワードを入力してください

## 関連するコード変更

これらのカラムは以下のモジュールで使用されます：

### 記事編集フロント (`/admin/js/article-editor.js`)
- `saveArticle()`: SEO フィールドとイベント日時をデータベースに保存
- `loadArticle()`: 既存記事の SEO フィールドとイベント日時を表示
- `publishArticle()`: 公開時にメタデータを含める

### 記事編集HTML (`/admin/article-edit.html`)
- SEO設定タブ: メタタイトル、メタディスクリプション、メタキーワード、スラッグを入力
- 基本情報タブ: イベント開始日時、終了日時を入力

## ロールバック手順

万が一問題が発生した場合のロールバック方法：

```sql
-- 追加されたカラムを削除（元に戻す）
ALTER TABLE IF EXISTS public.articles
DROP COLUMN IF EXISTS meta_title,
DROP COLUMN IF EXISTS meta_description,
DROP COLUMN IF EXISTS meta_keywords,
DROP COLUMN IF EXISTS slug,
DROP COLUMN IF EXISTS event_start_datetime,
DROP COLUMN IF EXISTS event_end_datetime,
DROP COLUMN IF EXISTS has_start_time,
DROP COLUMN IF EXISTS has_end_time;

-- インデックスを削除
DROP INDEX IF EXISTS idx_articles_slug;
```

## 注意事項

- 既存の記事には新しいカラムに NULL が設定されます
- バックアップは事前に取得することをお勧めします
- 本番環境での実行前に、テスト環境で動作確認することをお勧めします
