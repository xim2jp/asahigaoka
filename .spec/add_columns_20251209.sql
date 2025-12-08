-- 記事テーブルへの追加カラム（第3弾）
-- 記事ページ生成フラグ
ALTER TABLE articles ADD COLUMN generate_article_page BOOLEAN DEFAULT true;

-- コメント
COMMENT ON COLUMN articles.generate_article_page IS '記事専用HTMLページを生成するフラグ（デフォルトON）';

