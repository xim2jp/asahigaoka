# 東京都練馬区旭丘一丁目町会 ホームページシステム 仕様書

## 1. システムアーキテクチャ

### 1.1 全体構成

```
┌─────────────────────────────────────────────────────────────┐
│                       ユーザー層                             │
├──────────────┬────────────────┬────────────────┬───────────┤
│  公開Web     │  管理画面SPA   │ LINE公式       │ X API     │
│  サイト      │ (Vanilla JS)   │ アカウント     │           │
│              │ + ファイル管理 │ (未実装)       │ (未実装)  │
└──────────────┴────────────────┴────────────────┴───────────┘
       ↓               ↓                  ↓           ↓
┌─────────────────────────────────────────────────────────────┐
│            Supabase JS Client SDK                            │
│  - 直接 Supabase API を呼び出し                             │
│  - localStorage でセッション管理                            │
│  - REST API形式で通信                                      │
└─────────────────────────────────────────────────────────────┘
       ↓               ↓            ↓
┌──────────────────────────────────────────────────────────────┐
│          Supabase (PostgreSQL + Storage)                     │
│  - Database: articles, users, attachments テーブル          │
│  - Storage: attachments, featured-images バケット           │
│  - RLS ポリシー設定で行レベルセキュリティ実装               │
└──────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│    本番環境デプロイ                                         │
├──────────────────────────┬────────────────────────────────┤
│  Static Files:           │  S3 + CloudFront               │
│  HTML, CSS, JS           │  - CloudFront: CDN キャッシュ   │
│                          │  - SSL/TLS 暗号化              │
└──────────────────────────┴────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│    外部サービス連携（今後実装）                            │
├──────────────────┬──────────────────┬────────────────────┤
│  LINE Messaging  │  X API v2        │  Claude API        │
│  API (未実装)    │  (未実装)        │  (未実装)          │
│                  │                  │                    │
│  Dify RAG        │  GitHub API      │  AWS Lambda        │
│  (未実装)        │  (未実装)        │  (未実装)          │
└──────────────────┴──────────────────┴────────────────────┘
```

### 1.2 技術スタック

| レイヤー | 技術 | バージョン/備考 |
|---------|------|----------------|
| **フロントエンド** |
| 公開Webサイト | HTML5 + CSS3 + Vanilla JS | `/` ディレクトリ |
| 管理画面 SPA | HTML5 + CSS3 + Vanilla JS | `/admin` ディレクトリ |
| JS フレームワーク | Supabase JS Client | バージョン 2.x |
| セッション管理 | localStorage | ブラウザ内保存 |
| **バックエンド** |
| データベース層 | Supabase (PostgreSQL) | リレーショナルDB、RLS対応 |
| API層 | Supabase API | REST API自動生成 |
| ストレージ層 | Supabase Storage | S3互換インターフェース |
| 認証 | カスタム users テーブル | Base64ハッシュ（簡易実装） |
| **データベース** |
| RDB | PostgreSQL (Supabase) | 16.x |
| **ストレージ** |
| ファイル保存 | Supabase Storage | バケット: attachments, featured-images |
| 本番静的ホスティング | AWS S3 + CloudFront | 静的HTML/CSS/JS |
| **AI/LLM** |
| LLM API | Claude API (Anthropic) | Claude 3.5 Sonnet（今後実装） |
| AI Agent | Cursor Agent | Node.js ベース、ECS で実行（今後実装） |
| RAG Platform | Dify | ノーコードAIプラットフォーム（今後実装） |
| Vector DB | Dify 内蔵 Vector DB | Dify で自動管理（今後実装） |
| **CI/CD** |
| Git ホスティング | GitHub | Private Repository |
| CI/CD | GitHub Actions | deploy.yml - S3へのデプロイ |
| プレビュー | Netlify | gh-pages ブランチ連携（今後実装） |
| **外部連携** |
| LINE | LINE Messaging API | Official Account（今後実装） |
| X | X API v2 | 投稿自動化（今後実装） |

---

## 2. API 仕様 (Supabase JS Client SDK)

フロントエンドから Supabase を直接操作。Lambda 関数は不要。

### 2.1 認証処理

#### ログイン実装例
```javascript
// admin/js/supabase-client.js
async signIn(email, password) {
  const passwordHash = btoa(password); // Base64 ハッシュ化

  const { data, error } = await this.client
    .from('users')
    .select('*')
    .eq('email', email)
    .eq('password_hash', passwordHash)
    .eq('is_active', true)
    .single();

  if (error || !data) {
    return { success: false, error: '認証失敗' };
  }

  // localStorage に保存
  localStorage.setItem('asahigaoka_user', JSON.stringify({
    id: data.id,
    name: data.name,
    email: data.email,
    role: data.role
  }));

  return { success: true, data };
}

// ログアウト
async signOut() {
  localStorage.removeItem('asahigaoka_user');
  return { success: true };
}

// 現在のユーザー取得
getCurrentUser() {
  const user = localStorage.getItem('asahigaoka_user');
  return user ? JSON.parse(user) : null;
}
```

### 2.2 記事 CRUD 操作

#### 記事一覧取得
```javascript
async getArticles(category = null, limit = 20, offset = 0) {
  let query = this.client
    .from('articles')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (category) {
    query = query.eq('category', category);
  }

  const { data, count, error } = await query;

  return {
    success: !error,
    articles: data,
    total: count,
    error: error?.message
  };
}
```

#### 記事詳細取得
```javascript
async getArticleById(articleId) {
  const { data, error } = await this.client
    .from('articles')
    .select('*')
    .eq('id', articleId)
    .single();

  return { success: !error, data, error: error?.message };
}
```

#### 記事作成
```javascript
async createArticle(articleData) {
  const { data, error } = await this.client
    .from('articles')
    .insert([articleData])
    .select()
    .single();

  return { success: !error, data, error: error?.message };
}
```

#### 記事更新
```javascript
async updateArticle(articleId, articleData) {
  const { data, error } = await this.client
    .from('articles')
    .update(articleData)
    .eq('id', articleId)
    .select()
    .single();

  return { success: !error, data, error: error?.message };
}
```

#### 記事削除
```javascript
async deleteArticle(articleId) {
  const { error } = await this.client
    .from('articles')
    .delete()
    .eq('id', articleId);

  return { success: !error, error: error?.message };
}
```

### 2.3 ファイル添付機能

#### ファイルアップロード
```javascript
async uploadAttachment(file, bucketName = 'attachments') {
  // 日本語ファイル名対応: タイムスタンプ + ランダム文字列
  const timestamp = Date.now();
  const random = Math.random().toString(36).substr(2, 9);
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
  const sanitizedFileName = `${timestamp}-${random}${ext}`;

  // Supabase Storage にアップロード
  const { data, error: uploadError } = await this.client
    .storage
    .from(bucketName)
    .upload(sanitizedFileName, file);

  if (uploadError) {
    return { success: false, error: uploadError.message };
  }

  // DB に記録（元のファイル名を保存）
  const { data: dbData, error: dbError } = await this.client
    .from('attachments')
    .insert([{
      file_name: file.name,              // 元のファイル名（日本語対応）
      file_type: this.getFileType(file),
      mime_type: file.type,
      storage_path: data.path,           // 保存先パス
      file_size: file.size,
      uploaded_by: this.getCurrentUserId()
    }])
    .select()
    .single();

  return {
    success: !dbError,
    data: dbData,
    error: dbError?.message
  };
}
```

**対応ファイル形式**:
- 画像: jpg, jpeg, png, gif, webp → `file_type: 'image'`
- 文書: pdf, doc, docx, xls, xlsx, ppt, pptx → `file_type: 'document'`
- テキスト: txt, md → `file_type: 'text'`
- アーカイブ: zip → `file_type: 'archive'`

