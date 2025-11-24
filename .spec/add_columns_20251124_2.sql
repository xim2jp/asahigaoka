-- 記事テーブルへの追加カラム（第2弾）
ALTER TABLE articles ADD COLUMN show_in_calendar BOOLEAN DEFAULT false;
ALTER TABLE articles ADD COLUMN show_in_news_list BOOLEAN DEFAULT true; -- デフォルトONが一般的と想定
ALTER TABLE articles ADD COLUMN include_in_rag BOOLEAN DEFAULT false;

-- コメント
COMMENT ON COLUMN articles.show_in_calendar IS 'カレンダーへの表示フラグ';
COMMENT ON COLUMN articles.show_in_news_list IS 'お知らせ一覧への表示フラグ';
COMMENT ON COLUMN articles.include_in_rag IS 'RAG（AI学習）への登録フラグ';

