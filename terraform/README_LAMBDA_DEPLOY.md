# Dify API Proxy Lambda デプロイガイド

## 概要

Dify APIを安全に呼び出すためのLambdaプロキシ機能をTerraformでデプロイする手順。

## アーキテクチャ

```
フロントエンド (JavaScript)
    ↓
API Gateway (https://wgoz4zndo3.execute-api.ap-northeast-1.amazonaws.com/prod/generate-article)
    ↓
Lambda Function (Python 3.11)
    ↓
Dify API (http://top-overly-pup.ngrok-free.app/v1/workflows/run)
```

## セキュリティ上の利点

- APIキーがフロントエンドに露出しない
- Lambda環境変数で安全に管理
- CORSによるオリジン制限
- API Gatewayでリクエスト制御可能

## デプロイ手順

### 1. 前提条件

- AWS CLIが設定済み
- Terraformがインストール済み（>= 1.0）
- 適切なAWS認証情報が設定済み

### 2. 初期化

```bash
cd terraform
terraform init
```

### 3. 変数の設定

`terraform.tfvars` ファイルを編集（既に作成済み）：

```hcl
dify_api_key      = "app-MJJsu5NIf9bMpTtTDnW5CVli"
dify_api_endpoint = "http://top-overly-pup.ngrok-free.app/v1/workflows/run"
```

**注意**: `terraform.tfvars` は `.gitignore` に含まれており、リポジトリにコミットされません。

### 4. プランの確認

```bash
terraform plan -out=plan.tfplan
```

### 5. デプロイ実行

```bash
terraform apply plan.tfplan
```

### 6. エンドポイントURLの取得

デプロイ後、以下のコマンドでAPIエンドポイントURLを取得：

```bash
terraform output dify_proxy_api_endpoint
```

出力例：
```
https://wgoz4zndo3.execute-api.ap-northeast-1.amazonaws.com/prod/generate-article
```

### 7. フロントエンドの設定更新

取得したエンドポイントURLを `admin/js/config.js` に設定：

```javascript
window.DIFY_PROXY_ENDPOINT = 'https://YOUR_API_ENDPOINT/prod/generate-article';
```

**注意**: この手順は既に完了済みです。

## 作成されるリソース

- **Lambda Function**: `dify-api-proxy`
  - Runtime: Python 3.11
  - Timeout: 30秒
  - 環境変数: DIFY_API_KEY, DIFY_API_ENDPOINT

- **API Gateway**: `dify-proxy-api`
  - ステージ: `prod`
  - エンドポイント: `/generate-article`
  - メソッド: POST, OPTIONS (CORS)

- **IAM Role**: `dify-proxy-lambda-role`
  - CloudWatch Logs書き込み権限

- **CloudWatch Logs**: `/aws/lambda/dify-api-proxy`
  - 保持期間: 7日

## API仕様

### リクエスト

**エンドポイント**: `POST /generate-article`

**ヘッダー**:
```
Content-Type: application/json
```

**ボディ**:
```json
{
  "title": "記事タイトル",
  "summary": "記事の下書き内容",
  "date": "2025-11-23",
  "intro_url": "https://asahigaoka-nerima.tokyo/town.html"
}
```

### レスポンス

**成功時**:
```json
{
  "success": true,
  "data": {
    "text350": "生成された記事本文（350文字程度）",
    "text80": "SNS用抜粋（80文字程度）"
  }
}
```

**エラー時**:
```json
{
  "success": false,
  "error": "エラーメッセージ"
}
```

## トラブルシューティング

### Lambda実行エラー

CloudWatch Logsで確認：

```bash
aws logs tail /aws/lambda/dify-api-proxy --follow
```

### CORSエラー

オリジンが `https://asahigaoka-nerima.tokyo` であることを確認してください。
ローカル開発の場合は、Lambda関数の CORS 設定を一時的に変更する必要があります。

### APIキーの更新

1. `terraform.tfvars` を更新
2. `terraform apply` を再実行

```bash
terraform apply
```

## クリーンアップ

リソースを削除する場合：

```bash
terraform destroy
```

**注意**: 実行前に必ず確認してください。

## ファイル構成

```
terraform/
├── main.tf                           # メインのTerraform設定
├── terraform.tfvars                  # 変数値（.gitignoreに含まれる）
├── terraform.tfvars.example          # 変数値のサンプル
├── .gitignore                        # Git無視ファイル
├── lambda/
│   └── dify_proxy/
│       ├── lambda_function.py        # Lambda関数コード
│       └── requirements.txt          # Python依存関係（空）
└── README_LAMBDA_DEPLOY.md           # このファイル
```

## メンテナンス

### Lambda関数コードの更新

1. `terraform/lambda/dify_proxy/lambda_function.py` を編集
2. `terraform apply` を実行して自動デプロイ

Terraformが自動的にZIPファイルを作成し、Lambda関数を更新します。

### モニタリング

CloudWatch Logsで以下を確認できます：

- API呼び出しログ
- エラーログ
- レスポンス時間

## 参考

- [AWS Lambda ドキュメント](https://docs.aws.amazon.com/lambda/)
- [API Gateway ドキュメント](https://docs.aws.amazon.com/apigateway/)
- [Terraform AWS Provider](https://registry.terraform.io/providers/hashicorp/aws/latest/docs)
