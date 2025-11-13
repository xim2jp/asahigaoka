# Supabase + Lambda API設計仕様書

## 1. API概要

### 1.1 通信規約

- **プロトコル**: HTTPS
- **ベースURL**: `https://api.asahigaoka.com` (または API Gateway URL)
- **認証**: Bearer トークン（JWT）
- **コンテンツタイプ**: `application/json`

### 1.2 レスポンス形式

**成功時 (200 OK)**:
```json
{
  "success": true,
  "data": { /* レスポンスデータ */ },
  "message": "操作成功メッセージ"
}
```

**エラー時**:
```json
{
  "success": false,
  "error": "エラーコード",
  "message": "エラーメッセージ",
  "status": 400
}
```

### 1.3 認証ヘッダー

```
Authorization: Bearer {JWT_TOKEN}
```

JWT トークンは Supabase Auth から取得

---

## 2. 認証API

### 2.1 `POST /api/auth/signup` - ユーザー登録

**説明**: 新規ユーザー登録（Supabase Auth）

**Request**:
```json
{
  "email": "user@example.com",
  "password": "securepassword123",
  "name": "田中太郎"
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "email_confirmed_at": null
    },
    "session": {
      "access_token": "eyJhbGc...",
      "refresh_token": "xxxxxxxxxxxx",
      "expires_in": 3600
    }
  },
  "message": "登録確認メールを送信しました"
}
```

**Error (400)**:
```json
{
  "success": false,
  "error": "user_already_exists",
  "message": "このメールアドレスは既に登録されています"
}
```

**実装詳細**:
- Supabase Auth の `signUpWithPassword()` を使用
- メール確認フロー開始
- ユーザー登録時に `users` テーブルに profile を作成

---

### 2.2 `POST /api/auth/login` - ログイン

**説明**: メール・パスワード認証

**Request**:
```json
{
  "email": "user@example.com",
  "password": "securepassword123"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "user@example.com",
      "name": "田中太郎",
      "role": "editor"
    },
    "session": {
      "access_token": "eyJhbGc...",
      "refresh_token": "xxxxxxxxxxxx",
      "expires_in": 3600
    }
  }
}
```

**Error (401)**:
```json
{
  "success": false,
  "error": "invalid_credentials",
  "message": "メールアドレスまたはパスワードが正しくありません"
}
```

**実装詳細**:
- Supabase Auth の `signInWithPassword()` を使用
- `users` テーブルから profile 情報を取得
- セッション情報をレスポンス

---

### 2.3 `POST /api/auth/refresh` - トークン更新

**説明**: リフレッシュトークンで新しいアクセストークンを取得

**Request**:
```json
{
  "refresh_token": "xxxxxxxxxxxx"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "access_token": "eyJhbGc...",
    "expires_in": 3600
  }
}
```

---

### 2.4 `POST /api/auth/logout` - ログアウト

**説明**: セッション終了

**Authorization**: 必須

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "ログアウトしました"
}
```

**実装詳細**:
- Supabase Auth の `signOut()` を使用
- クライアント側でトークンをクリア

---

### 2.5 `GET /api/auth/me` - ユーザー情報取得

**説明**: 現在のユーザー情報を取得

**Authorization**: 必須

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "name": "田中太郎",
    "role": "editor",
    "avatar_url": null,
    "created_at": "2025-11-13T10:00:00Z"
  }
}
```

---

## 3. 記事管理API

### 3.1 `GET /api/articles` - 記事一覧取得

**説明**: 公開済み記事一覧を取得（全員アクセス可）

**Query Parameters**:
```
?category=event
&limit=20
&offset=0
&sort_by=published_at
&sort_order=desc
&search=キーワード
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "articles": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "イベント情報：餅つき大会",
        "excerpt": "今年の餅つき大会を開催します...",
        "content": "...",
        "category": "event",
        "tags": ["イベント", "季節"],
        "featured_image_url": "https://...",
        "author": {
          "id": "...",
          "name": "田中太郎"
        },
        "status": "published",
        "published_at": "2025-11-13T10:00:00Z",
        "created_at": "2025-11-13T09:00:00Z",
        "updated_at": "2025-11-13T09:30:00Z"
      }
    ],
    "total": 100,
    "page": 1,
    "per_page": 20
  }
}
```

