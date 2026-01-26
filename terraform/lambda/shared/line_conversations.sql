-- LINE会話履歴テーブル（line_conversations）
-- spec.md セクション3.6の仕様に基づく

CREATE TABLE IF NOT EXISTS line_conversations (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    line_user_id VARCHAR(255) NOT NULL,              -- LINE ユーザーID（匿名化）
    message_type VARCHAR(20) NOT NULL,               -- user / assistant
    content TEXT NOT NULL,                           -- メッセージ内容
    dify_conversation_id VARCHAR(255),               -- Dify の Conversation ID
    response_time_ms INTEGER,                        -- 応答時間（ミリ秒）
    is_fallback BOOLEAN NOT NULL DEFAULT FALSE,      -- フォールバック応答フラグ
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- インデックス
CREATE INDEX IF NOT EXISTS idx_line_conversations_user_id ON line_conversations(line_user_id);
CREATE INDEX IF NOT EXISTS idx_line_conversations_created_at ON line_conversations(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_line_conversations_user_created ON line_conversations(line_user_id, created_at DESC);

-- message_typeのチェック制約
ALTER TABLE line_conversations DROP CONSTRAINT IF EXISTS chk_message_type;
ALTER TABLE line_conversations ADD CONSTRAINT chk_message_type CHECK (message_type IN ('user', 'assistant'));

-- RLSポリシー（Supabase用）
ALTER TABLE line_conversations ENABLE ROW LEVEL SECURITY;

-- サービスロール用のポリシー（Lambda関数からの全アクセスを許可）
CREATE POLICY "Service role can do all" ON line_conversations
    FOR ALL
    TO service_role
    USING (true)
    WITH CHECK (true);

-- 匿名ユーザー用のポリシー（読み取りのみ、管理画面用）
CREATE POLICY "Anon can read" ON line_conversations
    FOR SELECT
    TO anon
    USING (true);

-- 匿名ユーザー用のポリシー（書き込み許可、Lambda関数用）
CREATE POLICY "Anon can insert" ON line_conversations
    FOR INSERT
    TO anon
    WITH CHECK (true);

-- コメント
COMMENT ON TABLE line_conversations IS 'LINE AIチャットの会話履歴';
COMMENT ON COLUMN line_conversations.line_user_id IS 'LINE ユーザーID（匿名化済み）';
COMMENT ON COLUMN line_conversations.message_type IS 'メッセージタイプ: user=ユーザー, assistant=AI';
COMMENT ON COLUMN line_conversations.content IS 'メッセージ内容';
COMMENT ON COLUMN line_conversations.dify_conversation_id IS 'Dify API の会話ID（会話継続用）';
COMMENT ON COLUMN line_conversations.response_time_ms IS 'AI応答時間（ミリ秒）';
COMMENT ON COLUMN line_conversations.is_fallback IS 'フォールバック応答かどうか（エラー時のデフォルト応答）';
