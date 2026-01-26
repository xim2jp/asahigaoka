"""
LINE Webhook Lambda関数
LINEからのメッセージを受信し、Dify APIで応答を生成して返信する
"""
import base64
import hashlib
import hmac
import json
import logging
import os
import urllib.error
import urllib.request
from typing import Any, Dict, Optional

LOGGER = logging.getLogger()
LOGGER.setLevel(logging.INFO)

# 環境変数
LINE_CHANNEL_SECRET = os.environ.get("LINE_CHANNEL_SECRET")
LINE_CHANNEL_ACCESS_TOKEN = os.environ.get("LINE_CHANNEL_ACCESS_TOKEN")
DIFY_API_KEY = os.environ.get("DIFY_API_KEY")
DIFY_API_ENDPOINT = os.environ.get("DIFY_API_ENDPOINT", "http://top-overly-pup.ngrok-free.app/v1/chat-messages")

# Supabase設定（会話履歴保存用）
SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_KEY")

# LINE API エンドポイント
LINE_REPLY_URL = "https://api.line.me/v2/bot/message/reply"


class ConfigError(Exception):
    """設定エラー"""
    pass


class SignatureVerificationError(Exception):
    """署名検証エラー"""
    pass


def validate_configuration() -> None:
    """環境変数の検証"""
    if not LINE_CHANNEL_SECRET:
        raise ConfigError("LINE_CHANNEL_SECRET が設定されていません")
    if not LINE_CHANNEL_ACCESS_TOKEN:
        raise ConfigError("LINE_CHANNEL_ACCESS_TOKEN が設定されていません")
    if not DIFY_API_KEY:
        raise ConfigError("DIFY_API_KEY が設定されていません")


def verify_signature(body: str, signature: str) -> bool:
    """
    LINE署名を検証する

    Args:
        body: リクエストボディ
        signature: X-Line-Signature ヘッダーの値

    Returns:
        検証結果
    """
    if not LINE_CHANNEL_SECRET:
        return False

    hash_value = hmac.new(
        LINE_CHANNEL_SECRET.encode('utf-8'),
        body.encode('utf-8'),
        hashlib.sha256
    ).digest()

    expected_signature = base64.b64encode(hash_value).decode('utf-8')
    return hmac.compare_digest(signature, expected_signature)


def call_dify_api(query: str, user_id: str, conversation_id: str = "") -> Dict[str, Any]:
    """
    Dify Chat API を呼び出す

    Args:
        query: ユーザーからの質問
        user_id: LINE ユーザーID
        conversation_id: 会話ID（継続する場合）

    Returns:
        API レスポンス
    """
    request_body = {
        "inputs": {},
        "query": query,
        "response_mode": "blocking",
        "conversation_id": conversation_id,
        "user": f"line_user_{user_id}"
    }

    headers = {
        "Authorization": f"Bearer {DIFY_API_KEY}",
        "Content-Type": "application/json"
    }

    data = json.dumps(request_body).encode('utf-8')
    req = urllib.request.Request(
        DIFY_API_ENDPOINT,
        data=data,
        headers=headers,
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=25) as response:
            response_data = json.loads(response.read().decode('utf-8'))
            LOGGER.info(f"Dify API response: {json.dumps(response_data, ensure_ascii=False)[:500]}")

            # 回答が空の場合はデフォルトメッセージを使用
            answer = response_data.get("answer", "")
            if not answer or not answer.strip():
                answer = "申し訳ございません。回答を生成できませんでした。もう一度お試しください。"

            return {
                "success": True,
                "answer": answer,
                "conversation_id": response_data.get("conversation_id", "")
            }
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        LOGGER.error(f"Dify API HTTP error: {e.code} - {error_body}")
        return {
            "success": False,
            "answer": "申し訳ございません。現在AIアシスタントが混み合っております。しばらくしてからお試しください。",
            "conversation_id": ""
        }
    except urllib.error.URLError as e:
        LOGGER.error(f"Dify API connection error: {str(e)}")
        return {
            "success": False,
            "answer": "申し訳ございません。AIアシスタントに接続できませんでした。",
            "conversation_id": ""
        }
    except Exception as e:
        LOGGER.error(f"Dify API unexpected error: {str(e)}")
        return {
            "success": False,
            "answer": "申し訳ございません。予期しないエラーが発生しました。",
            "conversation_id": ""
        }