**実装詳細**:
- RLS で公開済み記事のみ返却
- フルテキスト検索対応
- ページング対応

---

### 3.2 `GET /api/articles/{id}` - 記事詳細取得

**説明**: 特定の記事詳細を取得

**Path Parameters**:
- `id`: 記事ID (UUID)

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "イベント情報：餅つき大会",
    "content": "本文...",
    "category": "event",
    "author": {
      "id": "...",
      "name": "田中太郎",
      "avatar_url": null
    },
    "published_at": "2025-11-13T10:00:00Z",
    "created_at": "2025-11-13T09:00:00Z",
    "updated_at": "2025-11-13T09:30:00Z"
  }
}
```

**Error (404)**:
```json
{
  "success": false,
  "error": "not_found",
  "message": "記事が見つかりません"
}
```

---

### 3.3 `POST /api/articles` - 記事作成

**説明**: 新規記事を作成（editor以上の権限が必須）

**Authorization**: 必須

**Request**:
```json
{
  "title": "イベント情報：餅つき大会",
  "content": "本文テキスト...",
  "excerpt": "抜粋...",
  "category": "event",
  "tags": ["イベント", "季節"],
  "featured_image_url": "https://...",
  "status": "draft",
  "published_at": "2025-12-01T10:00:00Z"
}
```

**Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "イベント情報：餅つき大会",
    "created_at": "2025-11-13T10:00:00Z"
  },
  "message": "記事を作成しました"
}
```

**Error (403)**:
```json
{
  "success": false,
  "error": "permission_denied",
  "message": "記事作成権限がありません"
}
```

**実装詳細**:
- RLS で `editor` 以上のみ作成可能
- author は auth.uid() を自動設定
- status = "draft" がデフォルト

---

### 3.4 `PUT /api/articles/{id}` - 記事更新

**説明**: 記事を更新（作成者またはadmin）

**Authorization**: 必須

**Request**:
```json
{
  "title": "更新済みタイトル",
  "content": "更新済み本文",
  "status": "published",
  "published_at": "2025-11-13T15:00:00Z"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "updated_at": "2025-11-13T11:00:00Z"
  },
  "message": "記事を更新しました"
}
```

---

### 3.5 `DELETE /api/articles/{id}` - 記事削除

**説明**: 記事を削除（admin のみ）

**Authorization**: admin のみ

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "記事を削除しました"
}
```

---

## 4. メディア/画像API

### 4.1 `POST /api/media/upload` - 画像アップロード

**説明**: 画像をアップロード（Supabase Storage）

**Authorization**: 必須

**Content-Type**: `multipart/form-data`

**Request**:
```
file: <binary image data>
```

**Response (201 Created)**:
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "file_name": "image.jpg",
    "file_url": "https://[project-id].supabase.co/storage/v1/object/public/articles-images/image.jpg",
    "file_size": 102400,
    "mime_type": "image/jpeg"
  },
  "message": "画像をアップロードしました"
}
```

**Error (413)**:
```json
{
  "success": false,
  "error": "file_too_large",
  "message": "ファイルサイズは5MB以下である必要があります"
}
```

**実装詳細**:
- Supabase Storage バケット `articles-images` にアップロード
- ファイル名にタイムスタンプを付与（重複防止）
- ファイルタイプをバリデーション（jpg, png, gif のみ）

---

### 4.2 `GET /api/media?limit=20&offset=0` - 画像一覧取得

**説明**: アップロード済み画像一覧を取得

**Authorization**: 必須

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "media": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "file_name": "image.jpg",
        "file_url": "https://...",
        "file_size": 102400,
        "uploaded_by": "田中太郎",
        "created_at": "2025-11-13T10:00:00Z"
      }
    ],
    "total": 50
  }
}
```

---

### 4.3 `DELETE /api/media/{id}` - 画像削除

**説明**: 画像を削除（admin のみ）

**Authorization**: admin のみ

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "画像を削除しました"
}
```

---

## 5. 検索API

### 5.1 `GET /api/search?q=キーワード` - 全文検索

**説明**: 記事をキーワード検索

