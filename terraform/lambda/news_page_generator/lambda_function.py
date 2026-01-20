"""
news.html 静的ページ生成 Lambda関数
Supabaseから記事データを取得し、カレンダーと一覧を更新してGitHubにプッシュ
"""
import json
import os
import base64
import urllib.request
import urllib.error
from datetime import datetime, timedelta
from typing import Dict, Any, List, Optional
import re


# カテゴリ表示名マッピング
CATEGORY_LABELS = {
    'notice': 'お知らせ',
    'event': 'イベント',
    'disaster_safety': '防災・防犯',
    'child_support': '子育て支援',
    'shopping_info': '商店街情報',
    'activity_report': '活動レポート'
}

# カテゴリCSSクラスマッピング
CATEGORY_CSS_CLASSES = {
    'notice': 'category-notice',
    'event': 'category-event',
    'disaster_safety': 'category-disaster_safety',
    'child_support': 'category-child_support',
    'shopping_info': 'category-shopping_info',
    'activity_report': 'category-activity_report'
}


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda ハンドラー関数
    EventBridgeから毎日日本時間0:05に呼び出される
    """
    print('news.html 静的ページ生成開始')

    try:
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

        # 日本時間の今日の日付を取得（冪等性のため）
        jst_now = datetime.utcnow() + timedelta(hours=9)
        today = jst_now.date()
        print(f'基準日: {today}')

        # Supabaseから記事データを取得
        articles = fetch_articles_from_supabase(supabase_url, supabase_key)
        print(f'取得した記事数: {len(articles)}')

        # カレンダー表示用の記事をフィルタ
        calendar_articles = [a for a in articles if a.get('show_in_calendar')]
        print(f'カレンダー表示対象: {len(calendar_articles)}件')

        # 一覧表示用の記事をフィルタ
        news_list_articles = [a for a in articles if a.get('show_in_news_list')]
        print(f'一覧表示対象: {len(news_list_articles)}件')

        # news.htmlを生成
        html_content = generate_news_html(today, calendar_articles, news_list_articles)

        # GitHubにプッシュ
        result = push_to_github(
            github_token,
            github_repo,
            github_branch,
            'news.html',
            html_content,
            f'Update news.html - {today.isoformat()}'
        )

        print(f'GitHub push 完了: {result}')

        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'message': 'news.html updated successfully',
                'date': today.isoformat(),
                'articles_count': len(articles),
                'calendar_articles': len(calendar_articles),
                'news_list_articles': len(news_list_articles)
            }, ensure_ascii=False)
        }

    except Exception as e:
        print(f'エラー: {str(e)}')
        import traceback
        traceback.print_exc()
        return {
            'statusCode': 500,
            'body': json.dumps({
                'success': False,
                'error': str(e)
            }, ensure_ascii=False)
        }


def fetch_articles_from_supabase(supabase_url: str, supabase_key: str) -> List[Dict[str, Any]]:
    """
    Supabaseから公開済み記事を取得
    """
    # REST APIエンドポイント
    endpoint = f"{supabase_url}/rest/v1/articles"

    # クエリパラメータ: status=published, deleted_at=null, 日付降順
    params = "select=*&status=eq.published&deleted_at=is.null&order=event_start_datetime.desc.nullsfirst,published_at.desc"
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
        print(f'Supabase API HTTPエラー: {e.code} - {error_body}')
        raise Exception(f'Supabase API呼び出しエラー: {e.code}')
    except urllib.error.URLError as e:
        print(f'Supabase API 接続エラー: {str(e)}')
        raise Exception('Supabaseへの接続に失敗しました')


def generate_news_html(today, calendar_articles: List[Dict], news_list_articles: List[Dict]) -> str:
    """
    news.htmlの完全なHTMLを生成
    """
    # 当月と来月のカレンダーを生成
    current_year = today.year
    current_month = today.month

    if current_month == 12:
        next_year = current_year + 1
        next_month = 1
    else:
        next_year = current_year
        next_month = current_month + 1

    current_calendar_html = generate_calendar_html(
        current_year, current_month, today, calendar_articles
    )
    next_calendar_html = generate_calendar_html(
        next_year, next_month, today, calendar_articles
    )

    # ニュース一覧HTMLを生成
    news_list_html = generate_news_list_html(news_list_articles)

    # テンプレートに埋め込み
    html = NEWS_HTML_TEMPLATE.format(
        current_month_title=f"{current_year}年{current_month}月",
        current_month_calendar=current_calendar_html,
        next_month_title=f"{next_year}年{next_month}月",
        next_month_calendar=next_calendar_html,
        news_list=news_list_html,
        generated_at=datetime.utcnow().isoformat() + 'Z'
    )

    return html


def generate_calendar_html(year: int, month: int, today, articles: List[Dict]) -> str:
    """
    カレンダーグリッドのHTMLを生成
    """
    import calendar

    cal = calendar.Calendar(firstweekday=6)  # 日曜始まり
    month_days = list(cal.itermonthdays2(year, month))

    # 曜日ヘッダー
    day_headers = ['日', '月', '火', '水', '木', '金', '土']
    html = ''
    for day in day_headers:
        html += f'<div class="calendar-day-header">{day}</div>'

    # 記事を日付でマッピング
    article_by_date = {}
    for article in articles:
        event_date = article.get('event_start_datetime')
        if event_date:
            # ISO形式からdateを抽出
            date_str = event_date[:10]  # YYYY-MM-DD
            if date_str not in article_by_date:
                article_by_date[date_str] = []
            article_by_date[date_str].append(article)

    # 日付セルを生成
    for day, weekday in month_days:
        if day == 0:
            # 前月・次月の日付（空欄として表示）
            html += '<div class="calendar-day other-month"></div>'
        else:
            # 今月の日付
            date_obj = datetime(year, month, day).date()
            date_str = date_obj.isoformat()

            is_today = (date_obj == today)
            today_class = 'today' if is_today else ''

            # その日のイベントを取得
            day_articles = article_by_date.get(date_str, [])
            has_event = len(day_articles) > 0
            event_class = 'has-event' if has_event else ''

            event_html = ''
            if has_event:
                article = day_articles[0]
                slug = article.get('slug') or article.get('id')
                title = article.get('title', '')
                # タイトルをエスケープ
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


def generate_news_list_html(articles: List[Dict]) -> str:
    """
    ニュース一覧のHTMLを生成
    """
    if not articles:
        return '<div class="text-center text-gray-500 py-8">お知らせはありません</div>'

    html = ''
    for article in articles[:30]:  # 最大30件表示
        slug = article.get('slug') or article.get('id')

        title = escape_html(article.get('title', ''))

        # イベント開始日を優先して表示
        event_date = article.get('event_start_datetime')
        if event_date:
            date_str = format_date_jp(event_date)
        else:
            published_at = article.get('published_at') or article.get('created_at')
            date_str = format_date_jp(published_at) if published_at else ''

        # アイキャッチ画像
        featured_image = article.get('featured_image_url')
        if featured_image:
            image_html = f'<img src="{featured_image}" alt="{title}" class="news-item-image">'
        else:
            image_html = '<div class="news-item-image bg-gray-200 flex items-center justify-center text-gray-400 text-sm">画像なし</div>'

        # SNSアイコン
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


def format_date_jp(iso_date: str) -> str:
    """
    ISO形式の日付を日本語形式に変換
    """
    try:
        # タイムゾーン情報を除去
        date_part = iso_date.replace('Z', '+00:00')
        if '+' in date_part:
            date_part = date_part.split('+')[0]
        if 'T' in date_part:
            date_str = date_part.split('T')[0]
        else:
            date_str = date_part[:10]

        year, month, day = date_str.split('-')

        # 曜日を計算
        dt = datetime(int(year), int(month), int(day))
        weekdays = ['月', '火', '水', '木', '金', '土', '日']
        weekday = weekdays[dt.weekday()]

        return f"{year}年{int(month):02d}月{int(day):02d}日（{weekday}）"
    except Exception:
        return iso_date


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
    # まず現在のファイルのSHAを取得（存在する場合）
    api_url = f"https://api.github.com/repos/{repo}/contents/{file_path}"
    headers = {
        'Authorization': f'token {token}',
        'Accept': 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
    }

    sha = None
    try:
        req = urllib.request.Request(f"{api_url}?ref={branch}", headers=headers, method='GET')
        with urllib.request.urlopen(req, timeout=30) as response:
            data = json.loads(response.read().decode('utf-8'))
            sha = data.get('sha')
    except urllib.error.HTTPError as e:
        if e.code != 404:
            raise
        # 404の場合は新規ファイル

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


# news.html テンプレート
NEWS_HTML_TEMPLATE = '''<!DOCTYPE html>
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
