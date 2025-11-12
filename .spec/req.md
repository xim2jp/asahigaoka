# 東京都練馬区旭丘一丁目町会 ホームページシステム 要件定義書

## 1. システム概要

### 1.1 目的
- 町会の最新情報を一元管理し、複数チャネル（Web、LINE、X）への効率的な配信を実現
- 若い世代・子育て世代の町会活動への参加促進
- 地域コミュニティの強化と情報共有の活性化

### 1.2 スコープ

本システムは以下のコンポーネントで構成される：

1. **管理ダッシュボード** - 町会スタッフ向けの記事管理インターフェース
2. **AIアシスタント** - チャットでのWebサイト更新支援機能（新規）
3. **Webサイト** - 公開ページ（TOP、最新記事、カレンダー表示等）
4. **LINE統合** - LINE Official Accountへの記事配信とカレンダーUI
5. **X統合** - X（旧Twitter）への自動投稿
6. **API層** - AWS Lambda/API Gatewayでの動的処理

### 1.3 対象ユーザー
- **管理ユーザー（町会スタッフ）** - 記事作成・編集・公開
- **一般ユーザー（町会住民）** - Webサイト閲覧、LINE友だち、X情報購読

---

## 2. 機能要件

### 2.1 管理ダッシュボード機能（新規実装）

#### 2.1.1 記事管理

- **記事作成・編集・削除**
  - タイトル、本文、アイキャッチ画像
  - 公開日時、カテゴリ、タグの設定
  - 公開/下書き状態の管理
  - プレビュー機能

#### 2.1.2 カテゴリ管理

- あらかじめ定義されたカテゴリ：
  - お知らせ
  - イベント情報
  - 防災・防犯
  - 子育て支援
  - 商店街情報
  - 活動レポート

#### 2.1.3 配信管理

- LINE配信タイミングの設定（即座/予約）
- X投稿タイミングの設定
- SNS投稿用の文言カスタマイズ

#### 2.1.4 メディア管理

- 画像のアップロード・削除
- 画像の最適化（リサイズ等）
- アイキャッチ画像の推奨サイズ案内

#### 2.1.5 知識ベース管理（Dify Knowledge API連携）（新規）

管理画面から町会情報の資料をアップロードし、Dify の Knowledge Base に登録する機能。

- **資料アップロード**
  - PDF、Word（.docx）、テキストファイル等をアップロード
  - ドラッグ＆ドロップ対応
  - 複数ファイル一括アップロード

- **テキスト抽出処理**
  - Lambda でファイルからテキストを抽出
  - PDF: PyPDF2 or pdfplumber
  - Word: python-docx
  - テキストファイル: 直接読み込み

- **QA形式への変換**
  - 抽出したテキストを QA（Question & Answer）形式に自動変換
  - Claude API を使用して「想定される質問」と「回答」のペアを生成
  - 例：
    - Q: 「次のイベントはいつですか？」
    - A: 「次回の餅つき大会は12月15日（日）10:00から開催予定です。」

- **Dify Knowledge API 連携**
  - 変換した QA データを Dify Knowledge API に登録
  - Dify 内部でベクトルDB が自動構築される
  - API エンドポイント: `POST /v1/datasets/{dataset_id}/documents`

- **登録済み資料の管理**
  - 資料一覧表示（ファイル名、登録日時、ステータス）
  - 資料の削除（Dify Knowledge API から削除）
  - 資料の再インデックス（更新時）

- **ステータス表示**
  - アップロード中：「処理中...」
  - テキスト抽出中：「テキスト抽出中...」
  - QA変換中：「QA形式に変換中...」
  - Dify登録中：「Knowledge Base に登録中...」
  - 完了：「登録完了」

#### 2.1.6 管理画面アーキテクチャ（SPA実装）

管理画面は `/admin` フォルダ以下に配置される静的ファイルベースのSPA（Single Page Application）で実装される：

- **フロントエンド構成**
  - HTML5 + CSS3 + Vanilla JavaScript（フレームワークなし）
  - ローカルストレージによるセッション管理
  - API Gateway との通信（REST API）

- **展開構造**
  ```
  /admin/
    ├── index.html           # 管理画面のエントリーポイント
    ├── css/
    │   ├── style.css        # 共通スタイル
    │   └── admin.css        # 管理画面固有スタイル
    ├── js/
    │   ├── app.js           # メインアプリケーション
    │   ├── api.js           # API通信モジュール
    │   ├── auth.js          # 認証管理
    │   └── components/      # UIコンポーネント
    │       ├── editor.js
    │       ├── medialist.js
    │       └── dashboard.js
    ├── images/              # 管理画面用アイコン・画像
    └── manifest.json        # PWA設定（オプション）
  ```

- **動作フロー**
  1. ユーザーが `/admin/` にアクセス
  2. 静的ファイル（HTML/CSS/JS）がロード
  3. JavaScript が API Gateway と通信
  4. 記事データを取得・操作
  5. SPA として動的にUIを更新

- **認証フロー**
  1. ログイン画面で ID/パスワード入力
  2. `/api/auth/login` エンドポイントで認証
  3. JWT トークンをレスポンスで受け取り
  4. 以降のリクエストに Authorization ヘッダーで付与
  5. トークンはセッションストレージに保存

### 2.2 Webサイト機能（拡張・新規）

#### 2.2.1 TOPページ
- **最新情報セクション**（従来から実装）
  - 最新5件の記事表示
  - 「詳細へ」リンク

- **町会活動ハイライト**（従来から実装）
  - ピックアップ記事（管理画面で指定）
  - 画像付き簡潔説明

#### 2.2.2 最新記事ページ（新規）

**記事一覧表示**
- 全記事のリスト表示
- ページング対応
- カテゴリ別フィルタリング
- 日付ソート（新着順/古い順）
- 検索機能（タイトル・本文の全文検索）

**記事詳細表示**
- フルテキスト表示
- 公開日時表示
- カテゴリ・タグ表示
- 前後の記事への移動リンク

**カレンダー表示（新規）**
- イベント記事を月間カレンダーに表示
- 日付クリックで当日の記事を表示
- カテゴリで色分け表示
- モバイルレスポンシブ対応

