/**
 * スマホ版管理画面 - mobile-admin.js
 * 既存の supabase-client.js, config.js を利用
 */

class MobileAdmin {
  constructor() {
    this.articles = [];
    this.expandedId = null;
    this.uploadedImageUrl = null;
    this.uploadedImageId = null;
  }

  // ============================
  // 初期化
  // ============================

  async init() {
    // 認証チェック
    if (!this.checkAuth()) return;

    // ユーザー名表示
    const user = supabaseClient.currentUser;
    if (user) {
      document.getElementById('user-name').textContent = `（${user.name}）`;
    }

    // イベントリスナー設定
    this.setupEventListeners();

    // 記事一覧読み込み
    await this.loadArticles();
  }

  checkAuth() {
    const user = supabaseClient.currentUser;
    if (!user) {
      window.location.href = 'login.html';
      return false;
    }
    return true;
  }

  setupEventListeners() {
    // タブ切り替え
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => this.switchTab(btn.dataset.tab));
    });

    // ログアウト
    document.getElementById('btn-logout').addEventListener('click', () => this.logout());

    // 新規作成フォーム
    document.getElementById('create-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.saveNewArticle();
    });

    // キャンセル
    document.getElementById('btn-cancel').addEventListener('click', () => {
      this.resetForm();
      this.switchTab('list');
    });

    // AI生成
    document.getElementById('btn-ai-generate').addEventListener('click', () => this.generateWithAI());

    // 画像アップロード
    const uploadArea = document.getElementById('image-upload-area');
    const fileInput = document.getElementById('new-image');

    uploadArea.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => this.handleImageUpload(e));

    // 画像削除
    document.getElementById('image-remove-btn').addEventListener('click', () => this.removeImage());
  }

  // ============================
  // タブ切り替え
  // ============================

  switchTab(tabName) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabName);
    });
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });
  }

  // ============================
  // ログアウト
  // ============================

  async logout() {
    await supabaseClient.signOut();
    window.location.href = 'login.html';
  }

  // ============================
  // 記事一覧
  // ============================

  async loadArticles() {
    this.showLoading('記事を読み込み中...');

    const result = await supabaseClient.getArticles({
      limit: 30,
      status: 'all',
      sortBy: 'created_at',
      sortOrder: 'desc'
    });

    this.hideLoading();

    if (!result.success) {
      this.showAlert('記事の読み込みに失敗しました', 'error');
      return;
    }

    this.articles = result.data || [];
    this.renderArticleList();
  }

  renderArticleList() {
    const container = document.getElementById('article-list');

    if (this.articles.length === 0) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">&#128221;</div>
          <div class="empty-state-text">記事がありません</div>
        </div>
      `;
      return;
    }

    container.innerHTML = this.articles.map(article => this.renderArticleCard(article)).join('');

    // カードのイベントリスナー設定
    container.querySelectorAll('.article-card-header').forEach(header => {
      header.addEventListener('click', () => {
        const id = header.closest('.article-card').dataset.id;
        this.toggleArticleExpand(id);
      });
    });
  }

  renderArticleCard(article) {
    const isPublished = article.status === 'published';
    const statusClass = isPublished ? 'published' : 'draft';
    const statusLabel = isPublished ? '公開中' : '下書き';
    const dateStr = this.formatDate(article.event_start_datetime || article.created_at);

    return `
      <div class="article-card" data-id="${article.id}">
        <div class="article-card-header">
          <span class="status-dot ${statusClass}"></span>
          <div class="article-card-info">
            <div class="article-card-title">${this.escapeHtml(article.title || '（無題）')}</div>
            <div class="article-card-date">${dateStr}</div>
          </div>
          <span class="article-card-chevron">&#9654;</span>
        </div>
        <div class="article-card-body">
          <div class="form-group">
            <label class="form-label">件名</label>
            <input type="text" class="form-input edit-title" value="${this.escapeAttr(article.title || '')}">
          </div>
          <div class="form-group">
            <label class="form-label">本文</label>
            <textarea class="form-textarea edit-content" rows="6">${this.escapeHtml(this.stripHtml(article.content || ''))}</textarea>
          </div>
          <div class="toggle-row">
            <span class="toggle-label">ステータス</span>
            <div style="display:flex;align-items:center;">
              <label class="toggle-switch">
                <input type="checkbox" class="status-toggle" ${isPublished ? 'checked' : ''}>
                <span class="toggle-slider"></span>
              </label>
              <span class="status-text ${statusClass}">${statusLabel}</span>
            </div>
          </div>
          <div class="edit-btn-row">
            <button class="btn btn-primary btn-sm btn-save-edit" data-id="${article.id}">保存</button>
            <button class="btn btn-secondary btn-sm btn-close-edit">閉じる</button>
          </div>
        </div>
      </div>
    `;
  }

  toggleArticleExpand(id) {
    const cards = document.querySelectorAll('.article-card');

    cards.forEach(card => {
      if (card.dataset.id === id) {
        const isExpanded = card.classList.toggle('expanded');

        if (isExpanded) {
          // 展開時にイベントリスナーを設定
          const saveBtn = card.querySelector('.btn-save-edit');
          const closeBtn = card.querySelector('.btn-close-edit');
          const toggle = card.querySelector('.status-toggle');
          const statusText = card.querySelector('.status-text');

          saveBtn.addEventListener('click', () => this.saveInlineEdit(id));
          closeBtn.addEventListener('click', () => {
            card.classList.remove('expanded');
          });

          toggle.addEventListener('change', () => {
            const isChecked = toggle.checked;
            statusText.textContent = isChecked ? '公開中' : '下書き';
            statusText.className = `status-text ${isChecked ? 'published' : 'draft'}`;
          });
        }
      } else {
        card.classList.remove('expanded');
      }
    });
  }

  // ============================
  // インライン編集保存
  // ============================

  async saveInlineEdit(id) {
    const card = document.querySelector(`.article-card[data-id="${id}"]`);
    if (!card) return;

    const title = card.querySelector('.edit-title').value.trim();
    const contentText = card.querySelector('.edit-content').value.trim();
    const isPublished = card.querySelector('.status-toggle').checked;

    if (!title) {
      this.showAlert('件名を入力してください', 'error');
      return;
    }

    this.showLoading('保存中...');

    // 元の記事データを取得
    const article = this.articles.find(a => a.id === id);
    const wasPublished = article && article.status === 'published';
    const newStatus = isPublished ? 'published' : 'draft';

    // 本文をHTML形式に変換（段落タグで囲む）
    const contentHtml = contentText
      .split('\n')
      .filter(line => line.trim())
      .map(line => `<p>${this.escapeHtml(line)}</p>`)
      .join('');

    const updates = {
      title,
      content: contentHtml,
      status: newStatus
    };

    // 下書き→公開中に変更した場合、published_at を設定
    if (!wasPublished && isPublished) {
      updates.published_at = new Date().toISOString();
    }

    const result = await supabaseClient.updateArticle(id, updates);

    if (!result.success) {
      this.hideLoading();
      this.showAlert('保存に失敗しました: ' + result.error, 'error');
      return;
    }

    // 下書き→公開中に変更した場合、SNS自動投稿チェック
    if (!wasPublished && isPublished && article) {
      await this.autoPublishSNS(result.data || { ...article, ...updates });
    }

    this.hideLoading();
    this.showAlert('保存しました', 'success');

    // 一覧を再読込
    await this.loadArticles();
  }

  // ============================
  // SNS自動投稿
  // ============================

  async autoPublishSNS(article) {
    if (!article) return;

    const title = article.title || '';
    const excerpt = article.excerpt || '';
    const slug = article.slug || article.id;

    // LINE投稿（テスト中のため無効化 - 本番利用者がいるため）
    // if (!article.line_published) {
    //   await this.postToLine(title, excerpt, slug, article.id);
    // }

    // X投稿（未投稿の場合のみ）
    if (!article.x_published) {
      await this.postToX(title, excerpt, slug, article.id);
    }
  }

  async postToLine(title, excerpt, slug, articleId) {
    const endpoint = window.LINE_BROADCAST_ENDPOINT;
    if (!endpoint) {
      console.warn('LINE通知エンドポイント未設定');
      return;
    }

    try {
      const articleUrl = `https://asahigaoka-nerima.tokyo/news/${slug}.html`;
      const message = `【新着記事】${title}\n\n${excerpt || title}\n\n${articleUrl}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, article_id: articleId })
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        // フラグ更新
        await supabaseClient.updateArticle(articleId, { line_published: true });
        this.showAlert('LINE通知を送信しました', 'success');
      } else if (response.ok && result.status === 'skipped') {
        console.log('LINE通知スキップ（既に配信済み）');
      } else {
        console.error('LINE通知失敗:', result);
      }
    } catch (error) {
      console.error('LINE通知エラー:', error);
    }
  }

  async postToX(title, excerpt, slug, articleId) {
    const endpoint = window.X_POST_ENDPOINT;
    if (!endpoint) {
      console.warn('X投稿エンドポイント未設定');
      return;
    }

    try {
      const articleUrl = `https://asahigaoka-nerima.tokyo/news/${slug}.html`;
      let message = `${excerpt || title}\n#旭丘一丁目\n${articleUrl}`;

      // 280文字制限
      if (message.length > 280) {
        const suffix = `\n#旭丘一丁目\n${articleUrl}`;
        const maxLen = 280 - suffix.length - 3;
        message = (excerpt || title).substring(0, maxLen) + '...' + suffix;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, article_id: articleId })
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        await supabaseClient.updateArticle(articleId, { x_published: true });
        this.showAlert('Xに投稿しました', 'success');
      } else if (response.ok && result.status === 'skipped') {
        console.log('X投稿スキップ（既に投稿済み）');
      } else {
        console.error('X投稿失敗:', result);
      }
    } catch (error) {
      console.error('X投稿エラー:', error);
    }
  }

  // ============================
  // 画像アップロード
  // ============================

  async handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    // バリデーション
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.showAlert('JPG, PNG, GIF, WebP のみ対応しています', 'error');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      this.showAlert('画像サイズは5MB以下にしてください', 'error');
      return;
    }

    // プレビュー表示
    const reader = new FileReader();
    reader.onload = (ev) => {
      document.getElementById('image-preview-img').src = ev.target.result;
      document.getElementById('image-preview').classList.add('has-image');
    };
    reader.readAsDataURL(file);

    // アップロード
    this.showLoading('画像をアップロード中...');
    const result = await supabaseClient.uploadMedia(file, 'featured-images');
    this.hideLoading();

    if (result.success) {
      this.uploadedImageUrl = result.data.file_url;
      this.uploadedImageId = result.data.id;
      this.showAlert('画像をアップロードしました', 'success');
    } else {
      this.showAlert('画像のアップロードに失敗しました', 'error');
      this.removeImage();
    }
  }

  removeImage() {
    this.uploadedImageUrl = null;
    this.uploadedImageId = null;
    document.getElementById('new-image').value = '';
    document.getElementById('image-preview-img').src = '';
    document.getElementById('image-preview').classList.remove('has-image');
  }

  // ============================
  // AI生成
  // ============================

  async generateWithAI() {
    const title = document.getElementById('new-title').value.trim();
    const summary = document.getElementById('new-summary').value.trim();
    const dateFrom = document.getElementById('new-date-from').value;
    const dateTo = document.getElementById('new-date-to').value;

    // バリデーション
    if (!title) {
      this.showAlert('件名を入力してください', 'error');
      return;
    }
    if (!summary) {
      this.showAlert('要約（下書き）を入力してください', 'error');
      return;
    }
    if (!dateFrom) {
      this.showAlert('開始日を入力してください', 'error');
      return;
    }

    this.showLoading('AIが記事を生成中...');

    try {
      const result = await this.callDifyAPI(title, summary, dateFrom, dateTo);

      this.hideLoading();

      if (result.success) {
        // 本文に自動入力
        document.getElementById('new-content').value = result.data.text350 || '';
        // SNS用サマリ文に自動入力
        document.getElementById('new-excerpt').value = result.data.text80 || '';
        this.showAlert('AIが記事を生成しました', 'success');
      } else {
        this.showAlert('AI生成に失敗しました: ' + (result.error || ''), 'error');
      }
    } catch (error) {
      this.hideLoading();
      this.showAlert('AI生成中にエラーが発生しました', 'error');
    }
  }

  async callDifyAPI(title, summary, date, dateTo = null) {
    const apiEndpoint = window.DIFY_PROXY_ENDPOINT;
    if (!apiEndpoint) {
      return { success: false, error: 'APIエンドポイント未設定' };
    }

    const requestBody = {
      title,
      summary,
      date,
      intro_url: 'https://asahigaoka-nerima.tokyo/town.html'
    };

    if (dateTo) {
      requestBody.date_to = dateTo;
    }

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.data) {
        return {
          success: true,
          data: {
            text350: data.data.text350 || '',
            text80: data.data.text80 || '',
            meta_desc: data.data.meta_desc || '',
            meta_kwd: data.data.meta_kwd || ''
          }
        };
      } else {
        throw new Error(data.error || 'レスポンス形式不正');
      }
    } catch (error) {
      console.error('Dify API エラー:', error);
      return { success: false, error: error.message };
    }
  }

  // ============================
  // 新規記事保存
  // ============================

  async saveNewArticle() {
    const title = document.getElementById('new-title').value.trim();
    const dateFrom = document.getElementById('new-date-from').value;
    const dateTo = document.getElementById('new-date-to').value;
    const summary = document.getElementById('new-summary').value.trim();
    const contentText = document.getElementById('new-content').value.trim();
    const excerpt = document.getElementById('new-excerpt').value.trim();

    // バリデーション
    if (!title) {
      this.showAlert('件名を入力してください', 'error');
      return;
    }
    if (!dateFrom) {
      this.showAlert('開始日を入力してください', 'error');
      return;
    }
    if (!summary) {
      this.showAlert('要約を入力してください', 'error');
      return;
    }

    this.showLoading('記事を保存中...');

    // 本文をHTML形式に変換
    const contentHtml = contentText
      ? contentText.split('\n').filter(l => l.trim()).map(l => `<p>${this.escapeHtml(l)}</p>`).join('')
      : '';

    // 日時組み立て
    const eventStartDatetime = dateFrom + ' 00:00:00';
    const eventEndDatetime = dateTo ? dateTo + ' 23:59:59' : null;

    const articleData = {
      title,
      content: contentHtml,
      excerpt: excerpt || summary,
      category: 'notice',
      status: 'draft',
      event_start_datetime: eventStartDatetime,
      event_end_datetime: eventEndDatetime,
      has_start_time: false,
      has_end_time: false,
      featured_image_url: this.uploadedImageUrl || null,
      line_published: false,
      x_published: false,
      show_in_news_list: true,
      show_in_calendar: true
    };

    const result = await supabaseClient.createArticle(articleData);

    this.hideLoading();

    if (result.success) {
      this.showAlert('記事を下書き保存しました', 'success');
      this.resetForm();
      this.switchTab('list');
      await this.loadArticles();
    } else {
      this.showAlert('保存に失敗しました: ' + result.error, 'error');
    }
  }

  resetForm() {
    document.getElementById('create-form').reset();
    this.removeImage();
    document.getElementById('new-content').value = '';
    document.getElementById('new-excerpt').value = '';
  }

  // ============================
  // UI ヘルパー
  // ============================

  showAlert(message, type = 'info') {
    const area = document.getElementById('alert-area');
    const alert = document.createElement('div');
    alert.className = `mobile-alert ${type}`;
    alert.textContent = message;
    area.appendChild(alert);

    setTimeout(() => {
      alert.style.opacity = '0';
      alert.style.transition = 'opacity 0.3s';
      setTimeout(() => alert.remove(), 300);
    }, 4000);
  }

  showLoading(text = '処理中...') {
    document.getElementById('loading-text').textContent = text;
    document.getElementById('loading-overlay').classList.add('active');
  }

  hideLoading() {
    document.getElementById('loading-overlay').classList.remove('active');
  }

  formatDate(dateStr) {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  escapeAttr(str) {
    return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  stripHtml(html) {
    const div = document.createElement('div');
    div.innerHTML = html;
    return div.textContent || div.innerText || '';
  }
}

// ============================
// 起動
// ============================
document.addEventListener('DOMContentLoaded', () => {
  const app = new MobileAdmin();
  app.init();
});
