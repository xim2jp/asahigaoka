-- Migration: media テーブルに article_id カラムを追加
-- 作成日: 2024-11-16
-- 説明: 添付ファイルを記事に紐付けるため、media テーブルに article_id カラムを追加します

-- article_id カラムを追加
ALTER TABLE IF EXISTS public.media
ADD COLUMN IF NOT EXISTS article_id UUID REFERENCES public.articles(id) ON DELETE CASCADE;

-- article_id にインデックスを作成
CREATE INDEX IF NOT EXISTS idx_media_article_id ON public.media(article_id);

-- コメント追加
COMMENT ON COLUMN public.media.article_id IS '記事への外部キー（記事削除時に関連メディアも削除）';