#### 記事の添付ファイル取得
```javascript
async getArticleAttachments(articleId) {
  const { data, error } = await this.client
    .from('attachments')
    .select('*,uploaded_by:users(name)')
    .eq('article_id', articleId)
    .order('created_at', { ascending: false });

  return { success: !error, data, error: error?.message };
}
```

#### ファイル削除
```javascript
async deleteAttachment(attachmentId, storagePath) {
  // Storage から削除
  const { error: storageError } = await this.client
    .storage
    .from('attachments')
    .remove([storagePath]);

  if (storageError) {
    return { success: false, error: storageError.message };
  }

  // DB から削除
  const { error: dbError } = await this.client
    .from('attachments')
    .delete()
    .eq('id', attachmentId);

  return { success: !dbError, error: dbError?.message };
}
```

#### 添付ファイルを記事にリンク
```javascript
async linkAttachmentToArticle(attachmentId, articleId) {
  const { data, error } = await this.client
    .from('attachments')
    .update({ article_id: articleId })
    .eq('id', attachmentId);

  return { success: !error, error: error?.message };
}
```

### 2.4 検索 API

#### `GET /api/search`
- **説明**: 全文検索
- **Query Parameters**:
  - `q`: 検索キーワード
  - `category`: カテゴリフィルタ
  - `limit`: 取得件数

### 2.5 LINE 連携 API

#### `POST /api/line/send`
- **説明**: LINE メッセージ配信
- **Authorization**: Bearer Token 必須
- **Request**:
  ```json
  {
    "article_id": "article_123",
    "target_group": "all"
  }
  ```

### 2.6 X 連携 API

#### `POST /api/x/post`
- **説明**: X（Twitter）投稿
- **Authorization**: Bearer Token 必須
- **Request**:
  ```json
  {
    "article_id": "article_123",
    "schedule_time": "2025-11-13T15:00:00Z"
  }
  ```

### 2.7 AI アシスタント API

#### `POST /api/ai/chat`
- **説明**: AI チャットメッセージ送信（ECS タスク起動）
- **Authorization**: Bearer Token 必須
- **Request**:
  ```json
  {
    "session_id": "session_12345",
    "message": "TOPページの背景色を青に変更"
  }
  ```
- **Response**:
  ```json
  {
    "session_id": "session_12345",
    "status": "processing",
    "ecs_task_arn": "arn:aws:ecs:...",
    "message": "ECS タスクで処理中..."
  }
  ```

#### `GET /api/ai/chat/history`
- **説明**: チャット履歴取得
- **Authorization**: Bearer Token 必須

#### `POST /api/ai/changes/approve`
- **説明**: ファイル変更提案を承認（main にマージ）
- **Authorization**: Bearer Token 必須（管理者のみ）
- **Request**:
  ```json
  {
    "change_id": "change_abc123",
    "approved": true
  }
  ```

#### `POST /api/ai/changes/reject`
- **説明**: ファイル変更提案をキャンセル
- **Authorization**: Bearer Token 必須

#### `GET /api/ai/changes/history`
- **説明**: ファイル変更履歴取得
- **Authorization**: Bearer Token 必須

### 2.8 知識ベース管理 API（Dify 連携）

#### `POST /api/knowledge/upload`
- **説明**: 資料アップロード → テキスト抽出 → QA変換 → Dify Knowledge API 登録
- **Authorization**: Bearer Token 必須
- **Content-Type**: multipart/form-data
- **Request**:
  - `file`: PDF/Word/テキストファイル
  - `dataset_id`: Dify Dataset ID（オプション）
- **Response**: 202 Accepted
  ```json
  {
    "document_id": "doc_abc123",
    "status": "processing"
  }
  ```

#### `GET /api/knowledge/documents`
- **説明**: 登録済み資料一覧取得
- **Authorization**: Bearer Token 必須
- **Query**: `limit`, `offset`

#### `DELETE /api/knowledge/documents/{document_id}`
- **説明**: 資料削除（Dify + S3 + DB）
- **Authorization**: Bearer Token 必須

### 2.9 LINE Webhook API

#### `POST /api/line/webhook`
- **説明**: LINE Platform からのメッセージ受信
- **Authorization**: X-Line-Signature ヘッダー検証
- **処理フロー**:
  1. LINE 署名検証
  2. Dify API 呼び出し（Chat Completion）
  3. Dify 応答を受信
  4. LINE Reply API で返信
  5. 会話履歴を DB に記録

---

## 3. データベース仕様

### 3.1 記事テーブル（articles）

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| id | String | ○ | UUID |
| title | String | ○ | 記事タイトル |
| content | Text | ○ | 本文（Markdown or HTML） |
| excerpt | String | ○ | 抜粋（SNS配信用） |
| category | String | ○ | カテゴリ（enum） |
| tags | Array<String> | × | タグ配列 |
| featured_image_url | String | × | アイキャッチ画像URL |
| author | String | ○ | 投稿者名 |
| published_at | Timestamp | ○ | 公開日時 |
| created_at | Timestamp | ○ | 作成日時 |
| updated_at | Timestamp | ○ | 更新日時 |
| status | String | ○ | published / draft |
| line_published | Boolean | ○ | LINE配信済みフラグ |
| x_published | Boolean | ○ | X投稿済みフラグ |

**カテゴリ enum**: `notice`, `event`, `disaster_safety`, `child_support`, `shopping_info`, `activity_report`

### 3.2 ユーザーテーブル（users）

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| id | String | ○ | UUID |
| email | String | ○ | メールアドレス（ユニーク） |
| password_hash | String | ○ | ハッシュ化パスワード |
| name | String | ○ | ユーザー名 |
| role | String | ○ | admin / editor |
| is_active | Boolean | ○ | ユーザーの有効・無効状態（デフォルト: true） |
| last_login_at | Timestamp | × | 最後のログイン時刻 |
| created_at | Timestamp | ○ | 作成日時 |
| updated_at | Timestamp | ○ | 更新日時 |

### 3.3 AI チャット履歴テーブル（ai_chat_history）

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| id | String | ○ | UUID |
| session_id | String | ○ | セッションID（複数メッセージをグループ化） |
| user_id | String | ○ | ユーザーID |
| message_type | String | ○ | user / assistant |
| content | Text | ○ | メッセージ内容 |
| created_at | Timestamp | ○ | 送信時刻 |

### 3.4 ファイル変更履歴テーブル（file_change_history）

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| id | String | ○ | UUID |
| user_id | String | ○ | 承認したユーザーID |
| file_path | String | ○ | 変更対象ファイルパス |
| change_type | String | ○ | create / update / delete |
| old_content | Text | × | 変更前の内容 |
| new_content | Text | ○ | 変更後の内容 |
| ai_session_id | String | × | 対応するAIチャットセッションID |
| pr_number | Integer | × | GitHub PR番号 |
| status | String | ○ | pending / approved / rejected |
| created_at | Timestamp | ○ | 変更リクエスト時刻 |
| approved_at | Timestamp | × | 承認時刻 |

### 3.5 知識ベースドキュメント管理テーブル（knowledge_documents）

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| id | String | ○ | UUID |
| file_name | String | ○ | ファイル名 |
| file_type | String | ○ | pdf / docx / txt |
| file_url | String | ○ | S3 保存先 URL |
| dify_document_id | String | ○ | Dify の Document ID |
| dify_dataset_id | String | ○ | Dify の Dataset ID |
| status | String | ○ | processing / completed / failed |
| uploaded_by | String | ○ | アップロードしたユーザーID |
| qa_count | Integer | × | 生成された QA ペア数 |
| created_at | Timestamp | ○ | アップロード日時 |
| indexed_at | Timestamp | × | Dify 登録完了日時 |

### 3.6 LINE会話履歴テーブル（line_conversations）

