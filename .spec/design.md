# 東京都練馬区旭丘一丁目町会 ホームページシステム 設計書

## 1. プロジェクト概要

### 1.1 目的
町会の最新情報を一元管理し、Web・LINE・Xへの効率的な配信を実現する統合システムを構築する。

### 1.2 開発方針
- **段階的リリース**: 機能を4つのフェーズに分けて段階的に実装・リリース
- **アジャイル開発**: 各フェーズでフィードバックを収集し、次フェーズに反映
- **低コスト運用**: 無料・従量課金サービスを最大限活用
- **保守性重視**: ノーコード・ローコードツールを活用し、非エンジニアでも管理可能

### 1.3 フェーズ別開発計画

| フェーズ | 期間 | 主要機能 | 優先度 |
|---------|------|---------|-------|
| 第1フェーズ | 1ヶ月 | ログイン、ユーザー管理、記事管理 | 必須 |
| 第2フェーズ | 3週間 | LINE/X投稿機能 | 必須 |
| 第3フェーズ | 1ヶ月 | RAG AIチャットシステム | 重要 |
| 第4フェーズ | 2週間 | その他機能（AIアシスタント等） | オプション |

---

## 2. 第1フェーズ：基盤構築（必須機能）

### 2.1 概要
**期間**: 1ヶ月（4週間）
**目標**: システムの基盤となる管理機能を実装し、記事管理の基本機能を提供

### 2.2 実装機能

#### 2.2.1 認証・ユーザー管理
- **ログイン画面** (`/admin/login.html`)
  - メールアドレス・パスワード認証
  - JWT トークン発行・管理
  - セッション管理（1時間有効）

- **ユーザー管理画面** (`/admin/users.html`)
  - ユーザー一覧表示
  - ユーザー追加・編集・削除
  - ロール管理（admin/editor）

#### 2.2.2 記事管理機能
- **ダッシュボード** (`/admin/index.html`)
  - 最新記事一覧（5件）
  - 統計情報表示
  - クイックアクション

- **記事一覧画面** (`/admin/articles.html`)
  - ページング対応（20件/ページ）
  - カテゴリフィルタ
  - 検索機能
  - 一括操作

- **記事編集画面** (`/admin/article-edit.html`)
  - タブナビゲーション：基本情報 / SEO/SNS設定
  - **基本情報タブ**
    - 記事タイトル、カテゴリ、ステータス（公開/下書き）
    - 抜粋（SNS配信用概要）
    - タグ管理
    - 公開日時設定
    - **アイキャッチ画像（メイン画像）** のアップロード
    - リッチテキストエディタ（太字・斜体・見出し・リスト等）
    - **複数ファイル添付機能**（PDF・Word・テキスト・ZIP等）
    - アップロード進捗表示
    - 添付ファイル一覧・削除機能
    - TOPページ掲載設定（最新情報、町会活動ハイライト）
    - 表示・連携設定（お知らせ一覧、カレンダー、RAG学習）
  - **SEO/SNS設定タブ**
    - **SEO設定**
      - メタタイトル
      - メタディスクリプション
      - メタキーワード
      - スラッグ（URL）（空欄の場合、保存時に記事IDで自動設定）
    - **LINE配信設定**（即時配信のみ）
      - LINE配信チェックボックス
      - 配信メッセージ（空欄の場合、抜粋からハッシュタグを除いたものを自動設定）
    - **X投稿設定**（即時投稿のみ）
      - X投稿チェックボックス
      - 投稿内容（空欄の場合、抜粋をそのまま自動設定）
      - ハッシュタグ
  - **保存機能**
    - 「保存して公開」：記事を即座に公開（エラー時は処理中断）
    - 「下書き保存」：下書き状態で保存
    - 保存時自動データ加工
      - スラッグが空の場合、記事IDで自動設定
      - LINEメッセージが空の場合、抜粋からハッシュタグ除去して設定
      - Xメッセージが空の場合、抜粋をそのまま設定
    - バリデーション
      - 公開日時が指定されている場合、LINE/X配信は不可（エラー表示）
    - 保存後、記事一覧ページへ自動遷移
    - 成功メッセージを非モーダル（自動消去）で表示
    - エラーハンドリング改善（詳細なエラーメッセージ表示）

### 2.3 技術実装詳細

#### 2.3.1 フロントエンド構成
```
/admin/
├── index.html                # ダッシュボード
├── login.html                # ログイン画面
├── articles.html             # 記事一覧
├── article-edit.html         # 記事編集
├── users.html                # ユーザー管理
├── css/
│   ├── admin.css             # 管理画面共通スタイル
│   └── responsive.css        # レスポンシブデザイン
├── js/
│   ├── supabase-client.js    # Supabase API クライアント
│   ├── app.js                # 管理画面共通機能
│   ├── dashboard.js          # ダッシュボード機能
│   ├── articles-manager.js   # 記事管理・一覧表示
│   ├── article-editor.js     # 記事編集・保存・ファイル管理
│   └── users-manager.js      # ユーザー管理（実装予定）
└── images/
    └── icons/                # アイコンセット
```

#### 2.3.2 バックエンド実装（Supabase JS SDK）

フロントエンドから直接 Supabase を操作し、認証・データベース・ストレージ処理を実行。Lambda 関数は不要。

**Supabase クライアント初期化**:
```javascript
// admin/js/supabase-client.js
class SupabaseClient {
  constructor() {
    this.client = supabase.createClient(
      'https://xxxx.supabase.co',  // Supabase URL
      'anon-public-key'              // Public Key
    );
  }

  // 認証: ユーザーテーブルから直接検証
  async signIn(email, password) {
    // Base64パスワードハッシュ化
    const passwordHash = btoa(password);

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

    // localStorageに保存
    localStorage.setItem('asahigaoka_user', JSON.stringify({
      id: data.id,
      name: data.name,
      email: data.email,
      role: data.role
    }));

    return { success: true, data };
  }

  // 記事CRUD
  async createArticle(articleData) {
    const { data, error } = await this.client
      .from('articles')
      .insert([articleData])
      .select()
      .single();

    return { success: !error, data, error: error?.message };
  }

  async updateArticle(articleId, articleData) {
    const { data, error } = await this.client
      .from('articles')
      .update(articleData)
      .eq('id', articleId)
      .select()
      .single();

    return { success: !error, data, error: error?.message };
  }

  async getArticleById(articleId) {
    const { data, error } = await this.client
      .from('articles')
      .select('*')
      .eq('id', articleId)
      .single();

    return { success: !error, data, error: error?.message };
  }

  // ファイルアップロード（Supabase Storage）
  async uploadAttachment(file, bucketName = 'attachments') {
    // 日本語ファイル名対応: タイムスタンプ + ランダム値
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    const sanitizedFileName = `${timestamp}-${random}${ext}`;

    const { data, error: uploadError } = await this.client
      .storage
      .from(bucketName)
      .upload(sanitizedFileName, file);

    if (uploadError) {
      return { success: false, error: uploadError.message };
    }

    // DB に記録
    const { data: dbData, error: dbError } = await this.client
      .from('attachments')
      .insert([{
        file_name: file.name,           // 元のファイル名
        file_type: this.getFileType(file),
        mime_type: file.type,
        storage_path: data.path,
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

  // ファイルタイプ判定
  getFileType(file) {
    const mimeType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();

    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'document';
    if (/\.(docx?|xlsx?|pptx?)$/i.test(fileName)) return 'document';
    if (mimeType.startsWith('text/') || fileName.endsWith('.md')) return 'text';
    if (mimeType === 'application/zip') return 'archive';
    return 'document';
  }

  // 記事に添付ファイルをリンク
  async linkAttachmentToArticle(attachmentId, articleId) {
    const { data, error } = await this.client
      .from('attachments')
      .update({ article_id: articleId })
      .eq('id', attachmentId);

    return { success: !error, error: error?.message };
  }
}
```

#### 2.3.3 データベース設計（Supabase / PostgreSQL）

**テーブル構造**:
```sql
-- users テーブル
CREATE TABLE users (
  id UUID PRIMARY KEY,
  email VARCHAR NOT NULL UNIQUE,
  name VARCHAR,
  password_hash VARCHAR NOT NULL,
  role VARCHAR (admin|editor),
  is_active BOOLEAN DEFAULT true,
  last_login_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- articles テーブル
CREATE TABLE articles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR NOT NULL,
  content TEXT,
  excerpt VARCHAR,
  category VARCHAR,
  tags TEXT[],
  featured_image_url VARCHAR,
  author UUID NOT NULL REFERENCES users(id),
  status VARCHAR (draft|published),
  published_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- attachments テーブル
CREATE TABLE attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_name VARCHAR NOT NULL,                    -- 元のファイル名（日本語対応）
  file_type VARCHAR (image|document|text|archive),
  mime_type VARCHAR,
  storage_path VARCHAR NOT NULL,                 -- Supabase Storage パス
  file_size BIGINT,
  article_id UUID REFERENCES articles(id) ON DELETE SET NULL,
  uploaded_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

**ストレージ構造** (Supabase Storage):
```
attachments/
└── {timestamp}-{random}.{ext}  # 日本語対応のため英数字のみのファイル名

featured-images/
└── {timestamp}-{random}.{ext}  # アイキャッチ画像用
```

### 2.4 セキュリティ実装

#### 2.4.1 認証フロー
```
1. ユーザーがログイン画面でメールアドレス・パスワード入力
2. supabaseClient.signIn() が users テーブルをクエリ
3. パスワードを Base64 エンコードして password_hash と比較
4. is_active = true をチェック（無効ユーザーを拒否）
5. 成功時、ユーザー情報を localStorage に保存
   {
     "asahigaoka_user": {
       "id": "user_id",
       "email": "user@example.com",
       "name": "ユーザー名",
       "role": "admin|editor"
     }
   }
6. 以降のページロードで getCurrentUser() が localStorage から復元
7. ログアウト時は localStorage をクリア
```

**注**: 実装では Supabase Auth ではなく、独自の users テーブルを使用する簡易認証方式を採用

#### 2.4.2 Supabase セキュリティ設定
```javascript
// Supabase はクライアント側からのアクセスを想定した設計
// 1. 行レベルセキュリティ（RLS）: テーブルごとにポリシーを設定
CREATE POLICY "Users can read their own data"
ON articles FOR SELECT
USING (auth.uid() = author_id);

// 2. Supabase Storage: バケットごとにアクセス制御
CREATE POLICY "Authenticated users can upload files"
ON storage.objects FOR INSERT
TO authenticated
USING (bucket_id = 'attachments');

