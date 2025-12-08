/**
 * 静的ページ生成クライアント
 * 管理画面から静的ページ生成APIを呼び出すためのクラス
 */

class StaticPageGenerator {
  constructor() {
    // エンドポイントは config.js から取得、またはデフォルト値
    this.apiEndpoint = window.PAGE_GENERATOR_ENDPOINT || 'https://api.asahigaoka-nerima.tokyo/api/generate/index';
    this.articlePageEndpoint = window.ARTICLE_PAGE_GENERATOR_ENDPOINT || 'https://api.asahigaoka-nerima.tokyo/api/generate/article';
    this.newsPageEndpoint = window.NEWS_PAGE_GENERATOR_ENDPOINT || 'https://api.asahigaoka-nerima.tokyo/api/generate/news';
  }

  /**
   * TOPページ生成リクエストを送信
   * @param {string} token - 認証トークン（JWT）
   * @returns {Promise<{success: boolean, message: string, error?: string}>}
   */
  async generateTopPage(token) {
    console.log('🔄 TOPページ生成リクエスト送信開始...');
    
    try {
      // ※ APIが未実装の場合はモックとして振る舞う
      if (this.apiEndpoint.includes('api.asahigaoka-nerima.tokyo')) {
        console.log('⚠️ 開発モード: APIエンドポイントがダミーのため、リクエスト送信をシミュレートします');
        return await this.mockGenerateRequest();
      }

      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          force_regenerate: true
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ TOPページ生成リクエスト成功:', result);
      return result;

    } catch (error) {
      console.error('❌ TOPページ生成リクエスト失敗:', error);
      // APIがない場合でも、ユーザーフローを止めないように成功扱い（ただしログは出す）にするか、
      // 明示的にエラーを返すか。ここではエラーを返して呼び出し元でハンドリングする。
      return {
        success: false,
        message: 'ページ生成リクエストに失敗しました',
        error: error.message
      };
    }
  }

  /**
   * 開発用モックレスポンス
   */
  async mockGenerateRequest() {
    return new Promise((resolve) => {
      setTimeout(() => {
        console.log('✅ [Mock] 静的ページ生成トリガー完了');
        resolve({
          success: true,
          message: 'TOPページ更新リクエストを受け付けました（開発モード）',
          generated_at: new Date().toISOString()
        });
      }, 1000);
    });
  }

  /**
   * 記事ページを生成
   * @param {object} articleData - 記事データ
   * @returns {Promise<{success: boolean, message: string, error?: string}>}
   */
  async generateArticlePage(articleData) {
    console.log('🔄 記事ページ生成リクエスト送信開始...', articleData.id);

    try {
      // APIが未実装の場合はモックとして振る舞う
      if (this.articlePageEndpoint.includes('api.asahigaoka-nerima.tokyo')) {
        console.log('⚠️ 開発モード: 記事ページ生成APIがダミーのため、リクエスト送信をシミュレートします');
        return await this.mockArticlePageGeneration(articleData);
      }

      const response = await fetch(this.articlePageEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          article_id: articleData.id,
          article_data: articleData
        })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ 記事ページ生成リクエスト成功:', result);
      return result;

    } catch (error) {
      console.error('❌ 記事ページ生成リクエスト失敗:', error);
      return {
        success: false,
        message: '記事ページ生成リクエストに失敗しました',
        error: error.message
      };
    }
  }

  /**
   * 記事ページ生成のモック（開発用）
   * @param {object} articleData - 記事データ
   */
  async mockArticlePageGeneration(articleData) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const slug = articleData.slug || articleData.id;
        console.log(`✅ [Mock] 記事ページ生成完了: news/${slug}.html`);
        resolve({
          success: true,
          message: `記事ページを生成しました: news/${slug}.html（開発モード）`,
          generated_file: `news/${slug}.html`,
          generated_at: new Date().toISOString()
        });
      }, 500);
    });
  }

  /**
   * お知らせ一覧ページ（news.html）を更新
   * @param {object} options - オプション（show_in_news_list, show_in_calendarなど）
   * @returns {Promise<{success: boolean, message: string, error?: string}>}
   */
  async updateNewsPage(options = {}) {
    console.log('🔄 お知らせ一覧ページ更新リクエスト送信開始...');

    try {
      // APIが未実装の場合はモックとして振る舞う
      if (this.newsPageEndpoint.includes('api.asahigaoka-nerima.tokyo')) {
        console.log('⚠️ 開発モード: お知らせ一覧更新APIがダミーのため、リクエスト送信をシミュレートします');
        return await this.mockNewsPageUpdate(options);
      }

      const response = await fetch(this.newsPageEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(options)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      console.log('✅ お知らせ一覧ページ更新リクエスト成功:', result);
      return result;

    } catch (error) {
      console.error('❌ お知らせ一覧ページ更新リクエスト失敗:', error);
      return {
        success: false,
        message: 'お知らせ一覧ページ更新リクエストに失敗しました',
        error: error.message
      };
    }
  }

  /**
   * お知らせ一覧ページ更新のモック（開発用）
   * @param {object} options - オプション
   */
  async mockNewsPageUpdate(options) {
    return new Promise((resolve) => {
      setTimeout(() => {
        const updates = [];
        if (options.update_news_list) updates.push('お知らせ一覧');
        if (options.update_calendar) updates.push('カレンダー');

        console.log(`✅ [Mock] news.html 更新完了: ${updates.join(', ') || 'なし'}`);
        resolve({
          success: true,
          message: `news.html を更新しました: ${updates.join(', ') || 'なし'}（開発モード）`,
          updated_sections: updates,
          generated_at: new Date().toISOString()
        });
      }, 500);
    });
  }

  /**
   * 記事保存時の静的ページ生成処理を一括実行
   * @param {object} articleData - 保存された記事データ
   * @param {object} flags - フラグ（generateArticlePage, showInNewsList, showInCalendar）
   * @returns {Promise<{success: boolean, results: object}>}
   */
  async processArticleSave(articleData, flags) {
    console.log('🔄 記事保存後の静的ページ生成処理開始...', {
      articleId: articleData.id,
      flags
    });

    const results = {
      articlePage: null,
      newsPage: null
    };

    try {
      // 1. 記事ページ生成
      if (flags.generateArticlePage) {
        results.articlePage = await this.generateArticlePage(articleData);
      }

      // 2. お知らせ一覧・カレンダー更新
      if (flags.showInNewsList || flags.showInCalendar) {
        results.newsPage = await this.updateNewsPage({
          update_news_list: flags.showInNewsList,
          update_calendar: flags.showInCalendar,
          article_id: articleData.id,
          article_slug: articleData.slug || articleData.id
        });
      }

      console.log('✅ 静的ページ生成処理完了:', results);
      return {
        success: true,
        results
      };

    } catch (error) {
      console.error('❌ 静的ページ生成処理エラー:', error);
      return {
        success: false,
        error: error.message,
        results
      };
    }
  }
}

// グローバルインスタンス作成
window.staticPageGenerator = new StaticPageGenerator();