| フィールド | 型 | 必須 | 説明 |
|-----------|---|------|------|
| id | String | ○ | UUID |
| line_user_id | String | ○ | LINE ユーザーID（匿名化） |
| message_type | String | ○ | user / assistant |
| content | Text | ○ | メッセージ内容 |
| dify_conversation_id | String | × | Dify の Conversation ID |
| response_time_ms | Integer | × | 応答時間（ミリ秒） |
| is_fallback | Boolean | ○ | フォールバック応答フラグ |
| created_at | Timestamp | ○ | 送信時刻 |

---

## 4. AI アシスタント実装仕様

### 4.1 フロー概要

```
ユーザープロンプト入力
  ↓
Lambda: ECS タスク起動
  ↓
ECS (Cursor Agent): リポジトリクローン、コード修正、PR作成
  ↓
GitHub: feature → gh-pages 自動マージ
  ↓
Netlify: プレビューサイト自動デプロイ
  ↓
管理画面: ユーザーが Netlify で確認
  ↓
ユーザーが「適用」ボタンをクリック
  ↓
Lambda: main ブランチへマージ
  ↓
GitHub Actions: deploy.yml 実行
  ↓
S3 + CloudFront: 本番デプロイ完了
```

### 4.2 Lambda 関数仕様

#### Lambda関数: `ai-chat-handler`
- **トリガー**: API Gateway `/api/ai/chat` POST
- **ランタイム**: Python 3.11 or Node.js 18.x
- **タイムアウト**: 30秒
- **環境変数**:
  - `ECS_CLUSTER_NAME`: ECS クラスター名
  - `ECS_TASK_DEFINITION`: Cursor Agent タスク定義ARN
  - `GITHUB_TOKEN`: GitHub Personal Access Token (Secrets Manager)
  - `DATABASE_URL`: データベース接続URL
- **IAM Role**:
  - `ecs:RunTask`
  - `secretsmanager:GetSecretValue`
  - `dynamodb:PutItem` or Firestore/Supabase アクセス権限

**処理フロー**:
1. ユーザープロンプトを受け取る
2. データベースに AI セッションを記録
3. ECS タスクを起動（環境変数でプロンプトを渡す）
4. タスク ARN を返却

#### Lambda関数: `ai-merge-to-main`
- **トリガー**: API Gateway `/api/ai/changes/approve` POST
- **ランタイム**: Python 3.11 or Node.js 18.x
- **タイムアウト**: 60秒
- **環境変数**:
  - `GITHUB_TOKEN`: GitHub Personal Access Token (Secrets Manager)
  - `GITHUB_REPO`: リポジトリ名（例: `org/repo`）
- **IAM Role**:
  - `secretsmanager:GetSecretValue`
  - データベースアクセス権限

**処理フロー**:
1. ユーザーの権限チェック（admin のみ）
2. change_id から PR番号を取得
3. GitHub API で main ブランチへマージ
4. データベースに承認履歴を記録

### 4.3 ECS タスク仕様（Cursor Agent）

#### タスク定義: `cursor-agent-task`
- **起動タイプ**: Fargate
- **CPU**: 1 vCPU
- **メモリ**: 2 GB
- **コンテナイメージ**: カスタム Docker イメージ
  - ベースイメージ: `node:18-alpine`
  - インストール: Cursor Agent, Git, GitHub CLI (`gh`)
- **環境変数**:
  - `USER_PROMPT`: Lambda から渡されるユーザープロンプト
  - `GITHUB_TOKEN`: GitHub 認証トークン
  - `AI_SESSION_ID`: セッションID
  - `REPO_URL`: GitHub リポジトリURL
- **ネットワーク**: VPC内で実行（NAT Gateway経由で外部アクセス）

#### Dockerfile 例
```dockerfile
FROM node:18-alpine

RUN apk add --no-cache git curl

# GitHub CLI インストール
RUN curl -fsSL https://cli.github.com/packages/rpm/gh-cli.repo > /etc/apk/repositories.d/github-cli.repo
RUN apk add --no-cache gh

# Cursor Agent インストール（仮）
RUN npm install -g cursor-agent

WORKDIR /workspace

COPY entrypoint.sh /entrypoint.sh
RUN chmod +x /entrypoint.sh

ENTRYPOINT ["/entrypoint.sh"]
```

#### entrypoint.sh 例
```bash
#!/bin/bash
set -e

# 環境変数チェック
: ${USER_PROMPT:?}
: ${GITHUB_TOKEN:?}
: ${REPO_URL:?}

# GitHub 認証
echo "$GITHUB_TOKEN" | gh auth login --with-token

# リポジトリクローン
git clone "$REPO_URL" repo
cd repo

# 新しいブランチ作成
BRANCH_NAME="feature/ai-change-$(date +%s)"
git checkout -b "$BRANCH_NAME"

# Cursor Agent 実行（プロンプトに従ってコード修正）
cursor-agent --prompt "$USER_PROMPT" --output ./

# 変更をコミット
git add .
git commit -m "AI: $USER_PROMPT"

# プッシュ
git push origin "$BRANCH_NAME"

# PR 作成（gh-pages へのマージ対象）
gh pr create --base gh-pages --head "$BRANCH_NAME" \
  --title "AI修正: $USER_PROMPT" \
  --body "AI による自動修正です。Netlify でプレビューを確認してください。"

echo "PR作成完了"
```

### 4.4 ブランチ戦略

| ブランチ | 用途 | デプロイ先 |
|---------|------|-----------|
| `main` | 本番環境 | AWS S3 + CloudFront |
| `gh-pages` | プレビュー環境 | Netlify |
| `feature/ai-change-*` | AI 修正用（一時的） | - |

**マージフロー**:
1. Cursor Agent が `feature/ai-change-{timestamp}` ブランチ作成
2. PR 作成時に `gh-pages` へ自動マージ（GitHub Actions or Lambda）
3. ユーザーが「適用」で `main` へマージ

### 4.5 GitHub Actions 仕様

#### `.github/workflows/deploy.yml`
```yaml
name: Deploy to S3

on:
  push:
    branches:
      - main

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3

      - name: Configure AWS credentials
        uses: aws-actions/configure-aws-credentials@v2
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ap-northeast-1

      - name: Deploy to S3
        run: |
          aws s3 sync . s3://asahigaoka-website \
            --exclude ".git/*" \
            --exclude ".github/*" \
            --delete

      - name: CloudFront Cache Invalidation
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

#### `.github/workflows/auto-merge-to-gh-pages.yml`
```yaml
name: Auto Merge to gh-pages

on:
  pull_request:
    types: [opened]
    branches:
      - gh-pages

jobs:
  auto-merge:
    runs-on: ubuntu-latest
    if: startsWith(github.head_ref, 'feature/ai-change-')
    steps:
      - uses: actions/checkout@v3

      - name: Merge PR
        run: |
          gh pr merge ${{ github.event.pull_request.number }} \
            --merge --auto
        env:
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

---

## 5. 認証・認可仕様

### 5.1 認証方式
- **JWT（JSON Web Token）**
- トークン有効期限: 1時間
- リフレッシュトークン: 7日間

### 5.2 パスワードハッシュ
- **アルゴリズム**: bcrypt
- **ソルトラウンド**: 12

### 5.3 ロール定義

| ロール | 権限 |
|-------|------|
| `admin` | 全操作可能（記事作成/編集/削除、AI承認、ユーザー管理） |
| `editor` | 記事作成/編集、AI使用可（承認は不可） |

### 5.4 API エンドポイントの認可

| エンドポイント | 権限 |
|--------------|------|
| `POST /api/articles` | admin, editor |
| `PUT /api/articles/{id}` | admin, editor |
| `DELETE /api/articles/{id}` | admin のみ |
| `POST /api/ai/changes/approve` | admin のみ |
| `POST /api/ai/chat` | admin, editor |