#### 2.2.3 既存ページの更新
- 記事データベース連携による動的コンテンツ化
- 自動更新に対応

### 2.3 LINE統合機能（拡張）

#### 2.3.1 記事配信
- 新着記事の自動配信
  - テンプレートメッセージ形式
  - タイトル + 抜粋 + 詳細リンク
  - 画像の表示対応

#### 2.3.2 LINEカレンダーUI
- イベント一覧のカレンダー表示
- リッチメニューでのアクセス
- 日付選択時にイベント詳細を表示
- LINE内でのURL遷移

#### 2.3.3 グループチャット対応

- 子育てグループへの配信
- 防災グループへの配信
- イベント企画グループへの配信

#### 2.3.4 AI自動応答機能（RAG システム - Dify 実装）（新規）

公式LINEアカウントへの一般ユーザーからの問い合わせに、Dify のノーコードツールで構築した RAG システムで自動応答する機能。

- **基本機能**
  - ユーザーからのメッセージを受信（LINE Webhook）
  - Lambda が Dify API を呼び出し
  - Dify が Knowledge Base を検索して回答を生成
  - LINE Message API 経由で自動返信

- **RAG システムの仕組み（Dify ベース）**
  - **知識ベース構築**：Dify Knowledge API を使用してベクトルDB を自動構築
  - **ベクトル検索**：Dify 内部でエンベディング化と類似度検索を実行
  - **回答生成**：Dify のノーコードツールで設定した LLM（Claude 等）が回答を生成

- **フロー**
  ```
  LINE ユーザー
    ↓ (メッセージ送信)
  LINE Message API (Webhook)
    ↓
  AWS Lambda (line-webhook-handler)
    ↓
  Dify API (Chat Completion)
    ↓ (Knowledge Base 検索 + 回答生成)
  Lambda (応答受信)
    ↓
  LINE Message API (Reply)
    ↓
  LINE ユーザー (回答受信)
  ```

- **対応可能な質問例**
  - 「次のイベントはいつですか？」
  - 「ゴミ出しのルールを教えてください」
  - 「防災訓練の日程を教えて」
  - 「町会費の支払い方法は？」

- **応答できない場合の処理**
  - Dify で設定したフォールバックメッセージを返却
  - 例：「申し訳ございません、その質問には回答できません。詳しくは町会事務局までお問い合わせください。」
  - 管理画面に未回答の質問をログとして記録（今後のFAQ追加に活用）

- **会話履歴の記録**
  - LINE ユーザーID、質問内容、回答内容、タイムスタンプを記録
  - Dify Conversation API で会話履歴を管理
  - 改善のためのフィードバック収集（オプション）

- **セキュリティ・プライバシー**
  - 個人情報を含む質問には応答しない（Dify プロンプト設定で制御）
  - 会話履歴は匿名化して保存

### 2.4 X（Twitter）統合機能（新規）

#### 2.4.1 自動投稿
- 新着記事の投稿（タイトル + ハッシュタグ + URL）
- 画像の自動添付
- ハッシュタグ活用（#旭丘一丁目）
- 投稿スケジュール設定対応

#### 2.4.2 投稿管理

- 投稿予約機能
- 投稿履歴表示
- 投稿のキャンセル機能

### 2.5 AIアシスタント機能（新規）

管理画面でAIチャット機能を提供し、ユーザーが自然言語で静的なHTMLの更新を依頼可能にする。

#### 2.5.1 AIチャット基本機能

- **チャット UI**
  - 管理画面の右側またはモーダルウィンドウに「AIアシスタント」チャット欄を配置
  - メッセージ入力欄とチャット履歴表示
  - 過去のチャット会話を保存・表示

- **自然言語処理**
  - 日本語での指示・依頼をAIが理解
  - 例：「TOPページのお知らせセクションの背景色を青から緑に変更してください」
  - 複数ターンの会話に対応（文脈理解）

#### 2.5.2 HTML生成・提案機能

- **コード生成**
  - ユーザーの依頼内容を理解し、対応する静的HTMLファイルを生成
  - 必要に応じてCSSやJavaScriptも提案

- **差分表示・プレビュー**
  - 現在のコードと変更後のコードの差分を表示
  - 変更内容を画面上でプレビュー表示

#### 2.5.3 確認・承認フロー

- **変更内容の確認**
  - 提案されたコード変更をユーザーが確認
  - 承認ボタンで実際にファイルを更新
  - キャンセルで却下

- **ファイル更新実行**
  - 承認後、AWS Lambda にリクエストを送信
  - 対象ファイルをリポジトリに更新（GitHub, S3等）

#### 2.5.4 履歴・ログ管理

- **チャット履歴保存**
  - AI との会話履歴を記録
  - 過去の依頼内容や実施内容を参照可能

- **変更履歴**
  - ファイル更新時のバージョン管理
  - 変更前後の内容を記録
  - ロールバック機能対応

#### 2.5.5 AI機能の制約

- **対象ファイル制限**
  - 更新可能な対象ファイルを明確に制限
  - 例：`/index.html`, `/css/*.css`, `/js/*.js` など

- **セキュリティ**
  - 危険なコードの生成を防ぐ
  - AI生成コードの検証・サニタイズ
  - 非編集権限ユーザーは AIアシスタント機能を使用禁止

---

## 3. 非機能要件

### 3.1 パフォーマンス
- Web ページ読み込み時間：3秒以内
- 記事一覧取得：1秒以内
- 記事検索結果表示：2秒以内
- API応答時間：500ms以内

### 3.2 スケーラビリティ
- 同時接続数：1000人以上対応
- 月間アクティブユーザー：500人以上の想定
- レコード数：初期1000件、年間500件追加想定

### 3.3 可用性
- サービス稼働率：99%以上（月間）
- 計画メンテナンス：月1回、夜間実施

### 3.4 セキュリティ

- SSL/TLS暗号化（HTTPS）
- 管理画面へのアクセス認証
  - ユーザー認証（ID/パスワード）
  - または OAuth2（Google/Microsoft）
- 個人情報の保護（PII検出・マスキング）
- API認証（APIキー/トークン）
- CSRF対策
- SQLインジェクション対策
- XSS対策

