/**
 * 記事管理機能
 * 記事の一覧表示、検索、フィルタリング、削除など
 */

class ArticlesManager {
  constructor() {
    this.currentUser = null;
    this.userRole = null;
    this.articles = [];
    this.filteredArticles = [];
    this.currentPage = 1;
    this.pageSize = 20;
    this.selectedCategory = 'all';
    this.selectedStatus = 'all';
    this.init();
  }

  /**
   * 初期化
   */
  async init() {
    await this.checkAuthentication();
    this.checkSuccessMessage();
    this.setupEventListeners();
    await this.loadArticles();
  }

  /**
   * 認証チェック
   */
  async checkAuthentication() {
    try {
      this.currentUser = await supabaseClient.getCurrentUser();

      if (!this.currentUser) {
        window.location.href = 'login.html';
        return false;
      }

      this.userRole = await supabaseClient.getUserRole(this.currentUser.id);
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
    // カテゴリフィルター
    const categorySelect = document.querySelector('[data-filter="category"]');
    if (categorySelect) {
      categorySelect.addEventListener('change', (e) => {
        this.selectedCategory = e.target.value;
        this.currentPage = 1;
        this.applyFilters();
      });
    }

    // ステータスフィルター
    const statusSelect = document.querySelector('[data-filter="status"]');
    if (statusSelect) {
      statusSelect.addEventListener('change', (e) => {
        this.selectedStatus = e.target.value;
        this.currentPage = 1;
        this.applyFilters();
      });
    }

    // 検索ボックス
    const searchInput = document.querySelector('.search-box input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.currentPage = 1;
        this.applyFilters();
      });
    }