---

## 6. 外部サービス連携仕様

### 6.1 LINE Messaging API

- **エンドポイント**: `https://api.line.me/v2/bot/message/push`
- **認証**: Channel Access Token
- **メッセージ形式**: Flex Message（カスタムレイアウト）

**配信例**:
```json
{
  "to": "U1234567890abcdef",
  "messages": [
    {
      "type": "text",
      "text": "【新着記事】\nタイトル: ...\n詳細: https://..."
    }
  ]
}
```

### 6.2 X (Twitter) API v2

- **エンドポイント**: `https://api.twitter.com/2/tweets`
- **認証**: OAuth 2.0 Bearer Token
- **文字数制限**: 280文字

**投稿例**:
```json
{
  "text": "【イベント情報】町会の餅つき大会を開催します！\n詳細: https://... #旭丘一丁目"
}
```

### 6.3 Claude API

- **エンドポイント**: `https://api.anthropic.com/v1/messages`
- **モデル**: `claude-3-5-sonnet-20250219`
- **認証**: API Key (x-api-key ヘッダー)
- **用途**:
  - Cursor Agent がプロンプト処理時に呼び出し
  - 知識ベース管理でのQA変換時に呼び出し

### 6.4 Dify（RAG Platform）

#### 6.4.1 概要
- **サービス**: Dify（https://dify.ai/）
- **用途**: LINE AI 自動応答、知識ベース管理
- **認証**: API Key（Authorization: Bearer ヘッダー）

#### 6.4.2 Knowledge API

**ドキュメント作成**:
```
POST https://api.dify.ai/v1/datasets/{dataset_id}/document/create_by_text
Authorization: Bearer {DIFY_API_KEY}
Content-Type: application/json

Request:
{
  "name": "町会規約",
  "text": "QA形式のテキスト",
  "indexing_technique": "high_quality",
  "process_rule": {
    "mode": "automatic"
  }
}

Response:
{
  "document": {
    "id": "doc_123",
    "name": "町会規約",
    "data_source_type": "upload_file"
  },
  "batch": "batch_456"
}
```

**ドキュメント削除**:
```
DELETE https://api.dify.ai/v1/datasets/{dataset_id}/documents/{document_id}
Authorization: Bearer {DIFY_API_KEY}
```

#### 6.4.3 Chat Completion API

**会話実行**:
```
POST https://api.dify.ai/v1/chat-messages
Authorization: Bearer {DIFY_API_KEY}
Content-Type: application/json

Request:
{
  "inputs": {},
  "query": "次のイベントはいつですか？",
  "response_mode": "blocking",
  "conversation_id": "",
  "user": "line_user_U1234567890abcdef",
  "files": []
}

Response:
{
  "event": "message",
  "message_id": "msg_789",
  "conversation_id": "conv_012",
  "mode": "chat",
  "answer": "次回の餅つき大会は12月15日（日）10:00から開催予定です。",
  "metadata": {
    "usage": {
      "prompt_tokens": 100,
      "completion_tokens": 50,
      "total_tokens": 150
    },
    "retriever_resources": [
      {
        "dataset_id": "dataset_abc",
        "document_id": "doc_123",
        "segment_id": "segment_456",
        "score": 0.95,
        "content": "..."
      }
    ]
  }
}
```

#### 6.4.4 LINE Webhook → Dify 連携フロー

```
1. LINE Platform → Lambda (POST /api/line/webhook)
   ↓
2. Lambda: LINE 署名検証
   ↓
3. Lambda → Dify API (POST /v1/chat-messages)
   Request:
   {
     "query": "ユーザーからの質問",
     "user": "line_user_id",
     "conversation_id": "(前回の会話ID、初回は空)"
   }
   ↓
4. Dify: Knowledge Base 検索 + LLM 応答生成
   ↓
5. Lambda ← Dify API
   Response:
   {
     "answer": "AI の回答",
     "conversation_id": "conv_123"
   }
   ↓
6. Lambda → LINE Reply API
   {
     "replyToken": "xxx",
     "messages": [
       {
         "type": "text",
         "text": "AI の回答"
       }
     ]
   }
   ↓
7. Lambda: 会話履歴を DB に記録
   - line_user_id
   - message_type: user / assistant
   - content
   - dify_conversation_id
   - response_time_ms
```

#### 6.4.5 知識ベース管理フロー

```
1. 管理画面: ファイルアップロード
   ↓
2. Lambda (POST /api/knowledge/upload)
   ↓
3. Lambda: ファイルを S3 に保存
   ↓
4. Lambda: テキスト抽出
   - PDF: PyPDF2 / pdfplumber
   - Word: python-docx
   - テキスト: 直接読み込み
   ↓
5. Lambda → Claude API
   Prompt: "以下のテキストから、想定される質問と回答をQA形式で抽出してください"
   ↓
6. Claude API → Lambda
   Response: QA形式のテキスト
   ↓
7. Lambda → Dify Knowledge API
   (POST /v1/datasets/{dataset_id}/document/create_by_text)
   ↓
8. Dify: ベクトル化 + インデックス作成
   ↓
9. Lambda: DB に記録
   - document_id
   - dify_document_id
   - status: completed
   - qa_count
```

---

## 7. セキュリティ仕様

### 7.1 通信暗号化
- すべての API 通信は HTTPS/TLS 1.2以上
- CloudFront で SSL/TLS 証明書管理

### 7.2 認証情報管理
- GitHub Token, API Keys: AWS Secrets Manager で管理
- Lambda 実行時に環境変数として注入

### 7.3 CORS 設定
- API Gateway で許可オリジンを設定
- 本番: `https://asahigaoka-website.com`
- 開発: `http://localhost:3000`

### 7.4 入力検証
- API Gateway でリクエストバリデーション
- Lambda でサニタイズ処理（XSS対策）

### 7.5 AI 生成コードの検証
- Cursor Agent が生成したコードを Lambda でスキャン
- 危険なパターン（eval, script タグ等）を検出・拒否

### 7.6 GitHub アクセス制限
- Cursor Agent 用 GitHub Token は read + write（repo スコープ）
- main ブランチへの直接プッシュは禁止（PR経由のみ）

---

## 8. デプロイメント仕様

### 8.1 本番環境
- **ホスティング**: AWS S3 + CloudFront
- **ドメイン**: `asahigaoka-website.com`（仮）
- **SSL証明書**: AWS Certificate Manager
- **デプロイ方法**: GitHub Actions（main プッシュ時）

### 8.2 プレビュー環境
- **ホスティング**: Netlify
- **ブランチ**: gh-pages
- **URL**: `https://asahigaoka-preview.netlify.app`（仮）
- **デプロイ方法**: Netlify 自動デプロイ（gh-pages プッシュ時）

### 8.3 バックアップ
- データベース: 日次自動バックアップ（Firebase/Supabase 機能）
- S3 ファイル: バージョニング有効化

---

## 9. 監視・ログ仕様

### 9.1 ログ収集
- Lambda ログ: CloudWatch Logs
- ECS ログ: CloudWatch Logs
- API アクセスログ: API Gateway ログ

### 9.2 メトリクス監視
- Lambda 実行時間、エラー率
- ECS タスク実行状況
- API レイテンシー

### 9.3 アラート設定
- Lambda エラー率 > 5%
- API 5xx エラー発生時
- ECS タスク失敗時

---

## 10. パフォーマンス仕様

### 10.1 目標値
- API レスポンス時間: 500ms 以内
- Web ページ読み込み時間: 3秒 以内
- 同時接続数: 1000人以上

### 10.2 最適化
- CloudFront でエッジキャッシュ（TTL: 1時間）
- 画像最適化（WebP形式、遅延ロード）
- Lambda コールドスタート対策（Provisioned Concurrency）

