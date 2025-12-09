-- 配信履歴テーブル
-- LINE配信およびX投稿の重複防止のために使用

CREATE TABLE IF NOT EXISTS notification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id UUID NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    notification_type VARCHAR(20) NOT NULL CHECK (notification_type IN ('line', 'x')),
    sent_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    message_hash VARCHAR(64), -- メッセージのハッシュ（同じ内容の重複検出用）
    response_data JSONB, -- APIレスポンスの保存
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    -- 同じ記事に対して同じタイプの通知は1回のみ
    UNIQUE(article_id, notification_type)
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_notification_history_article_id ON notification_history(article_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_type ON notification_history(notification_type);
CREATE INDEX IF NOT EXISTS idx_notification_history_sent_at ON notification_history(sent_at);

-- RLSポリシー（サービスロールのみアクセス可能）
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;

-- サービスロール用のポリシー
CREATE POLICY "Service role can manage notification_history" ON notification_history
    FOR ALL
    USING (auth.role() = 'service_role')
    WITH CHECK (auth.role() = 'service_role');

-- anon用の読み取りポリシー（管理画面から確認用）
CREATE POLICY "Anon can read notification_history" ON notification_history
    FOR SELECT
    USING (true);

-- anon用の書き込みポリシー（Lambda関数から書き込み用）
CREATE POLICY "Anon can insert notification_history" ON notification_history
    FOR INSERT
    WITH CHECK (true);

COMMENT ON TABLE notification_history IS 'LINE配信およびX投稿の履歴を管理。重複配信を防止するために使用。';
COMMENT ON COLUMN notification_history.notification_type IS 'line または x';
COMMENT ON COLUMN notification_history.message_hash IS 'メッセージ内容のSHA256ハッシュ';
