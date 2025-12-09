"""
記事詳細ページ生成 Lambda関数
記事IDと削除フラグを受け取り、詳細ページを生成/削除してGitHubにプッシュ
"""
import json
import os
import base64
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional


# カテゴリ表示名マッピング
CATEGORY_LABELS = {
    'notice': 'お知らせ',
    'event': 'イベント',
    'disaster_safety': '防災・防犯',
    'child_support': '子育て支援',
    'shopping_info': '商店街情報',
    'activity_report': '活動レポート'
}

# ファイルタイプアイコンマッピング
FILE_TYPE_ICONS = {
    'pdf': ('pdf', 'pdf'),
    'doc': ('doc', 'word'),
    'docx': ('doc', 'word'),
    'xls': ('doc', 'excel'),
    'xlsx': ('doc', 'excel'),
    'ppt': ('doc', 'ppt'),
    'pptx': ('doc', 'ppt'),
    'jpg': ('image', 'image'),
    'jpeg': ('image', 'image'),
    'png': ('image', 'image'),
    'gif': ('image', 'image'),
    'webp': ('image', 'image'),
}

# サイトベースURL
SITE_BASE_URL = "https://asahigaoka-nerima.tokyo"


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda ハンドラー関数
    API Gateway経由で呼び出される
    """
    print('記事詳細ページ生成開始')
    print(f'Event: {json.dumps(event, ensure_ascii=False)}')

    # CORSヘッダー
    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST,OPTIONS'
    }

    try:
        # リクエストボディを解析
        if isinstance(event.get('body'), str):
            body = json.loads(event['body'])
        else:
            body = event.get('body') or event

        article_id = body.get('article_id')
        delete_flag = body.get('delete_flag', False)

        if not article_id:
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': False,
                    'error': 'article_id is required'
                }, ensure_ascii=False)
            }

        # 環境変数を取得
        supabase_url = os.environ.get('SUPABASE_URL')
        supabase_key = os.environ.get('SUPABASE_ANON_KEY')
        github_token = os.environ.get('GITHUB_TOKEN')
        github_repo = os.environ.get('GITHUB_REPO', 'asahigaoka/asahigaoka')
        github_branch = os.environ.get('GITHUB_BRANCH', 'main')

        if not supabase_url or not supabase_key:
            raise ValueError('SUPABASE_URL and SUPABASE_ANON_KEY are required')
        if not github_token:
            raise ValueError('GITHUB_TOKEN is required')

        print(f'記事ID: {article_id}, 削除フラグ: {delete_flag}')

        # 記事情報を取得
        article = fetch_article_from_supabase(supabase_url, supabase_key, article_id)
        if not article:
            return {
                'statusCode': 404,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': False,
                    'error': f'Article not found: {article_id}'
                }, ensure_ascii=False)
            }

        slug = article.get('slug') or article.get('id')
        file_path = f'news/{slug}.html'

        if delete_flag:
            # 削除処理
            result = delete_from_github(
                github_token,
                github_repo,
                github_branch,
                file_path
            )
            print(f'GitHub 削除完了: {file_path}')

            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': True,
                    'message': 'Detail page deleted successfully',
                    'file_path': file_path
                }, ensure_ascii=False)
            }
        else:
            # 生成処理
            # テンプレートを取得
            template = fetch_template_from_github(
                github_token,
                github_repo,
                github_branch
            )

            # 添付ファイル情報を取得
            attachments = fetch_attachments_from_supabase(
                supabase_url,
                supabase_key,
                article_id
            )
            print(f'添付ファイル数: {len(attachments)}')

            # HTMLを生成
            html_content = generate_detail_html(template, article, attachments)

            # GitHubにプッシュ
            result = push_to_github(
                github_token,
                github_repo,
                github_branch,
                file_path,
                html_content,
                f'Update {file_path} - {article.get("title", "")[:30]}'
            )

            print(f'GitHub push 完了: {file_path}')

            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': True,
                    'message': 'Detail page generated successfully',
                    'file_path': file_path
                }, ensure_ascii=False)
            }

    except Exception as e:
        print(f'エラー: {str(e)}')
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'headers': cors_headers,
            'body': json.dumps({
                'success': False,
                'error': str(e)
            }, ensure_ascii=False)
        }


def fetch_article_from_supabase(supabase_url: str, supabase_key: str, article_id: str) -> Optional[Dict[str, Any]]:
    """
    Supabaseから記事を取得
    """
    endpoint = f"{supabase_url}/rest/v1/articles"
    params = f"select=*&id=eq.{article_id}"
    url = f"{endpoint}?{params}"

    headers = {
        'apikey': supabase_key,
        'Authorization': f'Bearer {supabase_key}',
        'Content-Type': 'application/json'
    }

    req = urllib.request.Request(url, headers=headers, method='GET')

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data[0] if data else None
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        print(f'Supabase API HTTPエラー: {e.code} - {error_body}')
        raise Exception(f'Supabase API呼び出しエラー: {e.code}')


def fetch_attachments_from_supabase(supabase_url: str, supabase_key: str, article_id: str) -> List[Dict[str, Any]]:
    """
    Supabaseから添付ファイル情報を取得
    """
    endpoint = f"{supabase_url}/rest/v1/article_attachments"
    params = f"select=*&article_id=eq.{article_id}&order=display_order.asc"
    url = f"{endpoint}?{params}"

    headers = {
        'apikey': supabase_key,
        'Authorization': f'Bearer {supabase_key}',
        'Content-Type': 'application/json'
    }

    req = urllib.request.Request(url, headers=headers, method='GET')

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
            return data
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        print(f'Supabase attachments API HTTPエラー: {e.code} - {error_body}')
        return []
    except Exception as e:
        print(f'添付ファイル取得エラー: {str(e)}')
        return []


def fetch_template_from_github(token: str, repo: str, branch: str) -> str:
    """
    GitHubからテンプレートを取得
    """
    api_url = f"https://api.github.com/repos/{repo}/contents/news/news_template.html"
    headers = {
        'Authorization': f'token {token}',
        'Accept': 'application/vnd.github.v3+json'
    }

    req = urllib.request.Request(f"{api_url}?ref={branch}", headers=headers, method='GET')

    try:
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
            content = base64.b64decode(data['content']).decode('utf-8')
            return content
    except urllib.error.HTTPError as e:
        error_body = e.read().decode('utf-8')
        print(f'GitHub API HTTPエラー: {e.code} - {error_body}')
        raise Exception(f'テンプレート取得エラー: {e.code}')


def generate_detail_html(template: str, article: Dict[str, Any], attachments: List[Dict[str, Any]]) -> str:
    """
    テンプレートに記事データを埋め込んでHTMLを生成
    """
    slug = article.get('slug') or article.get('id')
    title = escape_html(article.get('title', ''))
    content = article.get('content', '')
    category = article.get('category', 'notice')
    category_label = CATEGORY_LABELS.get(category, 'お知らせ')
    featured_image_url = article.get('featured_image_url', '')

    # 公開日
    published_at = article.get('published_at') or article.get('created_at', '')
    published_at_formatted = format_date_jp(published_at) if published_at else ''

    # イベント日時
    event_start = article.get('event_start_datetime')
    event_end = article.get('event_end_datetime')
    event_datetime_formatted = format_event_datetime(event_start, event_end) if event_start else ''

    # SEO関連
    meta_title = article.get('meta_title') or title
    meta_description = article.get('meta_description') or extract_description(content)
    meta_keywords = article.get('meta_keywords', '')

    # 記事URL
    article_url = f"{SITE_BASE_URL}/news/{slug}.html"
    article_url_encoded = urllib.parse.quote(article_url, safe='')
    title_encoded = urllib.parse.quote(title, safe='')

    # 添付ファイルセクションを生成
    attachments_html = generate_attachments_html(attachments)

    # イベント日時セクションの表示制御
    if event_datetime_formatted:
        event_section_style = ''
    else:
        event_section_style = 'display: none;'

    # アイキャッチ画像の表示制御
    if featured_image_url:
        featured_image_style = ''
    else:
        featured_image_style = 'display: none;'

    # 添付ファイルセクションの表示制御
    if attachments:
        attachments_section_style = ''
    else:
        attachments_section_style = 'display: none;'

    # テンプレート置換
    html = template

    # 基本情報
    html = html.replace('{{meta_title}}', escape_html(meta_title))
    html = html.replace('{{meta_description}}', escape_html(meta_description))
    html = html.replace('{{meta_keywords}}', escape_html(meta_keywords))
    html = html.replace('{{featured_image_url}}', featured_image_url)
    html = html.replace('{{article_url}}', article_url)
    html = html.replace('{{title}}', title)
    html = html.replace('{{category}}', category)
    html = html.replace('{{category_label}}', category_label)
    html = html.replace('{{published_at}}', published_at)
    html = html.replace('{{published_at_formatted}}', published_at_formatted)
    html = html.replace('{{event_datetime_formatted}}', event_datetime_formatted)
    html = html.replace('{{content}}', content)
    html = html.replace('{{article_url_encoded}}', article_url_encoded)
    html = html.replace('{{title_encoded}}', title_encoded)

    # 条件付きセクションの処理
    # イベント日時セクション
    html = html.replace('<!-- {{#if event_datetime}} -->', f'<div style="{event_section_style}">')
    html = html.replace('<!-- {{/if}} -->', '</div>')

    # アイキャッチ画像
    if not featured_image_url:
        # アイキャッチ画像がない場合は非表示
        import re
        html = re.sub(
            r'<!-- \{\{#if featured_image_url\}\} -->.*?<!-- \{\{/if\}\} -->',
            '',
            html,
            flags=re.DOTALL
        )
    else:
        html = html.replace('<!-- {{#if featured_image_url}} -->', '')

    # 添付ファイルセクション
    if attachments:
        html = html.replace('<!-- {{#if attachments}} -->', '')
        html = html.replace('<!-- {{#each attachments}} -->', '')
        html = html.replace('<!-- {{/each}} -->', '')
        # 添付ファイルのプレースホルダーを実際のHTMLで置換
        html = re.sub(
            r'<a href="\{\{file_url\}\}".*?</a>',
            attachments_html,
            html,
            flags=re.DOTALL
        )
    else:
        # 添付ファイルがない場合はセクション全体を非表示
        import re
        html = re.sub(
            r'<!-- \{\{#if attachments\}\} -->.*?<!-- \{\{/if\}\} -->',
            '',
            html,
            flags=re.DOTALL
        )

    # 前後記事のナビゲーション（現時点では非表示）
    import re
    html = re.sub(
        r'<!-- \{\{#if prev_article\}\} -->.*?<!-- \{\{/if\}\} -->',
        '<div></div>',
        html,
        flags=re.DOTALL
    )
    html = re.sub(
        r'<!-- \{\{#if next_article\}\} -->.*?<!-- \{\{else\}\} -->.*?<!-- \{\{/if\}\} -->',
        '',
        html,
        flags=re.DOTALL
    )

    return html


def generate_attachments_html(attachments: List[Dict[str, Any]]) -> str:
    """
    添付ファイル一覧のHTMLを生成
    """
    if not attachments:
        return ''

    html_parts = []
    for att in attachments:
        file_name = escape_html(att.get('file_name', ''))
        file_url = att.get('file_url', '')
        file_size = att.get('file_size', 0)

        # ファイルタイプを判定
        ext = file_name.lower().split('.')[-1] if '.' in file_name else ''
        file_type, file_icon = FILE_TYPE_ICONS.get(ext, ('other', 'file'))

        # ファイルサイズをフォーマット
        file_size_formatted = format_file_size(file_size)

        html_parts.append(f'''
              <a href="{file_url}" class="attachment-item" download="{file_name}" target="_blank">
                <div class="attachment-icon {file_type}">
                  <i class="ri-file-{file_icon}-line"></i>
                </div>
                <div class="attachment-info">
                  <div class="attachment-name">{file_name}</div>
                  <div class="attachment-size">{file_size_formatted}</div>
                </div>
                <i class="ri-download-line attachment-download"></i>
              </a>''')

    return '\n'.join(html_parts)


def format_file_size(size_bytes: int) -> str:
    """
    ファイルサイズを人間が読みやすい形式に変換
    """
    if size_bytes < 1024:
        return f"{size_bytes} B"
    elif size_bytes < 1024 * 1024:
        return f"{size_bytes / 1024:.1f} KB"
    elif size_bytes < 1024 * 1024 * 1024:
        return f"{size_bytes / (1024 * 1024):.1f} MB"
    else:
        return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"


def format_date_jp(iso_date: str) -> str:
    """
    ISO形式の日付を日本語形式に変換
    """
    try:
        date_part = iso_date.replace('Z', '+00:00')
        if '+' in date_part:
            date_part = date_part.split('+')[0]
        if 'T' in date_part:
            date_str = date_part.split('T')[0]
        else:
            date_str = date_part[:10]

        year, month, day = date_str.split('-')
        dt = datetime(int(year), int(month), int(day))
        weekdays = ['月', '火', '水', '木', '金', '土', '日']
        weekday = weekdays[dt.weekday()]

        return f"{year}年{int(month)}月{int(day)}日（{weekday}）"
    except Exception:
        return iso_date


def format_event_datetime(start: str, end: Optional[str]) -> str:
    """
    イベント日時をフォーマット
    """
    try:
        start_dt = parse_datetime(start)
        formatted = format_datetime_jp(start_dt)

        if end:
            end_dt = parse_datetime(end)
            # 同じ日の場合は終了時刻のみ
            if start_dt.date() == end_dt.date():
                formatted += f" 〜 {end_dt.strftime('%H:%M')}"
            else:
                formatted += f" 〜 {format_datetime_jp(end_dt)}"

        return formatted
    except Exception:
        return start


def parse_datetime(iso_str: str) -> datetime:
    """
    ISO形式の日時文字列をdatetimeに変換
    """
    iso_str = iso_str.replace('Z', '+00:00')
    if '+' in iso_str:
        iso_str = iso_str.split('+')[0]

    if 'T' in iso_str:
        return datetime.fromisoformat(iso_str)
    else:
        return datetime.fromisoformat(iso_str + 'T00:00:00')


def format_datetime_jp(dt: datetime) -> str:
    """
    datetimeを日本語形式に変換
    """
    weekdays = ['月', '火', '水', '木', '金', '土', '日']
    weekday = weekdays[dt.weekday()]
    return f"{dt.year}年{dt.month}月{dt.day}日（{weekday}）{dt.strftime('%H:%M')}"


def extract_description(content: str) -> str:
    """
    HTMLコンテンツから説明文を抽出
    """
    import re
    # HTMLタグを除去
    text = re.sub(r'<[^>]+>', '', content)
    # 連続する空白を1つに
    text = re.sub(r'\s+', ' ', text).strip()
    # 最初の160文字を取得
    if len(text) > 160:
        return text[:157] + '...'
    return text


def escape_html(text: str) -> str:
    """
    HTMLエスケープ
    """
    if not text:
        return ''
    return (text
            .replace('&', '&amp;')
            .replace('<', '&lt;')
            .replace('>', '&gt;')
            .replace('"', '&quot;')
            .replace("'", '&#39;'))


def push_to_github(token: str, repo: str, branch: str, file_path: str, content: str, commit_message: str) -> Dict:
    """
    GitHubにファイルをプッシュ
    """
    api_url = f"https://api.github.com/repos/{repo}/contents/{file_path}"
    headers = {
        'Authorization': f'token {token}',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
    }

    # 現在のファイルのSHAを取得
    sha = None
    try:
        req = urllib.request.Request(f"{api_url}?ref={branch}", headers=headers, method='GET')
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
            sha = data.get('sha')
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise

    # ファイルを更新（または作成）
    content_base64 = base64.b64encode(content.encode('utf-8')).decode('utf-8')

    body = {
        'message': commit_message,
        'content': content_base64,
        'branch': branch
    }

    if sha:
        body['sha'] = sha

    data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(api_url, data=data, headers=headers, method='PUT')

    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode('utf-8'))


def delete_from_github(token: str, repo: str, branch: str, file_path: str) -> Dict:
    """
    GitHubからファイルを削除
    """
    api_url = f"https://api.github.com/repos/{repo}/contents/{file_path}"
    headers = {
        'Authorization': f'token {token}',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
    }

    # 現在のファイルのSHAを取得
    try:
        req = urllib.request.Request(f"{api_url}?ref={branch}", headers=headers, method='GET')
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
            sha = data.get('sha')
    except urllib.error.HTTPError as e:
        if e.code == 404:
            # ファイルが存在しない場合は成功として扱う
            return {'message': 'File not found, nothing to delete'}
        raise

    # ファイルを削除
    body = {
        'message': f'Delete {file_path}',
        'sha': sha,
        'branch': branch
    }

    data = json.dumps(body).encode('utf-8')
    req = urllib.request.Request(api_url, data=data, headers=headers, method='DELETE')

    with urllib.request.urlopen(req, timeout=30) as response:
        return json.loads(response.read().decode('utf-8'))
