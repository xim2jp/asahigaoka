# Supabase セットアップ完了チェックリスト

## フェーズ1: Supabaseプロジェクト作成

### 1.1 プロジェクト初期化
- [ ] Supabase アカウント作成（https://supabase.com）
- [ ] 新規プロジェクト「asahigaoka」を東京リージョン（ap-northeast-1）で作成
- [ ] Database Password を安全に保管
- [ ] プロジェクト情報をコピー：
  ```
  プロジェクトID:       ________________
  Project URL:          ________________
  Anon Public Key:      ________________
  Service Role Secret:  ________________
  Database Password:    ________________
  ```

### 1.2 SQL スキーマ適用
- [ ] `supabase-schema.sql` をSQLエディタで実行
- [ ] テーブル作成確認：
  ```sql
  SELECT table_name FROM information_schema.tables
  WHERE table_schema = 'public';
  ```
  以下が表示されることを確認：
  - [ ] users
  - [ ] articles
  - [ ] media
  - [ ] ai_chat_history
  - [ ] file_change_history
  - [ ] knowledge_documents
  - [ ] line_conversations

- [ ] `supabase-rls-policies.sql` をSQLエディタで実行
- [ ] RLS ポリシー確認：
  ```sql
  SELECT schemaname, tablename, policyname
  FROM pg_policies
  WHERE schemaname = 'public';
  ```

### 1.3 インデックス確認
- [ ] 各テーブルのインデックスが作成されていることを確認：
  ```sql
  SELECT tablename, indexname FROM pg_indexes
  WHERE schemaname = 'public' ORDER BY tablename;
  ```

---

## フェーズ2: Supabase Auth 設定

### 2.1 メール認証設定
- [ ] **Settings** → **Authentication** → **Providers** で Email を有効化
- [ ] **Email Confirmations** を有効化：
  - [ ] ✅ Enable email confirmations
  - [ ] Type: `Double opt-in` に設定
- [ ] Email templates をカスタマイズ（日本語化推奨）

### 2.2 URL 設定
- [ ] **Settings** → **URL Configuration** で以下を設定：
  - [ ] **Site URL**: `https://asahigaoka-website.com`
  - [ ] **Redirect URLs**:
    ```
    https://asahigaoka-website.com/admin
    https://asahigaoka-website.com/admin/login
    http://localhost:3000/admin
    http://localhost:3000/admin/login
    ```

### 2.3 JWT 設定
- [ ] **Settings** → **JWT Settings** で以下を確認：
  - [ ] **JWT Expiration**: 3600 (1時間)
  - [ ] **Refresh Token Rotation**: 有効化
  - [ ] **Refresh Token Reuse Window**: 10秒

### 2.4 OAuth設定（オプション）
- [ ] Google OAuth（必要に応じて）
- [ ] Microsoft OAuth（必要に応じて）

---

## フェーズ3: 初期ユーザー作成

### 3.1 管理者ユーザー作成
- [ ] **Authentication** → **Users** → **Invite user**
- [ ] 以下を入力：
  - [ ] **Email**: `admin@asahigaoka.jp`
  - [ ] **Password**: 安全なパスワードを生成
  - [ ] **Generate new password** をチェック

### 3.2 ユーザープロフィール登録
- [ ] SQL エディタで以下を実行：
  ```sql
  INSERT INTO public.users (id, email, name, role)
  VALUES (
    '[User ID from auth.users]',
    'admin@asahigaoka.jp',
    '管理者',
    'admin'
  );
  ```
  - [ ] User ID をコピー（auth.users の users テーブルから）
  - [ ] 実行確認

### 3.3 追加ユーザー作成（editor）
- [ ] 同じ手順で editor ユーザーを2-3名作成
  - [ ] user@example.com (editor)
  - [ ] editor2@example.com (editor)

---

## フェーズ4: ストレージ設定

### 4.1 ストレージバケット作成
- [ ] **Storage** → **New bucket**
- [ ] Bucket name: `articles-images`
  - [ ] ✅ Public bucket
  - [ ] **File size limit**: 5 MB
- [ ] Create bucket

### 4.2 ストレージ RLSポリシー設定
- [ ] **Policies** タブで以下を実行：
  ```sql
  -- 全員が画像を読み取り可能
  CREATE POLICY "public_read"
  ON storage.objects FOR SELECT
  USING ( bucket_id = 'articles-images' );

  -- 認証ユーザーがアップロード可能
  CREATE POLICY "authenticated_upload"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK ( bucket_id = 'articles-images' );

  -- 管理者のみが削除可能
  CREATE POLICY "admin_delete"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'articles-images'
    AND auth.uid() IN (
      SELECT id FROM public.users WHERE role = 'admin'
    )
  );
  ```

