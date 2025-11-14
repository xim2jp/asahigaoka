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
      // 全記事を取得
      const articlesResult = await supabaseClient.getArticles({
        status: 'all',
        limit: 1000,
        offset: 0
      });

      const articles = articlesResult.data || [];

      // 統計情報を計算
      const totalCount = articles.length;
      const now = new Date();
      const currentMonth = now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
      const monthlyCount = articles.filter(a => {
        const createdDate = new Date(a.created_at);
        return createdDate.toISOString().startsWith(currentMonth);
      }).length;
      const lineCount = articles.filter(a => a.line_published).length;
      const xCount = articles.filter(a => a.x_published).length;

      // 統計カードを更新
      const statValues = document.querySelectorAll('.stat-card-value');
      if (statValues.length >= 4) {
        statValues[0].textContent = totalCount;
        statValues[1].textContent = monthlyCount;
        statValues[2].textContent = lineCount;
        statValues[3].textContent = xCount;
      }

      // 最新の published 記事を表示
      const recentArticles = articles
        .filter(a => a.status === 'published')
        .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
        .slice(0, 5);
      this.displayLatestArticles(recentArticles);

      // 下書き記事を表示
      this.displayDraftArticles(articles);
    } catch (error) {
      console.error('ダッシュボードデータ読み込みエラー:', error.message);
    }
  }

  /**
   * 最新記事を表示
   */
  displayLatestArticles(articles) {
    const tbody = document.querySelector('.table tbody');
    if (!tbody) return;

    tbody.innerHTML = '';

    if (articles.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="5" style="text-align: center; padding: 20px; color: #999;">
            記事がありません
          </td>
        </tr>
      `;
      return;
    }

    articles.forEach(article => {
      const row = document.createElement('tr');
      const categoryLabel = this.getCategoryLabel(article.category);
      const categoryColor = this.getCategoryColor(article.category);
      const updatedDate = new Date(article.updated_at).toLocaleDateString('ja-JP');

      row.innerHTML = `
        <td><strong>${this.escapeHtml(article.title)}</strong></td>
        <td><span class="badge badge-${categoryColor}">${categoryLabel}</span></td>
        <td><span class="badge badge-success">公開</span></td>
        <td>${updatedDate}</td>
        <td>
          <div class="table-actions">
            <a href="article-edit.html?id=${article.id}" class="btn btn-sm btn-outline">編集</a>
          </div>
        </td>
      `;
      tbody.appendChild(row);
    });
  }

  /**
   * 下書き記事を表示
   */
  displayDraftArticles(articles) {
    // 下書き記事リストを取得
    let targetList = null;
    const allCards = document.querySelectorAll('.card');
    for (const card of allCards) {
      if (card.textContent.includes('下書き記事')) {
        targetList = card.querySelector('ul');
        break;
      }
    }

    if (!targetList) return;

    targetList.innerHTML = '';

    // draft 記事で、自分の記事（admin は全て）
    let drafts = articles
      .filter(a => a.status === 'draft')
      .filter(a => this.userRole === 'admin' || a.author?.id === this.currentUser.id)
      .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));

    if (drafts.length === 0) {
      const li = document.createElement('li');
      li.style.cssText = 'padding: 20px; text-align: center; color: #999;';
      li.textContent = '下書き記事がありません';
      targetList.appendChild(li);
      return;
    }

    drafts.forEach((article, index) => {
      const li = document.createElement('li');
      const updatedDate = new Date(article.updated_at);
      const relativeDate = this.getRelativeDate(updatedDate);

      li.style.cssText = `padding: 10px 0;${index < drafts.length - 1 ? ' border-bottom: 1px solid var(--border-color);' : ''}`;
      li.innerHTML = `
        <a href="article-edit.html?id=${article.id}" style="color: var(--text-primary); text-decoration: none;">
          📄 ${this.escapeHtml(article.title)}
          <br>
          <small style="color: var(--text-secondary);">更新: ${relativeDate}</small>
        </a>
      `;
      targetList.appendChild(li);
    });
  }

  /**
   * カテゴリラベルを取得
   */
  getCategoryLabel(category) {
    const labels = {
      notice: 'お知らせ',
      event: 'イベント',
      disaster_safety: '防災・防犯',
      child_support: '子育て支援',
      shopping_info: '商店街',
      activity_report: '活動レポート'
    };
    return labels[category] || category;
  }

  /**
   * カテゴリの色を取得
   */
  getCategoryColor(category) {
    const colors = {
      notice: 'info',
      event: 'success',
      disaster_safety: 'danger',
      child_support: 'primary',
      shopping_info: 'warning',
      activity_report: 'secondary'
    };
    return colors[category] || 'secondary';
  }

  /**
   * 相対日時を取得
   */
  getRelativeDate(date) {
    const now = new Date();
    const diffMs = now - date;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);

    if (diffMins < 1) return '今';
    if (diffMins < 60) return `${diffMins}分前`;
    if (diffHours < 24) return `${diffHours}時間前`;
    if (diffDays < 7) return `${diffDays}日前`;
    if (diffDays < 30) return `${Math.floor(diffDays / 7)}週間前`;

    return date.toLocaleDateString('ja-JP');
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
