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

#### 記事管理機能
- [x] 記事一覧画面 (`/admin/articles.html`)
- [x] 記事編集画面 (`/admin/article-edit.html`)
  - [x] タブナビゲーション（基本情報/コンテンツ/SNS設定/SEO設定）
  - [x] リッチテキストエディタ
  - [x] 複数ファイル添付機能
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

### 11.4 今後の実装予定

#### 第2フェーズ（SNS連携）
- [ ] LINE Messaging API 連携
- [ ] X（Twitter）API v2 連携
- [ ] 自動投稿機能

#### 第3フェーズ（AI機能）
- [ ] Dify RAG システム構築
- [ ] LINE AI 自動応答
- [ ] 知識ベース管理

#### 第4フェーズ（AI開発支援）
- [ ] Cursor Agent 統合
- [ ] GitHub 連携
- [ ] ECS Fargate 実行環境

---

**文書作成日**: 2025年11月13日
**最終更新**: 2025年11月14日
**バージョン**: 2.0（第1フェーズ実装反映）
**ステータス**: 第1フェーズ実装完了、仕様書更新完了