---

## 11. 実装状況（2025年11月14日更新）

### 11.1 第1フェーズ実装完了項目

#### 認証・ユーザー管理
- [x] ログイン画面 (`/admin/login.html`)
- [x] カスタム認証（users テーブルベース）
- [x] localStorage セッション管理
- [x] ユーザー管理画面（未実装）
- [x] ログイン画面からサンプルアカウント情報を削除
- [x] 「ログイン状態を保持」機能を削除

#### 記事管理機能
- [x] 記事一覧画面 (`/admin/articles.html`)
- [x] 記事編集画面 (`/admin/article-edit.html`)
  - [x] タブナビゲーション（基本情報/SEO/SNS設定）
  - [x] リッチテキストエディタ
  - [x] 複数ファイル添付機能
  - [x] 保存時自動データ加工（スラッグ、LINE/Xメッセージ）
  - [x] 公開日時指定時のLINE/X配信バリデーション
  - [x] エラーハンドリング改善
- [x] 記事 CRUD API（supabase-client.js）
- [x] ダッシュボード (`/admin/index.html`)

#### ファイル添付機能（主要実装）
- [x] ファイルアップロード
  - [x] 日本語ファイル名対応（タイムスタンプ+ランダム値でサニタイズ）
  - [x] ファイルタイプ自動判定
  - [x] アップロード進捗表示
- [x] Supabase Storage 統合
  - [x] attachments バケット
  - [x] featured-images バケット
  - [x] RLS ポリシー設定
- [x] 添付ファイル管理
  - [x] ファイル一覧表示
  - [x] ファイル削除
  - [x] 記事へのファイルリンク

#### UX/UI 改善
- [x] 成功メッセージ（非モーダル、auto-dismiss）
- [x] 記事保存後の自動リダイレクト
- [x] localStorage 経由のメッセージング
- [x] 管理画面サイドバーに「お知らせページを見る」リンクを追加（別タブで開く）
- [x] 記事一覧の日付表示を「イベント日」に変更（公開日時から変更）
- [x] 記事一覧のソートをイベント開始日の降順に変更

### 11.2 第1フェーズ未実装項目
- [ ] ユーザー管理画面の完全実装
- [ ] タグ管理機能
- [ ] 記事検索機能

### 11.3 技術的な重要な実装決定

#### Supabase 導入
- PostgreSQL データベース（Firestore から変更）
- 行レベルセキュリティ（RLS）ポリシー
- Storage バケットでファイル管理

#### 認証方式
- Supabase Auth ではなくカスタム users テーブル
- Base64 ハッシュ化（簡易実装）
- **注**: 本番環境では bcrypt 推奨

#### クライアント側ロジック
- Lambda 関数なし（全処理をブラウザで実行）
- Supabase JS SDK で直接操作
- localStorage でセッション持続

#### ファイル名処理
- 日本語ファイル名問題を解決
- Storage: サニタイズ名で保存
- DB: 元のファイル名を記録
- UI: 元のファイル名を表示

### 11.4 AI記事生成機能（2025年11月16日実装完了）

#### 実装概要
Dify APIを活用したAI記事生成機能を実装。管理画面から簡単な下書きを入力するだけで、AIが正式な記事本文とSNS用抜粋、SEOメタ情報を自動生成。

#### 技術構成
- **Lambda Proxy**: `/terraform/lambda/dify_proxy/lambda_function.py`
  - Dify API Workflow呼び出し
  - タイトル、下書き本文、イベント日時を受け取り
  - 350字本文、80字抜粋、SEOメタ情報を返却
- **API Gateway**: CORS対応エンドポイント
- **Terraform**: インフラコード管理
- **フロントエンド**: Vanilla JavaScript（admin/js/article-editor.js）

#### 実装機能詳細
- [x] **イベント日時管理**
  - 開始日（必須）・開始時刻（任意）
  - 終了日（任意）・終了時刻（任意）
  - 時刻表示フラグ（has_start_time, has_end_time）でカレンダー表示制御
  - カレンダー日付選択時のタイムゾーン問題を修正（toISOString()によるUTC変換を廃止）
- [x] **AI生成処理**
  - 下書き本文からAIが正式な記事を生成
  - Dify APIに date_to パラメータ対応（範囲指定イベント）
  - 350字本文（text350）、80字抜粋（text80）を自動生成
- [x] **SEO最適化**
  - メタディスクリプション（meta_desc）自動生成
  - メタキーワード（meta_kwd）自動生成
  - 空欄の場合のみ自動入力（既存値を上書きしない）
- [x] **データベース保存**
  - イベント日時（event_start_datetime, event_end_datetime）
  - 時刻表示フラグ（has_start_time, has_end_time）
  - SEOフィールド（meta_title, meta_description, meta_keywords, slug）
  - アイキャッチ画像URL（featured_image_url）

#### データベーススキーマ拡張
```sql
-- articles テーブル（既存カラム）
event_start_datetime TIMESTAMP  -- イベント開始日時
event_end_datetime TIMESTAMP    -- イベント終了日時
has_start_time BOOLEAN          -- 開始時刻表示フラグ
has_end_time BOOLEAN            -- 終了時刻表示フラグ
meta_title VARCHAR              -- SEOタイトル
meta_description TEXT           -- SEOディスクリプション
meta_keywords VARCHAR           -- SEOキーワード
slug VARCHAR                    -- URL スラッグ
```

### 11.5 今後の実装予定

#### 第2フェーズ（SNS連携）
- [ ] LINE Messaging API 連携
- [ ] X（Twitter）API v2 連携
- [ ] 自動投稿機能

#### 第3フェーズ（AI機能拡張）
- [x] Dify API 記事生成（完了）
- [ ] Dify RAG システム構築（LINE AI自動応答）
- [ ] 知識ベース管理

#### 第4フェーズ（AI開発支援）
- [ ] Cursor Agent 統合
- [ ] GitHub 連携
- [ ] ECS Fargate 実行環境

---

## 12. Dify API 記事生成機能仕様

### 12.1 概要

Dify Workflowを使用したAI記事生成機能。管理画面から簡単な下書きとイベント情報を入力するだけで、AIが正式な記事本文（350字）、SNS用抜粋（80字）、SEOメタ情報を自動生成。

### 12.2 システム構成

```
管理画面（/admin/article-edit.html）
  ↓ ユーザー入力
  - タイトル
  - イベント開始日（必須）
  - イベント終了日（任意）
  - 下書き本文
  ↓ 「AIに書いてもらう」ボタンクリック
JavaScript（article-editor.js）
  ↓ POST リクエスト
API Gateway: /prod/generate-article
  ↓
Lambda: dify-api-proxy
  - 環境変数: DIFY_API_KEY, DIFY_API_ENDPOINT
  - リクエストボディ: { title, summary, date, date_to, intro_url }
  ↓ POST リクエスト
Dify API Workflow
  - Claude 4 Sonnet使用
  - 入力: title, summary, date, date_to, intro_url
  - 出力: { text350, text80, meta_desc, meta_kwd }
  ↓ レスポンス
Lambda → API Gateway → JavaScript
  ↓ DOM操作
管理画面に自動入力
  - 記事本文（content-editor）: text350
  - SNS用抜粋（excerpt）: text80
  - メタディスクリプション（meta-description）: meta_desc（空欄の場合のみ）
  - メタキーワード（meta-keywords）: meta_kwd（空欄の場合のみ）
```

### 12.3 API仕様

#### 12.3.1 Dify Proxy API

**エンドポイント**: `https://wgoz4zndo3.execute-api.ap-northeast-1.amazonaws.com/prod/generate-article`

**メソッド**: POST

**リクエストヘッダー**:
```
Content-Type: application/json
```