### 4.3 バケット確認
- [ ] **Storage** で `articles-images` バケットが表示されている

---

## フェーズ5: AWS Lambda 環境設定

### 5.1 環境変数設定
- [ ] AWS Lambda 関数の環境変数に以下を設定：
  ```
  SUPABASE_URL=[Project URL]
  SUPABASE_ANON_KEY=[Anon Public Key]
  SUPABASE_SERVICE_ROLE_KEY=[Service Role Secret Key]
  SUPABASE_DB_PASSWORD=[Database Password]
  ```

### 5.2 Lambda IAM ロール
- [ ] CloudWatch Logs 権限（ログ出力）
- [ ] Secrets Manager 権限（API Key管理）
- [ ] RDS/DynamoDB 権限は **不要**（HTTP経由でアクセス）

### 5.3 Lambda レイヤー作成
- [ ] Node.js の場合：`@supabase/supabase-js`
  ```bash
  mkdir nodejs
  cd nodejs
  npm install @supabase/supabase-js
  zip -r supabase-layer.zip nodejs
  # AWS Lambda レイヤー作成
  ```

- [ ] Python の場合：`supabase`
  ```bash
  pip install supabase -t python/lib/python3.11/site-packages
  zip -r supabase-layer.zip python
  # AWS Lambda レイヤー作成
  ```

### 5.4 Lambda 関数テスト
- [ ] 以下のテスト関数を実行：
  ```python
  import json
  import os
  from supabase import create_client

  def lambda_handler(event, context):
      supabase_url = os.environ.get("SUPABASE_URL")
      supabase_key = os.environ.get("SUPABASE_ANON_KEY")
      supabase = create_client(supabase_url, supabase_key)

      response = supabase.table("users").select("*").execute()

      return {
          "statusCode": 200,
          "body": json.dumps({"users": response.data})
      }
  ```
- [ ] テスト実行結果：成功（200 OK）

---

## フェーズ6: API Gateway 設定

### 6.1 CORS設定
- [ ] API Gateway → **Enable CORS**
  - [ ] **Access-Control-Allow-Headers**: `Content-Type, Authorization`
  - [ ] **Access-Control-Allow-Origin**:
    ```
    https://asahigaoka-website.com
    https://asahigaoka-preview.netlify.app
    http://localhost:3000
    ```
  - [ ] **Access-Control-Allow-Methods**: `GET, POST, PUT, DELETE, OPTIONS`

### 6.2 リソース/メソッド作成
- [ ] `/api` リソース作成
  - [ ] `/auth` サブリソース
    - [ ] `POST /auth/login`
    - [ ] `POST /auth/signup`
    - [ ] `POST /auth/logout`
    - [ ] `POST /auth/refresh`
    - [ ] `GET /auth/me`
  - [ ] `/articles` サブリソース
    - [ ] `GET /articles` (全員)
    - [ ] `GET /articles/{id}` (全員)
    - [ ] `POST /articles` (認証ユーザー)
    - [ ] `PUT /articles/{id}` (作成者/admin)
    - [ ] `DELETE /articles/{id}` (admin)
  - [ ] `/media` サブリソース
    - [ ] `POST /media/upload`
    - [ ] `GET /media`
    - [ ] `DELETE /media/{id}`
  - [ ] `/search` サブリソース
    - [ ] `GET /search`
  - [ ] `/line` サブリソース
    - [ ] `POST /line/webhook` (LINE署名検証)
    - [ ] `POST /line/send` (admin)
  - [ ] `/users` サブリソース（admin機能）
    - [ ] `GET /users`
    - [ ] `PUT /users/{id}`
  - [ ] `/knowledge` サブリソース
    - [ ] `POST /knowledge/upload`
    - [ ] `GET /knowledge/documents`
    - [ ] `DELETE /knowledge/documents/{id}`

### 6.3 認可設定
- [ ] メソッド実行権限の設定：
  - [ ] 公開エンドポイント（認証不要）
  - [ ] 認証ユーザーのみ
  - [ ] Admin のみ

---

## フェーズ7: 管理画面フロントエンド連携

### 7.1 SDK初期化スクリプト作成
- [ ] `/admin/js/supabase.js` を作成：
  ```javascript
  import { createClient } from '@supabase/supabase-js'

  const SUPABASE_URL = 'https://[project-id].supabase.co'
  const SUPABASE_ANON_KEY = '[anon-key]'

  export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  ```

### 7.2 認証フロー実装
- [ ] `/admin/login.html` でログイン実装
  - [ ] メール/パスワード入力
  - [ ] `supabase.auth.signInWithPassword()` 呼び出し
  - [ ] JWT トークン保存（localStorage）
  - [ ] `/admin/index.html` へリダイレクト

