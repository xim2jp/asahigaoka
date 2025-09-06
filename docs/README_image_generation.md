# 🎨 画像生成ルール

## 基本方針
**ユーザーから「画像を作成して」「画像を生成して」などの依頼があった場合、必ずDALL-E 3 APIを使用すること。**

## 使用するAPI
- **エンドポイント**: `https://aclxgnopf472sawl2taqsvvq2m0slnzz.lambda-url.ap-northeast-1.on.aws/`
- **方式**: AWS Lambda Function URL経由でDALL-E 3を呼び出し
- **認証**: 不要（Lambda内でOpenAI APIキーを管理）

## 実行方法
必ず以下のcurlコマンドを使用して画像を生成すること：

```bash
curl -X POST "https://aclxgnopf472sawl2taqsvvq2m0slnzz.lambda-url.ap-northeast-1.on.aws/" \
  -H "Content-Type: application/json" \
  -d '{
    "prompt": "[ユーザーの要求に基づいたプロンプト]",
    "size": "[サイズ選択]",
    "quality": "[品質選択]",
    "style": "[スタイル選択]"
  }' -s
```

## パラメータ説明
- **prompt**: 生成したい画像の詳細な説明（日本語可）
- **size**: 
  - `"1024x1024"` - 正方形（デフォルト）
  - `"1024x1792"` - 縦長（ポートレート）
  - `"1792x1024"` - 横長（ランドスケープ）
- **quality**: 
  - `"standard"` - 標準品質（高速）
  - `"hd"` - 高画質（推奨）
- **style**: 
  - `"vivid"` - 鮮やかで劇的な表現
  - `"natural"` - 自然でリアルな表現

## 生成後の処理
1. **画像URLの提示**: 生成されたURLをユーザーに提示
2. **ダウンロード**: 必要に応じてwgetで画像をダウンロード
3. **確認**: Readツールで画像を表示して確認

## 注意事項
- 生成された画像URLは**約2時間**で有効期限が切れる
- 画像はMicrosoft Azure Blob Storage（OpenAIのインフラ）でホスティングされる
- 生成には10-20秒程度かかる場合がある
- 1画像あたり$0.040-$0.080の料金が発生する

## 禁止事項
- 他の画像生成API（Google Imagen、Replicateなど）の使用は禁止
- ローカルでの画像生成ツールの使用は禁止
- 必ず上記のLambda Function URL経由でDALL-E 3を使用すること