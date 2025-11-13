# Supabase セットアップガイド

## 1. Supabaseプロジェクト初期化

### 1.1 プロジェクト作成手順

1. https://supabase.com にアクセス
2. **New Project** をクリック
3. 以下の設定で作成：
   - **Organization**: 新規作成または既存
   - **Project Name**: `asahigaoka`
   - **Database Password**: **安全なパスワードを記録** (後で使用)
   - **Region**: `Tokyo (ap-northeast-1)`
   - **Pricing Plan**: `Free` プラン

4. プロジェクト作成完了後、**以下の情報をコピーして安全に保管**：

```
Supabase Project Information
=============================
Project ID:           [コピー]
Project URL:          https://[project-id].supabase.co
Anon Public Key:      [コピー] (SUPABASE_ANON_KEY)
Service Role Secret:  [コピー] (SUPABASE_SERVICE_ROLE_KEY)
Database Password:    [入力したパスワード]
Database Host:        [project-id].db.supabase.co
Database User:        postgres
```

### 1.2 SQL スキーマ適用

Supabase ダッシュボード → **SQL Editor** → **New Query** から以下を実行：

1. `supabase-schema.sql` の内容をすべてコピー・実行
2. `supabase-rls-policies.sql` の内容をすべてコピー・実行

**確認**：
```sql
-- SQL Editor で実行してテーブル確認
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'public';
```

結果に以下のテーブルが表示されることを確認：
- users
- articles
- media
- ai_chat_history
- file_change_history
- knowledge_documents
- line_conversations

---

## 2. Supabase Auth 設定

### 2.1 メール認証の有効化

Supabase ダッシュボード → **Authentication** → **Providers**

1. **Email** を有効化（デフォルトで有効）
2. **Email Confirmation** の設定：
   - ✅ Enable email confirmations
   - **Type**: `Double opt-in` (推奨)
   - **Email templates**: カスタマイズ可能 (日本語化推奨)

### 2.2 SMTP設定（本番環境用）

**Settings** → **Email** タブ：

- **SMTP Host**: 本番メールサーバーの設定
- **SMTP Port**: 587
- **SMTP User**: メールアドレス
- **SMTP Password**: パスワード

※ 無料プランではSupabase提供のメールを使用

### 2.3 URL設定

**Settings** → **URL Configuration**：

```
Site URL:             https://asahigaoka-website.com
Redirect URLs (comma separated):
  https://asahigaoka-website.com/admin
  https://asahigaoka-website.com/admin/login
  http://localhost:3000/admin
  http://localhost:3000/admin/login
```

### 2.4 JWT設定

**Settings** → **JWT Settings**：

- **JWT Secret**: Supabaseが自動生成（変更不可）
- **JWT Expiration**: 3600 (1時間推奨)
- **Refresh Token Rotation**: 有効化 (推奨)
- **Refresh Token Reuse Window**: 10秒

---

## 3. ユーザー管理（初期設定）

### 3.1 最初の管理者ユーザー作成

Supabase ダッシュボード → **Authentication** → **Users**：

1. **Invite user** をクリック
2. 以下を入力：
   - **Email**: admin@asahigaoka.jp
   - **Password**: 初期パスワード

3. ユーザー作成後、ユーザーのセッションを開く
4. Metadata タブで以下を追加：
   ```json
   {
     "role": "admin"
   }
   ```

### 3.2 プロフィール情報の登録

作成したユーザーの `users` テーブルレコードに以下を登録：

```sql
INSERT INTO public.users (id, email, name, role)
VALUES (
  '[User ID from auth.users]',
  'admin@asahigaoka.jp',
  '管理者',
  'admin'
);
```

---

## 4. ストレージ設定（画像アップロード）

### 4.1 Supabase Storage バケット作成

Supabase ダッシュボード → **Storage** → **New bucket**：

1. **Bucket name**: `articles-images`
   - **Public bucket**: ✅ (画像は公開)
   - **File size limit**: 5 MB

2. **Create bucket**

### 4.2 ストレージ RLSポリシー

**Policies** タブで以下を設定：

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
USING ( bucket_id = 'articles-images' );
```

---

## 5. Lambda 連携設定

### 5.1 環境変数設定

AWS Lambda の環境変数に以下を設定：

```
SUPABASE_URL=https://[project-id].supabase.co
SUPABASE_ANON_KEY=[anon public key]
SUPABASE_SERVICE_ROLE_KEY=[service role secret key]
SUPABASE_DB_PASSWORD=[database password]
```

### 5.2 Lambda 関数での Supabase 初期化

**Node.js 例**:

```javascript
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseServiceRole);

exports.handler = async (event) => {
  try {
    // テスト: users テーブル取得
    const { data, error } = await supabase
      .from('users')
      .select('*');

    if (error) {
      console.error('Supabase error:', error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: error.message })
      };
    }

    return {
      statusCode: 200,
      body: JSON.stringify({ users: data })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message })
    };
  }
};
```

**Python 例**:

```python
import json
import os
from supabase import create_client, Client

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")

supabase: Client = create_client(supabase_url, supabase_key)