### 7.3 API通信実装
- [ ] `/admin/js/api.js` で API通信モジュール作成：
  ```javascript
  export async function getArticles(category, limit = 20, offset = 0) {
    const response = await fetch(
      `/api/articles?category=${category}&limit=${limit}&offset=${offset}`,
      {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      }
    )
    return await response.json()
  }
  ```

---

## フェーズ8: テスト実行

### 8.1 ユーザー認証テスト
- [ ] ログイン機能テスト
  - [ ] 有効なメール/パスワードでログイン成功
  - [ ] トークンが返却される
  - [ ] 無効なパスワードでログイン失敗（401）
- [ ] トークンリフレッシュテスト
  - [ ] リフレッシュトークンで新しいアクセストークンを取得

### 8.2 記事管理テスト
- [ ] 記事作成テスト
  - [ ] editor ユーザーで記事作成成功
  - [ ] 未認証ユーザーで失敗（401）
- [ ] 記事取得テスト
  - [ ] 公開済み記事を全員が取得可能
  - [ ] 下書き記事は作成者/admin のみ表示
- [ ] 記事検索テスト
  - [ ] キーワード検索が動作

### 8.3 画像アップロードテスト
- [ ] 画像アップロード
  - [ ] 5MB以下のファイルが正常にアップロード
  - [ ] 5MB超のファイルがエラー返却（413）
  - [ ] ファイル URL が返却される
- [ ] 画像削除テスト
  - [ ] admin が画像削除可能
  - [ ] editor は削除不可（403）

### 8.4 RLS ポリシーテスト
- [ ] ユーザーが自身のデータのみ参照可能
- [ ] 他のユーザーのデータは参照不可
- [ ] Admin は全データにアクセス可能

### 8.5 LINE 連携テスト
- [ ] LINE Webhook 署名検証
- [ ] Dify API 連携確認
- [ ] 会話履歴が記録される

---

## フェーズ9: 本番環境デプロイ

### 9.1 Lambda 関数デプロイ
- [ ] 全 Lambda 関数をzipで圧縮・デプロイ
- [ ] 環境変数確認
- [ ] CloudWatch ログ確認

### 9.2 Supabase 本番設定
- [ ] バックアップ有効化
- [ ] 監視設定
- [ ] ロギング設定

### 9.3 セキュリティレビュー
- [ ] RLS ポリシーが正しく設定されている
- [ ] API Key を Secrets Manager で管理している
- [ ] HTTPS/TLS が有効化されている
- [ ] CORS が適切に制限されている

---

## フェーズ10: 運用・保守

### 10.1 バックアップ設定
- [ ] 日次自動バックアップが実行されている
- [ ] バックアップリテンション期間を設定（30日推奨）
- [ ] 復旧テストを実施

### 10.2 監視・アラート設定
- [ ] CloudWatch でメトリクス監視
  - [ ] Lambda エラー率
  - [ ] API レスポンスタイム
  - [ ] ストレージ使用量
- [ ] アラート設定
  - [ ] エラー率 > 5%
  - [ ] API 5xx エラー発生時
  - [ ] ストレージ 80% 達成時

### 10.3 ログ管理
- [ ] CloudWatch Logs で API ログ確認
- [ ] エラーログの監視
- [ ] ユーザー監査ログの記録

### 10.4 定期メンテナンス
- [ ] 月1回のセキュリティパッチ確認
- [ ] インデックス最適化
- [ ] テーブル統計情報の更新

---

## トラブルシューティング

### 問題: RLS エラー (`new row violates row level security policy`)

**確認項目**:
- [ ] ユーザーが `users` テーブルに登録されているか
- [ ] ユーザーの role が正しく設定されているか
  ```sql
  SELECT id, email, role FROM public.users WHERE id = '[user-id]';
  ```
- [ ] RLS ポリシーで `(SELECT role FROM public.users WHERE id = auth.uid())` が正しく評価されているか

### 問題: JWT トークンエラー

**確認項目**:
- [ ] トークン有効期限を確認
- [ ] リフレッシュトークンで新しいトークンを取得
- [ ] API Gateway で JWT 検証が有効化されているか

### 問題: ストレージアップロードエラー

**確認項目**:
- [ ] ストレージバケットの RLS ポリシーが設定されているか
- [ ] ファイルサイズが 5MB 以下か
- [ ] ファイルタイプが許可されているか（jpg, png, gif）

---

## 完了日時

- [ ] 全項目チェック完了日: ________________
- [ ] 本番環境デプロイ日: ________________
- [ ] 初期ユーザー受け入れテスト完了日: ________________

**署名**: ________________ (実施者)

**日付**: ________________

---

**最終更新**: 2025年11月13日