**Query Parameters**:
```
?q=キーワード
&category=event
&limit=20
&offset=0
```

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "title": "イベント情報：餅つき大会",
        "excerpt": "本文から抽出した抜粋...",
        "category": "event",
        "published_at": "2025-11-13T10:00:00Z"
      }
    ],
    "total": 5
  }
}
```

**実装詳細**:
- PostgreSQL の `to_tsvector()` でフルテキスト検索
- 日本語検索対応（`'japanese'` config）

---

## 6. LINE連携API

### 6.1 `POST /api/line/webhook` - LINE メッセージ受信

**説明**: LINE公式アカウントからメッセージを受信

**Authorization**: X-Line-Signature ヘッダーで検証

**Request**:
```json
{
  "events": [
    {
      "type": "message",
      "replyToken": "nHuyWiB7yP5Ew52FIkcQT",
      "source": {
        "userId": "U1234567890abcdef",
        "type": "user"
      },
      "message": {
        "type": "text",
        "id": "100001",
        "text": "次のイベントはいつですか？"
      }
    }
  ]
}
```

**Processing Flow**:
1. LINE署名検証（X-Line-Signature）
2. Dify API呼び出し（RAGシステム）
3. LINE Reply API で応答返信
4. 会話履歴をDB記録

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "ウェブフックを処理しました"
}
```

**実装詳細**:
- LINE Messaging API で署名検証
- Dify API を呼び出して AI応答生成
- 会話履歴を `line_conversations` テーブルに記録

---

### 6.2 `POST /api/line/send` - LINE配信（記事配信）

**説明**: LINE公式アカウント経由で記事を配信

**Authorization**: admin のみ

**Request**:
```json
{
  "article_id": "550e8400-e29b-41d4-a716-446655440000",
  "target_group": "all"
}
```

**Response (202 Accepted)**:
```json
{
  "success": true,
  "data": {
    "sent_count": 150,
    "broadcast_id": "xxxxx"
  },
  "message": "配信を送信しました"
}
```

**実装詳細**:
- LINE Messaging API の Push API/Broadcast API を使用
- 配信済みフラグを `articles` テーブルに記録

---

## 7. ユーザー管理API（管理画面用）

### 7.1 `GET /api/users` - ユーザー一覧取得

**説明**: 全ユーザーの一覧（admin のみ）

**Authorization**: admin のみ

**Response (200 OK)**:
```json
{
  "success": true,
  "data": {
    "users": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440000",
        "email": "user@example.com",
        "name": "田中太郎",
        "role": "editor",
        "created_at": "2025-11-13T10:00:00Z"
      }
    ],
    "total": 10
  }
}
```

---

### 7.2 `PUT /api/users/{id}` - ユーザー更新

**説明**: ユーザー情報を更新（admin のみ、またはユーザー本人）

**Authorization**: admin または本人

**Request**:
```json
{
  "name": "新しい名前",
  "role": "admin"
}
```

**Response (200 OK)**:
```json
{
  "success": true,
  "message": "ユーザー情報を更新しました"
}
```

---

## 8. Dify連携API

### 8.1 `POST /api/knowledge/upload` - 知識ベース ドキュメントアップロード

**説明**: PDF等のドキュメントをアップロード → Dify Knowledge Base に登録

**Authorization**: admin のみ

**Content-Type**: `multipart/form-data`

**Request**:
```
file: <binary file data (PDF/Word/TXT)>
```

**Response (202 Accepted)**:
```json
{
  "success": true,
  "data": {
    "document_id": "doc_abc123",
    "status": "processing"
  },
  "message": "ドキュメントを処理中です..."
}
```

**Processing Flow**:
1. ファイルを S3/Supabase Storage に保存
2. テキスト抽出（PDF/Word/TXT）
3. Claude API で QA形式に変換
4. Dify Knowledge API に登録
5. DB に記録

---

## 9. エラーコード一覧

| コード | HTTP | 説明 |
|------|------|------|
| `success` | 200 | 成功 |
| `created` | 201 | 作成成功 |
| `accepted` | 202 | 受け付け |
| `invalid_request` | 400 | リクエスト不正 |
| `unauthorized` | 401 | 認証なし |
| `permission_denied` | 403 | 権限なし |
| `not_found` | 404 | 見つかりません |
| `conflict` | 409 | 競合 (重複等) |
| `file_too_large` | 413 | ファイルサイズ超過 |
| `server_error` | 500 | サーバーエラー |

---

**最終更新**: 2025年11月13日
**バージョン**: 1.0