- **AI機能関連のセキュリティ**
  - AI生成コードの検証・サニタイズ（危険なコード、外部スクリプト注入の防止）
  - ファイル更新権限の厳格化（管理者のみがAI提案を承認可能）
  - AIチャット履歴の暗号化保存
  - AIプロンプトインジェクション対策
  - 対象ファイルのホワイトリスト管理（許可ファイルのみ更新可能）
  - ファイル変更時の変更ログ記録と追跡
  - 変更内容のレビュー・承認プロセス

### 3.5 運用・保守性

- **管理画面UI**
  - 直感的で操作しやすいダッシュボードデザイン
  - ツールチップ・ヘルプテキスト完備
  - エラーメッセージの明確な表示

- **バックアップ・復旧**
  - 日次自動バックアップ
  - 30日間の世代管理
  - 復旧テストの定期実施

- **監視・ログ**
  - AWS CloudWatch によるメトリクス監視
  - API エラーログ記録
  - ユーザーアクション監査ログ
  - アラート設定（異常時の通知）

- **インシデント対応**
  - インシデント対応計画の策定
  - 24時間体制での対応体制（フェーズ1では対応チームを確保）

### 3.6 ユーザビリティ
- スマートフォンファースト設計
- レスポンシブデザイン（PC/タブレット対応）
- 直感的な操作性
- アクセシビリティ対応（WCAG 2.1 Level A）
- 日本語のみ（初版）

---

## 4. システム構成

### 4.1 アーキテクチャ全体

```
┌──────────────────────────────────────────────────────────┐
│                    ユーザーインターフェース                  │
├──────────────┬────────────────┬────────────────┬─────────┤
│  Webサイト   │  管理画面SPA   │ LINE Official  │ X API   │
│ （/index）   │  （/admin）    │   Account      │（Twitter）
│HTML/CSS/JS   │ + AI チャット  │                │         │
└──────────────┴────────────────┴────────────────┴─────────┘
      ↓               ↓                    ↓          ↓
┌──────────────────────────────────────────────────────────┐
│        API Gateway + AWS Lambda（業務ロジック層）          │
│  - 記事CRUD操作（/api/articles）                         │
│  - 認証・ユーザー管理（/api/auth）                       │
│  - 画像アップロード（/api/media）                        │
│  - LINE配信処理（/api/line）                            │
│  - X投稿処理（/api/x）                                 │
│  - AIチャット処理（/api/ai/chat）     ──→ Claude API   │
│  - ファイル変更提案（/api/ai/changes）                   │
│  - 検索・フィルタリング（/api/search）                   │
└──────────────────────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────────────────────┐
│         記事データベース（無料クラウドサービス）             │
│  - Firebase Firestore / Supabase / Airtable             │
│  - テーブル: articles, users, categories, media,        │
│    ai_chat_history, file_change_history                 │
└──────────────────────────────────────────────────────────┘
              ↓
┌──────────────────────────────────────────────────────────┐
│        ストレージ（AWS S3 / Firebase Storage）             │
│  - アイキャッチ画像                                       │
│  - 媒体ファイル                                           │
│  - Webサイト静的ファイル（管理画面から更新）              │
└──────────────────────────────────────────────────────────┘
```

### 4.2 技術スタック（確定）

| レイヤー | 技術 | 備考 |
|---------|------|------|
| 公開Webサイト | HTML5 + CSS3 + Vanilla JavaScript | `/` ディレクトリ、外部依存最小化 |
| 管理画面（SPA） | HTML5 + CSS3 + Vanilla JavaScript | `/admin` ディレクトリ、REST API 連携 |
| バックエンド API | AWS Lambda + API Gateway | Python/Node.js でビジネスロジック実装 |
| API 認証 | JWT（JSON Web Token） | ステートレス認証、Authorization ヘッダー |
| データベース | 無料クラウドサービス | Firebase Firestore / Supabase 推奨 |
| SNS連携 | LINE Messaging API + X API v2 | 公式 API 使用 |
| ストレージ | AWS S3 / Firebase Storage | 画像・ファイル保管 |
| AI / LLM | Claude API（Anthropic） | 自然言語処理、コード生成に使用 |

### 4.3 外部サービス連携

| サービス | 用途 | 費用 |
|---------|------|------|
| LINE Official Account | メッセージ配信 | 無料～従量課金 |
| X API | 投稿自動化 | 無料（無料枠内） |
| Firebase / Supabase | データベース | 無料～従量課金 |
| AWS Lambda | バックエンド | 従量課金（無料枠有） |
| AWS API Gateway | API提供 | 従量課金 |
| AWS S3 | 画像ストレージ | 従量課金（無料枠有） |
| Claude API（Anthropic） | AI チャット、コード生成 | 従量課金 |

### 4.4 管理画面SPA詳細設計

#### 4.4.1 ディレクトリ構成

```
/admin/
├── index.html              # エントリーポイント
├── css/
│   ├── common.css          # 共通スタイル（色、フォント等）
│   ├── layout.css          # レイアウトスタイル
│   ├── admin.css           # 管理画面固有スタイル
│   └── responsive.css      # レスポンシブスタイル
├── js/
│   ├── app.js              # アプリケーション起動・ルーティング
│   ├── api.js              # API通信ユーティリティ
│   ├── auth.js             # 認証・セッション管理
│   ├── storage.js          # ローカルストレージ管理
│   └── components/         # UIコンポーネント
│       ├── header.js       # ヘッダーコンポーネント
│       ├── sidebar.js      # サイドバー（ナビゲーション）
│       ├── dashboard.js    # ダッシュボード
│       ├── editor.js       # 記事エディタ
│       ├── medialist.js    # メディア管理
│       ├── aiassistant.js  # AIアシスタントチャット欄
│       ├── aichanges.js    # AI提案内容の差分・承認UI
│       └── settings.js     # 設定画面
├── images/
│   ├── logo.svg            # ロゴ
│   ├── icons/              # アイコンセット
│   └── placeholder.png     # プレースホルダー画像
├── lib/
│   └── marked.min.js       # Markdown パーサー（オプション）
└── manifest.json           # PWA マニフェスト（オプション）
```

#### 4.4.2 API通信設計

