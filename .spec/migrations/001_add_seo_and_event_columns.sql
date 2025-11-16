-- Migration: SEO関連カラムを articles テーブルに追加
-- 作成日: 2024-11-16
-- 説明: 記事管理機能にSEO最適化機能を追加するため、
-- articles テーブルに SEO 関連のカラムを追加します
--
-- 注: イベント関連のカラム (event_start_datetime, event_end_datetime, has_start_time, has_end_time)
--     は既に実装されているため、SEO 関連カラムのみを追加します

-- articles テーブルへのカラム追加
ALTER TABLE IF EXISTS public.articles
ADD COLUMN IF NOT EXISTS meta_title VARCHAR(60),
ADD COLUMN IF NOT EXISTS meta_description VARCHAR(160),
ADD COLUMN IF NOT EXISTS meta_keywords VARCHAR(255),
ADD COLUMN IF NOT EXISTS slug VARCHAR(255);

-- slug カラムにユニークインデックスを作成（削除されたレコードを除外）
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug ON public.articles(slug) WHERE deleted_at IS NULL;

-- コメント追加
COMMENT ON COLUMN public.articles.meta_title IS 'SEO用メタタイトル（60文字以内）';
COMMENT ON COLUMN public.articles.meta_description IS 'SEO用メタディスクリプション（160文字以内）';
COMMENT ON COLUMN public.articles.meta_keywords IS 'SEO用メタキーワード（カンマ区切り）';
COMMENT ON COLUMN public.articles.slug IS '記事URL用スラッグ';