def reply_to_line(reply_token: str, message: str) -> bool:
    """
    LINE Reply APIでメッセージを返信する

    Args:
        reply_token: リプライトークン
        message: 返信メッセージ

    Returns:
        送信成功かどうか
    """
    headers = {
        "Content-Type": "application/json",
        "Authorization": f"Bearer {LINE_CHANNEL_ACCESS_TOKEN}"
    }

    # メッセージが長すぎる場合は分割
    max_length = 5000
    messages = []

    if len(message) <= max_length:
        messages.append({"type": "text", "text": message})
    else:
        # 5000文字で分割
        for i in range(0, len(message), max_length):
            messages.append({"type": "text", "text": message[i:i + max_length]})
        # LINEは最大5メッセージまで
        messages = messages[:5]

    payload = json.dumps({
        "replyToken": reply_token,
        "messages": messages
    }).encode('utf-8')

    req = urllib.request.Request(
        LINE_REPLY_URL,
        data=payload,
        headers=headers,
        method='POST'
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as response:
            LOGGER.info(f"LINE reply success: {response.getcode()}")
            return True
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        LOGGER.error(f"LINE reply error: {e.code} - {error_body}")
        return False
    except Exception as e:
        LOGGER.error(f"LINE reply unexpected error: {str(e)}")
        return False


def get_conversation_id(line_user_id: str) -> Optional[str]:
    """
    Supabaseから直近の会話IDを取得する

    Args:
        line_user_id: LINE ユーザーID

    Returns:
        会話ID（なければNone）
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        return None

    endpoint = f"{SUPABASE_URL}/rest/v1/line_conversations"
    params = f"line_user_id=eq.{line_user_id}&message_type=eq.assistant&select=dify_conversation_id&order=created_at.desc&limit=1"
    url = f"{endpoint}?{params}"

    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json'
    }

    req = urllib.request.Request(url, headers=headers, method='GET')

    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            data = json.loads(response.read().decode('utf-8'))
            if data and len(data) > 0:
                return data[0].get('dify_conversation_id')
            return None
    except Exception as e:
        LOGGER.warning(f"Failed to get conversation ID: {str(e)}")
        return None


def save_conversation(
    line_user_id: str,
    message_type: str,
    content: str,
    dify_conversation_id: str = None,
    response_time_ms: int = None,
    is_fallback: bool = False
) -> None:
    """
    Supabaseに会話履歴を保存する

    Args:
        line_user_id: LINE ユーザーID
        message_type: メッセージタイプ（user / assistant）
        content: メッセージ内容
        dify_conversation_id: Dify会話ID
        response_time_ms: 応答時間（ミリ秒）
        is_fallback: フォールバック応答かどうか
    """
    if not SUPABASE_URL or not SUPABASE_KEY:
        LOGGER.warning("Supabase not configured, skipping conversation save")
        return

    endpoint = f"{SUPABASE_URL}/rest/v1/line_conversations"

    payload = {
        'line_user_id': line_user_id,
        'message_type': message_type,
        'content': content[:10000],  # 最大10000文字に制限
        'is_fallback': is_fallback
    }

    if dify_conversation_id:
        payload['dify_conversation_id'] = dify_conversation_id
    if response_time_ms is not None:
        payload['response_time_ms'] = response_time_ms

    headers = {
        'apikey': SUPABASE_KEY,
        'Authorization': f'Bearer {SUPABASE_KEY}',
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
    }

    data = json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(endpoint, data=data, headers=headers, method='POST')

    try:
        with urllib.request.urlopen(req, timeout=5) as response:
            LOGGER.info(f"Conversation saved: {message_type}")
    except Exception as e:
        LOGGER.error(f"Failed to save conversation: {str(e)}")


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda ハンドラー関数

    Args:
        event: API Gateway からのイベント
        context: Lambda コンテキスト

    Returns:
        API Gateway レスポンス
    """
    LOGGER.info(f"Received event: {json.dumps(event)[:1000]}")

    # CORS プリフライトリクエスト対応
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST,OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type,X-Line-Signature'
            },
            'body': json.dumps({'status': 'ok'})
        }

    try:
        # 設定の検証
        validate_configuration()

        # リクエストボディの取得
        body = event.get('body', '')
        if not body:
            LOGGER.error("Empty request body")
            return {
                'statusCode': 400,
                'body': json.dumps({'error': 'Empty body'})
            }

        # LINE署名の検証
        headers = event.get('headers', {})
        # ヘッダー名は大文字小文字を考慮
        signature = headers.get('x-line-signature') or headers.get('X-Line-Signature', '')

        if not signature:
            LOGGER.error("Missing X-Line-Signature header")
            return {
                'statusCode': 401,
                'body': json.dumps({'error': 'Missing signature'})
            }

        if not verify_signature(body, signature):
            LOGGER.error("Invalid signature")
            return {
                'statusCode': 401,
                'body': json.dumps({'error': 'Invalid signature'})
            }

        # リクエストボディのパース
        webhook_data = json.loads(body)
        events = webhook_data.get('events', [])

        if not events:
            LOGGER.info("No events to process")
            return {
                'statusCode': 200,
                'body': json.dumps({'status': 'ok', 'message': 'No events'})
            }

        # イベントを処理
        for line_event in events:
            event_type = line_event.get('type')

            # メッセージイベントのみ処理
            if event_type != 'message':
                LOGGER.info(f"Skipping non-message event: {event_type}")
                continue

            message = line_event.get('message', {})
            message_type = message.get('type')

            # テキストメッセージのみ処理
            if message_type != 'text':
                LOGGER.info(f"Skipping non-text message: {message_type}")
                # テキスト以外のメッセージには定型文で返答
                reply_to_line(
                    line_event.get('replyToken'),
                    "申し訳ございません。現在テキストメッセージのみ対応しております。"
                )
                continue

            user_text = message.get('text', '')
            line_user_id = line_event.get('source', {}).get('userId', 'unknown')
            reply_token = line_event.get('replyToken')

            LOGGER.info(f"Processing message from {line_user_id}: {user_text[:100]}")

            # ユーザーメッセージを保存
            save_conversation(line_user_id, 'user', user_text)

            # 直近の会話IDを取得（会話の継続用）
            conversation_id = get_conversation_id(line_user_id) or ""

            # Dify APIを呼び出し
            import time
            start_time = time.time()

            dify_response = call_dify_api(user_text, line_user_id, conversation_id)

            response_time_ms = int((time.time() - start_time) * 1000)

            # AI応答を保存
            save_conversation(
                line_user_id,
                'assistant',
                dify_response['answer'],
                dify_response.get('conversation_id'),
                response_time_ms,
                not dify_response['success']
            )

            # LINEに返信
            reply_to_line(reply_token, dify_response['answer'])

        return {
            'statusCode': 200,
            'body': json.dumps({'status': 'ok'})
        }

    except ConfigError as e:
        LOGGER.error(f"Configuration error: {str(e)}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': str(e)})
        }
    except json.JSONDecodeError as e:
        LOGGER.error(f"JSON parse error: {str(e)}")
        return {
            'statusCode': 400,
            'body': json.dumps({'error': 'Invalid JSON'})
        }
    except Exception as e:
        LOGGER.exception("Unexpected error")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }
