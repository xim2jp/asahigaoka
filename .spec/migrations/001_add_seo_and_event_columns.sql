-- Migration: SEO関連カラムとイベント関連カラムを articles テーブルに追加
-- 作成日: 2024-11-16
-- 説明: 記事管理機能にSEO最適化機能とイベント日時管理機能を追加するため、
-- articles テーブルに必要なカラムを追加します

-- articles テーブルへのカラム追加
ALTER TABLE IF EXISTS public.articles
ADD COLUMN IF NOT EXISTS meta_title VARCHAR(60),
ADD COLUMN IF NOT EXISTS meta_description VARCHAR(160),
ADD COLUMN IF NOT EXISTS meta_keywords VARCHAR(255),
ADD COLUMN IF NOT EXISTS slug VARCHAR(255),
ADD COLUMN IF NOT EXISTS event_start_datetime TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS event_end_datetime TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS has_start_time BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS has_end_time BOOLEAN DEFAULT FALSE;

-- slug カラムにユニークインデックスを作成（オプション）
CREATE UNIQUE INDEX IF NOT EXISTS idx_articles_slug ON public.articles(slug) WHERE deleted_at IS NULL;

-- コメント追加
COMMENT ON COLUMN public.articles.meta_title IS 'SEO用メタタイトル（60文字以内）';
COMMENT ON COLUMN public.articles.meta_description IS 'SEO用メタディスクリプション（160文字以内）';
COMMENT ON COLUMN public.articles.meta_keywords IS 'SEO用メタキーワード';
COMMENT ON COLUMN public.articles.slug IS '記事URL用スラッグ';
COMMENT ON COLUMN public.articles.event_start_datetime IS 'イベント開始日時';
COMMENT ON COLUMN public.articles.event_end_datetime IS 'イベント終了日時';
COMMENT ON COLUMN public.articles.has_start_time IS 'イベント開始時刻を指定したか';
COMMENT ON COLUMN public.articles.has_end_time IS 'イベント終了時刻を指定したか';