// 3. 環境変数で Supabase URL と Public Key を設定
// .env または admin/js/config.js で管理
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
```

### 2.5 開発タスク（第1フェーズ）

**Week 1: 環境構築**
- [x] Supabase プロジェクト作成（Firestore → Supabase PostgreSQL に変更）
- [x] PostgreSQL テーブル設計
- [x] Supabase Storage バケット作成（attachments, featured-images）
- [x] Supabase JS クライアントセットアップ
- [x] GitHub リポジトリ初期化

**Week 2: 認証・ユーザー管理**
- [x] ログイン画面実装 (`/admin/login.html`)
- [x] カスタム認証実装（users テーブルベース、Base64ハッシュ）
- [x] ユーザー管理画面実装 (`/admin/users.html`)
- [x] ユーザー CRUD 実装（Supabase JS SDK使用）

**Week 3: 記事管理**
- [x] 記事一覧画面実装 (`/admin/articles.html`)
- [x] 記事編集画面実装 (`/admin/article-edit.html`) - タブナビゲーション付き
- [x] 記事 CRUD 実装（supabase-client.js）
- [x] **複数ファイル添付機能実装**
  - [x] ファイルアップロード（日本語ファイル名対応）
  - [x] Supabase Storage 統合
  - [x] attachments テーブル管理
  - [x] ファイルタイプ自動判定（image/document/text/archive）
  - [x] 添付ファイル一覧・削除機能

**Week 4: テスト・調整**
- [x] 各機能の動作確認完了
- [x] ファイルアップロードエラー修正（日本語ファイル名、RLS ポリシー）
- [x] 記事保存後の redirect 実装（articles.html へ自動遷移）
- [x] 非モーダルメッセージ表示実装（localStorage 経由）

---

## 3. 第2フェーズ：SNS連携（必須機能）

### 3.1 概要
**期間**: 3週間
**目標**: LINE・Xへの自動投稿機能を実装し、情報発信の効率化を実現

### 3.2 実装機能

#### 3.2.1 LINE配信機能
- **LINE配信設定画面** (`/admin/line-settings.html`)
  - Channel Access Token 設定
  - 配信グループ管理
  - テンプレート管理

- **記事からのLINE配信**
  - 即時配信
  - 予約配信
  - 配信履歴管理

#### 3.2.2 X（Twitter）投稿機能
- **X投稿設定画面** (`/admin/x-settings.html`)
  - API認証設定
  - ハッシュタグ管理
  - 投稿テンプレート

- **記事からのX投稿**
  - 自動要約（280文字）
  - ファイル添付（対応形式: 画像）
  - 投稿履歴管理

### 3.3 技術実装詳細

#### 3.3.1 LINE Messaging API連携

**Lambda関数: line-send-message**
```python
import json
import requests

LINE_API_ENDPOINT = "https://api.line.me/v2/bot/message/push"
CHANNEL_ACCESS_TOKEN = os.environ['LINE_CHANNEL_ACCESS_TOKEN']

def lambda_handler(event, context):
    body = json.loads(event['body'])
    article_id = body['article_id']
    target_group = body.get('target_group', 'all')

    # 記事取得
    article = get_article(article_id)

    # メッセージ作成
    message = {
        "to": get_group_id(target_group),
        "messages": [{
            "type": "flex",
            "altText": article['title'],
            "contents": create_flex_message(article)
        }]
    }

    # LINE API呼び出し
    headers = {
        'Content-Type': 'application/json',
        'Authorization': f'Bearer {CHANNEL_ACCESS_TOKEN}'
    }

    response = requests.post(LINE_API_ENDPOINT,
                            json=message,
                            headers=headers)

    # 配信履歴記録
    save_delivery_log('line', article_id, response.status_code)

    return {
        'statusCode': 200,
        'body': json.dumps({'success': True})
    }
```

#### 3.3.2 X API v2連携

**Lambda関数: x-post-tweet**
```python
import json
import tweepy

def lambda_handler(event, context):
    body = json.loads(event['body'])
    article_id = body['article_id']

    # 記事取得
    article = get_article(article_id)

    # ツイート文作成（280文字制限）
    tweet_text = create_tweet_text(article)

    # X API認証
    client = tweepy.Client(
        bearer_token=os.environ['X_BEARER_TOKEN'],
        consumer_key=os.environ['X_CONSUMER_KEY'],
        consumer_secret=os.environ['X_CONSUMER_SECRET'],
        access_token=os.environ['X_ACCESS_TOKEN'],
        access_token_secret=os.environ['X_ACCESS_TOKEN_SECRET']
    )

    # 投稿
    response = client.create_tweet(
        text=tweet_text,
        media_ids=[upload_media(article['featured_image_url'])]
    )

    # 投稿履歴記録
    save_post_log('x', article_id, response.data['id'])

    return {
        'statusCode': 200,
        'body': json.dumps({'tweet_id': response.data['id']})
    }
```

### 3.4 配信管理機能

#### 3.4.1 配信スケジュール管理
```javascript
// 管理画面での配信予約
async function scheduleDelivery(articleId, platform, scheduledTime) {
    const response = await fetch('/api/schedule', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${getToken()}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            article_id: articleId,
            platform: platform,
            scheduled_time: scheduledTime
        })
    });

    return response.json();
}
```

#### 3.4.2 CloudWatch Events連携
```python
# スケジュール実行用Lambda
def schedule_handler(event, context):
    schedule_id = event['schedule_id']
    schedule = get_schedule(schedule_id)

    if schedule['platform'] == 'line':
        invoke_lambda('line-send-message', schedule)
    elif schedule['platform'] == 'x':
        invoke_lambda('x-post-tweet', schedule)

    update_schedule_status(schedule_id, 'completed')
```

### 3.5 開発タスク（第2フェーズ）

**Week 1: LINE連携**
- [ ] LINE Official Account作成
- [ ] LINE Messaging API設定
- [ ] LINE配信Lambda実装
- [ ] Flex Messageテンプレート作成

**Week 2: X連携**
- [ ] X Developer Account設定
- [ ] X API認証実装
- [ ] X投稿Lambda実装
- [ ] ファイルアップロード処理

**Week 3: 配信管理・テスト**
- [ ] スケジュール配信実装
- [ ] 配信履歴管理実装
- [ ] 統合テスト
- [ ] 本番環境設定

---

## 4. 第3フェーズ：RAG AIチャットシステム（重要機能）

### 4.1 概要
**期間**: 1ヶ月
**目標**: Difyを活用したRAGシステムを構築し、LINE公式アカウントでAI自動応答を実現

### 4.2 実装機能

#### 4.2.1 知識ベース管理
- **知識ベース管理画面** (`/admin/knowledge.html`)
  - 資料アップロード（PDF/Word/Text）
  - QA変換処理
  - Dify Knowledge API連携
  - 登録資料一覧管理

#### 4.2.2 LINE AI自動応答
- **Webhook処理**
  - LINEメッセージ受信
  - Dify Chat API呼び出し
  - AI応答生成・返信
  - 会話履歴記録

### 4.3 技術実装詳細

#### 4.3.1 Dify設定

**Difyワークスペース構成**:
```
Dify Workspace: asahigaoka-townhall
├── Knowledge Base: 町会情報
│   ├── Dataset: general_info
│   ├── Dataset: events
│   └── Dataset: disaster_prevention
└── App: LINE Assistant
    ├── Model: Claude 3.5 Sonnet
    ├── Prompt Template
    └── Knowledge Settings
```

**Difyプロンプトテンプレート**:
```
あなたは東京都練馬区旭丘一丁目町会の案内アシスタント「あさひくん」です。
以下の知識ベースを参照して、住民からの質問に親切に回答してください。

制約：
- 個人情報に関する質問には回答しない
- 知識ベースにない情報は「町会事務局にお問い合わせください」と案内
- 敬語で丁寧に回答する

知識ベース：
{knowledge_base}

質問：
{user_query}

回答：
```

#### 4.3.2 知識ベース管理Lambda

**Lambda関数: knowledge-upload**
```python
import json
import boto3
import PyPDF2
from docx import Document
import requests

DIFY_API_KEY = os.environ['DIFY_API_KEY']
DIFY_API_URL = "https://api.dify.ai/v1"
CLAUDE_API_KEY = os.environ['CLAUDE_API_KEY']

def lambda_handler(event, context):
    # ファイル取得
    file_content = event['file_content']
    file_type = event['file_type']

    # テキスト抽出
    text = extract_text(file_content, file_type)

    # QA変換（Claude API）
    qa_pairs = convert_to_qa(text)

    # Dify Knowledge API登録
    dataset_id = event.get('dataset_id', 'general_info')
    document_id = register_to_dify(dataset_id, qa_pairs)

    # DB記録
    save_knowledge_document({
        'document_id': document_id,
        'file_name': event['file_name'],
        'qa_count': len(qa_pairs),
        'status': 'completed'
    })

    return {
        'statusCode': 200,
        'body': json.dumps({
            'document_id': document_id,
            'qa_count': len(qa_pairs)
        })
    }

def extract_text(file_content, file_type):
    if file_type == 'pdf':
        reader = PyPDF2.PdfReader(file_content)
        text = ""
        for page in reader.pages:
            text += page.extract_text()
    elif file_type == 'docx':
        doc = Document(file_content)
        text = "\n".join([para.text for para in doc.paragraphs])
    else:
        text = file_content.decode('utf-8')
    return text

def convert_to_qa(text):
    # Claude API呼び出し
    response = requests.post(
        "https://api.anthropic.com/v1/messages",
        headers={
            "x-api-key": CLAUDE_API_KEY,
            "anthropic-version": "2023-06-01"
        },
        json={
            "model": "claude-3-5-sonnet-20241022",
            "messages": [{
                "role": "user",
                "content": f"""
                以下のテキストから、想定される質問と回答のペアを
                QA形式で10個以上抽出してください。

                フォーマット:
                Q: 質問
                A: 回答

                テキスト:
                {text[:8000]}  # トークン制限対策
                """
            }],
            "max_tokens": 4000
        }
    )

    # QAペアをパース
    qa_text = response.json()['content'][0]['text']
    qa_pairs = parse_qa_pairs(qa_text)
    return qa_pairs

def register_to_dify(dataset_id, qa_pairs):
    # Dify Knowledge API呼び出し
    response = requests.post(
        f"{DIFY_API_URL}/datasets/{dataset_id}/document/create_by_text",
        headers={
            "Authorization": f"Bearer {DIFY_API_KEY}"
        },
        json={
            "name": f"Knowledge_{datetime.now().isoformat()}",
            "text": format_qa_for_dify(qa_pairs),
            "indexing_technique": "high_quality",
            "process_rule": {"mode": "automatic"}
        }
    )

    return response.json()['document']['id']
