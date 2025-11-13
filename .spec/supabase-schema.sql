-- Supabase PostgreSQL スキーマ定義
-- プロジェクト: asahigaoka
-- リージョン: Tokyo (ap-northeast-1)
-- 認証: Supabase Auth

-- 拡張機能の有効化
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==========================================
-- 1. ユーザーテーブル (Supabase Auth連携)
-- ==========================================
-- 注: Supabase Authが管理するauth.users テーブルを使用
-- このテーブルはプロフィール情報を保存

CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(255) NOT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'editor' CHECK (role IN ('admin', 'editor')),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_role ON public.users(role);
CREATE INDEX idx_users_created_at ON public.users(created_at DESC);

-- コメント
COMMENT ON TABLE public.users IS 'ユーザー情報 (Supabase Authと連携)';
COMMENT ON COLUMN public.users.role IS 'ユーザーロール: admin=管理者, editor=編集者';

-- ==========================================
-- 2. 記事テーブル (articles)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.articles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  content TEXT NOT NULL,
  excerpt VARCHAR(500),
  category VARCHAR(50) NOT NULL CHECK (category IN (
    'notice',           -- お知らせ
    'event',            -- イベント情報
    'disaster_safety',  -- 防災・防犯
    'child_support',    -- 子育て支援
    'shopping_info',    -- 商店街情報
    'activity_report'   -- 活動レポート
  )),
  tags TEXT[],
  featured_image_url TEXT,
  author UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('published', 'draft')),
  published_at TIMESTAMP WITH TIME ZONE,
  line_published BOOLEAN DEFAULT FALSE,
  x_published BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_articles_status ON public.articles(status);
CREATE INDEX idx_articles_category ON public.articles(category);
CREATE INDEX idx_articles_published_at ON public.articles(published_at DESC);
CREATE INDEX idx_articles_created_at ON public.articles(created_at DESC);
CREATE INDEX idx_articles_author ON public.articles(author);
CREATE INDEX idx_articles_line_published ON public.articles(line_published);
CREATE INDEX idx_articles_x_published ON public.articles(x_published);

-- フルテキスト検索インデックス
-- 注: Supabaseでは日本語設定がデフォルトで利用できないため、
-- アプリケーション側でILIKE検索を実装
-- 単純なインデックスのみを使用
CREATE INDEX idx_articles_title ON public.articles(title);

COMMENT ON TABLE public.articles IS '記事管理テーブル';
COMMENT ON COLUMN public.articles.category IS 'カテゴリ分類';
COMMENT ON COLUMN public.articles.status IS '公開状態: published=公開済み, draft=下書き';

-- ==========================================
-- 3. メディアテーブル (media)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.media (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50),
  file_size BIGINT,
  file_url TEXT NOT NULL,
  storage_path TEXT,
  uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  mime_type VARCHAR(100),
  width INTEGER,
  height INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_media_uploaded_by ON public.media(uploaded_by);
CREATE INDEX idx_media_created_at ON public.media(created_at DESC);

COMMENT ON TABLE public.media IS 'メディア/画像管理テーブル';

-- ==========================================
-- 4. AIチャット履歴テーブル (ai_chat_history)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ai_chat_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id VARCHAR(255) NOT NULL,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('user', 'assistant')),
  content TEXT NOT NULL,
  tokens_used INTEGER,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX idx_ai_chat_session_id ON public.ai_chat_history(session_id);
CREATE INDEX idx_ai_chat_user_id ON public.ai_chat_history(user_id);
CREATE INDEX idx_ai_chat_created_at ON public.ai_chat_history(created_at DESC);

COMMENT ON TABLE public.ai_chat_history IS 'AIアシスタント チャット履歴';

-- ==========================================
-- 5. ファイル変更履歴テーブル (file_change_history)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.file_change_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  file_path VARCHAR(255) NOT NULL,
  change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('create', 'update', 'delete')),
  old_content TEXT,
  new_content TEXT,
  ai_session_id VARCHAR(255),
  pr_number INTEGER,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  approved_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_file_change_user_id ON public.file_change_history(user_id);
CREATE INDEX idx_file_change_status ON public.file_change_history(status);
CREATE INDEX idx_file_change_created_at ON public.file_change_history(created_at DESC);

COMMENT ON TABLE public.file_change_history IS 'ファイル変更履歴（AI提案の承認・却下追跡）';

-- ==========================================
-- 6. 知識ベースドキュメント管理テーブル (knowledge_documents)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.knowledge_documents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  file_name VARCHAR(255) NOT NULL,
  file_type VARCHAR(50) NOT NULL CHECK (file_type IN ('pdf', 'docx', 'txt')),
  file_url TEXT NOT NULL,
  storage_path TEXT,
  dify_document_id VARCHAR(255),
  dify_dataset_id VARCHAR(255),
  status VARCHAR(20) NOT NULL DEFAULT 'processing' CHECK (status IN ('processing', 'completed', 'failed')),
  uploaded_by UUID NOT NULL REFERENCES public.users(id) ON DELETE SET NULL,
  qa_count INTEGER,
  error_message TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  indexed_at TIMESTAMP WITH TIME ZONE
);

-- インデックス
CREATE INDEX idx_knowledge_documents_status ON public.knowledge_documents(status);
CREATE INDEX idx_knowledge_documents_uploaded_by ON public.knowledge_documents(uploaded_by);
CREATE INDEX idx_knowledge_documents_dify_document_id ON public.knowledge_documents(dify_document_id);
CREATE INDEX idx_knowledge_documents_created_at ON public.knowledge_documents(created_at DESC);

COMMENT ON TABLE public.knowledge_documents IS 'Dify RAG システム用 知識ベース ドキュメント管理';

-- ==========================================
-- 7. LINE会話履歴テーブル (line_conversations)
-- ==========================================
CREATE TABLE IF NOT EXISTS public.line_conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  line_user_id VARCHAR(255) NOT NULL,
  message_type VARCHAR(20) NOT NULL CHECK (message_type IN ('user', 'assistant')),
  content TEXT NOT NULL,
  dify_conversation_id VARCHAR(255),
  response_time_ms INTEGER,
  is_fallback BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- インデックス
CREATE INDEX idx_line_conversations_user_id ON public.line_conversations(line_user_id);
CREATE INDEX idx_line_conversations_dify_conversation_id ON public.line_conversations(dify_conversation_id);
CREATE INDEX idx_line_conversations_created_at ON public.line_conversations(created_at DESC);

COMMENT ON TABLE public.line_conversations IS 'LINE 会話履歴（Dify RAG システム用）';

-- ==========================================
-- 自動更新トリガー関数
-- ==========================================

-- updated_at を自動更新する関数
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- users テーブル用トリガー
CREATE TRIGGER update_users_updated_at
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- articles テーブル用トリガー
CREATE TRIGGER update_articles_updated_at
BEFORE UPDATE ON public.articles
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();

-- ==========================================
-- 初期データ (オプション)
-- ==========================================

-- 管理者ユーザー作成
-- 注: Supabase Auth経由で users テーブルに挿入する
-- このスクリプトでは手動で実施するか、アプリケーションから実施

-- テストカテゴリデータ（ユーザー作成後に実行）
-- 注: usersテーブルにレコードがない場合はスキップ
-- INSERT INTO public.articles (title, content, excerpt, category, author, status)
-- VALUES (
--   'テスト記事',
--   'これはテスト記事です。',
--   'テスト記事の抜粋',
--   'notice',
--   (SELECT id FROM public.users LIMIT 1),
--   'draft'
-- )
-- ON CONFLICT DO NOTHING;

-- ==========================================
-- End of Schema
-- ==========================================
