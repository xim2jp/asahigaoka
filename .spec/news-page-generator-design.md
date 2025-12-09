# news.html 静的ページ生成システム 設計書

## 1. 概要

`news.html` ページは静的HTMLとして配信されているため、カレンダーの日付やイベント情報を常に最新に保つために、毎日自動更新する仕組みが必要です。

本システムは、AWS Lambda関数を使用してSupabaseから記事データを取得し、カレンダーセクションとお知らせ一覧セクションを更新したnews.htmlを生成し、GitHubのmainブランチにプッシュします。

## 2. アーキテクチャ

```
┌─────────────────┐
│  EventBridge    │
│  (日本時間0:05) │
└────────┬────────┘
         │ トリガー
         ▼
┌─────────────────┐      ┌─────────────────┐
│     Lambda      │─────▶│    Supabase     │
│ news-page-gen   │      │   (articles)    │
└────────┬────────┘      └─────────────────┘
         │
         │ 記事データ取得
         ▼
┌─────────────────┐
│  HTML生成       │
│  - カレンダー   │
│  - 一覧         │
└────────┬────────┘
         │
         │ git push
         ▼
┌─────────────────┐      ┌─────────────────┐
│     GitHub      │─────▶│   CloudFront    │
│     (main)      │      │   (CDN配信)     │
└─────────────────┘      └─────────────────┘
```

## 3. 冪等性の設計

同じ日に何度実行しても同じ結果が生成されるよう設計されています。

### 3.1 基準日の決定

- Lambda関数は**日本時間（JST）の日付**を基準日として使用
- `datetime.utcnow() + timedelta(hours=9)` で日本時間を計算
- カレンダーの「今日」のハイライトは基準日に基づいて決定

### 3.2 データの一貫性

- Supabaseから取得するデータは常に同じクエリ条件:
  - `status = 'published'`
  - `deleted_at IS NULL`
  - `order by event_start_datetime desc, published_at desc`

### 3.3 冪等性の保証

1. 同じ日に複数回実行しても、生成されるHTMLは同一
2. GitHubへのプッシュは既存ファイルのSHAを取得して更新（内容が同じなら実質変更なし）
3. コミットメッセージに日付を含める: `Update news.html - YYYY-MM-DD`

## 4. Lambda関数仕様

### 4.1 基本情報

| 項目 | 値 |
|------|-----|
| 関数名 | `news-page-generator` |
| ランタイム | Python 3.11 |
| タイムアウト | 60秒 |
| メモリ | 256MB |

### 4.2 環境変数

| 変数名 | 説明 |
|--------|------|
| `SUPABASE_URL` | Supabase プロジェクトURL |
| `SUPABASE_ANON_KEY` | Supabase 匿名キー |
| `GITHUB_TOKEN` | GitHub Personal Access Token（repo権限） |
| `GITHUB_REPO` | GitHubリポジトリ（owner/repo形式） |
| `GITHUB_BRANCH` | プッシュ先ブランチ（デフォルト: main） |

### 4.3 処理フロー

1. 日本時間の基準日を取得
2. Supabaseから公開済み記事を取得
3. `show_in_calendar = true` の記事をカレンダーにマッピング
4. `show_in_news_list = true` の記事を一覧に表示
5. 当月・来月のカレンダーHTMLを生成
6. お知らせ一覧HTMLを生成
7. テンプレートにマージして完全なHTMLを生成
8. GitHub API経由でnews.htmlをプッシュ

## 5. EventBridgeスケジュール

### 5.1 実行タイミング

- **日本時間 0:05（午前0時5分）** に毎日実行
- Cron式: `cron(5 15 * * ? *)` （UTC 15:05）

### 5.2 スケジュール設計理由

- 日付が変わった直後に実行することで、カレンダーの「今日」が正しく更新される
- 5分のオフセットは、日付変更の境界を安全に越えるため

## 6. カレンダー表示仕様

### 6.1 表示期間

- 当月（現在の月）
- 来月（次の月）

### 6.2 イベント表示条件

記事が以下の条件を満たす場合、カレンダーに表示:

1. `status = 'published'`（公開済み）
2. `show_in_calendar = true`
3. `event_start_datetime` が設定されている

### 6.3 イベントの表示

- 該当日のセルにイベントタイトルを表示
- タイトルは最大2行で切り詰め
- クリックで記事詳細ページ（`news/{slug}.html`）にジャンプ

