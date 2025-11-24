# この記事は、DifyのAPIを利用して、最新情報記事を自動生成する手順を示している

## APIコール方法
Bashのcurl でコールする場合は以下の通りとなるので、同じことをPHPでもJavaScriptでもPythonでも実現できれば言語は問わない。

### curlコード
```bash
curl -X POST 'http://top-overly-pup.ngrok-free.app/v1/workflows/run' \
--header 'Authorization: Bearer {api_key}' \
--header 'Content-Type: application/json' \
--data-raw '{
    "inputs": {},
    "response_mode": "blocking",
    "user": "abc-123"
}'
```
#### inputs の内容
```json
{
  "inputs": {
    "date":"2025-11-23", 
	"title":"{{title}}" , 
	"summary":"{{summary}}", 
	"intro_url":"{{intro_url}}"
  }
}
```

api_key は、.env もしくはGithubSecretに、DIFY_API_KEY_ARTICLEとして登録してある。

- date は、記事の本文を読んで、その記事の内容が発生した、もしくは発生する日付が書いてあればそれを採用
 書いて無ければ、記事の公開日付を採用
 公開日付もわからなければ本日を採用
- title は、記事のタイトルそのままでよい
- summary は、記事本文でよい
- intro_url は固定で「https://asahigaoka-nerima.tokyo/town.html」

### 返却データ
レスポンスはJSONで返ってくるので、以下の要素をJSONから発見して、フォームの本文と、SNS用短縮テキストに格納する。
- フォーム本文
text350
- SNS用短縮テキスト
text80