管理画面は以下のAPIエンドポイントと通信：

```json
認証関連:
  POST /api/auth/login       - ログイン
  POST /api/auth/logout      - ログアウト
  GET  /api/auth/me          - ユーザー情報取得

記事管理:
  GET    /api/articles       - 記事一覧取得
  GET    /api/articles/{id}  - 記事詳細取得
  POST   /api/articles       - 記事作成
  PUT    /api/articles/{id}  - 記事更新
  DELETE /api/articles/{id}  - 記事削除

メディア:
  POST   /api/media/upload   - 画像アップロード
  DELETE /api/media/{id}     - 画像削除

SNS配信:
  POST   /api/articles/{id}/publish-line   - LINE配信実行
  POST   /api/articles/{id}/publish-x      - X投稿実行
```

#### 4.4.3 ローカルストレージ管理

```javascript
localStorage:
  - auth_token          : JWT トークン
  - user_id             : ユーザーID
  - user_name           : ユーザー名
  - last_login          : 最終ログイン時刻

sessionStorage:
  - draft_article       : 下書き記事（一時保存）
  - ui_state            : UI状態（開いているモーダル等）
```

#### 4.4.4 エラーハンドリング

- API エラー（401, 403, 500等）を適切に処理
- ネットワークエラーの自動リトライ（3回まで）
- ユーザーフレンドリーなエラーメッセージ表示
- オフライン時の機能制限と通知

#### 4.4.5 セキュリティ対策

- **XSS対策**: DOM要素への直接的なHTML設定を避け、`textContent` を使用
- **CSRF対策**: API通信時に CSRF トークンをヘッダーに付与
- **入力検証**: フォーム送信時にクライアント側でバリデーション
- **トークン管理**: JWTトークンの有効期限確認と自動更新

#### 4.4.6 パフォーマンス最適化

- **キャッシング**: 記事一覧、カテゴリデータをメモリキャッシュ
- **遅延ロード**: 大容量画像は遅延ロード対応
- **バンドルサイズ**: 外部ライブラリの最小化（Vanilla JS推奨）
- **API最適化**: 不要なリクエストの排除、データのページング

#### 4.4.7 AIアシスタント実装フロー（Cursor Agent + GitHub + Netlify）

AIチャット機能でのHTML更新は、以下の複雑なワークフローを採用：

**フロー全体：**

```
①ユーザープロンプト入力
   ↓
②管理画面 → Lambda (/api/ai/chat)
   ↓
③Lambda：プロンプト + 現在のリポジトリコードを取得
   ↓
④Lambda → ECS タスク起動（プロンプト付き）
   ↓
⑤ECS：リポジトリをクローン
   ↓
⑥ECS：Cursor Agent 実行（プロンプト通りにコード修正）
   ↓
⑦ECS：git commit + git push（feature ブランチへ）
   ↓
⑧GitHub：PR 作成（gh-pages ブランチへのマージ予定）
   ↓
⑨PR作成時点で gh-pages へ自動マージ
   ↓
⑩Netlify プレビュー サイト デプロイ（gh-pages から）
   ↓
⑪管理画面に通知：「PR作成、Netlify プレビュー可能」
   ↓
⑫ユーザーが Netlify で変更内容をレビュー
   ↓
⑬管理画面から「適用」ボタンをクリック
   ↓
⑭Lambda：main ブランチへのマージを実行
   ↓
⑮GitHub Actions (deploy.yml) トリガー
   ↓
⑯GitHub Actions：S3 へのデプロイ実行
   ↓
⑰本番環境に反映完了
```

**詳細な技術スタック：**

| コンポーネント | 技術 | 役割 |
|-------------|------|------|
| 管理画面（SPA） | Vanilla JavaScript | ユーザープロンプト入力、AI提案の確認・承認 |
| API Gateway | AWS | REST API エンドポイント |
| Lambda（メイン） | Python/Node.js | ECS タスク起動、GitHub マージ処理、データベース管理 |
| ECS（タスク） | Docker コンテナ | Cursor Agent 実行環境 |
| Cursor Agent | Node.js ベース | リポジトリクローン、コード修正、commit/push |
| GitHub（リポジトリ） | Git | ソース管理、ブランチ戦略 |
| GitHub Actions | YAML (deploy.yml) | S3 へのデプロイ自動化 |
| Netlify | CI/CD | gh-pages からのプレビューサイト自動デプロイ |
| AWS S3 | 静的ホスティング | 本番環境 （index.html, /admin, その他静的ファイル） |
| Claude API | LLM | AI コード生成の補助（Cursor Agent が呼び出す） |

**ブランチ戦略：**

```
main ブランチ
  ↓（本番・マージ可能な状態）

gh-pages ブランチ
  ↓（Netlify プレビュー用）

feature ブランチ（自動生成、一時的）
  ↓（PR作成時点で gh-pages へマージ）
  ↓（ユーザーが「適用」で main へマージ）
```

**Cursor Agent（ECS 内部）の動作：**

1. **リポジトリクローン**
   - GitHub トークンでプライベートリポジトリをクローン
   - 最新の main ブランチから新しい feature ブランチを作成

2. **コード修正**
   - ユーザープロンプトに従い、Cursor Agent が該当ファイル（HTML/CSS/JS）を修正
   - 修正内容を画面に表示（差分表示）

3. **git 操作**
   ```bash
   git checkout -b feature/ai-change-{timestamp}
   # ファイル修正
   git add .
   git commit -m "AI: {プロンプト要約}"
   git push origin feature/ai-change-{timestamp}
   ```

4. **PR 作成**
   - GitHub CLI (`gh pr create`) で gh-pages へのマージを指定
   - PR 説明に修正内容を自動記載

5. **gh-pages への自動マージ**
   - PR 作成時に GitHub Actions または Lambda が即座にマージ

**Lambda（AI チャット処理）の実装詳細：**

```python
# AWS Lambda 関数構成例

def lambda_handler(event, context):
    user_prompt = event['message']
    user_id = event['user_id']

    # 1. 現在のリポジトリコードを取得（S3 or GitHub から）
    repo_code = fetch_latest_repo_code()

    # 2. Cursor Agent 用のプロンプトを構築
    cursor_prompt = build_cursor_prompt(user_prompt, repo_code)

    # 3. ECS タスクを起動
    ecs_response = start_ecs_task(
        task_definition='cursor-agent-task',
        overrides={
            'environment': [
                {'name': 'USER_PROMPT', 'value': cursor_prompt},
                {'name': 'GITHUB_TOKEN', 'value': get_github_token()},
                {'name': 'AI_SESSION_ID', 'value': session_id}
            ]
        }
    )

    # 4. ECS タスク実行状況をデータベースに記録
    save_ai_session(user_id, user_prompt, ecs_response['taskArn'])

    # 5. 管理画面にフィードバック（非同期）
    return {
        'status': 'processing',
        'session_id': session_id,
        'message': 'ECS タスクで修正を処理中です...'
    }

def merge_to_main(event, context):
    """ユーザーが「適用」を押した時のハンドラー"""
    change_id = event['change_id']
    user_id = event['user_id']

    # 1. 承認権限チェック（admin のみ）
    if not is_admin(user_id):
        raise PermissionError("管理者のみが承認できます")

    # 2. feature ブランチから main へマージ
    pr_number = get_pr_number_from_change(change_id)
    merge_pr_to_main(pr_number)

    # 3. GitHub Actions 起動を待つ
    # (deploy.yml が自動的に実行される)

    return {
        'status': 'merged',
        'pr_number': pr_number,
        'message': 'main ブランチへマージしました。GitHub Actions でデプロイが実行中です。'
    }
```

**GitHub Actions（deploy.yml）の流れ：**

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
      - uses: actions/checkout@v2

      - name: Build
        run: |
          # 必要なビルド処理
          echo "Building..."

      - name: Deploy to S3
        run: |
          aws s3 sync . s3://asahigaoka-website --delete

      - name: Cloudfront Cache Invalidation
        run: |
          aws cloudfront create-invalidation \
            --distribution-id ${{ secrets.CLOUDFRONT_DISTRIBUTION_ID }} \
            --paths "/*"
```

**管理画面での表示フロー：**

1. ユーザーが AI チャット欄でプロンプント入力
2. ECS タスク起動中：「処理中...」表示
3. ECS 完了 & PR 作成：「Netlify プレビューを確認する」ボタン表示
4. ユーザーが Netlify でレビュー確認後、管理画面に戻る
5. 「適用」ボタンをクリック → main マージ → S3 デプロイ
6. デプロイ完了通知：「本番環境に反映されました」

**セキュリティ・権限管理：**

- ECS 内 Cursor Agent：GitHub トークンは Lambda から環境変数で注入（シークレット管理）
- main へのマージ：Lambda が権限チェック（`is_admin()` で管理者のみ）
- PR 作成：Cursor Agent が使用する GitHub トークンは read-only に制限可能
- S3 デプロイ：GitHub Actions が AWS 認証情報を使用（IAM ロール）

---

## 5. データベース仕様

### 5.1 記事テーブル（Articles）

| カラム | データ型 | 説明 | 必須 |
|-------|--------|------|------|
| id | String | 記事ID（UUID） | ○ |
| title | String | 記事タイトル | ○ |
| content | Text | 本文内容 | ○ |
| excerpt | String | 抜粋（SNS配信用） | ○ |
| category | String | カテゴリ（enum） | ○ |
| tags | Array<String> | タグ配列 | × |
| featured_image_url | String | アイキャッチ画像URL | × |
| author | String | 投稿者名 | ○ |
| published_at | Timestamp | 公開日時 | ○ |
| created_at | Timestamp | 作成日時 | ○ |
| updated_at | Timestamp | 更新日時 | ○ |
| status | String | 公開/下書き | ○ |
| line_published | Boolean | LINE配信済み | ○ |
| x_published | Boolean | X投稿済み | ○ |

### 5.2 カテゴリマスタ

| カテゴリ名 | ID | 説明 |
|-----------|-----|------|
| お知らせ | notice | 一般的なお知らせ |
| イベント情報 | event | イベント・行事 |
| 防災・防犯 | disaster_safety | 防災・防犯情報 |
| 子育て支援 | child_support | 子育て関連情報 |
| 商店街情報 | shopping_info | 商店街・地域ビジネス情報 |
| 活動レポート | activity_report | 活動実績報告 |

### 5.3 ユーザー管理テーブル（Users - 管理画面用）

| カラム | データ型 | 説明 | 必須 |
|-------|--------|------|------|
| id | String | ユーザーID | ○ |
| email | String | メールアドレス | ○ |
| name | String | ユーザー名 | ○ |
| role | String | 権限（admin/editor） | ○ |
| created_at | Timestamp | 作成日時 | ○ |

### 5.4 AIチャット履歴テーブル（AI_Chat_History）

| カラム | データ型 | 説明 | 必須 |
|-------|--------|------|------|
| id | String | チャットセッションID（UUID） | ○ |
| user_id | String | ユーザーID（外部キー） | ○ |
| message_type | String | メッセージ種別（user/assistant） | ○ |
| content | Text | メッセージ内容 | ○ |
| created_at | Timestamp | メッセージ送信時刻 | ○ |

### 5.5 ファイル変更履歴テーブル（File_Change_History）

| カラム | データ型 | 説明 | 必須 |
|-------|--------|------|------|
| id | String | 変更ID（UUID） | ○ |
| user_id | String | 承認したユーザーID | ○ |
| file_path | String | 変更対象ファイルパス | ○ |
| change_type | String | 変更種別（create/update/delete） | ○ |
| old_content | Text | 変更前の内容 | × |
| new_content | Text | 変更後の内容 | ○ |
| ai_request_id | String | 対応するAIチャットセッションID | × |
| status | String | ステータス（pending/approved/rejected） | ○ |
| created_at | Timestamp | 変更リクエスト時刻 | ○ |
| approved_at | Timestamp | 承認時刻 | × |

### 5.6 知識ベースドキュメント管理テーブル（Knowledge_Documents）

| カラム | データ型 | 説明 | 必須 |
|-------|--------|------|------|
| id | String | ドキュメントID（UUID） | ○ |
| file_name | String | ファイル名 | ○ |
| file_type | String | ファイル形式（pdf/docx/txt） | ○ |
| file_url | String | S3等のファイル保存先URL | ○ |
| dify_document_id | String | Dify の Document ID | ○ |
| dify_dataset_id | String | Dify の Dataset ID | ○ |
| status | String | processing/completed/failed | ○ |
| uploaded_by | String | アップロードしたユーザーID | ○ |
| qa_count | Integer | 生成されたQAペア数 | × |
| created_at | Timestamp | アップロード日時 | ○ |
| indexed_at | Timestamp | Dify登録完了日時 | × |

### 5.7 LINE会話履歴テーブル（LINE_Conversations）

| カラム | データ型 | 説明 | 必須 |
|-------|--------|------|------|
| id | String | 会話ID（UUID） | ○ |
| line_user_id | String | LINE ユーザーID（匿名化） | ○ |
| message_type | String | user/assistant | ○ |
| content | Text | メッセージ内容 | ○ |
| dify_conversation_id | String | Dify の Conversation ID | × |
| response_time_ms | Integer | 応答時間（ミリ秒） | × |
| is_fallback | Boolean | フォールバック応答フラグ | ○ |
| created_at | Timestamp | 送信時刻 | ○ |

---

## 6. API仕様（AWS Lambda）

### 6.0 認証API

#### 6.0.1 ログイン

```
POST /api/auth/login
Content-Type: application/json

