-- Supabase RLS (Row Level Security) ポリシー定義
-- Supabase Authと連携した行レベルのアクセス制御

-- ==========================================
-- RLS 有効化
-- ==========================================

-- users テーブル
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- articles テーブル
ALTER TABLE public.articles ENABLE ROW LEVEL SECURITY;

-- media テーブル
ALTER TABLE public.media ENABLE ROW LEVEL SECURITY;

-- ai_chat_history テーブル
ALTER TABLE public.ai_chat_history ENABLE ROW LEVEL SECURITY;

-- file_change_history テーブル
ALTER TABLE public.file_change_history ENABLE ROW LEVEL SECURITY;

-- knowledge_documents テーブル
ALTER TABLE public.knowledge_documents ENABLE ROW LEVEL SECURITY;

-- line_conversations テーブル
ALTER TABLE public.line_conversations ENABLE ROW LEVEL SECURITY;

-- ==========================================
-- 1. USERS テーブルのRLSポリシー
-- ==========================================

-- ユーザーは自身のプロフィールのみ参照・更新可能
CREATE POLICY "users_select_own_profile" ON public.users
  FOR SELECT
  USING (auth.uid() = id OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "users_update_own_profile" ON public.users
  FOR UPDATE
  USING (auth.uid() = id OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin')
  WITH CHECK (auth.uid() = id OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- 管理者のみがユーザーを削除可能
CREATE POLICY "users_delete_admin_only" ON public.users
  FOR DELETE
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- 管理者のみが新規ユーザー作成可能
CREATE POLICY "users_insert_admin_only" ON public.users
  FOR INSERT
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- ==========================================
-- 2. ARTICLES テーブルのRLSポリシー
-- ==========================================

-- 全員が公開済み記事を参照可能
CREATE POLICY "articles_select_published" ON public.articles
  FOR SELECT
  USING (status = 'published' AND deleted_at IS NULL);

-- 認証ユーザーが下書きを参照可能（自分の記事のみ）
CREATE POLICY "articles_select_own_draft" ON public.articles
  FOR SELECT
  USING (
    (auth.uid()::uuid = author AND status = 'draft' AND deleted_at IS NULL)
    OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- 認証ユーザー (editor) が記事作成可能
CREATE POLICY "articles_insert_authenticated" ON public.articles
  FOR INSERT
  WITH CHECK (
    auth.uid()::uuid = author
    AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'editor')
  );

-- ユーザーが自分の記事を更新可能 (admin は全て)
CREATE POLICY "articles_update_own_or_admin" ON public.articles
  FOR UPDATE
  USING (
    (auth.uid()::uuid = author AND deleted_at IS NULL)
    OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  )
  WITH CHECK (
    (auth.uid()::uuid = author AND deleted_at IS NULL)
    OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- ユーザーが自分の記事を削除可能 (管理者のみ物理削除)
CREATE POLICY "articles_delete_own_or_admin" ON public.articles
  FOR DELETE
  USING (
    (auth.uid()::uuid = author AND deleted_at IS NULL)
    OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- ==========================================
-- 3. MEDIA テーブルのRLSポリシー
-- ==========================================

-- 全員がメディアを参照可能
CREATE POLICY "media_select_all" ON public.media
  FOR SELECT
  USING (deleted_at IS NULL);

-- 認証ユーザーがメディアをアップロード可能
CREATE POLICY "media_insert_authenticated" ON public.media
  FOR INSERT
  WITH CHECK (auth.uid()::uuid = uploaded_by AND (SELECT role FROM public.users WHERE id = auth.uid()) IN ('admin', 'editor'));

-- 管理者のみがメディアを削除可能
CREATE POLICY "media_delete_admin_only" ON public.media
  FOR DELETE
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- ==========================================
-- 4. AI_CHAT_HISTORY テーブルのRLSポリシー
-- ==========================================

-- ユーザーが自身のチャット履歴のみ参照可能
CREATE POLICY "ai_chat_select_own_session" ON public.ai_chat_history
  FOR SELECT
  USING (
    auth.uid()::uuid = user_id
    OR (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
  );

-- 認証ユーザーがチャット履歴を作成可能
CREATE POLICY "ai_chat_insert_authenticated" ON public.ai_chat_history
  FOR INSERT
  WITH CHECK (auth.uid()::uuid = user_id);

-- ==========================================
-- 5. FILE_CHANGE_HISTORY テーブルのRLSポリシー
-- ==========================================

-- 管理者のみが閲覧・操作可能
CREATE POLICY "file_change_select_admin_only" ON public.file_change_history
  FOR SELECT
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "file_change_insert_admin_only" ON public.file_change_history
  FOR INSERT
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "file_change_update_admin_only" ON public.file_change_history
  FOR UPDATE
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "file_change_delete_admin_only" ON public.file_change_history
  FOR DELETE
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- ==========================================
-- 6. KNOWLEDGE_DOCUMENTS テーブルのRLSポリシー
-- ==========================================

-- 管理者のみが閲覧・操作可能
CREATE POLICY "knowledge_documents_select_admin_only" ON public.knowledge_documents
  FOR SELECT
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "knowledge_documents_insert_admin_only" ON public.knowledge_documents
  FOR INSERT
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "knowledge_documents_update_admin_only" ON public.knowledge_documents
  FOR UPDATE
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin')
  WITH CHECK ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

CREATE POLICY "knowledge_documents_delete_admin_only" ON public.knowledge_documents
  FOR DELETE
  USING ((SELECT role FROM public.users WHERE id = auth.uid()) = 'admin');

-- ==========================================
-- 7. LINE_CONVERSATIONS テーブルのRLSポリシー
-- ==========================================

-- システム内部(Lambda)のみがアクセス可能
-- サービスロール(Service Role Secret Key)でのみアクセス許可
CREATE POLICY "line_conversations_insert_service_role" ON public.line_conversations
  FOR INSERT
  WITH CHECK (auth.uid()::text = 'service_role');

CREATE POLICY "line_conversations_select_service_role" ON public.line_conversations
  FOR SELECT
  USING (
    (SELECT role FROM public.users WHERE id = auth.uid()) = 'admin'
    OR auth.uid()::text = 'service_role'
  );

-- ==========================================
-- End of RLS Policies
-- ==========================================