**リクエストボディ**:
```json
{
  "title": "ちびっこ相撲教室開催のお知らせ",
  "summary": "大相撲大関が来場。ちゃんこ鍋とおむすび提供。幼稚園・保育園・小学校3年まで参加無料。",
  "date": "2026-01-15",
  "date_to": "2026-01-15",
  "intro_url": "https://asahigaoka-nerima.tokyo/town.html"
}
```

**レスポンス** (200 OK):
```json
{
  "success": true,
  "data": {
    "text350": "東京都練馬区旭丘一丁目町会では、2026年1月15日にちびっこ相撲教室を開催します...",
    "text80": "大相撲大関が来場！ちゃんこ鍋とおむすび付き。幼稚園〜小学3年生まで参加無料。まわし貸出あり。",
    "meta_desc": "練馬区旭丘でちびっこ相撲教室開催。大相撲大関が指導。参加無料、要申込。",
    "meta_kwd": "練馬区,旭丘,相撲教室,子供イベント,大相撲,町会"
  }
}
```

**エラーレスポンス** (400/500):
```json
{
  "success": false,
  "error": "エラーメッセージ"
}
```

#### 12.3.2 Lambda関数実装

**ファイル**: `/terraform/lambda/dify_proxy/lambda_function.py`

**環境変数**:
- `DIFY_API_KEY`: Dify API認証キー
- `DIFY_API_ENDPOINT`: Dify Workflow URL

**主要処理**:
1. リクエストボディバリデーション（title, summary, date 必須）
2. Dify API呼び出し（urllib.request使用）
3. レスポンスパース（markdown JSONブロック対応）
4. CORSヘッダー付与

**CORSヘッダー**:
```python
cors_headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
```

### 12.4 フロントエンド実装

#### 12.4.1 イベント日時入力フォーム

**HTML** (`/admin/article-edit.html`):
```html
<div class="form-group">
  <label class="form-label">イベント日時</label>
  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px;">
    <div>
      <label for="event-date-from">開始日 *</label>
      <input type="date" id="event-date-from" class="form-control" required>
    </div>
    <div>
      <label for="event-time-from">開始時刻</label>
      <input type="time" id="event-time-from" class="form-control">
    </div>
    <div>
      <label for="event-date-to">終了日</label>
      <input type="date" id="event-date-to" class="form-control">
    </div>
    <div>
      <label for="event-time-to">終了時刻</label>
      <input type="time" id="event-time-to" class="form-control">
    </div>
  </div>
</div>
```

#### 12.4.2 AI生成処理

**JavaScript** (`/admin/js/article-editor.js`):
```javascript
async generateWithAI() {
  const title = document.querySelector('#title').value.trim();
  const draftContent = document.querySelector('#draft-content').value.trim();
  const eventDateFrom = document.querySelector('#event-date-from').value;
  const eventDateTo = document.querySelector('#event-date-to').value;

  // バリデーション
  if (!title || !draftContent || !eventDateFrom) {
    this.showAlert('必須項目を入力してください', 'error');
    return;
  }

  // Dify API呼び出し
  const result = await this.callDifyAPI(title, draftContent, eventDateFrom, eventDateTo);

  if (result.success) {
    // 本文設定
    document.getElementById('content-editor').innerHTML = this.formatContent(result.data.text350);

    // SNS抜粋設定
    document.getElementById('excerpt').value = result.data.text80;

    // SEOメタ設定（空欄の場合のみ）
    const metaDescField = document.getElementById('meta-description');
    if (!metaDescField.value.trim() && result.data.meta_desc) {
      metaDescField.value = result.data.meta_desc;
    }

    const metaKeywordsField = document.getElementById('meta-keywords');
    if (!metaKeywordsField.value.trim() && result.data.meta_kwd) {
      metaKeywordsField.value = result.data.meta_kwd;
    }
  }
}

async callDifyAPI(title, summary, date, dateTo = null) {
  const apiEndpoint = window.DIFY_PROXY_ENDPOINT;
  const requestBody = {
    title, summary, date,
    intro_url: 'https://asahigaoka-nerima.tokyo/town.html'
  };

  if (dateTo) {
    requestBody.date_to = dateTo;
  }

  const response = await fetch(apiEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  const data = await response.json();

  return {
    success: data.success,
    data: {
      text350: data.data.text350 || '',
      text80: data.data.text80 || '',
      meta_desc: data.data.meta_desc || '',
      meta_kwd: data.data.meta_kwd || ''
    }
  };
}
```

### 12.5 保存処理拡張

#### 12.5.1 イベント日時とSEOフィールドの保存

```javascript
async saveArticle() {
  // イベント日時取得
  const eventDateFrom = document.querySelector('#event-date-from').value;
  const eventTimeFrom = document.querySelector('#event-time-from').value;
  const eventDateTo = document.querySelector('#event-date-to').value;
  const eventTimeTo = document.querySelector('#event-time-to').value;

  // SEOフィールド取得
  const metaTitle = document.querySelector('#meta-title').value.trim();
  const metaDescription = document.querySelector('#meta-description').value.trim();
  const metaKeywords = document.querySelector('#meta-keywords').value.trim();
  const slug = document.querySelector('#slug').value.trim();

  // 時刻表示フラグ
  const hasStartTime = eventTimeFrom ? true : false;
  const hasEndTime = eventTimeTo ? true : false;

  // 日時文字列組み立て
  let eventStartDatetime = eventDateFrom;
  if (hasStartTime) {
    eventStartDatetime += ' ' + eventTimeFrom + ':00';
  } else {
    eventStartDatetime += ' 00:00:00';
  }

  let eventEndDatetime = null;
  if (eventDateTo) {
    eventEndDatetime = eventDateTo;
    if (hasEndTime) {
      eventEndDatetime += ' ' + eventTimeTo + ':00';
    } else {
      eventEndDatetime += ' 23:59:59';
    }
  }

  const articleData = {
    title, content, excerpt, category,
    status: 'draft',
    event_start_datetime: eventStartDatetime,
    event_end_datetime: eventEndDatetime,
    has_start_time: hasStartTime,
    has_end_time: hasEndTime,
    meta_title: metaTitle || null,
    meta_description: metaDescription || null,
    meta_keywords: metaKeywords || null,
    slug: slug || null
  };

  // Supabaseに保存
  const result = await supabaseClient.createArticle(articleData);
}
```

### 12.6 Terraform設定

#### 12.6.1 変数定義

**ファイル**: `/terraform/main.tf`

```hcl
variable "dify_api_key" {
  description = "Dify API Key for article generation"
  type        = string
  sensitive   = true
}

variable "dify_api_endpoint" {
  description = "Dify API endpoint URL"
  type        = string
  default     = "https://top-overly-pup.ngrok-free.app/v1/workflows/run"
}
```

#### 12.6.2 Lambda関数

```hcl
resource "aws_lambda_function" "dify_proxy" {
  filename         = data.archive_file.dify_proxy_lambda.output_path
  function_name    = "dify-api-proxy"
  role            = aws_iam_role.dify_proxy_lambda.arn
  handler         = "lambda_function.lambda_handler"
  source_code_hash = data.archive_file.dify_proxy_lambda.output_base64sha256
  runtime         = "python3.11"
  timeout         = 30

  environment {
    variables = {
      DIFY_API_KEY      = var.dify_api_key
      DIFY_API_ENDPOINT = var.dify_api_endpoint
    }
  }
}
```

#### 12.6.3 API Gateway（CORS対応）

```hcl
resource "aws_api_gateway_integration_response" "generate_article_options" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  resource_id = aws_api_gateway_resource.generate_article.id
  http_method = aws_api_gateway_method.generate_article_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }
}
```

### 12.7 デプロイ手順

