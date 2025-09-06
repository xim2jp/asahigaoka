# Terraformセットアップ手順

## 前提条件
- Terraformがインストールされていること（v1.0以上）
- AWS CLIがインストールされていること
- AWSアカウントの認証情報が設定されていること
- Route53にドメイン`asahigaoka-nerima.tokyo`が既に登録されていること

## セットアップ手順

### 1. AWS認証情報の設定
```bash
export AWS_ACCESS_KEY_ID="your-access-key"
export AWS_SECRET_ACCESS_KEY="your-secret-key"
export AWS_DEFAULT_REGION="ap-northeast-1"
```

### 2. Terraformの初期化
```bash
cd terraform
terraform init
```

### 3. リソースの確認
```bash
terraform plan
```

### 4. リソースの作成
```bash
terraform apply
```
確認プロンプトが表示されたら`yes`を入力

### 5. GitHub Secretsの設定
GitHub リポジトリの Settings > Secrets and variables > Actions で以下のシークレットを設定：
- `AWS_ACCESS_KEY_ID`: AWSアクセスキーID
- `AWS_SECRET_ACCESS_KEY`: AWSシークレットアクセスキー

## 作成されるリソース
- S3バケット: `asahigaoka-nerima-tokyo`
- CloudFrontディストリビューション
- ACM証明書（us-east-1リージョン）
- Route53 Aレコード

## 注意事項
- ACM証明書の検証には数分かかる場合があります
- CloudFrontの配信開始には15-30分程度かかります
- 初回デプロイ後、`https://asahigaoka-nerima.tokyo/`でアクセス可能になります

## リソースの削除
```bash
terraform destroy
```

## トラブルシューティング
- Route53ホストゾーンが見つからない場合は、事前に作成してください
- S3バケット名が既に使用されている場合は、`main.tf`の`bucket_name`を変更してください