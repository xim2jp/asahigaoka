"""
Dify API プロキシ Lambda関数
記事生成のためのDify APIを安全に呼び出すプロキシ
"""
import json
import os
import urllib.request
import urllib.error
from typing import Dict, Any


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda ハンドラー関数

    Args:
        event: API Gatewayからのイベント
        context: Lambda コンテキスト

    Returns:
        API Gatewayレスポンス
    """
    # CORSヘッダー（開発環境用に全オリジンを許可）
    # 本番環境では特定のオリジンのみに制限することを推奨
    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }

    # プリフライトリクエスト（OPTIONS）の処理
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': ''
        }

    try:
        # リクエストボディをパース
        if 'body' not in event:
            return error_response('リクエストボディがありません', 400, cors_headers)

        body = json.loads(event['body'])

        # 必須パラメータのバリデーション
        # image_url がある場合は title, summary, date は任意（Dify側で生成/補完を期待）
        image_url = body.get('image_url')
        if not image_url:
            required_fields = ['title', 'summary', 'date']
            for field in required_fields:
                if field not in body:
                    return error_response(f'{field} は必須です', 400, cors_headers)

        # Dify API呼び出し
        result = call_dify_api(
            title=body.get('title', ''),
            summary=body.get('summary', ''),
            date=body.get('date', ''),
            date_to=body.get('date_to'),
            intro_url=body.get('intro_url', 'https://asahigaoka-nerima.tokyo/town.html'),
            image_url=image_url
        )

        return {
            'statusCode': 200,
            'headers': {
                **cors_headers,
                'Content-Type': 'application/json'
            },
            'body': json.dumps(result, ensure_ascii=False)
        }

    except json.JSONDecodeError:
        return error_response('不正なJSONフォーマットです', 400, cors_headers)
    except Exception as e:
        print(f'エラー: {str(e)}')
        return error_response(f'サーバーエラー: {str(e)}', 500, cors_headers)


def call_dify_api(title: str, summary: str, date: str, date_to: str = None, intro_url: str = None, image_url: str = None) -> Dict[str, Any]:
    """
    Dify APIを呼び出す

    Args:
        title: 記事タイトル
        summary: 記事概要（下書き）
        date: 記事の開始日付
        date_to: 記事の終了日付（オプション）
        intro_url: イントロURL
        image_url: 画像URL（オプション）

    Returns:
        API レスポンス
    """
    # 環境変数からAPIキーとエンドポイントを取得
    api_key = os.environ.get('DIFY_API_KEY')
    api_endpoint = os.environ.get('DIFY_API_ENDPOINT')

    if not api_key:
        raise ValueError('DIFY_API_KEY が設定されていません')
    if not api_endpoint:
        raise ValueError('DIFY_API_ENDPOINT が設定されていません')

    # header.
    # header.
    # header.
    # header.

    # リクエストボディを構築
    inputs = {
        'date': date,
        'title': title,
        'summary': summary,
        'intro_url': intro_url or 'https://asahigaoka-nerima.tokyo/town.html'
    }

    # date_to がある場合は追加
    if date_to:
        inputs['date_to'] = date_to
    
    # image_url がある場合は picture 変数を追加
    if image_url:
        inputs['picture'] = [
            {
                'type': 'image',
                'transfer_method': 'remote_url',
                'url': image_url
            }
        ]

    request_body = {
        'inputs': inputs,
        'response_mode': 'blocking',
        'user': 'asahigaoka-cms'
    }

    # HTTPリクエストを作成
    headers = {
        'Authorization': f'Bearer {api_key}',
        'Content-Type': 'application/json'
    }

    data = json.dumps(request_body).encode('utf-8')
    req = urllib.request.Request(
        api_endpoint,
        data=data,
        headers=headers,
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            response_data = json.loads(response.read().decode('utf-8'))

            # レスポンスからtext350とtext80を抽出
            if 'data' in response_data and 'outputs' in response_data['data']:
                outputs = response_data['data']['outputs']

                # usageフィールドからJSONを抽出
                if 'usage' in outputs:
                    usage_text = outputs['usage']
                    # Markdownのコードブロックを除去
                    if '```json' in usage_text:
                        # ```json と ``` の間のJSONを抽出
                        import re
                        json_match = re.search(r'```json\s*\n(.*?)\n```', usage_text, re.DOTALL)
                        if json_match:
                            usage_json = json.loads(json_match.group(1))
                            return {
                                'success': True,
                                'data': {
                                    'text350': usage_json.get('text350', ''),
                                    'text80': usage_json.get('text80', ''),
                                    'meta_desc': usage_json.get('meta_desc', ''),
                                    'meta_kwd': usage_json.get('meta_kwd', '')
                                }
                            }
                    # Markdownブロックがない場合は直接パース
                    try:
                        usage_json = json.loads(usage_text)
                        return {
                            'success': True,
                            'data': {
                                'text350': usage_json.get('text350', ''),
                                'text80': usage_json.get('text80', ''),
                                'meta_desc': usage_json.get('meta_desc', ''),
                                'meta_kwd': usage_json.get('meta_kwd', '')
                            }
                        }
                    except json.JSONDecodeError:
                        pass

                # 従来の形式もサポート（text350とtext80が直接outputsに含まれる場合）
                return {
                    'success': True,
                    'data': {
                        'text350': outputs.get('text350', ''),
                        'text80': outputs.get('text80', '')
                    }
                }
            else:
                raise ValueError('レスポンスの形式が不正です')

    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        print(f'Dify API HTTPエラー: {e.code} - {error_body}')
        raise Exception(f'Dify API呼び出しエラー: {e.code}')
    except urllib.error.URLError as e:
        print(f'Dify API 接続エラー: {str(e)}')
        raise Exception('Dify APIへの接続に失敗しました')


def error_response(message: str, status_code: int, headers: Dict[str, str]) -> Dict[str, Any]:
    """
    エラーレスポンスを生成

    Args:
        message: エラーメッセージ
        status_code: HTTPステータスコード
        headers: レスポンスヘッダー

    Returns:
        エラーレスポンス
    """
    return {
        'statusCode': status_code,
        'headers': {
            **headers,
            'Content-Type': 'application/json'
        },
        'body': json.dumps({
            'success': False,
            'error': message
        }, ensure_ascii=False)
    }