Request:
{
  "email": "staff@example.com",
  "password": "password123"
}

Response: 200 OK
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": "user_001",
    "name": "田中太郎",
    "email": "staff@example.com",
    "role": "editor"
  },
  "expires_in": 3600
}

Error: 401 Unauthorized
{
  "error": "Invalid credentials"
}
```

#### 6.0.2 ログアウト

```
POST /api/auth/logout
Authorization: Bearer {token}

Response: 200 OK
{
  "success": true
}
```

#### 6.0.3 ユーザー情報取得

```
GET /api/auth/me
Authorization: Bearer {token}

Response: 200 OK
{
  "id": "user_001",
  "name": "田中太郎",
  "email": "staff@example.com",
  "role": "editor"
}
```

### 6.1 記事API

#### 6.1.1 記事一覧取得
```
GET /articles
Query: ?category=event&limit=20&offset=0
Response: { articles: [], total: 100 }
```

#### 6.1.2 記事詳細取得
```
GET /articles/{id}
Response: { article: {...} }
```

#### 6.1.3 記事作成
```
POST /articles
Body: { title, content, excerpt, category, tags, featured_image_url }
Auth: 必須
Response: { article_id, created_at }
```

#### 6.1.4 記事更新
```
PUT /articles/{id}
Body: { title, content, excerpt, category, tags, featured_image_url, status }
Auth: 必須
Response: { updated_at }
```

#### 6.1.5 記事削除
```
DELETE /articles/{id}
Auth: 必須
Response: { success: true }
```

### 6.2 検索API

#### 6.2.1 全文検索
```
GET /search
Query: ?q=キーワード&category=&limit=20
Response: { results: [], count: 5 }
```

### 6.3 LINE連携API

#### 6.3.1 LINE配信実行

```
POST /api/line/send
Body: { article_id, target_group: "all" | "group_name" }
Auth: 必須
Response: { sent_count: 100, success: true }
```

#### 6.3.2 LINE Webhook（ユーザーメッセージ受信）

```
POST /api/line/webhook
Content-Type: application/json
X-Line-Signature: {signature}

Request Body (LINE Platform):
{
  "events": [
    {
      "type": "message",
      "replyToken": "xxx",
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

処理フロー:
1. LINE署名検証
2. Dify API呼び出し（Chat Completion）
3. Dify応答を受信
4. LINE Reply API で返信
5. 会話履歴をデータベースに記録

Response: 200 OK（LINE Platform へ）
```

### 6.4 X連携API

#### 6.4.1 X投稿実行
```
POST /x/post
Body: { article_id, schedule_time: "optional" }
Auth: 必須
Response: { tweet_id, posted_at }
```

### 6.5 AIアシスタント API

#### 6.5.1 AIチャットメッセージ送信

```
POST /api/ai/chat
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "session_id": "optional (新規の場合は生成)",
  "message": "TOPページのお知らせセクションの背景色を青から緑に変更してください"
}

Response: 200 OK
{
  "session_id": "session_12345",
  "response": "了解しました。TOPページのお知らせセクションの背景色を青から緑に変更します。\n変更内容は以下の通りです...",
  "proposed_changes": {
    "file_path": "/index.html",
    "old_code": "...",
    "new_code": "..."
  },
  "timestamp": "2025-11-13T10:30:00Z"
}
```

#### 6.5.2 AIチャット履歴取得

```
GET /api/ai/chat/history?session_id={session_id}
Authorization: Bearer {token}

Response: 200 OK
{
  "session_id": "session_12345",
  "messages": [
    {
      "type": "user",
      "content": "TOPページのお知らせセクションの背景色を青から緑に変更してください",
      "timestamp": "2025-11-13T10:30:00Z"
    },
    {
      "type": "assistant",
      "content": "了解しました。変更内容は...",
      "timestamp": "2025-11-13T10:30:05Z"
    }
  ]
}
```

#### 6.5.3 ファイル変更提案の承認

```
POST /api/ai/changes/approve
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "change_id": "change_abc123",
  "approved": true
}

Response: 200 OK
{
  "success": true,
  "file_path": "/index.html",
  "message": "ファイルが更新されました",
  "change_history_id": "history_xyz789"
}
```

#### 6.5.4 ファイル変更提案のキャンセル

```
POST /api/ai/changes/reject
Authorization: Bearer {token}
Content-Type: application/json

Request:
{
  "change_id": "change_abc123",
  "reason": "修正が不要です"
}

Response: 200 OK
{
  "success": true,
  "message": "提案がキャンセルされました"
}
```

#### 6.5.5 変更履歴取得

```
GET /api/ai/changes/history?limit=20&offset=0
Authorization: Bearer {token}

Response: 200 OK
{
  "total": 50,
  "changes": [
    {
      "id": "history_xyz789",
      "file_path": "/index.html",
      "status": "approved",
      "user_name": "田中太郎",
      "approved_at": "2025-11-13T10:35:00Z",
      "old_content": "...",
      "new_content": "..."
    }
  ]
}
```

### 6.6 知識ベース管理API（Dify Knowledge連携）

#### 6.6.1 資料アップロード

```
POST /api/knowledge/upload
Authorization: Bearer {token}
Content-Type: multipart/form-data

Request:
- file: (ファイル) PDF/Word/テキストファイル
- dataset_id: Dify Dataset ID（オプション、デフォルトを使用）

Response: 202 Accepted
{
  "document_id": "doc_abc123",
  "status": "processing",
  "message": "ファイルを処理中です..."
}

処理フロー:
1. ファイルを S3 にアップロード
2. Lambda でテキスト抽出
3. Claude API で QA 形式に変換
4. Dify Knowledge API に登録
5. データベースに記録
```

#### 6.6.2 登録済み資料一覧取得

```
GET /api/knowledge/documents?limit=20&offset=0
Authorization: Bearer {token}

Response: 200 OK
{
  "total": 10,
  "documents": [
    {
      "id": "doc_abc123",
      "file_name": "町会規約.pdf",
      "file_type": "pdf",
      "status": "completed",
      "qa_count": 25,
      "uploaded_by": "田中太郎",
      "created_at": "2025-11-13T10:00:00Z",
      "indexed_at": "2025-11-13T10:05:00Z"
    }
  ]
}
```

#### 6.6.3 資料削除

```
DELETE /api/knowledge/documents/{document_id}
Authorization: Bearer {token}

Response: 200 OK
{
  "success": true,
  "message": "資料を削除しました"
}

処理フロー:
1. Dify Knowledge API から削除
2. S3 ファイルを削除
3. データベースから削除
```

#### 6.6.4 Dify API 連携（内部処理）

**Dify Knowledge API エンドポイント**:
- `POST https://api.dify.ai/v1/datasets/{dataset_id}/documents`
- `DELETE https://api.dify.ai/v1/datasets/{dataset_id}/documents/{document_id}`

**Dify Chat Completion API**:
- `POST https://api.dify.ai/v1/chat-messages`
- Request:
  ```json
  {
    "inputs": {},
    "query": "ユーザーの質問",
    "response_mode": "blocking",
    "conversation_id": "optional",
    "user": "line_user_id"
  }
  ```
- Response:
  ```json
  {
    "answer": "AI の回答",
    "conversation_id": "conv_123",
    "message_id": "msg_456"
  }
  ```

---

## 7. 画面設計（UI/UXレベル）

### 7.1 Web サイト構成

**TOPページ**
- ヘッダー
- 最新情報セクション（記事5件）
- 町会活動ハイライト（ピックアップ3件）
- その他既存セクション
- フッター

**最新記事ページ（/articles または /news）**
- タイトル・説明
- ビュー切替ボタン（一覧 / カレンダー）
- フィルタ/検索ボックス
- コンテンツエリア

**記事詳細ページ（/articles/{id}）**
- 記事本文
- 関連記事リンク
- 前後の記事ナビゲーション
- シェアボタン（LINE, X, メール）

### 7.2 管理画面（SPA実装）

**ログイン画面**

- メールアドレス・パスワード入力フォーム
- 「ログイン」ボタン
- エラーメッセージ表示領域

**ダッシュボード**

- 「こんにちは、[ユーザー名]さん」ウェルカムメッセージ
- 最近の記事一覧（最新5件）
- 配信状況サマリー（今月：LINE配信数、X投稿数）
- 下書き記事件数表示
- クイックアクション（新規作成ボタン）

**記事管理画面**

- ナビゲーション：検索ボックス、フィルタドロップダウン
- 記事一覧表示（テーブル形式）
  - チェックボックス（複数選択）
  - タイトル、カテゴリ、ステータス、更新日時
  - アクション（編集、削除、配信）
- ページング（1ページ20件表示）
- 「新規作成」ボタン

**記事編集画面**

- フォームセクション：
  - タイトル（テキスト入力）
  - カテゴリ（ドロップダウン）
  - アイキャッチ画像（アップロード/削除）
  - 本文（テキストエリア）
  - 抜粋（SNS用、テキストエリア）
  - タグ（複数入力対応）
  - 公開日時（日付・時刻ピッカー）
  - ステータス（公開/下書き ラジオボタン）

- リッチテキストエディタ機能：
  - テキスト装飾（太字、斜体、下線、取消線）
  - リスト（箇条書き、番号付き）
  - 見出し（h1～h3）
  - リンク挿入
  - 画像埋め込み

- プレビューモード：
  - 編集中でもリアルタイムプレビュー表示

- SNS配信設定：
  - 「LINE配信」チェックボックス
  - 「X投稿」チェックボックス
  - 配信日時予約（日付・時刻ピッカー）

- アクションボタン：
  - 「保存」（下書き保存）
  - 「公開」（公開＆配信）
  - 「キャンセル」（戻る）

**メディア管理画面**

- ドラッグ＆ドロップアップロード領域
- アップロード済み画像一覧（グリッド表示）
- 各画像：サムネイル、ファイル名、サイズ、削除ボタン
- 画像プレビュー（クリックで拡大表示）

**AIアシスタント欄（全画面で利用可能）**

- **配置**
  - 管理画面の右側に常に表示（または折り畳み可能なサイドパネル）
  - 幅：250～400px（レスポンシブで調整）
  - 表示/非表示のトグルボタン

- **UI構成**
  - **ヘッダー**：「AIアシスタント」タイトル + 最小化/閉じるボタン

  - **チャット履歴エリア**（スクロール可能）
    - ユーザーメッセージ：右側に配置、背景色：青系
    - AIメッセージ：左側に配置、背景色：灰色系
    - タイムスタンプ表示
    - 前回のセッション履歴を表示可能（セッション選択ドロップダウン）

  - **メッセージ入力エリア**
    - テキストボックス：複数行対応、プレースホルダー「Webサイトの変更を依頼してください...」
    - 送信ボタン（Enter キーでも送信可）
    - 送信中はローディング表示

  - **AI提案内容の表示**（チャット下に展開）
    - **差分表示**：現在のコード vs 提案コード
    - **プレビュー**：「プレビューを見る」ボタンで変更後の見た目を表示
    - **アクション**：「承認」「却下」ボタン

  - **変更履歴タブ**
    - 過去の承認・却下された変更を一覧表示
    - 各行：実施日時、ファイル名、変更者、承認ステータス

- **機能**
  - セッション切り替え：ドロップダウンで過去のチャット会話を選択
  - クリアボタン：現在のセッション履歴をクリア
  - エクスポート：チャット履歴をJSON形式でダウンロード

- **セキュリティ表示**
  - AIアシスタントが「管理者のみが変更を承認できます」という注意表示
  - 危険性が高いコード提案の場合、警告メッセージを表示

---

## 8. 運用・保守要件

### 8.1 保守体制
- 定期的なセキュリティパッチ適用
- 日次バックアップ実施
- 月1回の定期メンテナンス（夜間）
- インシデント対応24時間体制

### 8.2 監視・ログ
- AWS CloudWatch でのメトリクス監視
- API エラーログ記録
- ユーザーアクション監査ログ

### 8.3 バックアップ戦略
- 毎日夜間にデータベースバックアップ
- 最低30日間の世代管理
- 災害対応用オフサイトバックアップ

### 8.4 更新・変更管理
- 管理画面を通じた非エンジニアによる記事更新
- テンプレート提供による一貫性確保
- 更新内容の履歴管理（変更前後を記録）

---

## 9. セキュリティ要件

### 9.1 認証・認可
- 管理画面ユーザーの認証
- ロールベースアクセス制御（RBAC）
  - 管理者（全操作可）
  - 編集者（記事作成・編集のみ）

### 9.2 データ保護
- 通信：HTTPS/TLS 1.2以上
- 保存時暗号化（クラウドサービス提供機能を活用）
- 個人情報の最小化（住所・電話番号等の掲載禁止）

### 9.3 入力検証・サニタイズ
- XSS対策（HTMLエスケープ）
- SQLインジェクション対策（プリペアドステートメント）
- ファイルアップロード検証（ホワイトリスト形式）

### 9.4 API セキュリティ
- APIキーによる認証
- レート制限（DDoS対策）
- CORS設定の適切な制限

---

## 10. 成功指標（KPI）

### 10.1 定量指標
| 指標 | 目標値 | 測定方法 |
|-----|-------|--------|
| 月間アクティブユーザー | 500人以上 | アクセス解析 |
| LINE登録者数 | 300人以上 | LINE Official Account管理画面 |
| イベント記事の月間閲覧数 | 1000PV以上 | Webアクセスログ |
| 記事更新頻度 | 週1回以上 | データベースログ |
| LINE配信の開封率 | 30%以上 | LINE Analytics |
| X投稿のエンゲージメント率 | 5%以上 | X Analytics |

### 10.2 定性指標
- 若い子育て世代の町会活動参加増加
- 町会スタッフの満足度向上
- 地域コミュニケーションの活性化実感
- 防災意識の向上認識

---

## 11. 実装フェーズ

### フェーズ1（1ヶ月）：基盤構築
- AWS Lambda/API Gateway 環境構築
- データベース設計・構築（Firestore or Supabase）
- API基本実装（記事CRUD）
- 管理画面UI設計

### フェーズ2（1ヶ月）：SNS連携
- LINE Messaging API 連携実装
- X API 連携実装
- 自動配信ロジック実装
- テスト・デバッグ

### フェーズ3（1ヶ月）：Web統合・公開準備
- Webサイト統合（新記事ページ、カレンダー）
- セキュリティテスト
- パフォーマンステスト
- UAT（ユーザー受け入れテスト）

### フェーズ4（1ヶ月）：試験運用
- 試験運用期間（beta版）
- フィードバック収集・改善
- 本番環境への切り替え
- 運用ドキュメント作成

**推定総工期：4ヶ月**

---

## 12. 予算概算

| 項目 | 金額（税抜） | 備考 |
|-----|-----------|------|
| システム開発（AWS Lambda, API）| 150-200万円 | 既存Webサイト活用 |
| 管理画面実装（Dify連携等） | 50-80万円 | ノーコード・ローコード活用 |
| SNS連携実装 | 30-50万円 | LINE, X連携 |
| テスト・品質保証 | 30-50万円 | | **初期開発費用 小計** | **260-380万円** | |
| | | |
| AWS月額費用 | 15-30万円/年 | Lambda, API Gateway, S3 |
| Firestore/Supabase | 10-20万円/年 | 従量課金 |
| LINE Official Account | 0-5万円/年 | メッセージ料金 |
| 保守・運用 | 50-100万円/年 | エンジニア対応 |
| **年間運用費用 小計** | **75-155万円/年** | |

---

## 13. リスク管理

| リスク | 影響度 | 対策 |
|-------|--------|------|
| SNS API 仕様変更 | 中 | 定期的な動作確認、API更新への迅速な対応 |
| クラウドサービス障害 | 高 | 複数サービスの冗長化検討、バックアップ体制強化 |
| セキュリティ脆弱性 | 高 | 定期的な脆弱性スキャン、ペネトレーションテスト |
| ユーザー採用率低迷 | 中 | 段階的な普及啓発、インセンティブ設計 |
| データ量増大への対応 | 低 | スケーラビリティ設計を初期段階から考慮 |

---

## 14. 附則

### 14.1 用語定義
- **記事** - タイトル、本文、画像を含む情報発信コンテンツ
- **カテゴリ** - 記事を分類するためのグループ
- **配信** - Web、LINE、X等への情報発信
- **ユーザー** - システムの利用者（管理ユーザー、一般ユーザーの両方）

### 14.2 画像生成について
画像が必要となった場合は、`docs/README_image_generation.md`を参照し、適切に実施すること。

### 14.3 将来の拡張性
本システムは以下の拡張を想定して設計されている：
- 多言語対応（英語、中国語）
- イベント申込機能の追加
- ボランティアマッチング機能
- 地域商店街との連携強化

---

**文書作成日**: 2025年11月13日
**最終更新日**: 2025年11月13日
**ステータス**: 要件定義完了