def lambda_handler(event, context):
    try:
        # テスト: users テーブル取得
        response = supabase.table("users").select("*").execute()

        return {
            "statusCode": 200,
            "body": json.dumps({"users": response.data})
        }
    except Exception as error:
        print(f"Error: {error}")
        return {
            "statusCode": 500,
            "body": json.dumps({"error": str(error)})
        }
```

### 5.3 Lambda 実行ロール権限

IAM ロールに以下の権限は **不要**（HTTP経由でアクセス）：
- RDS関連の権限
- DynamoDB関連の権限

必要な権限：
- CloudWatch Logs (ログ出力)
- Secrets Manager (API Key保管)

---

## 6. API Gateway 連携

### 6.1 API エンドポイント例

**POST /api/auth/login**:

```python
import os
from supabase import create_client

supabase_url = os.environ.get("SUPABASE_URL")
supabase_key = os.environ.get("SUPABASE_ANON_KEY")
supabase = create_client(supabase_url, supabase_key)

def lambda_handler(event, context):
    body = json.loads(event['body'])
    email = body.get('email')
    password = body.get('password')

    try:
        # Supabase Auth でログイン
        response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        user = response.user
        session = response.session

        # ユーザー情報取得
        user_profile = supabase.table("users").select("*").eq("id", user.id).execute()

        return {
            "statusCode": 200,
            "body": json.dumps({
                "token": session.access_token,
                "refresh_token": session.refresh_token,
                "user": {
                    "id": user.id,
                    "email": user.email,
                    "name": user_profile.data[0].get('name') if user_profile.data else '',
                    "role": user_profile.data[0].get('role') if user_profile.data else 'editor'
                },
                "expires_in": 3600
            })
        }
    except Exception as error:
        return {
            "statusCode": 401,
            "body": json.dumps({"error": str(error)})
        }
```

**GET /api/articles** (認証ユーザーのみ):

```python
def lambda_handler(event, context):
    token = event['headers'].get('Authorization', '').replace('Bearer ', '')

    try:
        # JWT検証
        supabase_service = create_client(
            supabase_url,
            os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        )

        user = supabase_service.auth.get_user(token)

        # 記事取得
        response = supabase_service.table("articles")\
            .select("*")\
            .eq("status", "published")\
            .order("published_at", desc=True)\
            .limit(20)\
            .execute()

        return {
            "statusCode": 200,
            "body": json.dumps({
                "articles": response.data,
                "total": len(response.data)
            })
        }
    except Exception as error:
        return {
            "statusCode": 401,
            "body": json.dumps({"error": "Unauthorized"})
        }
```

### 6.2 CORS設定

API Gateway → **Enable CORS**：

```
Access-Control-Allow-Headers: Content-Type, Authorization
Access-Control-Allow-Origin:
  https://asahigaoka-website.com
  https://asahigaoka-preview.netlify.app
  http://localhost:3000
```

---

## 7. 本番環境へのデプロイ

### 7.1 AWS Lambda 関数の更新

```bash
# Lambda関数をzipで圧縮
cd lambda/functions
pip install -r requirements.txt -t .
zip -r function.zip .

# AWSにアップロード
aws lambda update-function-code \
  --function-name articles-crud \
  --zip-file fileb://function.zip \
  --region ap-northeast-1
```

### 7.2 環境変数の確認

```bash
aws lambda update-function-configuration \
  --function-name articles-crud \
  --environment Variables='{
    SUPABASE_URL=https://[project-id].supabase.co,
    SUPABASE_SERVICE_ROLE_KEY=[key],
    SUPABASE_ANON_KEY=[key]
  }' \
  --region ap-northeast-1
```

### 7.3 テスト実行

```bash
aws lambda invoke \
  --function-name articles-crud \
  --payload '{}' \
  response.json \
  --region ap-northeast-1

cat response.json
```

---

## 8. トラブルシューティング

### 8.1 RLS エラー (`new row violates row level security policy`)

**原因**: ユーザーがテーブルに権限がない

**解決**:
1. ユーザーが `users` テーブルに登録されているか確認
2. RLS ポリシーで `(SELECT role FROM public.users WHERE id = auth.uid())` が正しく評価されているか確認
3. Supabase ダッシュボード → **SQL Editor** で以下を実行：

```sql
SELECT id, email, role FROM public.users WHERE id = '[user-id]';
```

### 8.2 JWT トークンエラー

**原因**: トークンが有効期限切れ

**解決**:
1. トークン有効期限を確認
2. リフレッシュトークンで新しいトークンを取得

```python
response = supabase.auth.refresh_session(refresh_token)
new_access_token = response.session.access_token
```

### 8.3 ストレージアップロードエラー

**原因**: RLS ポリシーが未設定

**解決**: ストレージバケットの **Policies** タブで RLS ポリシーを確認・修正

---

## 9. セキュリティチェックリスト

- [ ] Supabase プロジェクトで RLS が有効化されている
- [ ] Service Role Secret Key を Secrets Manager で管理している
- [ ] API Gateway で CORS が正しく設定されている
- [ ] Lambda 環境変数が暗号化されている
- [ ] Supabase Auth のメール確認が有効化されている
- [ ] データベース接続がSSL/TLSで暗号化されている
- [ ] 定期的なバックアップが設定されている

---

**最終更新**: 2025年11月13日
