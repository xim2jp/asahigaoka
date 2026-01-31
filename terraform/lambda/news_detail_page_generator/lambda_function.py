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

        # 削除フラグが立っていない場合のみステータスチェック
        # ステータスが 'published' でない場合は詳細ページを生成しない
        if not delete_flag and article.get('status') != 'published':
            print(f'記事が公開状態ではありません: status={article.get("status")}')
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': False,
                    'error': f'Article is not published (status: {article.get("status")}). Only published articles can have detail pages.'
                }, ensure_ascii=False)
            }

        if delete_flag:
            # 削除処理
            result = delete_from_github(
                github_token,
                github_repo,
                github_branch,
                file_path
            )
            print(f'GitHub 削除完了: {file_path}')

            # news.htmlも更新（削除時）
            news_update_result = update_news_page(
                supabase_url,
                supabase_key,
                github_token,
                github_repo,
                github_branch
            )
            print(f'news.html 更新完了: {news_update_result}')

            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': True,
                    'message': 'Detail page deleted successfully',
                    'file_path': file_path,
                    'news_page_updated': news_update_result.get('success', False)
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

            # news.htmlも更新（公開時）
            news_update_result = update_news_page(
                supabase_url,
                supabase_key,
                github_token,
                github_repo,
                github_branch
            )
            print(f'news.html 更新完了: {news_update_result}')

            return {
                'statusCode': 200,
                'headers': cors_headers,
                'body': json.dumps({
                    'success': True,
                    'message': 'Detail page generated successfully',
                    'file_path': file_path,
                    'news_page_updated': news_update_result.get('success', False)
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
    import re

    slug = article.get('slug') or article.get('id')
    title = escape_html(article.get('title') or '')
    content = article.get('content') or ''
    category = article.get('category') or 'notice'
    category_label = CATEGORY_LABELS.get(category, 'お知らせ')
    featured_image_url = article.get('featured_image_url') or ''

    # 公開日
    published_at = article.get('published_at') or article.get('created_at') or ''
    published_at_formatted = format_date_jp(published_at) if published_at else ''

    # イベント日時
    event_start = article.get('event_start_datetime')
    event_end = article.get('event_end_datetime')
    event_datetime_formatted = format_event_datetime(event_start, event_end) if event_start else ''

    # SEO関連
    meta_title = article.get('meta_title') or title
    meta_description = article.get('meta_description') or extract_description(content)
    meta_keywords = article.get('meta_keywords') or ''

    # 記事URL
    article_url = f"{SITE_BASE_URL}/news/{slug}.html"
    article_url_encoded = urllib.parse.quote(article_url, safe='')
    title_encoded = urllib.parse.quote(title, safe='')

    # 添付ファイルセクションを生成
    attachments_html = generate_attachments_html(attachments)

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

    # イベント日時セクション（コンテンツがない場合は削除）
    if event_datetime_formatted:
        html = re.sub(
            r'<!-- \{\{#if event_datetime\}\} -->\s*',
            '',
            html
        )
        html = re.sub(
            r'\s*<!-- \{\{/if event_datetime\}\} -->',
            '',
            html
        )
    else:
        html = re.sub(
            r'<!-- \{\{#if event_datetime\}\} -->.*?<!-- \{\{/if event_datetime\}\} -->',
            '',
            html,
            flags=re.DOTALL
        )

    # アイキャッチ画像（コンテンツがない場合は削除）
    if featured_image_url:
        html = re.sub(
            r'<!-- \{\{#if featured_image_url\}\} -->\s*',
            '',
            html
        )
        html = re.sub(
            r'\s*<!-- \{\{/if featured_image_url\}\} -->',
            '',
            html
        )
    else:
        html = re.sub(
            r'<!-- \{\{#if featured_image_url\}\} -->.*?<!-- \{\{/if featured_image_url\}\} -->',
            '',
            html,
            flags=re.DOTALL
        )

    # 添付ファイルセクション
    if attachments:
        html = re.sub(
            r'<!-- \{\{#if attachments\}\} -->\s*',
            '',
            html
        )
        html = re.sub(
            r'\s*<!-- \{\{/if attachments\}\} -->',
            '',
            html
        )
        html = html.replace('<!-- {{#each attachments}} -->', '')
        html = html.replace('<!-- {{/each}} -->', '')
        # 添付ファイルのプレースホルダーを実際のHTMLで置換
        html = re.sub(
            r'<a href="\{\{file_url\}\}"[^>]*>.*?</a>',
            attachments_html,
            html,
            flags=re.DOTALL
        )
    else:
        # 添付ファイルがない場合はセクション全体を削除
        html = re.sub(
            r'<!-- \{\{#if attachments\}\} -->.*?<!-- \{\{/if attachments\}\} -->',
            '',
            html,
            flags=re.DOTALL
        )

    # 前後記事のナビゲーション（現時点では削除）
    html = re.sub(
        r'<!-- \{\{#if prev_article\}\} -->.*?<!-- \{\{/if prev_article\}\} -->',
        '<div></div>',
        html,
        flags=re.DOTALL
    )
    html = re.sub(
        r'<!-- \{\{#if next_article\}\} -->.*?<!-- \{\{/if next_article\}\} -->',
        '',
        html,
        flags=re.DOTALL
    )

    # 残っているプレースホルダを削除（念のため）
    html = re.sub(r'\{\{[^}]+\}\}', '', html)

    # 古い形式の条件タグも削除（互換性のため）
    html = re.sub(r'<!-- \{\{#if[^}]*\}\} -->', '', html)
    html = re.sub(r'<!-- \{\{/if[^}]*\}\} -->', '', html)
    html = re.sub(r'<!-- \{\{#each[^}]*\}\} -->', '', html)
    html = re.sub(r'<!-- \{\{/each[^}]*\}\} -->', '', html)
    html = re.sub(r'<!-- \{\{else\}\} -->', '', html)

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


def update_news_page(supabase_url: str, supabase_key: str, github_token: str, github_repo: str, github_branch: str) -> Dict[str, Any]:
    """
    news.htmlを更新する
    記事詳細ページの生成/削除時に呼び出され、カレンダーと一覧を最新状態に更新する
    """
    import calendar

    try:
        print('news.html 更新開始...')

        # 日本時間の今日の日付を取得
        jst_now = datetime.utcnow() + timedelta(hours=9)
        today = jst_now.date()
        print(f'基準日: {today}')

        # Supabaseから公開済み記事を取得
        endpoint = f"{supabase_url}/rest/v1/articles"
        params = "select=*&status=eq.published&deleted_at=is.null&order=event_start_datetime.desc.nullsfirst,published_at.desc"
        url = f"{endpoint}?{params}"

        headers = {
            'apikey': supabase_key,
            'Authorization': f'Bearer {supabase_key}',
            'Content-Type': 'application/json'
        }

        req = urllib.request.Request(url, headers=headers, method='GET')
        with urllib.request.urlopen(req, timeout=30) as response:
            articles = json.loads(response.read().decode('utf-8'))

        print(f'取得した記事数: {len(articles)}')

        # カレンダー表示用の記事をフィルタ
        calendar_articles = [a for a in articles if a.get('show_in_calendar')]
        print(f'カレンダー表示対象: {len(calendar_articles)}件')

        # 一覧表示用の記事をフィルタ
        news_list_articles = [a for a in articles if a.get('show_in_news_list')]
        print(f'一覧表示対象: {len(news_list_articles)}件')

        # news.htmlを生成
        html_content = generate_news_page_html(today, calendar_articles, news_list_articles)

        # GitHubにプッシュ
        result = push_to_github(
            github_token,
            github_repo,
            github_branch,
            'news.html',
            html_content,
            f'Update news.html - {today.isoformat()}'
        )

        print(f'news.html GitHub push 完了')

        return {
            'success': True,
            'articles_count': len(articles),
            'calendar_articles': len(calendar_articles),
            'news_list_articles': len(news_list_articles)
        }

    except Exception as e:
        print(f'news.html 更新エラー: {str(e)}')
        import traceback
        traceback.print_exc()
        return {
            'success': False,
            'error': str(e)
        }


def generate_news_page_html(today, calendar_articles: List[Dict], news_list_articles: List[Dict]) -> str:
    """
    news.htmlの完全なHTMLを生成
    """
    import calendar as cal_module

    current_year = today.year
    current_month = today.month

    if current_month == 12:
        next_year = current_year + 1
        next_month = 1
    else:
        next_year = current_year
        next_month = current_month + 1

    current_calendar_html = generate_calendar_grid_html(
        current_year, current_month, today, calendar_articles
    )
    next_calendar_html = generate_calendar_grid_html(
        next_year, next_month, today, calendar_articles
    )

    news_list_html = generate_news_list_items_html(news_list_articles)

    html = NEWS_PAGE_TEMPLATE.format(
        current_month_title=f"{current_year}年{current_month}月",
        current_month_calendar=current_calendar_html,
        next_month_title=f"{next_year}年{next_month}月",
        next_month_calendar=next_calendar_html,
        news_list=news_list_html,
        generated_at=datetime.utcnow().isoformat() + 'Z'
    )

    return html


def generate_calendar_grid_html(year: int, month: int, today, articles: List[Dict]) -> str:
    """
    カレンダーグリッドのHTMLを生成
    """
    import calendar as cal_module

    cal = cal_module.Calendar(firstweekday=6)  # 日曜始まり
    month_days = list(cal.itermonthdays2(year, month))

    day_headers = ['日', '月', '火', '水', '木', '金', '土']
    html = ''
    for day in day_headers:
        html += f'<div class="calendar-day-header">{day}</div>'

    # 記事を日付でマッピング
    article_by_date = {}
    for article in articles:
        event_date = article.get('event_start_datetime')
        if event_date:
            date_str = event_date[:10]
            if date_str not in article_by_date:
                article_by_date[date_str] = []
            article_by_date[date_str].append(article)

    for day, weekday in month_days:
        if day == 0:
            html += '<div class="calendar-day other-month"></div>'
        else:
            date_obj = datetime(year, month, day).date()
            date_str = date_obj.isoformat()

            is_today = (date_obj == today)
            today_class = 'today' if is_today else ''

            day_articles = article_by_date.get(date_str, [])
            has_event = len(day_articles) > 0
            event_class = 'has-event' if has_event else ''

            event_html = ''
            if has_event:
                article = day_articles[0]
                slug = article.get('slug') or article.get('id')
                title = article.get('title', '')
                title_escaped = escape_html(title)
                # generate_article_pageフラグがtrueの場合のみリンクを生成
                if article.get('generate_article_page'):
                    detail_url = f"news/{slug}.html"
                    event_html = f'<div class="calendar-day-event" onclick="event.stopPropagation(); window.location.href=\'{detail_url}\'" title="{title_escaped}">{title_escaped}</div>'
                else:
                    # リンクなしのイベント表示
                    event_html = f'<div class="calendar-day-event calendar-day-event-nolink" title="{title_escaped}">{title_escaped}</div>'

            html += f'''<div class="calendar-day {today_class} {event_class}">
                <span class="calendar-day-number">{day}</span>
                {event_html}
            </div>'''

    return html


def generate_news_list_items_html(articles: List[Dict]) -> str:
    """
    ニュース一覧のHTMLを生成
    """
    if not articles:
        return '<div class="text-center text-gray-500 py-8">お知らせはありません</div>'

    html = ''
    for article in articles[:30]:
        slug = article.get('slug') or article.get('id')
        title = escape_html(article.get('title', ''))

        # イベント開始日を優先して表示
        event_date = article.get('event_start_datetime')
        if event_date:
            date_str = format_date_jp(event_date)
        else:
            published_at = article.get('published_at') or article.get('created_at')
            date_str = format_date_jp(published_at) if published_at else ''

        featured_image = article.get('featured_image_url')
        if featured_image:
            image_html = f'<img src="{featured_image}" alt="{title}" class="news-item-image">'
        else:
            image_html = '<div class="news-item-image bg-gray-200 flex items-center justify-center text-gray-400 text-sm">画像なし</div>'

        icons_html = ''
        if article.get('line_published'):
            icons_html += '<div class="news-item-icon line" title="LINEで配信済み"><i class="ri-line-fill text-xs"></i></div>'
        if article.get('x_published'):
            icons_html += '<div class="news-item-icon x" title="Xで投稿済み"><i class="ri-twitter-x-line text-xs"></i></div>'

        # generate_article_pageフラグがtrueの場合のみリンクを生成
        if article.get('generate_article_page'):
            detail_url = f"news/{slug}.html"
            html += f'''
            <a href="{detail_url}" class="news-item">
                {image_html}
                <div class="news-item-content">
                    <div class="news-item-date">{date_str}</div>
                    <div class="news-item-title">{title}</div>
                    <div class="news-item-icons">
                        {icons_html}
                    </div>
                </div>
            </a>
        '''
        else:
            # リンクなしの表示
            html += f'''
            <div class="news-item news-item-nolink">
                {image_html}
                <div class="news-item-content">
                    <div class="news-item-date">{date_str}</div>
                    <div class="news-item-title">{title}</div>
                    <div class="news-item-icons">
                        {icons_html}
                    </div>
                </div>
            </div>
        '''

    return html


# news.html テンプレート
NEWS_PAGE_TEMPLATE = '''<!DOCTYPE html>
<html lang="ja">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>お知らせ - 東京都練馬区旭丘一丁目町会</title>
    <script src="https://cdn.tailwindcss.com/3.4.16"></script>
    <script>
      tailwind.config = {{
        theme: {{
          extend: {{
            colors: {{ primary: "#57b5e7", secondary: "#8dd3c7" }},
            borderRadius: {{
              none: "0px",
              sm: "4px",
              DEFAULT: "8px",
              md: "12px",
              lg: "16px",
              xl: "20px",
              "2xl": "24px",
              "3xl": "32px",
              full: "9999px",
              button: "8px",
            }},
          }},
        }},
      }};
    </script>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Pacifico&display=swap"
      rel="stylesheet"
    />
    <link
      href="https://cdnjs.cloudflare.com/ajax/libs/remixicon/4.6.0/remixicon.min.css"
      rel="stylesheet"
    />
    <link rel="stylesheet" href="css/template.css" />
    <style>
      :where([class^="ri-"])::before {{ content: "\\f3c2"; }}

      /* カレンダースタイル */
      .calendar {{
        background: white;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1);
      }}

      .calendar-header {{
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        padding-bottom: 12px;
        border-bottom: 2px solid #e5e7eb;
      }}

      .calendar-title {{
        font-size: 1.25rem;
        font-weight: bold;
        color: #111827;
      }}

      .calendar-grid {{
        display: grid;
        grid-template-columns: repeat(7, 1fr);
        gap: 1px;
        border: 1px solid #e5e7eb;
        border-radius: 8px;
        overflow: hidden;
      }}

      .calendar-day-header {{
        text-align: center;
        font-size: 0.75rem;
        font-weight: 600;
        color: #6b7280;
        padding: 8px 4px;
        background: #f9fafb;
        border-right: 1px solid #e5e7eb;
        border-bottom: 1px solid #e5e7eb;
      }}

      .calendar-day-header:last-child {{
        border-right: none;
      }}

      .calendar-day {{
        display: flex;
        flex-direction: column;
        align-items: flex-start;
        justify-content: flex-start;
        font-size: 0.875rem;
        color: #374151;
        cursor: pointer;
        transition: background 0.2s;
        padding: 4px;
        height: 80px;
        border-right: 1px solid #e5e7eb;
        border-bottom: 1px solid #e5e7eb;
        overflow: hidden;
        box-sizing: border-box;
      }}

      .calendar-day:nth-child(7n) {{
        border-right: none;
      }}

      .calendar-day:hover {{
        background: #f3f4f6;
      }}

      .calendar-day.other-month {{
        color: #d1d5db;
        background: #fafafa;
      }}

      .calendar-day.today {{
        background: #57b5e7;
        color: white;
        font-weight: bold;
      }}

      .calendar-day-number {{
        font-weight: 600;
        margin-bottom: 2px;
        flex-shrink: 0;
        width: 100%;
        text-align: left;
      }}

      .calendar-day-event {{
        font-size: 0.65rem;
        line-height: 1.3;
        text-align: left;
        width: 100%;
        padding: 2px 4px;
        margin-top: auto;
        background: #fef3c7;
        color: #92400e;
        border-radius: 3px;
        overflow: hidden;
        white-space: normal;
        word-break: break-word;
        cursor: pointer;
        transition: all 0.2s;
        flex: 1;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        min-height: 0;
      }}

      .calendar-day.today .calendar-day-event {{
        background: rgba(255, 255, 255, 0.3);
        color: white;
      }}

      .calendar-day-event:hover {{
        background: #fde68a;
      }}

      .calendar-day.today .calendar-day-event:hover {{
        background: rgba(255, 255, 255, 0.5);
      }}

      .calendar-day.has-event {{
        position: relative;
      }}

      .calendar-day-event-nolink {{
        cursor: default;
      }}

      .calendar-day-event-nolink:hover {{
        background: #fef3c7;
      }}

      .calendar-day.today .calendar-day-event-nolink:hover {{
        background: rgba(255, 255, 255, 0.3);
      }}

      /* お知らせ一覧スタイル */
      .news-item {{
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px 0;
        border-bottom: 1px dashed #d1d5db;
        transition: background 0.2s;
        text-decoration: none;
        color: inherit;
      }}

      .news-item:hover {{
        background: #f9fafb;
        padding-left: 8px;
        padding-right: 8px;
        margin-left: -8px;
        margin-right: -8px;
        border-radius: 8px;
      }}

      .news-item-image {{
        width: 120px;
        height: 80px;
        object-fit: cover;
        border-radius: 8px;
        flex-shrink: 0;
      }}

      .news-item-content {{
        flex: 1;
        min-width: 0;
      }}

      .news-item-date {{
        font-size: 0.875rem;
        color: #6b7280;
        margin-bottom: 4px;
      }}

      .news-item-title {{
        font-size: 1rem;
        font-weight: 600;
        color: #111827;
        margin-bottom: 8px;
        line-height: 1.5;
      }}

      .news-item-icons {{
        display: flex;
        gap: 8px;
        align-items: center;
      }}

      .news-item-icon {{
        width: 20px;
        height: 20px;
        display: flex;
        align-items: center;
        justify-content: center;
        border-radius: 4px;
      }}

      .news-item-icon.line {{
        background: #00C300;
        color: white;
      }}

      .news-item-icon.x {{
        background: #000000;
        color: white;
      }}

      .news-item-nolink {{
        cursor: default;
      }}

      .news-item-nolink:hover {{
        background: transparent;
        padding-left: 0;
        padding-right: 0;
        margin-left: 0;
        margin-right: 0;
        border-radius: 0;
      }}

      @media (max-width: 768px) {{
        .news-item {{
          flex-direction: column;
          align-items: flex-start;
        }}

        .news-item-image {{
          width: 100%;
          height: 200px;
        }}

        .calendar-grid {{
          gap: 1px;
        }}

        .calendar-day {{
          font-size: 0.75rem;
          height: 60px;
          padding: 2px;
        }}

        .calendar-day-event {{
          font-size: 0.6rem;
          padding: 1px 2px;
        }}
      }}
    </style>
    <!-- Generated at: {generated_at} -->
  </head>
  <body class="bg-white">
    <!-- ヘッダー -->
    <header class="bg-white shadow-sm sticky top-0 z-50">
      <nav class="w-full px-6 py-4">
        <div class="flex items-center justify-between">
          <div class="flex items-center space-x-3">
            <div
              class="w-12 h-12 flex items-center justify-center bg-primary rounded-lg"
            >
              <i class="ri-community-line text-white text-xl"></i>
            </div>
            <div>
              <h1 class="text-xl font-bold text-gray-900">
                東京都練馬区旭丘一丁目町会
              </h1>
              <p class="text-sm text-gray-600">
                みんなでつくる安心・安全なまち
              </p>
            </div>
          </div>
          <div class="hidden md:flex items-center space-x-8">
            <a
              href="index.html"
              class="text-gray-700 hover:text-primary transition-colors"
              >ホーム</a
            >
            <a
              href="news.html"
              class="text-primary font-semibold hover:text-primary transition-colors"
              >お知らせ</a
            >
            <a
              href="reports.html"
              class="text-gray-700 hover:text-primary transition-colors"
              >事業資料</a
            >
            <a
              href="town.html"
              class="text-gray-700 hover:text-primary transition-colors"
              >町会について</a
            >
            <a
              href="antidisaster-evacuation.html"
              class="text-gray-700 hover:text-primary transition-colors"
              >指定避難所</a
            >
            <a
              href="contact.html"
              class="text-gray-700 hover:text-primary transition-colors"
              >お問い合わせ</a
            >
          </div>
          <button
            class="md:hidden w-10 h-10 flex items-center justify-center"
            id="mobile-menu-btn"
          >
            <i class="ri-menu-line text-xl"></i>
          </button>
        </div>
        <div class="md:hidden mt-4 hidden" id="mobile-menu">
          <div class="flex flex-col space-y-3 py-4 border-t">
            <a
              href="index.html"
              class="text-gray-700 hover:text-primary transition-colors"
              >ホーム</a
            >
            <a
              href="news.html"
              class="text-primary font-semibold hover:text-primary transition-colors"
              >お知らせ</a
            >
            <a
              href="reports.html"
              class="text-gray-700 hover:text-primary transition-colors"
              >事業資料</a
            >
            <a
              href="town.html"
              class="text-gray-700 hover:text-primary transition-colors"
              >町会について</a
            >
            <a
              href="antidisaster-evacuation.html"
              class="text-gray-700 hover:text-primary transition-colors"
              >指定避難所</a
            >
            <a
              href="contact.html"
              class="text-gray-700 hover:text-primary transition-colors"
              >お問い合わせ</a
            >
          </div>
        </div>
      </nav>
    </header>

    <!-- ヒーローセクション -->
    <section class="page-hero">
      <div class="page-hero-content">
        <div>
          <h2 class="page-title">お知らせ</h2>
          <p class="page-subtitle">町会からの最新情報をお届けします</p>
        </div>
      </div>
    </section>

    <!-- メインコンテンツ -->
    <main>
      <section class="py-16">
        <div class="max-w-6xl mx-auto px-6">
          <!-- カレンダーセクション -->
          <div class="grid md:grid-cols-2 gap-6 mb-12">
            <!-- 今月のカレンダー -->
            <div class="calendar">
              <div class="calendar-header">
                <h3 class="calendar-title">{current_month_title}</h3>
              </div>
              <div class="calendar-grid">
                {current_month_calendar}
              </div>
            </div>

            <!-- 来月のカレンダー -->
            <div class="calendar">
              <div class="calendar-header">
                <h3 class="calendar-title">{next_month_title}</h3>
              </div>
              <div class="calendar-grid">
                {next_month_calendar}
              </div>
            </div>
          </div>

          <!-- お知らせ一覧 -->
          <div class="bg-white rounded-xl shadow-sm p-6 md:p-8">
            <h3 class="text-2xl font-bold text-gray-900 mb-8">お知らせ一覧</h3>

            <div id="news-list">
              {news_list}
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- フッター -->
    <footer class="bg-gray-900 text-white py-12">
      <div class="max-w-6xl mx-auto px-6">
        <div class="grid md:grid-cols-4 gap-8">
          <div>
            <div class="flex items-center space-x-3 mb-4">
              <div
                class="w-10 h-10 flex items-center justify-center bg-primary rounded-lg"
              >
                <i class="ri-community-line text-white"></i>
              </div>
              <div>
                <h5 class="font-semibold">東京都練馬区</h5>
                <p class="text-sm text-gray-400">旭丘一丁目町会</p>
              </div>
            </div>
            <p class="text-gray-400 text-sm">
              AI
              と共に築く新しい地域コミュニティ。すべての世代が参加しやすい町会活動を目指しています。
            </p>
          </div>
          <div>
            <h6 class="font-semibold mb-4">基本情報</h6>
            <div class="space-y-2 text-sm text-gray-400">
              <p>〒179-0071</p>
              <p>東京都練馬区旭丘1丁目</p>
              <p>TEL: 03-3950-4842（旭丘地域集会所）</p>
              <p>Email: block1@asahigaoka-nerima.tokyo</p>
            </div>
          </div>
          <div>
            <h6 class="font-semibold mb-4">リンク</h6>
            <div class="space-y-2 text-sm">
              <a
                href="privacy-policy.html"
                class="text-gray-400 hover:text-white transition-colors block"
                >プライバシーポリシー</a
              >
              <a
                href="terms-of-service.html"
                class="text-gray-400 hover:text-white transition-colors block"
                >利用規約</a
              >
              <a
                href="contact.html"
                class="text-gray-400 hover:text-white transition-colors block"
                >お問い合わせ</a
              >
            </div>
          </div>
          <div>
            <h6 class="font-semibold mb-4">SNS</h6>
            <div class="flex space-x-3">
              <a
                href="https://www.facebook.com/b1.asahigaoka"
                target="_blank"
                class="w-8 h-8 flex items-center justify-center bg-gray-800 rounded hover:bg-gray-700 transition-colors"
              >
                <i class="ri-facebook-fill"></i>
              </a>
              <a
                href="https://x.com/b1_asahigaoka"
                target="_blank"
                class="w-8 h-8 flex items-center justify-center bg-gray-800 rounded hover:bg-gray-700 transition-colors"
              >
                <i class="ri-twitter-x-line"></i>
              </a>
              <a
                href="https://line.me/R/ti/p/@619ynqur"
                target="_blank"
                class="w-8 h-8 flex items-center justify-center bg-gray-800 rounded hover:bg-gray-700 transition-colors"
              >
                <i class="ri-line-fill"></i>
              </a>
            </div>
          </div>
        </div>
        <div
          class="border-t border-gray-800 mt-8 pt-8 text-center text-sm text-gray-400"
        >
          <p>&copy; 2024 東京都練馬区旭丘一丁目町会. All rights reserved.</p>
        </div>
      </div>
    </footer>

    <!-- JavaScript -->
    <script>
      // モバイルメニュー
      document.addEventListener("DOMContentLoaded", function () {{
        const mobileMenuBtn = document.getElementById("mobile-menu-btn");
        const mobileMenu = document.getElementById("mobile-menu");
        if (mobileMenuBtn && mobileMenu) {{
          mobileMenuBtn.addEventListener("click", function () {{
            mobileMenu.classList.toggle("hidden");
          }});
        }}
      }});
    </script>

    <script>
      window.difyChatbotConfig = {{
        token: 't7gW8m8CMAZ2rcNw',
        baseUrl: 'https://top-overly-pup.ngrok-free.app',
        inputs: {{}},
        systemVariables: {{}},
        userVariables: {{}},
      }}
    </script>
    <script
      src="https://top-overly-pup.ngrok-free.app/embed.min.js"
      id="t7gW8m8CMAZ2rcNw"
      defer
    ></script>
    <style>
      #dify-chatbot-bubble-button {{
        background-color: #1C64F2 !important;
      }}
      #dify-chatbot-bubble-window {{
        width: 24rem !important;
        height: 40rem !important;
      }}
    </style>

  </body>
</html>
'''
