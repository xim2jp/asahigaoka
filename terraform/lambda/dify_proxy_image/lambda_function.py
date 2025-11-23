"""
Dify API プロキシ Lambda関数（画像分析用）
画像/PDF/Officeファイルからの記事生成のためのDify APIを安全に呼び出すプロキシ
"""
import json
import os
import urllib.request
import urllib.error
import base64
import uuid
import boto3
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
    # CORSヘッダー
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
        if 'request' not in body:
            return error_response('request は必須です', 400, cors_headers)

        # Dify API呼び出し
        result = call_dify_api(request=body['request'])

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


def call_dify_api(request: str) -> Dict[str, Any]:
    """
    Dify APIを呼び出す（画像分析用）

    Args:
        request: Base64エンコードされたファイルデータまたはテキスト

    Returns:
        API レスポンス
    """
    # 環境変数からAPIキーとエンドポイントを取得
    api_key = os.environ.get('DIFY_API_KEY')
    api_endpoint = os.environ.get('DIFY_API_ENDPOINT')
    s3_bucket = os.environ.get('S3_BUCKET', 'asahigaoka-nerima-tokyo')

    if not api_key:
        raise ValueError('DIFY_API_KEY が設定されていません')
    if not api_endpoint:
        raise ValueError('DIFY_API_ENDPOINT が設定されていません')

    # Base64データをデコードしてS3にアップロード
    import time
    file_data = base64.b64decode(request)

    # ユニークなファイル名を生成（タイムスタンプ + UUID）
    timestamp = int(time.time() * 1000)
    unique_id = str(uuid.uuid4())[:8]
    file_name = f"{timestamp}_{unique_id}.png"
    s3_key = f"images/news_images/{file_name}"

    # S3にアップロード
    s3_client = boto3.client('s3')
    s3_client.put_object(
        Bucket=s3_bucket,
        Key=s3_key,
        Body=file_data,
        ContentType='image/png'
    )

    # 公開URL
    file_url = f"https://asahigaoka-nerima.tokyo/{s3_key}"
    print(f"ファイルをS3にアップロード: {file_url}")

    # リクエストボディを構築
    request_body = {
        'inputs': {
            'picture': [
                {
                    'type': 'image',
                    'transfer_method': 'remote_url',
                    'url': file_url
                }
            ]
        },
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
        with urllib.request.urlopen(req, timeout=60) as response:
            response_data = json.loads(response.read().decode('utf-8'))
            print(f"Dify APIレスポンス: {json.dumps(response_data, ensure_ascii=False)}")

            # レスポンスからtext350とtext80を抽出
            if 'data' in response_data and 'outputs' in response_data['data']:
                outputs = response_data['data']['outputs']
                print(f"outputs: {json.dumps(outputs, ensure_ascii=False)}")

                # textフィールドからJSONを抽出
                if 'text' in outputs:
                    text_content = outputs['text']
                    # Markdownのコードブロックを除去
                    if '```json' in text_content:
                        import re
                        json_match = re.search(r'```json\s*\n(.*?)\n```', text_content, re.DOTALL)
                        if json_match:
                            parsed_json = json.loads(json_match.group(1))
                            return {
                                'success': True,
                                'data': {
                                    'title': parsed_json.get('meta_title', ''),
                                    'text350': parsed_json.get('text350', ''),
                                    'text80': parsed_json.get('text80', ''),
                                    'meta_desc': parsed_json.get('meta_description', ''),
                                    'meta_kwd': parsed_json.get('meta_keyword', '')
                                }
                            }
                    # Markdownブロックがない場合は直接パース
                    try:
                        parsed_json = json.loads(text_content)
                        return {
                            'success': True,
                            'data': {
                                'title': parsed_json.get('meta_title', ''),
                                'text350': parsed_json.get('text350', ''),
                                'text80': parsed_json.get('text80', ''),
                                'meta_desc': parsed_json.get('meta_description', ''),
                                'meta_kwd': parsed_json.get('meta_keyword', '')
                            }
                        }
                    except json.JSONDecodeError:
                        pass

                # 従来の形式もサポート
                return {
                    'success': True,
                    'data': {
                        'title': outputs.get('meta_title', ''),
                        'text350': outputs.get('text350', ''),
                        'text80': outputs.get('text80', ''),
                        'meta_desc': outputs.get('meta_description', ''),
                        'meta_kwd': outputs.get('meta_keyword', '')
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