```

#### 4.3.3 LINE Webhook処理

**Lambda関数: line-webhook-handler**
```python
import json
import requests
import hmac
import hashlib
import base64

def lambda_handler(event, context):
    # LINE署名検証
    body = event['body']
    signature = event['headers']['X-Line-Signature']

    if not verify_signature(body, signature):
        return {'statusCode': 403}

    # イベント処理
    events = json.loads(body)['events']

    for event in events:
        if event['type'] == 'message' and event['message']['type'] == 'text':
            handle_message(event)

    return {'statusCode': 200}

def handle_message(event):
    user_message = event['message']['text']
    reply_token = event['replyToken']
    user_id = event['source']['userId']

    # Dify Chat API呼び出し
    dify_response = requests.post(
        "https://api.dify.ai/v1/chat-messages",
        headers={
            "Authorization": f"Bearer {DIFY_API_KEY}"
        },
        json={
            "inputs": {},
            "query": user_message,
            "response_mode": "blocking",
            "conversation_id": get_conversation_id(user_id),
            "user": f"line_{user_id}"
        }
    )

    ai_response = dify_response.json()['answer']
    conversation_id = dify_response.json()['conversation_id']

    # LINE返信
    reply_message(reply_token, ai_response)

    # 会話履歴記録
    save_conversation({
        'line_user_id': user_id,
        'user_message': user_message,
        'ai_response': ai_response,
        'conversation_id': conversation_id
    })

def reply_message(reply_token, text):
    requests.post(
        'https://api.line.me/v2/bot/message/reply',
        headers={
            'Content-Type': 'application/json',
            'Authorization': f'Bearer {LINE_CHANNEL_ACCESS_TOKEN}'
        },
        json={
            'replyToken': reply_token,
            'messages': [{
                'type': 'text',
                'text': text
            }]
        }
    )
```

### 4.4 RAGシステム運用フロー

```
1. 管理者が資料をアップロード
   ↓
2. Lambda でテキスト抽出・QA変換
   ↓
3. Dify Knowledge API で登録
   ↓
4. ベクトルDB自動構築（Dify内部）
   ↓
5. LINEユーザーが質問
   ↓
6. Dify が類似度検索
   ↓
7. Claude が回答生成
   ↓
8. LINEに自動返信
```

### 4.5 開発タスク（第3フェーズ）

**Week 1: Dify環境構築**
- [ ] Difyアカウント作成
- [ ] Knowledge Base設定
- [ ] Chat App作成
- [ ] プロンプトチューニング

**Week 2: 知識ベース管理**
- [ ] 管理画面実装
- [ ] ファイルアップロードLambda
- [ ] テキスト抽出処理
- [ ] QA変換処理（Claude API）

**Week 3: LINE連携**
- [ ] Webhook Lambda実装
- [ ] Dify Chat API連携
- [ ] 会話履歴管理
- [ ] エラーハンドリング

**Week 4: テスト・最適化**
- [ ] 回答精度テスト
- [ ] レスポンス速度最適化
- [ ] フォールバック処理
- [ ] 本番デプロイ

---

## 5. 第4フェーズ以降：拡張機能（オプション）

### 5.1 概要
**期間**: 2週間〜
**目標**: システムの利便性を高める追加機能を実装

### 5.2 実装予定機能

#### 5.2.1 AIアシスタント（HTMLコード生成）
- **実装内容**
  - 管理画面でのAIチャット機能
  - Cursor Agent によるコード修正
  - GitHub連携（PR作成・マージ）
  - Netlifyプレビュー

- **技術スタック**
  - ECS Fargate（Cursor Agent実行環境）
  - GitHub Actions（デプロイ自動化）
  - Netlify（プレビュー環境）

#### 5.2.2 カレンダー表示機能
- **実装内容**
  - イベント記事のカレンダー表示
  - モバイル対応レスポンシブデザイン
  - カテゴリ別色分け

#### 5.2.3 検索機能強化
- **実装内容**
  - 全文検索（Elasticsearch連携）
  - カテゴリ・タグフィルタ
  - 検索履歴・サジェスト

#### 5.2.4 分析・レポート機能
- **実装内容**
  - アクセス解析
  - 配信効果測定
  - 月次レポート生成

### 5.3 将来的な拡張構想

#### 5.3.1 多言語対応
- 英語・中国語対応
- 自動翻訳機能（DeepL API）
- 言語別コンテンツ管理

#### 5.3.2 イベント申込機能
- オンライン申込フォーム
- 参加者管理
- QRコード発行

#### 5.3.3 地域ポイント制度
- ボランティア参加ポイント
- イベント参加特典
- 地域商店街連携

---

## 6. インフラ設計

### 6.1 システムアーキテクチャ図

```
┌─────────────────────────────────────────────────┐
│                   CloudFront                     │
│              (CDN・SSL/TLS証明書)                │
└─────────────────────────────────────────────────┘
                         ↓
