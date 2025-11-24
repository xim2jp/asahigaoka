/**
 * 静的ページ生成クライアント
 * 管理画面から静的ページ生成APIを呼び出すためのクラス
 */

class StaticPageGenerator {
  constructor() {
    // エンドポイントは config.js から取得、またはデフォルト値
    this.apiEndpoint = window.PAGE_GENERATOR_ENDPOINT || 'https://api.asahigaoka-nerima.tokyo/api/generate/index';
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
}

// グローバルインスタンス作成
window.staticPageGenerator = new StaticPageGenerator();

