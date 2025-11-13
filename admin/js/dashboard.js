/**
 * ダッシュボード機能
 * ユーザー認証、統計情報の表示、ナビゲーション管理
 */

class Dashboard {
  constructor() {
    this.currentUser = null;
    this.userRole = null;
    this.init();
  }

  /**
   * 初期化
   */
  async init() {
    await this.checkAuthentication();
    this.setupEventListeners();
    await this.loadDashboardData();
    this.updateUserUI();
  }

  /**
   * 認証チェック
   * ログインしていない場合はログインページへリダイレクト
   */
  async checkAuthentication() {
    try {
      this.currentUser = await supabaseClient.getCurrentUser();

      if (!this.currentUser) {
        console.warn('❌ 未認証ユーザー - ログインページへリダイレクト');
        window.location.href = 'login.html';
        return false;
      }

      // ユーザーロールを取得
      this.userRole = await supabaseClient.getUserRole(this.currentUser.id);

      if (!this.userRole) {
        alert('ユーザー情報が見つかりません。\nシステム管理者にお問い合わせください。');
        window.location.href = 'login.html';
        return false;
      }

      console.log('✅ 認証確認:', this.currentUser.email, '(ロール:', this.userRole, ')');
      return true;
    } catch (error) {
      console.error('認証エラー:', error.message);
      window.location.href = 'login.html';
      return false;
    }
  }

  /**
   * イベントリスナーを設定
   */
  setupEventListeners() {
    // ログアウトボタン
    const logoutBtn = document.querySelector('.btn-outline');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.logout();
      });
    }

    // モバイルメニューの処理は app.js で対応
  }

  /**
   * ダッシュボードデータを読み込む
   */
  async loadDashboardData() {
    try {
      // 記事統計
      const articlesResult = await supabaseClient.getArticles({
        status: 'published',
        limit: 1000,
        offset: 0
      });

      const totalArticles = articlesResult.count || 0;

      // カテゴリ別記事数
      const categoryStats = {
        notice: 0,
        event: 0,
        disaster_safety: 0,
        child_support: 0,
        shopping_info: 0,
        activity_report: 0
      };

      articlesResult.data?.forEach(article => {
        if (categoryStats[article.category] !== undefined) {
          categoryStats[article.category]++;
        }
      });

      // 統計情報を UI に反映
      this.updateStatCards(totalArticles, categoryStats);

      // 最新の記事を表示
      const recentArticles = articlesResult.data?.slice(0, 5) || [];
      this.displayRecentArticles(recentArticles);
    } catch (error) {
      console.error('ダッシュボードデータ読み込みエラー:', error.message);
    }
  }

  /**
   * 統計カードを更新
   */
  updateStatCards(total, categoryStats) {
    const statCards = document.querySelectorAll('.stat-card');

    if (statCards[0]) {
      statCards[0].querySelector('.stat-card-value').textContent = total;
    }

    if (statCards[1]) {
      statCards[1].querySelector('.stat-card-value').textContent =
        categoryStats.event || 0;
    }

    if (statCards[2]) {
      statCards[2].querySelector('.stat-card-value').textContent =
        categoryStats.disaster_safety || 0;
    }

    if (statCards[3]) {
      statCards[3].querySelector('.stat-card-value').textContent =
        categoryStats.child_support || 0;
    }
  }

  /**
   * 最新の記事を表示
   */
  displayRecentArticles(articles) {
    const articlesContainer = document.querySelector('.recent-items');
    if (!articlesContainer) return;

    articlesContainer.innerHTML = '';

    if (articles.length === 0) {
      articlesContainer.innerHTML =
        '<p style="color: #999; text-align: center; padding: 20px;">記事がありません</p>';
      return;
    }

    articles.forEach(article => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'recent-item';
      itemDiv.innerHTML = `
        <div class="recent-item-header">
          <h3 class="recent-item-title">${this.escapeHtml(article.title)}</h3>
          <span class="badge badge-${article.status}">
            ${article.status === 'published' ? '公開中' : '下書き'}
          </span>
        </div>
        <p class="recent-item-excerpt">${this.escapeHtml(article.excerpt || '')}</p>
        <div class="recent-item-footer">
          <span class="recent-item-author">${article.author?.name || '不明'}</span>
          <span class="recent-item-date">
            ${this.formatDate(article.published_at || article.created_at)}
          </span>
        </div>
      `;
      articlesContainer.appendChild(itemDiv);
    });
  }

  /**
   * ユーザーUIを更新
   */
  updateUserUI() {
    // ユーザー名を表示
    const userNameElements = document.querySelectorAll('.user-name');
    userNameElements.forEach(el => {
      el.textContent = this.currentUser?.email || 'ユーザー';
    });

    // ユーザーアバターの初文字を設定
    const avatarElements = document.querySelectorAll('.user-avatar');
    const initial = this.currentUser?.email?.charAt(0).toUpperCase() || 'U';
    avatarElements.forEach(el => {
      el.textContent = initial;
    });

    // 権限に応じてメニューを制限
    if (this.userRole !== 'admin') {
      // editor の場合、ユーザー管理メニューを非表示にする
      const usersLink = document.querySelector('a[href="users.html"]');
      if (usersLink) {
        usersLink.style.display = 'none';
      }
    }
  }

  /**
   * ログアウト
   */
  async logout() {
    const confirmed = confirm('ログアウトしてもよろしいですか？');
    if (!confirmed) return;

    try {
      await supabaseClient.signOut();
      localStorage.removeItem('asahigaoka_user_role');
      window.location.href = 'login.html';
    } catch (error) {
      console.error('ログアウトエラー:', error.message);
      alert('ログアウトに失敗しました');
    }
  }

  /**
   * HTML エスケープ
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * 日付をフォーマット
   */
  formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    return date.toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    });
  }
}

// ページロード時に初期化
document.addEventListener('DOMContentLoaded', function() {
  const dashboard = new Dashboard();
  window.dashboard = dashboard;
});