    // ログアウトボタン
    const logoutBtn = document.querySelector('.btn-outline');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.logout();
      });
    }
  }

  /**
   * 記事を読み込む
   */
  async loadArticles() {
    try {
      const result = await supabaseClient.getArticles({
        status: 'all',
        limit: 1000,
        offset: 0
      });

      this.articles = result.data || [];
      this.applyFilters();
    } catch (error) {
      console.error('記事読み込みエラー:', error.message);
      this.showAlert('記事の読み込みに失敗しました', 'error');
    }
  }

  /**
   * フィルターを適用
   */
  applyFilters() {
    let filtered = [...this.articles];

    // カテゴリフィルター
    if (this.selectedCategory !== 'all') {
      filtered = filtered.filter(a => a.category === this.selectedCategory);
    }

    // ステータスフィルター（公開/下書きの権限チェック）
    if (this.selectedStatus !== 'all') {
      filtered = filtered.filter(a => {
        if (this.selectedStatus === 'published') {
          return a.status === 'published';
        } else if (this.selectedStatus === 'draft') {
          // editor は自分の下書きのみ、admin は全ての下書きを表示
          return a.status === 'draft' && (
            this.userRole === 'admin' || a.author?.id === this.currentUser.id
          );
        }
        return true;
      });
    } else if (this.userRole === 'editor') {
      // editor の場合、公開済み記事と自分の下書きを表示
      filtered = filtered.filter(a =>
        a.status === 'published' || (a.status === 'draft' && a.author?.id === this.currentUser.id)
      );
    }

    // 検索フィルター
    const searchInput = document.querySelector('.search-box input');
    if (searchInput && searchInput.value.trim()) {
      const query = searchInput.value.toLowerCase();
      filtered = filtered.filter(a =>
        a.title.toLowerCase().includes(query) ||
        (a.excerpt && a.excerpt.toLowerCase().includes(query))
      );
    }

    this.filteredArticles = filtered;
    this.displayArticles();
  }

  /**
   * 記事を表示
   */
  displayArticles() {
    const articlesContainer = document.querySelector('.table tbody');
    if (!articlesContainer) {
      console.warn('テーブルコンテナが見つかりません');
      return;
    }

    articlesContainer.innerHTML = '';

    if (this.filteredArticles.length === 0) {
      articlesContainer.innerHTML = `
        <tr>
          <td colspan="7" style="text-align: center; padding: 30px; color: #999;">
            記事がありません
          </td>
        </tr>
      `;
      return;
    }

    // ページネーション
    const start = (this.currentPage - 1) * this.pageSize;
    const end = start + this.pageSize;
    const pageArticles = this.filteredArticles.slice(start, end);

    pageArticles.forEach(article => {
      const row = document.createElement('tr');
      row.innerHTML = `
        <td>
          <input type="checkbox" class="item-checkbox" value="${article.id}">
        </td>
        <td>
          <strong>${this.escapeHtml(article.title)}</strong>
          <br>
          <small style="color: #999;">${this.escapeHtml(article.excerpt || '')}</small>
        </td>
        <td>
          <span class="badge badge-${this.getCategoryColor(article.category)}">
            ${this.getCategoryLabel(article.category)}
          </span>
        </td>
        <td>
          <span class="badge badge-${article.status}">
            ${article.status === 'published' ? '公開' : '下書き'}
          </span>
        </td>
        <td>${article.author?.name || '不明'}</td>
        <td>${this.formatDate(article.published_at || article.created_at)}</td>
        <td>
          <div class="action-buttons">
            <a href="article-edit.html?id=${article.id}" class="btn btn-sm btn-primary">編集</a>
            ${article.status === 'published' ? `
              <button class="btn btn-sm btn-warning" data-action="unpublish" data-id="${article.id}">
                下書きに戻す
              </button>
            ` : ''}
            <button class="btn btn-sm btn-danger" data-action="delete" data-id="${article.id}">
              削除
            </button>
          </div>
        </td>
      `;
      articlesContainer.appendChild(row);
    });

    // 削除ボタンのイベントリスナー
    document.querySelectorAll('[data-action="delete"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const articleId = btn.getAttribute('data-id');
        this.deleteArticle(articleId);
      });
    });

    // 下書きに戻すボタンのイベントリスナー
    document.querySelectorAll('[data-action="unpublish"]').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const articleId = btn.getAttribute('data-id');
        this.unpublishArticle(articleId);
      });
    });

    // ページネーション情報を更新
    this.updatePagination();
  }

  /**
   * ページネーション情報を更新
   */
  updatePagination() {
    const totalPages = Math.ceil(this.filteredArticles.length / this.pageSize);
    const paginationContainer = document.querySelector('.pagination');

    if (!paginationContainer) return;

    paginationContainer.innerHTML = '';

    if (totalPages <= 1) return;

    // 前へボタン
    if (this.currentPage > 1) {
      const prevBtn = document.createElement('button');
      prevBtn.className = 'btn btn-sm';
      prevBtn.textContent = '前へ';
      prevBtn.addEventListener('click', () => {
        this.currentPage--;
        this.displayArticles();
      });
      paginationContainer.appendChild(prevBtn);
    }

    // ページ番号
    for (let i = 1; i <= totalPages; i++) {
      const pageBtn = document.createElement('button');
      pageBtn.className = `btn btn-sm ${i === this.currentPage ? 'btn-primary' : ''}`;
      pageBtn.textContent = i;
      pageBtn.addEventListener('click', () => {
        this.currentPage = i;
        this.displayArticles();
      });
      paginationContainer.appendChild(pageBtn);
    }

    // 次へボタン
    if (this.currentPage < totalPages) {
      const nextBtn = document.createElement('button');
      nextBtn.className = 'btn btn-sm';
      nextBtn.textContent = '次へ';
      nextBtn.addEventListener('click', () => {
        this.currentPage++;
        this.displayArticles();
      });
      paginationContainer.appendChild(nextBtn);
    }
  }

  /**
   * 記事を下書きに戻す（公開解除）
   * 公開済み記事を下書き状態に戻し、詳細ページを削除する
   */
  async unpublishArticle(articleId) {
    const confirmed = confirm('この記事を下書きに戻しますか？\n（詳細ページがWebサイトから削除されます）');
    if (!confirmed) return;

    try {
      // 1. 記事のステータスを下書きに変更
      const result = await supabaseClient.updateArticle(articleId, {
        status: 'draft',
        published_at: null
      });

      if (!result.success) {
        this.showAlert('下書きへの変更に失敗しました: ' + result.error, 'error');
        return;
      }

      // 2. 詳細ページをGitHubから削除
      if (window.staticPageGenerator) {
        console.log('🗑️ 記事詳細ページを削除中...');
        const detailResult = await window.staticPageGenerator.deleteDetailPage(articleId);
        if (detailResult.success) {
          console.log('✅ 記事詳細ページ削除成功:', detailResult.file_path);
        } else {
          console.warn('⚠️ 記事詳細ページ削除失敗:', detailResult.error);
          // 詳細ページ削除失敗は警告を出すが、処理自体は成功扱いにする
          this.showAlert('記事を下書きに戻しましたが、詳細ページの削除に失敗しました', 'warning');
        }
      }

      // 3. 記事一覧を更新
      const articleIndex = this.articles.findIndex(a => a.id === articleId);
      if (articleIndex !== -1) {
        this.articles[articleIndex].status = 'draft';
        this.articles[articleIndex].published_at = null;
      }
      this.applyFilters();
      this.showAlert('記事を下書きに戻しました', 'success');
    } catch (error) {
      console.error('下書きへの変更エラー:', error.message);
      this.showAlert('下書きへの変更処理でエラーが発生しました', 'error');
    }
  }

  /**
   * 記事を削除
   */
  async deleteArticle(articleId) {
    const confirmed = confirm('この記事を削除しますか？');
    if (!confirmed) return;

    try {
      // 先に詳細ページを削除（GitHubから）
      if (window.staticPageGenerator) {
        console.log('🗑️ 記事詳細ページを削除中...');
        const detailResult = await window.staticPageGenerator.deleteDetailPage(articleId);
        if (detailResult.success) {
          console.log('✅ 記事詳細ページ削除成功:', detailResult.file_path);
        } else {
          console.warn('⚠️ 記事詳細ページ削除失敗:', detailResult.error);
          // 詳細ページ削除失敗は警告を出すが、記事削除処理自体は継続
        }
      }

      const result = await supabaseClient.deleteArticle(articleId);

      if (result.success) {
        this.articles = this.articles.filter(a => a.id !== articleId);
        this.applyFilters();
        this.showAlert('記事を削除しました', 'success');
      } else {
        this.showAlert('削除に失敗しました: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('削除エラー:', error.message);
      this.showAlert('削除処理でエラーが発生しました', 'error');
    }
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
   * アラート表示
   */
  showAlert(message, type = 'info') {
    const alertDiv = document.createElement('div');
    alertDiv.className = `alert alert-${type}`;
    alertDiv.textContent = message;
    alertDiv.style.marginTop = '20px';

    const mainContent = document.querySelector('.main-content');
    if (mainContent) {
      mainContent.insertBefore(alertDiv, mainContent.querySelector('h1').nextElementSibling);

      setTimeout(() => {
        alertDiv.remove();
      }, 5000);
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
    return date.toLocaleDateString('ja-JP');
  }

  /**
   * 成功メッセージをチェックして表示
   */
  checkSuccessMessage() {
    const message = localStorage.getItem('article_success_message');
    const timestamp = localStorage.getItem('article_success_timestamp');

    if (message && timestamp) {
      // 10秒以内のメッセージのみ表示（古いメッセージは無視）
      const messageTime = parseInt(timestamp);
      const now = Date.now();
      const elapsed = now - messageTime;

      if (elapsed < 10000) {
        const messageDiv = document.getElementById('success-message');
        const messageText = document.getElementById('success-message-text');

        if (messageDiv && messageText) {
          messageText.textContent = message;
          messageDiv.style.display = 'block';

          // 5秒後に自動消去
          setTimeout(() => {
            messageDiv.style.display = 'none';
          }, 5000);
        }
      }

      // localStorage をクリア
      localStorage.removeItem('article_success_message');
      localStorage.removeItem('article_success_timestamp');
    }
  }
}

// ページロード時に初期化
document.addEventListener('DOMContentLoaded', function() {
  const articlesManager = new ArticlesManager();
  window.articlesManager = articlesManager;
});