```bash
# 1. Lambda関数のZIPファイルを作成（Terraformが自動実行）
# terraform/lambda/dify_proxy/ → terraform/lambda/dify_proxy.zip

# 2. Terraform変数設定
# terraform.tfvars に DIFY_API_KEY を設定

# 3. Terraform apply
cd terraform
terraform plan
terraform apply

# 4. APIエンドポイント確認
terraform output dify_proxy_api_endpoint

# 5. フロントエンド設定ファイル更新
# admin/js/config.js に API Gateway URLを設定
```

---

## 13. 静的ページ生成API（TOPページ・お知らせページ）

### 12.1 概要

管理画面でメンテナンスした記事内容を基に、公開Webサイトの静的HTMLファイルを生成するAPI群。

### 12.2 ページ生成API

#### 12.2.1 TOPページ生成

```
POST /api/generate/index
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "force_regenerate": true  // キャッシュを無視して強制再生成
}

Response: 200 OK
{
  "success": true,
  "generated_at": "2025-11-15T10:30:00Z",
  "file_path": "s3://asahigaoka-website/index.html",
  "cache_invalidated": true,
  "message": "TOPページを更新しました"
}

Error: 500 Internal Server Error
{
  "success": false,
  "error": "ページ生成に失敗しました",
  "details": "..."
}
```

