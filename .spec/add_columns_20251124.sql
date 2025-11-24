-- 記事テーブルへの追加カラム
ALTER TABLE articles ADD COLUMN is_news_featured BOOLEAN DEFAULT false;
ALTER TABLE articles ADD COLUMN is_activity_highlight BOOLEAN DEFAULT false;

-- コメント
COMMENT ON COLUMN articles.is_news_featured IS 'TOPページ最新情報への掲載フラグ';
COMMENT ON COLUMN articles.is_activity_highlight IS 'TOPページ町会活動ハイライトへの掲載フラグ';