┌─────────────────────────────────────────────────┐
│                    S3 Bucket                     │
│           (静的ファイルホスティング)             │
│   /index.html, /admin/*, /css/*, /js/*, etc     │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│      ブラウザ（管理画面）                        │
│  - Vanilla JS                                   │
│  - supabase-client.js（Supabase JS SDK）       │
│  - localStorage（セッション管理）                │
└─────────────────────────────────────────────────┘
           ↓               ↓
┌──────────────────────────────────────────────────┐
│          Supabase（PostgreSQL）                  │
│  - Database: PostgreSQL (articles, users, etc)  │
│  - Storage: 画像・ファイル保存                   │
│  - Auth: カスタム users テーブル                 │
└──────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│             Supabase Storage Buckets             │
├─────────────────────────────────────────────────┤
│  - attachments: 記事添付ファイル                │
│  - featured-images: アイキャッチ画像            │
└─────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────┐
│         外部サービス連携（今後実装）             │
├──────────────────┬──────────────────┬──────────┤
│   LINE API       │   X (Twitter)    │  GitHub  │
│                  │                  │          │
│   Dify AI        │   Claude API     │  Netlify │
└──────────────────┴──────────────────┴──────────┘
```

### 6.2 セキュリティ設計

#### 6.2.1 ネットワークセキュリティ
- CloudFront でのDDoS対策（AWS Shield）
- Supabase の SSL/TLS 暗号化（全通信）
- Supabase 行レベルセキュリティ（RLS）ポリシー設定

#### 6.2.2 データ保護
- Supabase PostgreSQL のデータベース暗号化
- Storage バケットのアクセス制御ポリシー
- パスワードの Base64 ハッシュ化（簡易実装）
  - **注**: 本番環境では bcrypt などの強力なハッシュ関数を推奨
- API キーはフロントエンド環境変数で管理（公開可能なキーのみ使用）

#### 6.2.3 アクセス制御
- Supabase 行レベルセキュリティ（RLS）でアクセス制御
- ロールベースアクセス制御（users テーブルの role カラム）
- localStorage でセッション管理（XSS対策の実装必須）

### 6.3 監視・運用設計

#### 6.3.1 監視項目
- Supabase データベース接続数・パフォーマンス
- Supabase Storage 使用量
- CloudFront キャッシュヒット率
- ブラウザコンソールエラー（フロントエンド）

#### 6.3.2 アラート設定
Supabase ダッシュボードとブラウザ開発者ツールで監視:
- データベースの応答時間が遅延
- Storage 容量超過警告
- API レート制限接近
- ネットワークエラー（コンソール）

#### 6.3.3 バックアップ戦略
- データベース: 日次自動バックアップ（30日保持）
- S3: バージョニング有効化
- コード: GitHubでのバージョン管理

---

## 7. 開発環境・ツール

### 7.1 開発環境
```bash
# 必要なツール
- Node.js 18.x以上
- Git
- テキストエディタ（VS Code推奨）

# ローカル開発サーバー
npm install -g http-server
# または
python -m http.server 3000

# ブラウザで確認
http://localhost:3000/admin/login.html
```

**Supabase 設定**:
1. supabase.com でプロジェクト作成
2. PostgreSQL テーブルを作成
3. Storage バケット（attachments, featured-images）を作成
4. RLS ポリシー設定
5. Supabase URL と Public Key を admin/js/supabase-config.js に設定

### 7.2 デプロイメント

#### 7.2.1 デプロイメント方法（シンプル）
Supabase に全データを保管しているため、静的ファイルのデプロイのみ必要:

```yaml
# .github/workflows/deploy.yml
name: Deploy to S3 + CloudFront

on:
  push:
    branches: [main]

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

      - name: Deploy Static Files to S3
        run: |
          aws s3 sync . s3://asahigaoka-website \
            --delete \
            --exclude ".git/*" \
            --exclude ".github/*" \
            --exclude ".spec/*"

      - name: Invalidate CloudFront Cache
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_ID }} \
            --paths "/*"
```

**デプロイ時の確認項目**:
- Supabase URL と Public Key が環境変数で設定されているか
- Storage バケットのRLSポリシーが正しいか
- テーブルのRLSが有効か

### 7.3 テスト戦略

#### 7.3.1 単体テスト
```python
# Lambda関数のテスト例
import pytest
from auth_login import lambda_handler

def test_login_success():
    event = {
        'body': json.dumps({
            'email': 'test@example.com',
            'password': 'password123'
        })
    }

    response = lambda_handler(event, {})
    assert response['statusCode'] == 200
    assert 'token' in json.loads(response['body'])

def test_login_failure():
    event = {
        'body': json.dumps({
            'email': 'wrong@example.com',
            'password': 'wrongpass'
        })
    }

    response = lambda_handler(event, {})
    assert response['statusCode'] == 401
```

#### 7.3.2 統合テスト
```javascript
// E2Eテスト例（Playwright）
const { test, expect } = require('@playwright/test');

test('管理画面ログイン', async ({ page }) => {
    await page.goto('/admin/login.html');
    await page.fill('#email', 'admin@example.com');
    await page.fill('#password', 'password123');
    await page.click('#login-button');

    await expect(page).toHaveURL('/admin/index.html');
    await expect(page.locator('h1')).toContainText('ダッシュボード');
});
```

---

## 8. コスト見積もり

### 8.1 初期開発コスト

| フェーズ | 期間 | 想定工数 | 費用（人月100万円） |
|---------|------|---------|-------------------|
| 第1フェーズ | 4週間 | 1.0人月 | 100万円 |
| 第2フェーズ | 3週間 | 0.75人月 | 75万円 |
| 第3フェーズ | 4週間 | 1.0人月 | 100万円 |
| 第4フェーズ | 2週間 | 0.5人月 | 50万円 |
| **合計** | **13週間** | **3.25人月** | **325万円** |

### 8.2 運用コスト（月額）

| サービス | 用途 | 月額費用 |
|---------|------|---------|
| AWS Lambda | API実行 | 5,000円 |
| AWS S3 + CloudFront | ホスティング | 3,000円 |
| Firestore | データベース | 5,000円 |
| Dify | AI Platform | 10,000円 |
| LINE Official | メッセージ配信 | 5,000円 |
| その他（監視等） | - | 2,000円 |
| **合計** | - | **30,000円** |

### 8.3 保守費用（年間）

| 項目 | 内容 | 年額 |
|------|------|------|
| 定期メンテナンス | 月1回 | 60万円 |
| セキュリティ対応 | 随時 | 20万円 |
| 機能追加・改善 | 年4回 | 40万円 |
| **合計** | - | **120万円** |

---

## 9. リスク管理

### 9.1 技術的リスク

| リスク | 影響度 | 発生確率 | 対策 |
|-------|--------|---------|------|
| Dify サービス停止 | 高 | 低 | バックアップRAGシステム準備 |
| API制限超過 | 中 | 中 | レート制限・キャッシュ実装 |
| セキュリティ侵害 | 高 | 低 | 定期監査・ペンテスト実施 |
| パフォーマンス劣化 | 中 | 中 | 負荷テスト・最適化 |

### 9.2 運用リスク

| リスク | 影響度 | 発生確率 | 対策 |
|-------|--------|---------|------|
| 担当者不在 | 高 | 中 | ドキュメント整備・引き継ぎ |
| 利用率低迷 | 高 | 中 | 段階的導入・教育実施 |
| コスト超過 | 中 | 低 | 月次監視・アラート設定 |

---

## 10. プロジェクト管理

### 10.1 体制

| 役割 | 人数 | 責任範囲 |
|------|------|---------|
| プロジェクトマネージャー | 1名 | 全体統括・進捗管理 |
| フロントエンド開発者 | 1名 | 管理画面・UI実装 |
| バックエンド開発者 | 1名 | Lambda・API実装 |
| インフラエンジニア | 1名 | AWS環境構築（兼任可） |
| テスター | 1名 | テスト実施（兼任可） |

### 10.2 コミュニケーション

- **定例会議**: 週1回（月曜10:00）
- **進捗報告**: 日次（Slack）
- **レビュー**: プルリクエストベース
- **ドキュメント**: GitHub Wiki

### 10.3 品質管理

- **コードレビュー**: 必須（PR承認制）
- **テストカバレッジ**: 80%以上
- **脆弱性スキャン**: 週次実施
- **パフォーマンステスト**: リリース前実施

---

## 11. 成功基準

### 11.1 フェーズ別成功基準

| フェーズ | 成功基準 | 測定方法 |
|---------|---------|---------|
| 第1フェーズ | 管理画面で記事作成・公開可能 | 機能テスト合格 |
| 第2フェーズ | LINE/Xへの自動投稿成功率95%以上 | 配信ログ確認 |
| 第3フェーズ | AI回答精度80%以上 | サンプル質問テスト |
| 第4フェーズ | ユーザー満足度向上 | アンケート実施 |

### 11.2 プロジェクト全体の成功基準

- **技術面**
  - 全機能の正常動作
  - レスポンスタイム目標達成（3秒以内）
  - セキュリティ要件充足

- **ビジネス面**
  - 月間アクティブユーザー500人以上
  - LINE友だち登録300人以上
  - 運用コスト予算内

- **運用面**
  - 非エンジニアによる記事更新可能
  - 月次の安定稼働（稼働率99%以上）
  - ドキュメント完備

---

## 12. 付録

### 12.1 用語集

| 用語 | 説明 |
|-----|------|
| RAG | Retrieval-Augmented Generation（検索拡張生成） |
| JWT | JSON Web Token（認証トークン） |
| SPA | Single Page Application |
| CORS | Cross-Origin Resource Sharing |
| MFA | Multi-Factor Authentication（多要素認証） |

### 12.2 参考資料

- [AWS Lambda ドキュメント](https://docs.aws.amazon.com/lambda/)
- [LINE Messaging API リファレンス](https://developers.line.biz/ja/docs/messaging-api/)
- [Dify ドキュメント](https://docs.dify.ai/)
- [Firebase Firestore ガイド](https://firebase.google.com/docs/firestore)

### 12.3 連絡先

- **プロジェクトオーナー**: 町会事務局
- **技術サポート**: development@example.com
- **緊急連絡先**: 090-XXXX-XXXX

---

## 補足: 実装時の主要な設計変更（2025年11月16日更新）

### 技術スタック変更
| 項目 | 設計時 | 実装時 | 理由 |
|-----|--------|--------|------|
| データベース | Firestore | Supabase (PostgreSQL) | より柔軟なスキーマ、RLS対応 |
| バックエンド（記事管理） | AWS Lambda + API Gateway | Supabase JS SDK（フロントエンド） | 複雑性削減、コスト最適化 |
| バックエンド（AI生成） | なし | AWS Lambda + API Gateway | Dify API Proxy として実装 |
| 認証 | JWT（Lambda生成） | カスタムusersテーブル | シンプルなアーキテクチャ |
| ストレージ | AWS S3 | Supabase Storage | 一元管理 |
| AI記事生成 | なし | Dify API + Claude 4 Sonnet | 実装完了（2025-11-16） |

### 主要な実装成果

#### ファイル添付機能の完成
- 日本語ファイル名対応（Supabase Storage限界対応）
- ファイルタイプ自動判定
- 記事への複数ファイルリンク
- RLS ポリシー設定

#### AI記事生成機能（2025年11月16日実装完了）
- **Dify API統合**
  - Lambda Proxy経由でDify Workflow呼び出し
  - タイトル、下書き本文、イベント日時からAI生成
  - 350字本文、80字SNS抜粋、SEOメタ情報を返却
- **イベント日時管理**
  - 開始日時・終了日時の入力（日付と時刻を分離）
  - 時刻表示フラグ（has_start_time, has_end_time）でカレンダー表示制御
- **SEO最適化**
  - メタディスクリプション、メタキーワードの自動生成
  - 空欄の場合のみ自動入力（既存値を保護）
- **データベース拡張**
  - event_start_datetime, event_end_datetime
  - has_start_time, has_end_time
  - meta_title, meta_description, meta_keywords, slug

#### UX 改善
- 非モーダルメッセージ表示
- localStorage 経由のメッセージング
- 自動リダイレクト
- アイキャッチ画像の編集時ロード
- カテゴリ必須バリデーション

#### 記事編集画面改善（2025年11月24日）
- **タブ統合**: SNS配信設定タブとSEO設定タブを「SEO/SNS設定」タブに統合
- **不要項目削除**: 配信タイミング、配信日時、投稿タイミング、投稿日時を削除（即時配信のみ対応）
- **保存時自動データ加工**:
  - スラッグが空の場合、記事IDで自動設定
  - LINEメッセージが空の場合、抜粋からハッシュタグ（`#`で始まる単語）を除去して設定
  - Xメッセージが空の場合、抜粋をそのまま設定
- **バリデーション強化**:
  - 公開日時が指定されている場合、LINE/X配信は不可（エラー表示）
  - 保存処理のエラーハンドリング改善（詳細なエラーメッセージ表示）
  - 公開処理時のエラーチェック強化（保存失敗時は公開処理を中断）
- **スキーマ整合性**: スキーマに存在しないフィールド（line_enabled, line_message, x_enabled, x_message, x_hashtags）の送信を停止

#### 開発効率向上
- Lambda 関数（記事管理は不要、AI生成のみ） → 選択的な使い分け
- フロントエンド集約 → デバッグ容易
- Supabase ダッシュボード → 直接DB操作可能
- Terraform IaC → インフラ管理の自動化

---

## 13. 静的ページ生成機能設計

### 13.1 概要

管理画面で作成・編集した記事データを基に、公開Webサイトの静的HTMLページを自動生成する機能。

### 13.2 アーキテクチャ

#### 13.2.1 システム構成図

```
┌─────────────────────────────────────────────────────────┐
│              管理画面（/admin）                          │
│  ┌──────────────────────────────────────────┐           │
│  │ 「TOPページ更新」ボタン                  │           │
│  │ 「お知らせページ更新」ボタン             │           │
│  │ 「全ページ更新」ボタン                   │           │
│  └──────────────────────────────────────────┘           │
└───────────────────┬─────────────────────────────────────┘
                    ↓ POST /api/generate/{target}
┌─────────────────────────────────────────────────────────┐
│        AWS API Gateway + Lambda（page-generator）        │
│  ┌──────────────────────────────────────────┐           │
│  │ 1. Supabase からデータ取得               │           │
│  │ 2. テンプレート取得（S3）                │           │
│  │ 3. HTML生成（Jinja2/EJS）                │           │
│  │ 4. S3アップロード                        │           │
│  │ 5. CloudFront キャッシュ無効化           │           │
│  └──────────────────────────────────────────┘           │
└─────────────────────────────────────────────────────────┘
          ↓                         ↓
┌──────────────────┐      ┌──────────────────────────────┐
│   Supabase       │      │  S3 Buckets                  │
│   (PostgreSQL)   │      │  ┌─────────────────────────┐ │
│                  │      │  │ asahigaoka-templates    │ │
│  - articles      │      │  │ - index.html.j2         │ │
│  - users         │      │  │ - news.html.j2          │ │
│  - attachments   │      │  │ - article-detail.html.j2│ │
│                  │      │  └─────────────────────────┘ │
└──────────────────┘      │  ┌─────────────────────────┐ │
                          │  │ asahigaoka-website      │ │
                          │  │ - index.html（生成済み）│ │
                          │  │ - news.html（生成済み） │ │
                          │  │ - articles/*.html       │ │
                          │  └─────────────────────────┘ │
                          └──────────────────────────────┘
                                    ↓
                          ┌──────────────────────────────┐
                          │  CloudFront（CDN）           │
                          │  - キャッシュ無効化          │
                          └──────────────────────────────┘
                                    ↓
                          ┌──────────────────────────────┐
                          │  一般ユーザー                │
                          │  https://asahigaoka.com/     │
                          └──────────────────────────────┘
```

#### 13.2.2 スケジュール実行フロー

```
┌─────────────────────────────────────────────────────────┐
│       AWS CloudWatch Events (EventBridge)                │
│  スケジュール: cron(0 21 * * ? *)                       │
│  (毎日午前6時 JST)                                      │
└───────────────────┬─────────────────────────────────────┘
                    ↓ トリガー
┌─────────────────────────────────────────────────────────┐
│        Lambda 関数: page-generator                       │
│  入力: { "action": "generate_all" }                     │
└─────────────────────────────────────────────────────────┘
```

### 13.3 Lambda 関数設計

#### 13.3.1 page-generator 関数

**ファイル名**: `lambda/page-generator/index.py` または `index.js`

**ディレクトリ構成**:
```
lambda/
└── page-generator/
    ├── index.py                # メイン処理
    ├── requirements.txt        # 依存パッケージ
    ├── templates/              # テンプレートキャッシュ（オプション）
    ├── generators/
    │   ├── index_generator.py  # TOPページ生成
    │   ├── news_generator.py   # お知らせページ生成
    │   └── article_generator.py # 記事詳細生成
    └── utils/
        ├── supabase_client.py  # Supabaseクライアント
        ├── s3_client.py        # S3クライアント
        └── template_engine.py  # テンプレートエンジン
```

#### 13.3.2 メイン処理（index.py）

```python
import json
import os
from datetime import datetime
from generators.index_generator import generate_index
from generators.news_generator import generate_news
from generators.article_generator import generate_article
from utils.s3_client import S3Client
from utils.supabase_client import SupabaseClient
import boto3

# 環境変数
SUPABASE_URL = os.environ['SUPABASE_URL']
SUPABASE_SERVICE_KEY = os.environ['SUPABASE_SERVICE_KEY']
S3_BUCKET = os.environ['S3_BUCKET']
CLOUDFRONT_DISTRIBUTION_ID = os.environ['CLOUDFRONT_DISTRIBUTION_ID']
TEMPLATE_BUCKET = os.environ['TEMPLATE_BUCKET']

# クライアント初期化
supabase_client = SupabaseClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
s3_client = S3Client(S3_BUCKET, TEMPLATE_BUCKET)
cloudfront = boto3.client('cloudfront')

def lambda_handler(event, context):
    """
    メインハンドラー
    """
    try:
        # リクエストパラメータ取得
        body = json.loads(event.get('body', '{}'))
        action = body.get('action', event.get('action', 'generate_index'))
        force_regenerate = body.get('force_regenerate', True)

        print(f"Action: {action}, Force Regenerate: {force_regenerate}")

        # アクション別処理
        if action == 'generate_index':
            result = generate_index_page(force_regenerate)
        elif action == 'generate_news':
            result = generate_news_pages(body, force_regenerate)
        elif action == 'generate_article':
            article_id = body.get('article_id')
            result = generate_article_page(article_id, body, force_regenerate)
        elif action == 'generate_all':
            result = generate_all_pages(body, force_regenerate)
        else:
            return {
                'statusCode': 400,
                'body': json.dumps({
                    'success': False,
                    'error': f'Unknown action: {action}'
                })
            }

        # CloudFront キャッシュ無効化
        if result['success']:
            invalidate_cloudfront_cache()
            result['cache_invalidated'] = True

        return {
            'statusCode': 200 if result['success'] else 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps(result, ensure_ascii=False)
        }

    except Exception as e:
        print(f"Error: {str(e)}")
        import traceback
        traceback.print_exc()

        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'error': str(e)
            })
        }

def generate_index_page(force_regenerate):
    """
    TOPページ生成
    """
    print("Generating index page...")

    # 記事データ取得
    latest_articles = supabase_client.get_latest_articles(limit=5)
    featured_articles = supabase_client.get_featured_articles(limit=3)

    # HTML生成
    html = generate_index(
        latest_articles=latest_articles,
        featured_articles=featured_articles,
        template_bucket=TEMPLATE_BUCKET
    )

    # S3アップロード
    s3_client.upload_html('index.html', html)

    return {
        'success': True,
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'file_path': f's3://{S3_BUCKET}/index.html',
        'message': 'TOPページを更新しました'
    }

def generate_news_pages(params, force_regenerate):
    """
    お知らせページ生成（複数ページ対応）
    """
    print("Generating news pages...")

    # 記事データ取得
    category = params.get('category')
    all_articles = supabase_client.get_published_articles(category=category)

    # ページング処理
    page_size = 20
    total_pages = (len(all_articles) + page_size - 1) // page_size

    generated_files = []

    for page_num in range(1, total_pages + 1):
        start_idx = (page_num - 1) * page_size
        end_idx = start_idx + page_size
        page_articles = all_articles[start_idx:end_idx]

        # HTML生成
        html = generate_news(
            articles=page_articles,
            current_page=page_num,
            total_pages=total_pages,
            category=category,
            template_bucket=TEMPLATE_BUCKET
        )

        # ファイル名決定
        if page_num == 1 and not category:
            filename = 'news.html'
        elif category:
            filename = f'news-{category}.html' if page_num == 1 else f'news-{category}-page-{page_num}.html'
        else:
            filename = f'news-page-{page_num}.html'

        # S3アップロード
        s3_client.upload_html(filename, html)
        generated_files.append(f's3://{S3_BUCKET}/{filename}')

    return {
        'success': True,
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'files': generated_files,
        'total_pages': total_pages,
        'total_articles': len(all_articles),
        'message': 'お知らせページを更新しました'
    }

def generate_article_page(article_id, params, force_regenerate):
    """
    記事詳細ページ生成
    """
    print(f"Generating article page: {article_id}")

    # 記事データ取得
    article = supabase_client.get_article_by_id(article_id)
    if not article:
        raise ValueError(f'Article not found: {article_id}')

    # 添付ファイル取得
    attachments = supabase_client.get_article_attachments(article_id)

    # 前後の記事取得
    prev_article = supabase_client.get_prev_article(article['published_at'])
    next_article = supabase_client.get_next_article(article['published_at'])

    # HTML生成
    html = generate_article(
        article=article,
        attachments=attachments,
        prev_article=prev_article,
        next_article=next_article,
        template_bucket=TEMPLATE_BUCKET
    )

    # ファイル名決定（slug または article_id）
    slug = params.get('slug') or article.get('slug') or article_id
    filename = f'articles/{slug}.html'

    # S3アップロード
    s3_client.upload_html(filename, html)

    return {
        'success': True,
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'file_path': f's3://{S3_BUCKET}/{filename}',
        'url': f'https://asahigaoka-website.com/{filename}',
        'message': '記事詳細ページを更新しました'
    }

def generate_all_pages(params, force_regenerate):
    """
    全ページ一括生成
    """
    print("Generating all pages...")

    summary = {
        'index': 0,
        'news_pages': 0,
        'article_pages': 0,
        'total_files': 0
    }

    # TOPページ生成
    result_index = generate_index_page(force_regenerate)
    if result_index['success']:
        summary['index'] = 1

    # お知らせページ生成
    result_news = generate_news_pages({}, force_regenerate)
    if result_news['success']:
        summary['news_pages'] = result_news['total_pages']

    # 記事詳細ページ生成（オプション）
    if params.get('include_articles', False):
        all_articles = supabase_client.get_published_articles()
        for article in all_articles:
            result_article = generate_article_page(article['id'], {}, force_regenerate)
            if result_article['success']:
                summary['article_pages'] += 1

    summary['total_files'] = summary['index'] + summary['news_pages'] + summary['article_pages']

    return {
        'success': True,
        'generated_at': datetime.utcnow().isoformat() + 'Z',
        'summary': summary,
        'message': '全ページを更新しました'
    }

def invalidate_cloudfront_cache():
    """
    CloudFront キャッシュ無効化
    """
    print("Invalidating CloudFront cache...")

    cloudfront.create_invalidation(
        DistributionId=CLOUDFRONT_DISTRIBUTION_ID,
        InvalidationBatch={
            'Paths': {
                'Quantity': 1,
                'Items': ['/*']
            },
            'CallerReference': str(datetime.utcnow().timestamp())
        }
    )

    print("CloudFront cache invalidated")
```

#### 13.3.3 TOPページ生成処理（generators/index_generator.py）

```python
from jinja2 import Environment, FileSystemLoader
import boto3
from datetime import datetime

def generate_index(latest_articles, featured_articles, template_bucket):
    """
    TOPページHTML生成
    """
    # テンプレート取得（S3から）
    s3 = boto3.client('s3')
    template_obj = s3.get_object(Bucket=template_bucket, Key='index.html.j2')
    template_content = template_obj['Body'].read().decode('utf-8')

    # Jinja2環境設定
    env = Environment()
    template = env.from_string(template_content)

    # カテゴリラベルマッピング
    category_labels = {
        'notice': 'お知らせ',
        'event': 'イベント情報',
        'disaster_safety': '防災・防犯',
        'child_support': '子育て支援',
        'shopping_info': '商店街情報',
        'activity_report': '活動レポート'
    }

    # データ整形
    for article in latest_articles + featured_articles:
        article['category_label'] = category_labels.get(article['category'], article['category'])
        article['published_at_formatted'] = format_datetime(article['published_at'])

    # テンプレート変数
    context = {
        'site_title': '東京都練馬区旭丘一丁目町会',
        'site_description': '東京都練馬区旭丘一丁目町会の公式ウェブサイトです',
        'latest_articles': latest_articles,
        'featured_articles': featured_articles,
        'current_year': datetime.now().year
    }

    # HTML生成
    html = template.render(context)

    return html

def format_datetime(dt_str):
    """
    日時フォーマット変換
    """
    dt = datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
    return dt.strftime('%Y年%m月%d日')
```

### 13.4 カレンダーAjax機能設計

#### 13.4.1 フロントエンド実装（js/calendar.js）

```javascript
// カレンダー表示管理
class CalendarManager {
  constructor() {
    this.currentYear = new Date().getFullYear();
    this.currentMonth = new Date().getMonth() + 1;
    this.supabaseClient = new SupabaseClient(); // Supabase JS SDK

    this.init();
  }

  init() {
    // イベントリスナー設定
    document.getElementById('list-view').addEventListener('click', () => this.showListView());
    document.getElementById('calendar-view').addEventListener('click', () => this.showCalendarView());
    document.getElementById('prev-month').addEventListener('click', () => this.changeMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => this.changeMonth(1));
  }

  showListView() {
    document.getElementById('list-content').style.display = 'block';
    document.getElementById('calendar-content').style.display = 'none';
    document.getElementById('list-view').classList.add('active');
    document.getElementById('calendar-view').classList.remove('active');
  }

  showCalendarView() {
    document.getElementById('list-content').style.display = 'none';
    document.getElementById('calendar-content').style.display = 'block';
    document.getElementById('list-view').classList.remove('active');
    document.getElementById('calendar-view').classList.add('active');

    // カレンダー読み込み
    this.loadCalendar();
  }

  async loadCalendar() {
    // Supabase から直接データ取得
    const events = await this.fetchCalendarEvents(this.currentYear, this.currentMonth);

    // カレンダー描画
    this.renderCalendar(events);
  }

  async fetchCalendarEvents(year, month) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const lastDay = new Date(year, month, 0).getDate();
    const endDate = `${year}-${String(month).padStart(2, '0')}-${lastDay}`;

    const { data, error } = await this.supabaseClient.client
      .from('articles')
      .select('id, title, published_at, category, excerpt, featured_image_url')
      .eq('status', 'published')
      .gte('published_at', startDate)
      .lte('published_at', endDate + 'T23:59:59')
      .order('published_at', { ascending: true });

    if (error) {
      console.error('カレンダーイベント取得エラー:', error);
      return [];
    }

    return data.map(article => ({
      id: article.id,
      title: article.title,
      date: article.published_at.split('T')[0],
      category: article.category,
      url: `/articles/${article.id}.html`,
      excerpt: article.excerpt
    }));
  }

  renderCalendar(events) {
    const calendarGrid = document.getElementById('calendar-grid');

    // 現在の年月表示
    document.getElementById('current-month').textContent = `${this.currentYear}年${this.currentMonth}月`;

    // カレンダーHTML生成
    const firstDay = new Date(this.currentYear, this.currentMonth - 1, 1).getDay();
    const lastDate = new Date(this.currentYear, this.currentMonth, 0).getDate();

    let html = '<table class="calendar-table"><thead><tr>';
    html += '<th>日</th><th>月</th><th>火</th><th>水</th><th>木</th><th>金</th><th>土</th>';
    html += '</tr></thead><tbody><tr>';

    // 空白セル
    for (let i = 0; i < firstDay; i++) {
      html += '<td class="empty"></td>';
    }

    // 日付セル
    for (let date = 1; date <= lastDate; date++) {
      const dateStr = `${this.currentYear}-${String(this.currentMonth).padStart(2, '0')}-${String(date).padStart(2, '0')}`;
      const dayEvents = events.filter(e => e.date === dateStr);

      html += `<td class="date ${dayEvents.length > 0 ? 'has-events' : ''}">`;
      html += `<div class="date-number">${date}</div>`;

      if (dayEvents.length > 0) {
        html += '<ul class="events">';
        dayEvents.forEach(event => {
          html += `<li class="event category-${event.category}">`;
          html += `<a href="${event.url}">${event.title}</a>`;
          html += '</li>';
        });
        html += '</ul>';
      }

      html += '</td>';

      if ((firstDay + date) % 7 === 0 && date !== lastDate) {
        html += '</tr><tr>';
      }
    }

    html += '</tr></tbody></table>';

    calendarGrid.innerHTML = html;
  }

  changeMonth(delta) {
    this.currentMonth += delta;

    if (this.currentMonth < 1) {
      this.currentMonth = 12;
      this.currentYear--;
    } else if (this.currentMonth > 12) {
      this.currentMonth = 1;
      this.currentYear++;
    }

    this.loadCalendar();
  }
}

// ページロード時に初期化
document.addEventListener('DOMContentLoaded', () => {
  new CalendarManager();
});
```

### 13.5 管理画面統合設計

#### 13.5.1 管理画面UIコンポーネント

**管理画面ダッシュボード（admin/index.html）に追加**:

```html
<section class="site-management">
  <h2>公開サイト管理</h2>

  <div class="page-generator">
    <h3>ページ生成</h3>

    <div class="button-group">
      <button id="generate-index-btn" class="btn btn-primary">
        TOPページ更新
      </button>

      <button id="generate-news-btn" class="btn btn-primary">
        お知らせページ更新
      </button>

      <button id="generate-all-btn" class="btn btn-warning">
        全ページ更新
      </button>
    </div>

    <div id="generation-status" class="status-message"></div>
  </div>

  <div class="generation-log">
    <h3>最終更新履歴</h3>
    <ul id="generation-history">
      <!-- JavaScript で動的に生成 -->
    </ul>
  </div>
</section>

<script src="/admin/js/page-generator.js"></script>
```

#### 13.5.2 ページ生成処理（admin/js/page-generator.js）

```javascript
// ページ生成ボタンのイベントハンドラー
class PageGenerator {
  constructor() {
    this.apiBaseUrl = 'https://api.asahigaoka.com'; // API Gateway URL

    this.init();
  }

  init() {
    document.getElementById('generate-index-btn').addEventListener('click', () => {
      this.generatePage('generate_index', 'TOPページ');
    });

    document.getElementById('generate-news-btn').addEventListener('click', () => {
      this.generatePage('generate_news', 'お知らせページ');
    });

    document.getElementById('generate-all-btn').addEventListener('click', () => {
      if (confirm('全ページを更新しますか？時間がかかる場合があります。')) {
        this.generatePage('generate_all', '全ページ');
      }
    });

    // 履歴読み込み
    this.loadHistory();
  }

  async generatePage(action, pageName) {
    const statusEl = document.getElementById('generation-status');
    statusEl.textContent = `${pageName}を生成中...`;
    statusEl.className = 'status-message loading';

    try {
      const token = localStorage.getItem('asahigaoka_user')
        ? JSON.parse(localStorage.getItem('asahigaoka_user')).token
        : null;

      const response = await fetch(`${this.apiBaseUrl}/api/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          action: action,
          force_regenerate: true
        })
      });

      const result = await response.json();

      if (result.success) {
        statusEl.textContent = `${pageName}を更新しました`;
        statusEl.className = 'status-message success';

        // 履歴更新
        this.addHistoryItem(pageName, result.generated_at);
      } else {
        throw new Error(result.error || 'ページ生成に失敗しました');
      }
    } catch (error) {
      console.error('ページ生成エラー:', error);
      statusEl.textContent = `エラー: ${error.message}`;
      statusEl.className = 'status-message error';
    }
  }

  loadHistory() {
    // LocalStorage から履歴読み込み
    const history = JSON.parse(localStorage.getItem('generation_history') || '[]');

    const historyEl = document.getElementById('generation-history');
    historyEl.innerHTML = '';

    history.slice(0, 10).forEach(item => {
      const li = document.createElement('li');
      li.textContent = `${item.page} - ${new Date(item.generated_at).toLocaleString('ja-JP')}`;
      historyEl.appendChild(li);
    });
  }

  addHistoryItem(pageName, generatedAt) {
    const history = JSON.parse(localStorage.getItem('generation_history') || '[]');

    history.unshift({
      page: pageName,
      generated_at: generatedAt
    });

    // 最大50件まで保持
    if (history.length > 50) {
      history.pop();
    }

    localStorage.setItem('generation_history', JSON.stringify(history));

    this.loadHistory();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  new PageGenerator();
});
```

### 13.6 データベース拡張設計

#### 13.6.1 articles テーブル拡張

```sql
-- articlesテーブルに以下のカラムを追加

ALTER TABLE articles ADD COLUMN IF NOT EXISTS slug VARCHAR(255);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS is_featured BOOLEAN DEFAULT false;
ALTER TABLE articles ADD COLUMN IF NOT EXISTS meta_description VARCHAR(255);
ALTER TABLE articles ADD COLUMN IF NOT EXISTS og_image_url VARCHAR(500);

-- インデックス追加
CREATE INDEX IF NOT EXISTS idx_articles_slug ON articles(slug);
CREATE INDEX IF NOT EXISTS idx_articles_is_featured ON articles(is_featured);
CREATE INDEX IF NOT EXISTS idx_articles_published_at ON articles(published_at);
```

#### 13.6.2 page_generation_history テーブル（新規）

```sql
-- ページ生成履歴テーブル
CREATE TABLE page_generation_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  page_type VARCHAR(50) NOT NULL,  -- 'index', 'news', 'article', 'all'
  target_id UUID,                  -- 記事IDなど（article の場合）
  status VARCHAR(20) NOT NULL,     -- 'success', 'failed'
  generated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  generated_by UUID REFERENCES users(id),
  file_paths TEXT[],               -- 生成されたファイルパス
  error_message TEXT,
  execution_time_ms INTEGER
);

CREATE INDEX idx_page_generation_history_page_type ON page_generation_history(page_type);
CREATE INDEX idx_page_generation_history_generated_at ON page_generation_history(generated_at);
```

### 13.7 デプロイ設計

#### 13.7.1 Lambda デプロイパッケージ

```bash
# デプロイパッケージ作成スクリプト
#!/bin/bash

cd lambda/page-generator

# 依存パッケージインストール
pip install -r requirements.txt -t .

# zipパッケージ作成
zip -r page-generator.zip .

# AWS Lambdaにアップロード
aws lambda update-function-code \
  --function-name page-generator \
  --zip-file fileb://page-generator.zip
```

#### 13.7.2 CloudWatch Events設定

```bash
# EventBridgeルール作成
aws events put-rule \
  --name page-generator-daily \
  --schedule-expression 'cron(0 21 * * ? *)'

# Lambda関数をターゲットに設定
aws events put-targets \
  --rule page-generator-daily \
  --targets "Id"="1","Arn"="arn:aws:lambda:ap-northeast-1:ACCOUNT_ID:function:page-generator"
```

---

**文書作成日**: 2025年11月13日
**最終更新**: 2025年11月24日
**バージョン**: 2.3（記事編集画面改善、バリデーション強化）
**ステータス**: 第1フェーズ完了、記事編集機能改善完了
**次回レビュー**: 第2フェーズ開始時

---

## 14. AI記事生成機能実装詳細（2025年11月16日追加）

### 14.1 実装背景

町会の記事作成を効率化するため、Dify APIを活用したAI記事生成機能を実装。簡単な下書きから、正式な記事本文、SNS用抜粋、SEOメタ情報を自動生成することで、コンテンツ制作の負担を大幅に軽減。

### 14.2 技術アーキテクチャ

```
┌────────────────────────────────────────────────────────┐
│            管理画面（/admin/article-edit.html）        │
│  ┌──────────────────────────────────────────────────┐ │
│  │ フォーム入力                                     │ │
│  │  - タイトル                                      │ │
│  │  - イベント開始日（必須）                        │ │
│  │  - イベント開始時刻（任意）                      │ │
│  │  - イベント終了日（任意）                        │ │
│  │  - イベント終了時刻（任意）                      │ │
│  │  - 下書き本文                                    │ │
│  │                                                  │ │
│  │ [🤖 AIに書いてもらう] ボタン                    │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────┬──────────────────────────────────────────┘
              ↓ JavaScript (article-editor.js)
┌────────────────────────────────────────────────────────┐
│  POST /prod/generate-article                           │
│  {                                                     │
│    "title": "ちびっこ相撲教室",                        │
│    "summary": "大相撲大関来場...",                     │
│    "date": "2026-01-15",                               │
│    "date_to": "2026-01-15",                            │
│    "intro_url": "https://asahigaoka-nerima.tokyo/..."  │
│  }                                                     │
└─────────────┬──────────────────────────────────────────┘
              ↓ API Gateway
┌────────────────────────────────────────────────────────┐
│  Lambda: dify-api-proxy (Python 3.11)                  │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 環境変数:                                        │ │
│  │  - DIFY_API_KEY                                  │ │
│  │  - DIFY_API_ENDPOINT                             │ │
│  │                                                  │ │
│  │ 処理:                                            │ │
│  │  1. リクエストボディバリデーション               │ │
│  │  2. Dify API呼び出し（urllib.request）          │ │
│  │  3. レスポンスパース                             │ │
│  │     - Markdown JSONブロック除去                  │ │
│  │     - text350, text80, meta_desc, meta_kwd抽出   │ │
│  │  4. CORS対応レスポンス返却                       │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────┬──────────────────────────────────────────┘
              ↓ HTTPS POST
┌────────────────────────────────────────────────────────┐
│  Dify API Workflow                                     │
│  URL: https://top-overly-pup.ngrok-free.app/...       │
│  ┌──────────────────────────────────────────────────┐ │
│  │ LLM: Claude 4 Sonnet                             │ │
│  │                                                  │ │
│  │ 入力:                                            │ │
│  │  - title: イベントタイトル                       │ │
│  │  - summary: 下書き本文                           │ │
│  │  - date: イベント開始日                          │ │
│  │  - date_to: イベント終了日（任意）              │ │
│  │  - intro_url: 町会紹介ページURL                  │ │
│  │                                                  │ │
│  │ 出力（JSON in Markdown）:                        │ │
│  │  - text350: 正式な記事本文（350字）              │ │
│  │  - text80: SNS用抜粋（80字）                     │ │
│  │  - meta_desc: SEOディスクリプション              │ │
│  │  - meta_kwd: SEOキーワード（カンマ区切り）       │ │
│  └──────────────────────────────────────────────────┘ │
└─────────────┬──────────────────────────────────────────┘
              ↓ レスポンス
┌────────────────────────────────────────────────────────┐
│  管理画面に自動入力                                    │
│  ┌──────────────────────────────────────────────────┐ │
│  │ 記事本文（content-editor）: text350              │ │
│  │ SNS用抜粋（excerpt）: text80                     │ │
│  │ メタディスクリプション: meta_desc（空欄時のみ）  │ │
│  │ メタキーワード: meta_kwd（空欄時のみ）           │ │
│  └──────────────────────────────────────────────────┘ │
└────────────────────────────────────────────────────────┘
```

### 14.3 実装ファイル一覧

| ファイルパス | 役割 | 主な変更内容 |
|------------|------|------------|
| `/terraform/main.tf` | インフラ定義 | Lambda関数、API Gateway、変数定義 |
| `/terraform/lambda/dify_proxy/lambda_function.py` | Lambda関数 | Dify API呼び出し、レスポンスパース |
| `/admin/article-edit.html` | フォームUI | イベント日時入力フィールド追加 |
| `/admin/js/article-editor.js` | フロントエンドロジック | AI生成処理、保存処理拡張 |
| `/admin/js/config.js` | API設定 | Dify Proxy エンドポイントURL |

### 14.4 データベーススキーマ拡張

**articles テーブル追加カラム**:

```sql
-- イベント日時管理
event_start_datetime TIMESTAMP      -- イベント開始日時
event_end_datetime TIMESTAMP        -- イベント終了日時（任意）
has_start_time BOOLEAN DEFAULT false -- 開始時刻を表示するか
has_end_time BOOLEAN DEFAULT false   -- 終了時刻を表示するか

-- SEO最適化
meta_title VARCHAR(255)             -- SEOタイトル
meta_description TEXT               -- SEOディスクリプション（AI生成可）
meta_keywords VARCHAR(500)          -- SEOキーワード（AI生成可）
slug VARCHAR(255)                   -- URL スラッグ

-- Check制約（既存）
CHECK (category IN ('notice', 'event', 'disaster_safety',
                    'child_support', 'shopping_info', 'activity_report'))
```

### 14.5 主要な実装機能

#### 14.5.1 イベント日時入力

- **分離入力**: 日付と時刻を別々のinputフィールドで入力
  - 開始日（date型、必須）
  - 開始時刻（time型、任意）
  - 終了日（date型、任意）
  - 終了時刻（time型、任意）

- **時刻表示フラグ**: ユーザーが時刻を入力したかどうかを記録
  - `has_start_time`: 開始時刻が入力されている場合true
  - `has_end_time`: 終了時刻が入力されている場合true
  - カレンダー表示時に時刻を表示するか判断に使用

#### 14.5.2 AI生成ワークフロー

1. **バリデーション**
   - タイトル、下書き本文、イベント開始日の必須チェック

2. **API呼び出し**
   - Dify Proxy Lambda経由でDify Workflowを実行
   - タイムアウト: 30秒

3. **レスポンス処理**
   - Markdown JSONブロックの除去
   - text350, text80, meta_desc, meta_kwdの抽出

4. **DOM操作**
   - 記事本文エディタに text350 を設定
   - SNS抜粋に text80 を設定
   - メタフィールドが空欄の場合のみ meta_desc, meta_kwd を設定

#### 14.5.3 保存処理拡張

**保存時のデータ処理**:

```javascript
// イベント日時の組み立て
const hasStartTime = eventTimeFrom ? true : false;
const hasEndTime = eventTimeTo ? true : false;

let eventStartDatetime = eventDateFrom;
if (hasStartTime) {
  eventStartDatetime += ' ' + eventTimeFrom + ':00';
} else {
  eventStartDatetime += ' 00:00:00';  // デフォルト時刻
}

let eventEndDatetime = null;
if (eventDateTo) {
  eventEndDatetime = eventDateTo;
  if (hasEndTime) {
    eventEndDatetime += ' ' + eventTimeTo + ':00';
  } else {
    eventEndDatetime += ' 23:59:59';  // 終日イベント
  }
}

const articleData = {
  // ... 他のフィールド
  event_start_datetime: eventStartDatetime,
  event_end_datetime: eventEndDatetime,
  has_start_time: hasStartTime,
  has_end_time: hasEndTime,
  meta_title: metaTitle || null,
  meta_description: metaDescription || null,
  meta_keywords: metaKeywords || null,
  slug: slug || null,
  featured_image_url: this.currentArticle?.featured_image_url || null
};
```

### 14.6 CORS対応

**開発環境対応**: localhost:5500からのアクセスを許可

**Lambda関数 CORSヘッダー**:
```python
cors_headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS'
}
```

**API Gateway設定**:
- OPTIONS メソッドでプリフライトリクエスト対応
- Access-Control-Allow-Origin: '*'
- 強制再デプロイのためtimestamp()トリガー使用

### 14.7 修正したバグ

1. **Meta fieldsがDBに保存されない**
   - 原因: `saveArticle`でSEOフィールドをarticleDataに含めていなかった
   - 修正: meta_title, meta_description, meta_keywords, slugを追加

2. **Featured imageが編集時にロードされない**
   - 原因: `loadArticle`でfeatured_image_urlを設定していなかった
   - 修正: プレビュー画像の表示処理を追加

3. **Category空欄でエラー**
   - 原因: デフォルトオプション（value=""）選択時にDB制約違反
   - 修正: 保存前にカテゴリ必須バリデーション追加

4. **Meta fieldsが自動入力されない**
   - 原因: `callDifyAPI`の戻り値にmeta_desc, meta_kwdを含めていなかった
   - 修正: レスポンスデータにmeta_desc, meta_kwdを追加

### 14.8 今後の拡張可能性

1. **AI生成の高度化**
   - 記事カテゴリ別のプロンプト最適化
   - 画像生成APIとの統合
   - 多言語対応（英語・中国語）

2. **イベント管理強化**
   - 繰り返しイベント対応
   - Google Calendar連携
   - リマインダー機能

3. **SEO強化**
   - OGP画像自動生成
   - 構造化データ（JSON-LD）出力
   - サイトマップ自動更新

---

## 15. ニュース記事詳細ページ設計

### 15.1 ディレクトリ構造

ニュース記事の個別ページは `news/` フォルダ内に配置する。

```
/
├── news.html                    # お知らせ一覧ページ
├── news/                        # 記事詳細ページ格納フォルダ
│   ├── news_template.html       # 記事詳細ページテンプレート
│   ├── {slug}.html              # 生成される個別記事ページ
│   └── ...
├── css/
│   └── template.css
└── ...
```

### 15.2 相対パス設計

`news/` フォルダ内のページからは、親ディレクトリのリソースに `../` でアクセスする。

| リソース種別 | パス |
|-------------|------|
| CSS | `../css/template.css` |
| ホームページ | `../index.html` |
| お知らせ一覧 | `../news.html` |
| 事業資料 | `../reports.html` |
| 町会について | `../town.html` |
| 災害特集 | `../antidisaster_index.html` |
| お問い合わせ | `../contact.html` |
| プライバシーポリシー | `../privacy-policy.html` |
| 利用規約 | `../terms-of-service.html` |

### 15.3 テンプレート構造 (news_template.html)

#### 15.3.1 HTML構成

```html
<!DOCTYPE html>
<html lang="ja">
<head>
  <!-- SEOメタタグ -->
  <title>{{meta_title}} - 東京都練馬区旭丘一丁目町会</title>
  <meta name="description" content="{{meta_description}}" />
  <meta name="keywords" content="{{meta_keywords}}" />
  <!-- OGPタグ -->
  <meta property="og:title" content="{{meta_title}}" />
  <meta property="og:description" content="{{meta_description}}" />
  <meta property="og:image" content="{{featured_image_url}}" />
  <!-- Twitter Card -->
  <meta name="twitter:card" content="summary_large_image" />
  <!-- CSS (相対パス) -->
  <link rel="stylesheet" href="../css/template.css" />
</head>
<body>
  <!-- ヘッダー (他ページと共通、リンクは../) -->
  <header>...</header>

  <main>
    <!-- パンくずリスト -->
    <nav class="breadcrumb">
      ホーム > お知らせ > {{title}}
    </nav>

    <!-- 記事ヘッダー -->
    <header class="article-header">
      <span class="article-category">{{category_label}}</span>
      <time>{{published_at_formatted}}</time>
      <h1>{{title}}</h1>
      <!-- イベント日時 (条件付き表示) -->
      <div class="event-datetime">{{event_datetime_formatted}}</div>
    </header>

    <!-- アイキャッチ画像 -->
    <img src="{{featured_image_url}}" alt="{{title}}" />

    <!-- 記事本文 -->
    <div class="article-content">{{content}}</div>

    <!-- 添付ファイル -->
    <section class="attachments-section">...</section>

    <!-- シェアボタン -->
    <section class="share-section">
      <a href="LINE共有URL">LINEで送る</a>
      <a href="X共有URL">Xでポスト</a>
      <a href="Facebook共有URL">Facebookでシェア</a>
    </section>

    <!-- 前後記事ナビゲーション -->
    <nav class="article-navigation">
      <a href="{{prev_article.slug}}.html">前の記事</a>
      <a href="{{next_article.slug}}.html">次の記事</a>
      <a href="../news.html">お知らせ一覧に戻る</a>
    </nav>
  </main>

  <!-- フッター (他ページと共通、リンクは../) -->
  <footer>...</footer>

  <!-- Dify チャットボット -->
  <script>...</script>
</body>
</html>
```

#### 15.3.2 テンプレート変数一覧

| 変数名 | 型 | 説明 |
|--------|-----|------|
| `{{title}}` | String | 記事タイトル |
| `{{content}}` | HTML | 記事本文（HTMLとして出力） |
| `{{excerpt}}` | String | 抜粋 |
| `{{category}}` | String | カテゴリID (notice, event等) |
| `{{category_label}}` | String | カテゴリ表示名 |
| `{{published_at}}` | String | ISO8601形式の公開日時 |
| `{{published_at_formatted}}` | String | 表示用フォーマット済み日時 |
| `{{featured_image_url}}` | String | アイキャッチ画像URL |
| `{{meta_title}}` | String | SEOタイトル |
| `{{meta_description}}` | String | SEOディスクリプション |
| `{{meta_keywords}}` | String | SEOキーワード |
| `{{article_url}}` | String | 記事の完全URL |
| `{{article_url_encoded}}` | String | URLエンコード済みURL |
| `{{title_encoded}}` | String | URLエンコード済みタイトル |
| `{{event_datetime_formatted}}` | String | イベント日時（表示用） |
| `{{attachments}}` | Array | 添付ファイル配列 |
| `{{prev_article}}` | Object | 前の記事情報 |
| `{{next_article}}` | Object | 次の記事情報 |

#### 15.3.3 カテゴリ別スタイル

```css
.category-notice { background: #dbeafe; color: #1e40af; }
.category-event { background: #fef3c7; color: #92400e; }
.category-disaster_safety { background: #fee2e2; color: #991b1b; }
.category-child_support { background: #d1fae5; color: #065f46; }
.category-shopping_info { background: #fce7f3; color: #9d174d; }
.category-activity_report { background: #e0e7ff; color: #3730a3; }
```

### 15.4 静的ページ生成フロー

1. 管理画面で記事を公開
2. Lambda関数 `page-generator` を呼び出し
3. Supabaseから記事データを取得
4. `news_template.html` をテンプレートとして使用
5. テンプレート変数を記事データで置換
6. 生成したHTMLを `news/{slug}.html` としてS3にアップロード
7. CloudFrontキャッシュを無効化

### 15.5 リンク先構成

| リンク元 | リンク先 |
|---------|---------|
| news.html 記事一覧 | `news/{slug}.html` |
| index.html 最新情報 | `news/{slug}.html` |
| カレンダーイベント | `news/{slug}.html` |
| 記事詳細 前後ナビ | `{prev_slug}.html`, `{next_slug}.html` |
| 記事詳細 一覧へ戻る | `../news.html` |

---

## 16. スマホ版管理画面設計

### 16.1 概要

スマホからログインした管理者向けに、記事の一覧・簡易編集・新規作成に特化したモバイル専用画面を提供する。既存のバックエンド（Supabase、Dify API Proxy、LINE/X Lambda）をそのまま利用する。

### 16.2 ファイル構成

```
/admin/
├── mobile.html              # スマホ版管理画面（新規）
├── css/
│   └── mobile.css           # スマホ版専用スタイル（新規）
├── js/
│   ├── mobile-admin.js      # スマホ版ロジック（新規）
│   ├── supabase-client.js   # 既存（変更なし）
│   └── config.js            # 既存（変更なし）
└── login.html               # 既存（スマホ判定リダイレクト追加）
```

### 16.3 ログイン・遷移フロー

```
login.html
  ↓ ログイン成功
  ↓ window.innerWidth <= 768 ?
  ├─ YES → mobile.html
  └─ NO  → index.html（従来通り）
```

### 16.4 画面設計

#### 16.4.1 画面構成

```
┌────────────────────────────┐
│  ヘッダー                    │
│  旭丘一丁目町会 ┃ ログアウト  │
├────────────────────────────┤
│  [ 記事一覧 ] [ 新規作成 ]    │  ← タブナビゲーション
├────────────────────────────┤
│                            │
│  コンテンツエリア             │
│  （タブに応じて切り替え）      │
│                            │
└────────────────────────────┘
```

#### 16.4.2 記事一覧タブ

```
┌────────────────────────────┐
│ ● 公開中   餅つき大会のお知らせ │  ← タップで展開
│            2026-01-15        │
├────────────────────────────┤
│ ○ 下書き   防災訓練のお知らせ   │
│            2026-02-01        │
├────────────────────────────┤
│ ...（最大30件）               │
└────────────────────────────┘

展開時:
┌────────────────────────────┐
│ 件名: [餅つき大会のお知らせ  ] │
│ 本文:                        │
│ [テキストエリア              ] │
│                              │
│ ステータス: [●公開中 ○下書き]  │  ← トグルスイッチ
│                              │
│ [ 保存 ]    [ 閉じる ]        │
└────────────────────────────┘
```

#### 16.4.3 新規作成タブ

```
┌────────────────────────────┐
│ 開始日 *     終了日            │
│ [2026-01-15] [2026-01-15]    │
│                              │
│ 件名 *                       │
│ [                          ] │
│                              │
│ 要約（下書き） *              │
│ [                          ] │
│                              │
│ アイキャッチ画像              │
│ [ ファイルを選択 ]            │
│ (プレビュー表示)             │
│                              │
│      [ AIに依頼 ]            │
│                              │
│ 本文                         │
│ [                          ] │
│                              │
│ SNS用サマリ文                │
│ [                          ] │
│                              │
│ [ 投稿 ]      [ キャンセル ]  │
└────────────────────────────┘
```

### 16.5 コンポーネント設計

#### 16.5.1 MobileAdmin クラス

```javascript
class MobileAdmin {
  // --- 認証 ---
  checkAuth()               // localStorage からユーザー確認、未認証なら login.html へ
  logout()                  // supabaseClient.signOut() → login.html

  // --- 記事一覧 ---
  loadArticles()            // supabaseClient.getArticles({ limit:30, status:'all' })
  renderArticleList(articles)
  toggleArticleExpand(id)   // カード展開・折りたたみ
  saveInlineEdit(id)        // title, content のみ更新
  toggleStatus(id, article) // ステータス変更 + SNS自動投稿判定

  // --- SNS自動投稿 ---
  autoPublishSNS(article)   // line_published/x_published が false の場合のみ投稿
  postToLine(article)       // LINE_BROADCAST_ENDPOINT
  postToX(article)          // X_POST_ENDPOINT

  // --- 新規作成 ---
  handleImageUpload(e)      // supabaseClient.uploadMedia(file)
  generateWithAI()          // DIFY_PROXY_ENDPOINT（既存パターン）
  saveNewArticle()          // supabaseClient.createArticle({ status:'draft' })
  resetForm()               // フォームクリア

  // --- UI ---
  switchTab(tabName)        // 記事一覧 ↔ 新規作成
  showAlert(msg, type)      // 通知メッセージ
  showLoading() / hideLoading()
}
```

### 16.6 データフロー

#### 記事一覧読み込み
```
mobile-admin.js → supabaseClient.getArticles({limit:30}) → Supabase DB → 画面描画
```

#### インライン編集
```
ユーザー編集 → 保存ボタン → supabaseClient.updateArticle(id, {title, content}) → Supabase DB
```

#### ステータストグル（下書き→公開、SNS自動投稿）
```
トグル操作
  ↓
supabaseClient.updateArticle(id, { status:'published', published_at })
  ↓
line_published == false?
  ├─ YES → fetch(LINE_BROADCAST_ENDPOINT) → supabaseClient.updateArticle(id, {line_published:true})
  └─ NO  → skip
  ↓
x_published == false?
  ├─ YES → fetch(X_POST_ENDPOINT) → supabaseClient.updateArticle(id, {x_published:true})
  └─ NO  → skip
```

#### AI記事生成
```
件名 + 開始日 + 要約 → fetch(DIFY_PROXY_ENDPOINT)
  ↓
レスポンス { text350, text80 }
  ↓
text350 → 本文フィールドに自動入力
text80  → SNS用サマリ文に自動入力
```

#### 新規記事保存
```
フォーム入力
  ↓ (画像があれば先にアップロード)
supabaseClient.uploadMedia(file) → featured_image_url 取得
  ↓
supabaseClient.createArticle({
  title, content, excerpt, category:'notice',
  event_start_datetime, event_end_datetime,
  featured_image_url, status:'draft'
})
  ↓
記事一覧タブに切り替え＆リスト再読込
```

### 16.7 既存リソース利用マップ

| 機能 | 利用する既存リソース |
|------|-------------------|
| 認証 | supabase-client.js `getCurrentUser()`, `signOut()` |
| 記事取得 | supabase-client.js `getArticles()` |
| 記事更新 | supabase-client.js `updateArticle()` |
| 記事作成 | supabase-client.js `createArticle()` |
| 画像アップロード | supabase-client.js `uploadMedia()` |
| AI生成 | config.js `DIFY_PROXY_ENDPOINT` |
| LINE投稿 | config.js `LINE_BROADCAST_ENDPOINT` |
| X投稿 | config.js `X_POST_ENDPOINT` |

**新規API/DBテーブル: なし**

---

**文書作成日**: 2025年11月13日
**最終更新**: 2026年01月31日
**バージョン**: 2.4（スマホ版管理画面設計追加）
**ステータス**: 第1フェーズ完了、AI記事生成実装済み、静的ページ生成設計完了、スマホ版管理画面設計追加
**次回レビュー**: 第2フェーズ開始時