## 7. お知らせ一覧表示仕様

### 7.1 表示条件

記事が以下の条件を満たす場合、一覧に表示:

1. `status = 'published'`（公開済み）
2. `show_in_news_list = true`

### 7.2 表示順序

- `event_start_datetime` の降順（イベント日優先）
- `published_at` の降順

### 7.3 表示項目

- アイキャッチ画像（設定されている場合）
- 公開日（日本語形式: YYYY年MM月DD日（曜日））
- タイトル
- SNS配信アイコン（LINE配信済み、X投稿済み）

### 7.4 表示件数

- 最大30件

## 8. Terraform リソース

### 8.1 リソース一覧

| リソースタイプ | 名前 | 説明 |
|--------------|------|------|
| `aws_lambda_function` | `news_page_generator` | Lambda関数 |
| `aws_iam_role` | `news_page_generator_lambda` | Lambda実行ロール |
| `aws_cloudwatch_log_group` | `/aws/lambda/news-page-generator` | ログ |
| `aws_cloudwatch_event_rule` | `news_page_generator_schedule` | スケジュールルール |
| `aws_cloudwatch_event_target` | - | Lambda実行ターゲット |
| `aws_lambda_permission` | - | EventBridgeからの実行許可 |

### 8.2 必要な変数

```hcl
variable "supabase_url" {}
variable "supabase_anon_key" {}
variable "github_token" {}
variable "github_repo" {}      # デフォルト: "asahigaoka/asahigaoka"
variable "github_branch" {}    # デフォルト: "main"
```

## 9. デプロイ手順

### 9.1 前提条件

1. Terraformがインストールされている
2. AWSクレデンシャルが設定されている
3. GitHub Personal Access Tokenを取得済み（repo権限）

### 9.2 デプロイ

```bash
cd terraform

# 変数ファイルを作成または更新
# ※ すべての値は .env ファイルに記載済み
cat >> terraform.tfvars <<EOF
supabase_url      = "https://swaringqrzthsdpsyoft.supabase.co"
supabase_anon_key = "<.envのAnon Public Keyを参照>"
github_token      = "<.envのGITHUB_PERSONAL_ACCESS_TOKENを参照>"
github_repo       = "asahigaoka/asahigaoka"
github_branch     = "main"
EOF

# 計画
terraform plan

# 適用
terraform apply
```

### 9.3 環境変数の参照元

| 変数 | 参照元 |
|------|--------|
| `supabase_url` | `.env` の Project-ID から構成: `https://{Project-ID}.supabase.co` |
| `supabase_anon_key` | `.env` の `Anon Public Key` |
| `github_token` | `.env` の `GITHUB_PERSONAL_ACCESS_TOKEN` |

### 9.4 手動実行（テスト）

AWSコンソールまたはAWS CLIから手動でLambdaを実行:

```bash
aws lambda invoke \
  --function-name news-page-generator \
  --payload '{}' \
  response.json
```

## 10. 監視・運用

### 10.1 ログ

CloudWatch Logsに出力:
- パス: `/aws/lambda/news-page-generator`
- 保持期間: 14日

### 10.2 アラート（推奨）

- Lambda実行エラー
- 実行時間超過
- GitHub APIエラー

### 10.3 トラブルシューティング

| 問題 | 原因 | 対処 |
|------|------|------|
| 記事が表示されない | `show_in_news_list`がfalse | 記事の設定を確認 |
| カレンダーにイベントがない | `show_in_calendar`がfalse、または`event_start_datetime`未設定 | 記事の設定を確認 |
| GitHubプッシュ失敗 | トークン期限切れ | 新しいトークンを発行 |
| タイムアウト | ネットワーク遅延 | タイムアウト値を増加 |

## 11. 記事詳細ページ生成機能

### 11.1 概要

記事の保存・削除時に個別の詳細ページ（`news/{slug}.html`）を生成・削除するLambda関数。
API Gateway経由で呼び出され、記事IDと削除フラグをパラメータとして受け取る。

### 11.2 Lambda関数仕様

| 項目 | 値 |
|------|-----|
| 関数名 | `news-detail-page-generator` |
| ランタイム | Python 3.11 |
| タイムアウト | 60秒 |
| メモリ | 256MB |

### 11.3 環境変数

