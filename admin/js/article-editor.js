/**
 * 記事編集機能
 * 記事の作成・更新、メディアアップロード、公開管理
 */

class ArticleEditor {
  constructor() {
    this.currentUser = null;
    this.userRole = null;
    this.articleId = null;
    this.currentArticle = null;
    this.init();
  }

  /**
   * 初期化
   */
  async init() {
    console.log('🚀 ArticleEditor 初期化開始');
    await this.checkAuthentication();
    console.log('✅ 認証チェック完了');
    this.setupEventListeners();
    console.log('✅ イベントリスナー設定完了');

    // URLパラメータから記事IDを取得
    const urlParams = new URLSearchParams(window.location.search);
    this.articleId = urlParams.get('id');

    if (this.articleId) {
      // 既存記事を編集モードで読み込む
      await this.loadArticle(this.articleId);
    } else {
      // 新規記事作成モード
      this.setupNewArticleForm();
    }
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
    console.log('📝 イベントリスナー設定中...');

    // 保存ボタン
    const saveBtn = document.querySelector('[data-action="save"]');
    console.log('保存ボタン:', saveBtn);
    if (saveBtn) {
      saveBtn.addEventListener('click', () => this.saveArticle());
      console.log('✅ 保存ボタンにリスナー設定');
    }

    // 公開ボタン
    const publishBtn = document.querySelector('[data-action="publish"]');
    console.log('公開ボタン:', publishBtn);
    if (publishBtn) {
      publishBtn.addEventListener('click', () => this.publishArticle());
      console.log('✅ 公開ボタンにリスナー設定');
    }

    // キャンセルボタン
    const cancelBtn = document.querySelector('[data-action="cancel"]');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => {
        window.history.back();
      });
    }

    // 画像アップロード
    const fileInput = document.querySelector('input[type="file"]');
    if (fileInput) {
      fileInput.addEventListener('change', (e) => this.handleImageUpload(e));
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
  async loadArticle(articleId) {
    try {
      const result = await supabaseClient.getArticleById(articleId);

      if (!result.success) {
        alert('記事が見つかりません');
        window.location.href = 'articles.html';
        return;
      }

      this.currentArticle = result.data;

      // 権限チェック（admin か 記事の著者のみ編集可能）
      if (this.userRole !== 'admin' && this.currentArticle.author.id !== this.currentUser.id) {
        alert('この記事を編集する権限がありません');
        window.location.href = 'articles.html';
        return;
      }

      // フォームにデータを設定
      document.querySelector('#title').value = this.currentArticle.title || '';
      document.querySelector('#content').value = this.currentArticle.content || '';
      document.querySelector('#excerpt').value = this.currentArticle.excerpt || '';
      document.querySelector('#category').value = this.currentArticle.category || 'notice';

      // タイトル更新
      const pageTitle = document.querySelector('.page-title');
      if (pageTitle) {
        pageTitle.textContent = '記事を編集';
      }

      console.log('✅ 記事読み込み完了:', articleId);
    } catch (error) {
      console.error('記事読み込みエラー:', error.message);
      alert('記事の読み込みに失敗しました');
      window.location.href = 'articles.html';
    }
  }

  /**
   * 新規記事フォームを初期化
   */
  setupNewArticleForm() {
    const pageTitle = document.querySelector('.page-title');
    if (pageTitle) {
      pageTitle.textContent = '新規記事を作成';
    }
  }

  /**
   * 記事を保存（下書き）
   */
  async saveArticle() {
    console.log('💾 saveArticle メソッド実行');

    const title = document.querySelector('#title').value.trim();
    const content = document.querySelector('#content').value.trim();
    const excerpt = document.querySelector('#excerpt').value.trim();
    const category = document.querySelector('#category').value;

    console.log('フォーム入力値:', { title, content, excerpt, category });

    // バリデーション
    if (!title) {
      alert('タイトルを入力してください');
      return;
    }

    if (!content) {
      alert('内容を入力してください');
      return;
    }

    try {
      console.log('🔄 Supabaseに送信中...');
      const articleData = {
        title,
        content,
        excerpt,
        category,
        status: 'draft'
      };

      let result;

      if (this.articleId) {
        // 既存記事を更新
        result = await supabaseClient.updateArticle(this.articleId, articleData);

        if (result.success) {
          this.showAlert('記事を保存しました', 'success');
          this.currentArticle = result.data;
        } else {
          this.showAlert('保存に失敗しました: ' + result.error, 'error');
        }
      } else {
        // 新規記事を作成
        result = await supabaseClient.createArticle(articleData);

        if (result.success) {
          this.articleId = result.data.id;
          this.currentArticle = result.data;
          this.showAlert('記事を作成しました', 'success');

          // URL を更新（履歴に追加しない）
          window.history.replaceState(
            {},
            '',
            `article-edit.html?id=${this.articleId}`
          );
        } else {
          this.showAlert('作成に失敗しました: ' + result.error, 'error');
        }
      }
    } catch (error) {
      console.error('保存エラー:', error.message);
      this.showAlert('保存処理でエラーが発生しました', 'error');
    }
  }

  /**
   * 記事を公開
   */
  async publishArticle() {
    // まず下書きを保存
    await this.saveArticle();

    if (!this.articleId) {
      this.showAlert('記事を先に保存してください', 'warning');
      return;
    }

    try {
      const result = await supabaseClient.publishArticle(this.articleId);

      if (result.success) {
        this.currentArticle = result.data;
        this.showAlert('記事を公開しました', 'success');

        // 記事一覧に戻る
        setTimeout(() => {
          window.location.href = 'articles.html';
        }, 1500);
      } else {
        this.showAlert('公開に失敗しました: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('公開エラー:', error.message);
      this.showAlert('公開処理でエラーが発生しました', 'error');
    }
  }

  /**
   * 画像をアップロード
   */
  async handleImageUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    // ファイル検証
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    if (file.size > maxSize) {
      this.showAlert('ファイルサイズが大きすぎます（5MB以下）', 'error');
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      this.showAlert('JPG、PNG、GIF、WebP形式のみ対応しています', 'error');
      return;
    }

    try {
      const uploadBtn = event.target.closest('.file-upload-group').querySelector('button');
      uploadBtn.disabled = true;
      uploadBtn.textContent = 'アップロード中...';

      const result = await supabaseClient.uploadMedia(file);

      if (result.success) {
        // 記事を保存している場合は、featured_image_url を更新
        if (this.articleId) {
          await supabaseClient.updateArticle(this.articleId, {
            featured_image_url: result.data.file_url
          });
        }

        // 画像プレビューを表示
        const preview = event.target.closest('.file-upload-group').querySelector('.file-preview');
        if (preview) {
          const img = document.createElement('img');
          img.src = result.data.file_url;
          img.style.maxWidth = '200px';
          img.style.borderRadius = '4px';
          preview.innerHTML = '';
          preview.appendChild(img);
        }

        this.showAlert('画像をアップロードしました', 'success');
      } else {
        this.showAlert('アップロードに失敗しました: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('アップロードエラー:', error.message);
      this.showAlert('アップロード処理でエラーが発生しました', 'error');
    } finally {
      const uploadBtn = event.target.closest('.file-upload-group').querySelector('button');
      uploadBtn.disabled = false;
      uploadBtn.textContent = 'ファイルを選択';
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
}

// ページロード時に初期化
document.addEventListener('DOMContentLoaded', function() {
  const articleEditor = new ArticleEditor();
  window.articleEditor = articleEditor;
});