**処理内容**:
1. Supabase から最新5件の記事を取得
2. ピックアップ記事（is_featured = true）を取得（最大3件）
3. テンプレートエンジン（Jinja2/EJS）で index.html を生成
4. S3 にアップロード（s3://asahigaoka-website/index.html）
5. CloudFront キャッシュ無効化（/* パス）

#### 12.2.2 お知らせページ生成

```
POST /api/generate/news
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "page": 1,                   // 生成するページ番号（省略時は全ページ）
  "category": "event",         // カテゴリフィルタ（省略時は全カテゴリ）
  "force_regenerate": true
}

Response: 200 OK
{
  "success": true,
  "generated_at": "2025-11-15T10:30:00Z",
  "files": [
    "s3://asahigaoka-website/news.html",
    "s3://asahigaoka-website/news-page-2.html",
    "s3://asahigaoka-website/news-event.html",
    "s3://asahigaoka-website/news-notice.html"
  ],
  "total_pages": 5,
  "total_articles": 87,
  "cache_invalidated": true,
  "message": "お知らせページを更新しました"
}
```

**処理内容**:
1. Supabase から公開済み記事を取得
2. ページング処理（20件/ページ）
3. カテゴリ別ページも生成
4. テンプレートで news.html および関連ページを生成
5. S3 にアップロード
6. CloudFront キャッシュ無効化

#### 12.2.3 記事詳細ページ生成

```
POST /api/generate/article/{article_id}
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "slug": "mochitsuki-2025-11-15",  // オプション: カスタムURL
  "force_regenerate": true
}

Response: 200 OK
{
  "success": true,
  "generated_at": "2025-11-15T10:30:00Z",
  "file_path": "s3://asahigaoka-website/news/mochitsuki-2025-11-15.html",
  "url": "https://asahigaoka-website.com/news/mochitsuki-2025-11-15.html",
  "cache_invalidated": true
}
```

**処理内容**:
1. 記事データ取得（ID or slug）
2. 添付ファイル取得
3. 前後の記事取得（ナビゲーション用）
4. テンプレート（`news/news_template.html`）で記事詳細ページを生成
5. S3 にアップロード（`news/{slug}.html`）
6. CloudFront キャッシュ無効化

**出力先ディレクトリ構造**:
```
/
├── news.html                    # お知らせ一覧ページ
├── news/                        # 記事詳細ページ格納フォルダ
│   ├── news_template.html       # 記事詳細ページテンプレート
│   ├── {slug}.html              # 生成される個別記事ページ
│   └── ...
└── ...
```

**相対パス設計**:
`news/` フォルダ内のページからは、親ディレクトリのリソースに `../` でアクセス。
- CSS: `../css/template.css`
- ホームページ: `../index.html`
- お知らせ一覧: `../news.html`

#### 12.2.4 全ページ一括生成

```
POST /api/generate/all
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "include_articles": true,  // 記事詳細ページも含める
  "force_regenerate": true
}

Response: 200 OK
{
  "success": true,
  "generated_at": "2025-11-15T10:30:00Z",
  "summary": {
    "index": 1,
    "news_pages": 5,
    "article_pages": 87,
    "total_files": 93
  },
  "cache_invalidated": true,
  "message": "全ページを更新しました"
}
```

### 12.3 カレンダーAPI（Ajax専用）

#### 12.3.1 カレンダーイベント取得

```
GET /api/calendar
Query Parameters:
  - year: 年（例: 2025）
  - month: 月（1-12）
  - category: カテゴリフィルタ（オプション）

Response: 200 OK
{
  "year": 2025,
  "month": 11,
  "events": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "餅つき大会",
      "date": "2025-11-15",
      "category": "event",
      "url": "/articles/mochitsuki-2025-11-15.html",
      "excerpt": "年末恒例の餅つき大会を開催します",
      "featured_image_url": "https://storage.supabase.co/.../image.jpg"
    },
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "title": "防災訓練",
      "date": "2025-11-20",
      "category": "disaster_safety",
      "url": "/articles/bousai-2025-11-20.html",
      "excerpt": "防災訓練を実施します"
    }
  ],
  "total_events": 8
}

Error: 400 Bad Request
{
  "error": "Invalid parameters",
  "message": "year と month は必須です"
}
```

**Supabase クエリ実装例**:
```javascript
// フロントエンド（Vanilla JS）から直接 Supabase を呼び出し
async function getCalendarEvents(year, month, category = null) {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`;

  let query = supabaseClient.client
    .from('articles')
    .select('id, title, published_at, category, excerpt, featured_image_url')
    .eq('status', 'published')
    .gte('published_at', startDate)
    .lte('published_at', endDate)
    .order('published_at', { ascending: true });

  if (category) {
    query = query.eq('category', category);
  }

  const { data, error } = await query;

  if (error) {
    console.error('カレンダーイベント取得エラー:', error);
    return { success: false, error: error.message };
  }

  // データ整形
  const events = data.map(article => ({
    id: article.id,
    title: article.title,
    date: article.published_at.split('T')[0],
    category: article.category,
    url: `/articles/${article.id}.html`, // または slug
    excerpt: article.excerpt,
    featured_image_url: article.featured_image_url
  }));

  return {
    success: true,
    year: year,
    month: month,
    events: events,
    total_events: events.length
  };
}
```

#### 12.3.2 カレンダー日付イベント取得

```
GET /api/calendar/date/{date}
Path Parameter:
  - date: 日付（YYYY-MM-DD形式）

Response: 200 OK
{
  "date": "2025-11-15",
  "events": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "餅つき大会",
      "time": "10:00",
      "category": "event",
      "url": "/articles/mochitsuki-2025-11-15.html",
      "excerpt": "年末恒例の餅つき大会を開催します"
    }
  ]
}
```

### 12.4 スケジュールタスク仕様

#### 12.4.1 AWS CloudWatch Events（EventBridge）

**ルール名**: `page-generator-daily`

**スケジュール式**: `cron(0 21 * * ? *)` (UTC: 21:00 = JST: 06:00)

**ターゲット**: Lambda 関数 `page-generator`

**入力データ**:
```json
{
  "action": "generate_all",
  "include_articles": false,  // 記事詳細は含めない（手動生成のみ）
  "force_regenerate": true
}
```

#### 12.4.2 Lambda 関数: page-generator

**ランタイム**: Python 3.11 or Node.js 18.x

**環境変数**:
- `SUPABASE_URL`: Supabase プロジェクト URL
- `SUPABASE_SERVICE_KEY`: Supabase Service Role Key（RLS バイパス用）
- `S3_BUCKET`: 静的ファイルバケット名（例: asahigaoka-website）
- `CLOUDFRONT_DISTRIBUTION_ID`: CloudFront ディストリビューション ID
- `TEMPLATE_BUCKET`: テンプレートファイル保存バケット（例: asahigaoka-templates）

**タイムアウト**: 300秒（5分）

**メモリ**: 512 MB

**処理フロー**:
1. 入力データから action を確認
2. Supabase から記事データ取得
3. テンプレートファイルを S3 から取得
4. テンプレートエンジンで HTML 生成
5. S3 にアップロード
6. CloudFront キャッシュ無効化
7. 処理結果を CloudWatch Logs に記録

### 12.5 テンプレート仕様

#### 12.5.1 TOPページテンプレート（index.html.j2）

**保存場所**: `s3://asahigaoka-templates/index.html.j2`

**テンプレート変数**:
```jinja2
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>{{ site_title }}</title>
  <meta name="description" content="{{ site_description }}">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <header>
    <h1>{{ site_title }}</h1>
  </header>

  <main>
    <section class="latest-news">
      <h2>最新情報</h2>
      <ul>
        {% for article in latest_articles %}
        <li>
          <h3><a href="/articles/{{ article.id }}.html">{{ article.title }}</a></h3>
          <p class="meta">
            <span class="category">{{ article.category_label }}</span>
            <time datetime="{{ article.published_at }}">{{ article.published_at_formatted }}</time>
          </p>
          <p class="excerpt">{{ article.excerpt }}</p>
        </li>
        {% endfor %}
      </ul>
      <a href="/news.html" class="more-link">すべてのお知らせを見る</a>
    </section>

    <section class="highlights">
      <h2>町会活動ハイライト</h2>
      <div class="cards">
        {% for article in featured_articles %}
        <div class="card">
          <a href="/articles/{{ article.id }}.html">
            <img src="{{ article.featured_image_url }}" alt="{{ article.title }}">
            <h3>{{ article.title }}</h3>
            <p>{{ article.excerpt }}</p>
          </a>
        </div>
        {% endfor %}
      </div>
    </section>
  </main>

  <footer>
    <p>&copy; 2025 東京都練馬区旭丘一丁目町会</p>
  </footer>
</body>
</html>
```

#### 12.5.2 お知らせページテンプレート（news.html.j2）

**保存場所**: `s3://asahigaoka-templates/news.html.j2`

**テンプレート変数**:
```jinja2
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>お知らせ一覧 | {{ site_title }}</title>
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <header>
    <h1>お知らせ一覧</h1>
  </header>

  <main>
    <div class="view-switcher">
      <button id="list-view" class="active">一覧表示</button>
      <button id="calendar-view">カレンダー表示</button>
    </div>

    <!-- 一覧表示（静的） -->
    <section id="list-content" class="active">
      <ul class="article-list">
        {% for article in articles %}
        <li>
          <h2><a href="/articles/{{ article.id }}.html">{{ article.title }}</a></h2>
          <p class="meta">
            <span class="category category-{{ article.category }}">{{ article.category_label }}</span>
            <time datetime="{{ article.published_at }}">{{ article.published_at_formatted }}</time>
          </p>
          <p class="excerpt">{{ article.excerpt }}</p>
        </li>
        {% endfor %}
      </ul>

      <!-- ページネーション（静的） -->
      <nav class="pagination">
        {% if current_page > 1 %}
        <a href="/news-page-{{ current_page - 1 }}.html">前へ</a>
        {% endif %}

        {% for page_num in range(1, total_pages + 1) %}
          {% if page_num == current_page %}
          <span class="current">{{ page_num }}</span>
          {% else %}
          <a href="{% if page_num == 1 %}/news.html{% else %}/news-page-{{ page_num }}.html{% endif %}">{{ page_num }}</a>
          {% endif %}
        {% endfor %}

        {% if current_page < total_pages %}
        <a href="/news-page-{{ current_page + 1 }}.html">次へ</a>
        {% endif %}
      </nav>
    </section>

    <!-- カレンダー表示（Ajax動的） -->
    <section id="calendar-content" style="display:none;">
      <div id="calendar-controls">
        <button id="prev-month">&lt; 前月</button>
        <span id="current-month"></span>
        <button id="next-month">次月 &gt;</button>
      </div>
      <div id="calendar-grid">
        <!-- Ajaxで動的に生成 -->
      </div>
    </section>
  </main>

  <script src="/js/calendar.js"></script>
</body>
</html>
```

#### 12.5.3 記事詳細テンプレート（article-detail.html.j2）

**保存場所**: `s3://asahigaoka-templates/article-detail.html.j2`

**テンプレート変数**:
```jinja2
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>{{ article.title }} | {{ site_title }}</title>
  <meta name="description" content="{{ article.excerpt }}">
  <meta property="og:title" content="{{ article.title }}">
  <meta property="og:description" content="{{ article.excerpt }}">
  <meta property="og:image" content="{{ article.featured_image_url }}">
  <link rel="stylesheet" href="/css/style.css">
</head>
<body>
  <header>
    <nav>
      <a href="/">TOP</a> &gt; <a href="/news.html">お知らせ</a> &gt; {{ article.title }}
    </nav>
  </header>

  <main class="article-detail">
    <article>
      <h1>{{ article.title }}</h1>
      <p class="meta">
        <span class="category category-{{ article.category }}">{{ article.category_label }}</span>
        <time datetime="{{ article.published_at }}">{{ article.published_at_formatted }}</time>
      </p>

      {% if article.featured_image_url %}
      <img src="{{ article.featured_image_url }}" alt="{{ article.title }}" class="featured-image">
      {% endif %}

      <div class="content">
        {{ article.content | safe }}
      </div>

      {% if attachments %}
      <section class="attachments">
        <h2>添付ファイル</h2>
        <ul>
          {% for file in attachments %}
          <li>
            <a href="{{ file.url }}" download="{{ file.file_name }}">
              <span class="icon icon-{{ file.file_type }}"></span>
              {{ file.file_name }}
              <span class="size">({{ file.file_size_formatted }})</span>
            </a>
          </li>
          {% endfor %}
        </ul>
      </section>
      {% endif %}

      <div class="share-buttons">
        <a href="https://social-plugins.line.me/lineit/share?url={{ article_url }}" class="share-line">LINEで共有</a>
        <a href="https://twitter.com/intent/tweet?url={{ article_url }}&text={{ article.title }}" class="share-x">Xで共有</a>
      </div>
    </article>

    <nav class="article-navigation">
      {% if prev_article %}
      <a href="/articles/{{ prev_article.id }}.html" class="prev">&lt; {{ prev_article.title }}</a>
      {% endif %}
      {% if next_article %}
      <a href="/articles/{{ next_article.id }}.html" class="next">{{ next_article.title }} &gt;</a>
      {% endif %}
    </nav>
  </main>

  <footer>
    <p>&copy; 2025 東京都練馬区旭丘一丁目町会</p>
  </footer>
</body>
</html>
```

### 12.6 エラーハンドリング

#### 12.6.1 生成失敗時の処理
- Lambda 関数内でエラーをキャッチ
- CloudWatch Logs にエラー詳細を記録
- 管理画面にエラーメッセージを返却
- 既存のHTMLファイルは保持（上書きしない）

#### 12.6.2 リトライ処理
- S3 アップロード失敗時: 3回リトライ
- CloudFront キャッシュ無効化失敗時: 警告のみ（処理続行）

---

**文書作成日**: 2025年11月13日
**最終更新**: 2025年12月09日
**バージョン**: 2.5（管理画面改善、news.html同時更新機能追加）
**ステータス**: 第1フェーズ実装完了、記事編集機能改善完了、ニュース詳細ページテンプレート追加、管理画面UX改善