| 変数名 | 説明 |
|--------|------|
| `SUPABASE_URL` | Supabase プロジェクトURL |
| `SUPABASE_ANON_KEY` | Supabase 匿名キー |
| `GITHUB_TOKEN` | GitHub Personal Access Token（repo権限） |
| `GITHUB_REPO` | GitHubリポジトリ（owner/repo形式） |
| `GITHUB_BRANCH` | プッシュ先ブランチ（デフォルト: main） |

### 11.4 APIパラメータ

```json
{
  "article_id": "uuid-string",
  "delete_flag": false
}
```

| パラメータ | 型 | 必須 | 説明 |
|------------|-----|------|------|
| `article_id` | string | ○ | 記事のUUID |
| `delete_flag` | boolean | ○ | true: 削除、false: 生成/更新 |

### 11.5 処理フロー

#### 生成/更新時（delete_flag = false）

1. GitHubから`news/news_template.html`テンプレートを取得
2. Supabaseから記事情報を取得（`articles`テーブル）
3. Supabaseから添付ファイル情報を取得（`article_attachments`テーブル）
4. テンプレートのプレースホルダーを記事データで置換
5. GitHubに`news/{slug}.html`をプッシュ

#### 削除時（delete_flag = true）

1. Supabaseから記事のslugを取得
2. GitHubから`news/{slug}.html`を削除

### 11.6 テンプレート変数

`news/news_template.html`で使用される変数：

| 変数 | 説明 |
|------|------|
| `{{meta_title}}` | SEO用タイトル |
| `{{meta_description}}` | SEO用説明文 |
| `{{meta_keywords}}` | SEO用キーワード |
| `{{featured_image_url}}` | アイキャッチ画像URL |
| `{{article_url}}` | 記事の完全URL |
| `{{title}}` | 記事タイトル |
| `{{category}}` | カテゴリID |
| `{{category_label}}` | カテゴリ表示名 |
| `{{published_at}}` | 公開日（ISO形式） |
| `{{published_at_formatted}}` | 公開日（日本語形式） |
| `{{event_datetime_formatted}}` | イベント日時（日本語形式） |
| `{{content}}` | 記事本文（HTML） |
| `{{article_url_encoded}}` | シェア用URLエンコード済みURL |
| `{{title_encoded}}` | シェア用URLエンコード済みタイトル |

### 11.7 添付ファイルセクション

添付ファイルがある場合、以下の形式で表示：

```html
<a href="{file_url}" class="attachment-item" download="{file_name}" target="_blank">
  <div class="attachment-icon {file_type}">
    <i class="ri-file-{file_icon}-line"></i>
  </div>
  <div class="attachment-info">
    <div class="attachment-name">{file_name}</div>
    <div class="attachment-size">{file_size_formatted}</div>
  </div>
  <i class="ri-download-line attachment-download"></i>
</a>
```

### 11.8 Terraformリソース

| リソースタイプ | 名前 | 説明 |
|--------------|------|------|
| `aws_lambda_function` | `news_detail_page_generator` | Lambda関数 |
| `aws_iam_role` | `news_detail_page_generator_lambda` | Lambda実行ロール |
| `aws_cloudwatch_log_group` | `/aws/lambda/news-detail-page-generator` | ログ |
| `aws_api_gateway_resource` | `generate_detail_page` | APIエンドポイント |
| `aws_lambda_permission` | - | API Gatewayからの実行許可 |

### 11.9 APIエンドポイント

- **パス**: `/generate-detail-page`
- **メソッド**: POST
- **Content-Type**: application/json

### 11.10 レスポンス

成功時：
```json
{
  "statusCode": 200,
  "body": {
    "success": true,
    "message": "Detail page generated successfully",
    "file_path": "news/example-article.html"
  }
}
```

削除成功時：
```json
{
  "statusCode": 200,
  "body": {
    "success": true,
    "message": "Detail page deleted successfully",
    "file_path": "news/example-article.html"
  }
}
```

エラー時：
```json
{
  "statusCode": 500,
  "body": {
    "success": false,
    "error": "エラーメッセージ"
  }
}
```

## 12. 今後の拡張

- [ ] ページネーションの静的生成
- [ ] キャッシュ無効化（CloudFront Invalidation）の自動実行
- [ ] 差分検知による不要なプッシュの回避
