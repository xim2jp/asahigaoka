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
  - タブナビゲーション：基本情報 / コンテンツ / SNS配信設定 / SEO設定
  - **基本情報タブ**
    - 記事タイトル、カテゴリ、ステータス（公開/下書き）
    - 抜粋（SNS配信用概要）
    - タグ管理
    - 公開日時設定
    - **アイキャッチ画像（メイン画像）** のアップロード
  - **コンテンツタブ**
    - リッチテキストエディタ（太字・斜体・見出し・リスト等）
    - **複数ファイル添付機能**（PDF・Word・テキスト・ZIP等）
    - アップロード進捗表示
    - 添付ファイル一覧・削除機能
  - **保存機能**
    - 「保存して公開」：記事を即座に公開
    - 「下書き保存」：下書き状態で保存
    - 保存後、記事一覧ページへ自動遷移
    - 成功メッセージを非モーダル（自動消去）で表示

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

## 補足: 実装時の主要な設計変更（2025年11月14日）

### 技術スタック変更
| 項目 | 設計時 | 実装時 | 理由 |
|-----|--------|--------|------|
| データベース | Firestore | Supabase (PostgreSQL) | より柔軟なスキーマ、RLS対応 |
| バックエンド | AWS Lambda + API Gateway | Supabase JS SDK（フロントエンド） | 複雑性削減、コスト最適化 |
| 認証 | JWT（Lambda生成） | カスタムusersテーブル | シンプルなアーキテクチャ |
| ストレージ | AWS S3 | Supabase Storage | 一元管理 |

### 主要な実装成果

#### ファイル添付機能の完成
- 日本語ファイル名対応（Supabase Storage限界対応）
- ファイルタイプ自動判定
- 記事への複数ファイルリンク
- RLS ポリシー設定

#### UX 改善
- 非モーダルメッセージ表示
- localStorage 経由のメッセージング
- 自動リダイレクト

#### 開発効率向上
- Lambda 関数なし → 開発・保守が簡単
- フロントエンド集約 → デバッグ容易
- Supabase ダッシュボード → 直接DB操作可能

---

**文書作成日**: 2025年11月13日
**最終更新**: 2025年11月14日
**バージョン**: 2.0（実装ベースに更新）
**ステータス**: 第1フェーズ実装完了、設計書更新完了
**次回レビュー**: 第2フェーズ開始時