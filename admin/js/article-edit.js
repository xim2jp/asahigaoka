/**
 * 記事編集機能
 * ファイルアップロード、記事保存等
 */

class ArticleEditor {
  constructor() {
    this.currentUser = null;
    this.currentArticleId = null;
    this.uploadedAttachments = [];
    this.init();
  }

  /**
   * 初期化
   */
  async init() {
    await this.checkAuthentication();
    this.setupEventListeners();
    this.setupTabNavigation();
    this.setupEditorToolbar();
    this.setupCharacterCounters();
    this.loadArticleIfExists();
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
      return true;
    } catch (error) {
      console.error('認証エラー:', error.message);
      window.location.href = 'login.html';
      return false;
    }
  }

  /**
   * イベントリスナーをセットアップ
   */
  setupEventListeners() {
    // ログアウトボタン
    const logoutBtn = document.querySelector('.btn-outline');
    if (logoutBtn && logoutBtn.textContent.includes('ログアウト')) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await this.logout();
      });
    }

    // 添付ファイル入力
    const attachmentsInput = document.getElementById('attachments');
    if (attachmentsInput) {
      attachmentsInput.addEventListener('change', (e) => this.handleFileSelection(e));
    }

    // 保存ボタン
    const submitBtn = document.querySelector('button[type="submit"]');
    if (submitBtn) {
      submitBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.saveArticle('published');
      });
    }

    // 下書き保存ボタン
    const saveDraftBtn = document.querySelector('button[type="button"]');
    if (saveDraftBtn && saveDraftBtn.textContent.includes('下書き')) {
      saveDraftBtn.addEventListener('click', (e) => {
        e.preventDefault();
        this.saveArticle('draft');
      });
    }
  }

  /**
   * タブナビゲーションのセットアップ
   */
  setupTabNavigation() {
    document.querySelectorAll('.tab-button').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const tabName = button.getAttribute('data-tab');

        // アクティブタブを更新
        document.querySelectorAll('.tab-button').forEach(b => b.classList.remove('active'));
        button.classList.add('active');

        // コンテンツを表示
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        document.getElementById(tabName)?.classList.add('active');
      });
    });
  }

  /**
   * エディタツールバーのセットアップ
   */
  setupEditorToolbar() {
    const editor = document.querySelector('.editor-content');
    if (!editor) return;

    document.querySelectorAll('.editor-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        const command = btn.getAttribute('data-command');
        this.executeEditorCommand(command);
      });
    });
  }

  /**
   * エディタコマンドを実行
   */
  executeEditorCommand(command) {
    const editor = document.querySelector('.editor-content');
    if (!editor) return;

    editor.focus();

    switch (command) {
      case 'bold':
      case 'italic':
      case 'underline':
      case 'strikethrough':
        document.execCommand(command);
        break;
      case 'h1':
      case 'h2':
      case 'h3':
        document.execCommand('formatBlock', false, `<${command}>`);
        break;
      case 'ul':
        document.execCommand('insertUnorderedList');
        break;
      case 'ol':
        document.execCommand('insertOrderedList');
        break;
      case 'link': {
        const url = prompt('URLを入力してください:');
        if (url) document.execCommand('createLink', false, url);
        break;
      }
      case 'image': {
        const url = prompt('画像URLを入力してください:');
        if (url) document.execCommand('insertImage', false, url);
        break;
      }
      case 'undo':
        document.execCommand('undo');
        break;
      case 'redo':
        document.execCommand('redo');
        break;
    }
  }

  /**
   * 文字数カウンターをセットアップ
   */
  setupCharacterCounters() {
    const excerptElement = document.getElementById('excerpt');
    if (excerptElement) {
      excerptElement.addEventListener('input', function() {
        const counter = this.nextElementSibling;
        if (counter) {
          counter.textContent = `${this.value.length} / 500 文字`;
        }
      });
    }

    const xMessageElement = document.getElementById('x-message');
    if (xMessageElement) {
      xMessageElement.addEventListener('input', function() {
        const counter = this.nextElementSibling;
        if (counter) {
          counter.textContent = `${this.value.length} / 280 文字`;
        }
      });
    }
  }

  /**
   * ファイル選択時の処理
   */
  async handleFileSelection(e) {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // アップロード中状態を表示
    const progressDiv = document.getElementById('upload-progress');
    progressDiv.style.display = 'block';

    let uploadedCount = 0;

    for (const file of files) {
      try {
        console.log(`ファイルアップロード開始: ${file.name}`);

        // ファイルサイズ制限（100MB）
        if (file.size > 100 * 1024 * 1024) {
          console.warn(`ファイルが大きすぎます（最大100MB）: ${file.name}`);
          alert(`${file.name} は大きすぎます（最大100MB）`);
          continue;
        }

        // ファイルをアップロード
        const result = await supabaseClient.uploadAttachment(file);

        if (result.success && result.data) {
          this.uploadedAttachments.push(result.data);
          uploadedCount++;
          console.log(`✅ アップロード成功: ${file.name}`);
        } else {
          console.error(`❌ アップロード失敗: ${file.name}`, result.error);
          alert(`アップロード失敗: ${file.name}\n${result.error}`);
        }

        // プログレスバーを更新
        const progress = Math.round((uploadedCount / files.length) * 100);
        const progressBar = document.getElementById('progress-bar');
        const progressText = document.getElementById('progress-text');
        if (progressBar) progressBar.style.width = `${progress}%`;
        if (progressText) progressText.textContent = `${progress}%`;
      } catch (error) {
        console.error('アップロード処理エラー:', error.message);
      }
    }

    // アップロード完了
    progressDiv.style.display = 'none';
    this.displayAttachments();

    // ファイル入力をリセット
    e.target.value = '';
  }

  /**
   * 添付ファイル一覧を表示
   */
  displayAttachments() {
    const listContainer = document.getElementById('attachments-list');
    if (!listContainer) return;

    if (this.uploadedAttachments.length === 0) {
      listContainer.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
          アップロードされたファイルがありません
        </div>
      `;
      return;
    }

    listContainer.innerHTML = '';

    this.uploadedAttachments.forEach((attachment, index) => {
      const icon = this.getFileIcon(attachment.file_type);
      const fileSize = this.formatFileSize(attachment.file_size);
      const uploadedAt = new Date(attachment.created_at).toLocaleString('ja-JP');

      const item = document.createElement('div');
      item.className = 'attachment-item';
      item.innerHTML = `
        <div class="attachment-info">
          <div class="attachment-icon">${icon}</div>
          <div class="attachment-details">
            <div class="attachment-name">${this.escapeHtml(attachment.file_name)}</div>
            <div class="attachment-meta">${fileSize} • ${uploadedAt}</div>
          </div>
        </div>
        <div class="attachment-actions">
          <button type="button" class="btn btn-sm btn-outline btn-delete" data-index="${index}" title="削除">
            🗑️
          </button>
        </div>
      `;

      // 削除ボタンのイベント
      item.querySelector('.btn-delete').addEventListener('click', () => {
        this.removeAttachment(index);
      });

      listContainer.appendChild(item);
    });
  }

  /**
   * 添付ファイルを削除
   */
  async removeAttachment(index) {
    const attachment = this.uploadedAttachments[index];
    if (!attachment) return;

    const confirmed = confirm(`${attachment.file_name} を削除しますか？`);
    if (!confirmed) return;

    try {
      // 新規作成時（article_id がない）はローカルから削除
      if (!attachment.article_id) {
        // Supabase から削除
        const result = await supabaseClient.deleteAttachment(
          attachment.id,
          attachment.storage_path
        );

        if (!result.success) {
          alert('削除に失敗しました');
          return;
        }

        // ローカルリストから削除
        this.uploadedAttachments.splice(index, 1);
        this.displayAttachments();
        console.log('✅ ファイル削除成功');
      } else {
        // 既存記事の場合は同じ処理
        const result = await supabaseClient.deleteAttachment(
          attachment.id,
          attachment.storage_path
        );

        if (!result.success) {
          alert('削除に失敗しました');
          return;
        }

        this.uploadedAttachments.splice(index, 1);
        this.displayAttachments();
      }
    } catch (error) {
      console.error('削除エラー:', error.message);
      alert('削除に失敗しました');
    }
  }

  /**
   * 記事を保存
   */
  async saveArticle(status) {
    try {
      const title = document.getElementById('title')?.value;
      const category = document.getElementById('category')?.value;
      const excerpt = document.getElementById('excerpt')?.value;
      const content = document.querySelector('.editor-content')?.innerHTML;
      const featuredImageInput = document.getElementById('featured-image');

      // 検証
      if (!title || !category) {
        alert('タイトルとカテゴリは必須です');
        return;
      }

      // メイン画像をアップロード
      let featuredImageUrl = null;
      if (featuredImageInput?.files?.[0]) {
        const imageResult = await supabaseClient.uploadAttachment(
          featuredImageInput.files[0],
          'featured-images'
        );
        if (imageResult.success) {
          featuredImageUrl = supabaseClient.getAttachmentDownloadUrl(
            imageResult.data.storage_path
          );
        }
      }

      // 記事データを作成
      const articleData = {
        title,
        category,
        excerpt,
        content,
        featured_image_url: featuredImageUrl,
        status,
        author: {
          id: this.currentUser.id,
          name: this.currentUser.user_metadata?.name
        },
        published_at: status === 'published' ? new Date().toISOString() : null
      };

      let result;
      if (this.currentArticleId) {
        // 既存記事を更新
        result = await supabaseClient.updateArticle(this.currentArticleId, articleData);
      } else {
        // 新規記事を作成
        result = await supabaseClient.createArticle(articleData);
      }

      if (!result.success) {
        alert(`保存に失敗しました: ${result.error}`);
        return;
      }

      const articleId = result.data.id;
      this.currentArticleId = articleId;

      // アップロード済みファイルを記事に関連付け
      for (const attachment of this.uploadedAttachments) {
        if (!attachment.article_id) {
          await supabaseClient.linkAttachmentToArticle(attachment.id, articleId);
        }
      }

      console.log('✅ 記事保存成功:', articleId);
      alert(`記事を${status === 'published' ? '公開' : '下書き保存'}しました`);

      // 記事管理画面へリダイレクト
      setTimeout(() => {
        window.location.href = `article-edit.html?id=${articleId}`;
      }, 1000);
    } catch (error) {
      console.error('保存エラー:', error.message);
      alert('保存に失敗しました');
    }
  }

  /**
   * URLパラメータから記事を読み込む
   */
  async loadArticleIfExists() {
    const params = new URLSearchParams(window.location.search);
    const articleId = params.get('id');

    if (!articleId) return;

    try {
      this.currentArticleId = articleId;
      const result = await supabaseClient.getArticle(articleId);

      if (!result.success || !result.data) {
        console.warn('記事が見つかりません');
        return;
      }

      const article = result.data;

      // フォームに情報を入力
      document.getElementById('title').value = article.title || '';
      document.getElementById('category').value = article.category || '';
      document.getElementById('excerpt').value = article.excerpt || '';
      document.querySelector('.editor-content').innerHTML = article.content || '';

      if (article.featured_image_url) {
        const preview = document.getElementById('image-preview');
        preview.src = article.featured_image_url;
        preview.classList.add('show');
      }

      // 添付ファイルを読み込み
      const attachmentsResult = await supabaseClient.getArticleAttachments(articleId);
      if (attachmentsResult.success) {
        this.uploadedAttachments = attachmentsResult.data;
        this.displayAttachments();
      }

      console.log('✅ 記事読み込み成功:', articleId);
    } catch (error) {
      console.error('記事読み込みエラー:', error.message);
    }
  }

  /**
   * ファイルタイプからアイコンを取得
   */
  getFileIcon(fileType) {
    switch (fileType) {
      case 'image':
        return '🖼️';
      case 'document':
        return '📄';
      case 'text':
        return '📝';
      case 'archive':
        return '📦';
      default:
        return '📎';
    }
  }

  /**
   * ファイルサイズをフォーマット
   */
  formatFileSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
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
}

// ページロード時に初期化
document.addEventListener('DOMContentLoaded', function() {
  const editor = new ArticleEditor();
  window.articleEditor = editor;
});
