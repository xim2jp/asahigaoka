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
    this.featuredImageUrl = null; // アイキャッチ画像URL
    this.uploadedAttachmentIds = []; // アップロード済みの添付ファイル ID
    this.uploadedAttachments = []; // アップロード済みファイル情報（新規作成時用）
    this.activeModalTab = 'text'; // モーダルの現在のタブ（'text' or 'file'）
    this.selectedFile = null; // 選択されたファイル
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

    // AIに書いてもらうボタン（モーダル版）
    const aiGenerateModalBtn = document.getElementById('ai-generate-modal-btn');
    if (aiGenerateModalBtn) {
      aiGenerateModalBtn.addEventListener('click', () => this.openAIModal());
      console.log('✅ AI生成モーダルボタンにリスナー設定');
    }

    // モーダルのキャンセルボタン
    const modalCancelBtn = document.getElementById('modal-cancel-btn');
    if (modalCancelBtn) {
      modalCancelBtn.addEventListener('click', () => this.closeAIModal());
      console.log('✅ モーダルキャンセルボタンにリスナー設定');
    }

    // モーダルの閉じるボタン
    const modalCloseBtn = document.getElementById('modal-close-btn');
    if (modalCloseBtn) {
      modalCloseBtn.addEventListener('click', () => this.closeAIModal());
      console.log('✅ モーダル閉じるボタンにリスナー設定');
    }

    // モーダルのオーバーレイ
    const modalOverlay = document.getElementById('modal-overlay');
    if (modalOverlay) {
      modalOverlay.addEventListener('click', () => this.closeAIModal());
      console.log('✅ モーダルオーバーレイにリスナー設定');
    }

    // モーダルの送信ボタン
    const modalSubmitBtn = document.getElementById('modal-submit-btn');
    if (modalSubmitBtn) {
      modalSubmitBtn.addEventListener('click', () => this.submitAIGeneration());
      console.log('✅ モーダル送信ボタンにリスナー設定');
    }

    // モーダルタブ切り替え
    const modalTabButtons = document.querySelectorAll('.modal-tab-button');
    modalTabButtons.forEach(btn => {
      btn.addEventListener('click', (e) => this.switchModalTab(e.target.dataset.modalTab));
    });
    console.log('✅ モーダルタブボタンにリスナー設定');

    // ファイルドロップゾーン
    const fileDropZone = document.getElementById('file-drop-zone');
    const modalFileInput = document.getElementById('modal-file-input');

    if (fileDropZone && modalFileInput) {
      // クリックでファイル選択
      fileDropZone.addEventListener('click', () => modalFileInput.click());

      // ドラッグ＆ドロップ
      fileDropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        fileDropZone.style.borderColor = 'var(--primary-color)';
        fileDropZone.style.background = '#e3f2fd';
      });

      fileDropZone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        fileDropZone.style.borderColor = 'var(--border-color)';
        fileDropZone.style.background = '#f9f9f9';
      });

      fileDropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        fileDropZone.style.borderColor = 'var(--border-color)';
        fileDropZone.style.background = '#f9f9f9';
        const files = e.dataTransfer.files;
        if (files.length > 0) {
          this.handleModalFileSelect(files[0]);
        }
      });

      // ファイル選択
      modalFileInput.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          this.handleModalFileSelect(e.target.files[0]);
        }
      });

      console.log('✅ ファイルドロップゾーンにリスナー設定');
    }

    // ファイルクリアボタン
    const clearFileBtn = document.getElementById('clear-file-btn');
    if (clearFileBtn) {
      clearFileBtn.addEventListener('click', () => this.clearSelectedFile());
      console.log('✅ ファイルクリアボタンにリスナー設定');
    }

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

    // アイキャッチ画像アップロード
    const featuredImageInput = document.getElementById('featured-image');
    console.log('🖼️ featured-image 要素:', featuredImageInput);
    if (featuredImageInput) {
      featuredImageInput.addEventListener('change', (e) => {
        console.log('👂 featured-image change イベント発火');
        this.handleFeaturedImageUpload(e);
      });
      console.log('✅ featured-image のリスナーを設定しました');
    } else {
      console.warn('⚠️ featured-image 要素が見つかりません');
    }

    // 添付ファイルアップロード
    const attachmentsInput = document.getElementById('attachments');
    console.log('📎 attachments 要素:', attachmentsInput);
    if (attachmentsInput) {
      attachmentsInput.addEventListener('change', (e) => {
        console.log('👂 attachments change イベント発火');
        this.handleAttachmentsUpload(e);
      });
      console.log('✅ attachments のリスナーを設定しました');
    } else {
      console.warn('⚠️ attachments 要素が見つかりません');
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
      // content は contenteditable div なので innerHTML を使用
      const contentDiv = document.getElementById('content-editor');
      if (contentDiv) {
        contentDiv.innerHTML = this.currentArticle.content || '';
      }
      document.querySelector('#excerpt').value = this.currentArticle.excerpt || '';
      document.querySelector('#category').value = this.currentArticle.category || 'notice';

      // SEOフィールドを設定
      document.querySelector('#meta-title').value = this.currentArticle.meta_title || '';
      document.querySelector('#meta-description').value = this.currentArticle.meta_description || '';
      document.querySelector('#meta-keywords').value = this.currentArticle.meta_keywords || '';
      document.querySelector('#slug').value = this.currentArticle.slug || '';

      // TOPページ掲載設定を設定
      document.querySelector('#is-news-featured').checked = this.currentArticle.is_news_featured || false;
      document.querySelector('#is-activity-highlight').checked = this.currentArticle.is_activity_highlight || false;

      // 表示・連携設定を設定
      document.querySelector('#generate-article-page').checked = this.currentArticle.generate_article_page !== undefined ? this.currentArticle.generate_article_page : true;
      document.querySelector('#show-in-news-list').checked = this.currentArticle.show_in_news_list !== undefined ? this.currentArticle.show_in_news_list : true;
      document.querySelector('#show-in-calendar').checked = this.currentArticle.show_in_calendar || false;
      document.querySelector('#include-in-rag').checked = this.currentArticle.include_in_rag || false;

      // 公開日時を設定
      if (this.currentArticle.published_at) {
        const publishedDate = new Date(this.currentArticle.published_at);
        // ISO形式から datetime-local形式に変換 (YYYY-MM-DDTHH:mm)
        const localDateTime = publishedDate.toISOString().slice(0, 16);
        document.querySelector('#publish-date').value = localDateTime;
      }

      // LINE配信設定を設定（line_publishedはスキーマに存在）
      document.querySelector('#line-enabled').checked = this.currentArticle.line_published || false;
      document.querySelector('#line-message').value = '';

      // X投稿設定を設定（x_publishedはスキーマに存在）
      document.querySelector('#x-enabled').checked = this.currentArticle.x_published || false;
      document.querySelector('#x-message').value = '';
      document.querySelector('#x-hashtags').value = '#旭丘一丁目';

      // アイキャッチ画像を設定
      console.log('🖼️ アイキャッチ画像チェック:', {
        featured_image_url: this.currentArticle.featured_image_url,
        hasValue: !!this.currentArticle.featured_image_url
      });

      if (this.currentArticle.featured_image_url) {
        this.featuredImageUrl = this.currentArticle.featured_image_url;
        const preview = document.getElementById('image-preview');
        console.log('✅ アイキャッチ画像設定処理:', {
          url: this.currentArticle.featured_image_url,
          previewElement: !!preview,
          previewId: preview?.id
        });

        if (preview) {
          preview.src = this.currentArticle.featured_image_url;
          preview.classList.add('show');
          console.log('✅ プレビューを表示しました');
        } else {
          console.warn('⚠️ image-preview 要素が見つかりません');
        }
      } else {
        console.log('ℹ️ featured_image_url が設定されていません');
      }

      // イベント日時を設定
      if (this.currentArticle.event_start_datetime) {
        const startDatetime = new Date(this.currentArticle.event_start_datetime);
        const startDate = startDatetime.toISOString().split('T')[0];
        const startTime = startDatetime.toTimeString().slice(0, 5);

        document.querySelector('#event-date-from').value = startDate;
        // has_start_time フラグを使用
        if (this.currentArticle.has_start_time) {
          document.querySelector('#event-time-from').value = startTime;
        }
      }

      if (this.currentArticle.event_end_datetime) {
        const endDatetime = new Date(this.currentArticle.event_end_datetime);
        const endDate = endDatetime.toISOString().split('T')[0];
        const endTime = endDatetime.toTimeString().slice(0, 5);

        document.querySelector('#event-date-to').value = endDate;
        // has_end_time フラグを使用
        if (this.currentArticle.has_end_time) {
          document.querySelector('#event-time-to').value = endTime;
        }
      }

      // 記事に紐付く添付ファイルを取得して表示
      if (this.articleId) {
        console.log('📎 記事の添付ファイルを取得中...', {
          articleId: this.articleId,
          supabaseClientExists: !!supabaseClient,
          supabaseClientType: typeof supabaseClient,
          hasGetArticleAttachments: !!supabaseClient?.getArticleAttachments
        });

        try {
          console.log('🔄 getArticleAttachments を呼び出し中...');
          const attachmentsResult = await supabaseClient.getArticleAttachments(this.articleId);
          console.log('🔄 getArticleAttachments の戻り値:', {
            success: attachmentsResult.success,
            dataLength: attachmentsResult.data ? attachmentsResult.data.length : 0,
            error: attachmentsResult.error
          });

          if (attachmentsResult.success && attachmentsResult.data && attachmentsResult.data.length > 0) {
            console.log('✅ 添付ファイル取得成功:', attachmentsResult.data.length, '個');
            this.displayAttachments(attachmentsResult.data);
          } else {
            console.log('ℹ️ 添付ファイルなし', {
              success: attachmentsResult.success,
              hasData: !!attachmentsResult.data,
              dataLength: attachmentsResult.data ? attachmentsResult.data.length : 0,
              error: attachmentsResult.error
            });
            this.displayAttachments([]);
          }
        } catch (error) {
          console.error('❌ getArticleAttachments 呼び出しエラー:', error);
          this.displayAttachments([]);
        }
      }

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
   * AIモーダルを開く
   */
  openAIModal() {
    console.log('🔓 AIモーダルを開く');
    const modal = document.getElementById('ai-modal');
    const promptField = document.getElementById('modal-prompt');

    if (modal) {
      modal.style.display = 'flex';
      // フォーカスをテキストエリアに設定
      if (promptField) {
        promptField.focus();
      }
    }
  }

  /**
   * AIモーダルを閉じる
   */
  closeAIModal() {
    console.log('🔐 AIモーダルを閉じる');
    const modal = document.getElementById('ai-modal');
    if (modal) {
      modal.style.display = 'none';
    }
    // ファイル選択をクリア
    this.clearSelectedFile();
  }

  /**
   * モーダルタブを切り替える
   */
  switchModalTab(tabName) {
    console.log('🔄 モーダルタブ切り替え:', tabName);
    this.activeModalTab = tabName;

    // タブボタンのスタイル更新
    const tabButtons = document.querySelectorAll('.modal-tab-button');
    tabButtons.forEach(btn => {
      if (btn.dataset.modalTab === tabName) {
        btn.style.color = 'var(--primary-color)';
        btn.style.borderBottomColor = 'var(--primary-color)';
        btn.classList.add('active');
      } else {
        btn.style.color = 'var(--text-secondary)';
        btn.style.borderBottomColor = 'transparent';
        btn.classList.remove('active');
      }
    });

    // タブコンテンツの表示切り替え
    const textTab = document.getElementById('modal-tab-text');
    const fileTab = document.getElementById('modal-tab-file');

    if (tabName === 'text') {
      textTab.style.display = 'block';
      fileTab.style.display = 'none';
    } else {
      textTab.style.display = 'none';
      fileTab.style.display = 'block';
    }
  }

  /**
   * モーダル内でファイルが選択された時の処理
   */
  handleModalFileSelect(file) {
    console.log('📁 ファイル選択:', file.name);

    // ファイルサイズ制限（20MB）
    const maxSize = 20 * 1024 * 1024;
    if (file.size > maxSize) {
      this.showAlert('ファイルサイズが大きすぎます（20MB以下）', 'error');
      return;
    }

    // 対応ファイル形式チェック
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint', 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      'text/html'
    ];

    if (!allowedTypes.includes(file.type)) {
      this.showAlert('対応していないファイル形式です', 'error');
      return;
    }

    this.selectedFile = file;

    // ファイル情報を表示
    const fileInfo = document.getElementById('selected-file-info');
    const fileName = document.getElementById('selected-file-name');
    const fileSize = document.getElementById('selected-file-size');
    const fileIcon = document.getElementById('selected-file-icon');

    if (fileInfo && fileName && fileSize && fileIcon) {
      fileName.textContent = file.name;
      fileSize.textContent = this.formatFileSize(file.size);
      fileIcon.textContent = this.getFileIcon(file.name);
      fileInfo.style.display = 'block';
    }

    console.log('✅ ファイル選択完了:', file.name);
  }

  /**
   * 選択されたファイルをクリア
   */
  clearSelectedFile() {
    this.selectedFile = null;

    const fileInfo = document.getElementById('selected-file-info');
    const modalFileInput = document.getElementById('modal-file-input');

    if (fileInfo) {
      fileInfo.style.display = 'none';
    }

    if (modalFileInput) {
      modalFileInput.value = '';
    }

    console.log('🧹 ファイル選択をクリア');
  }

  /**
   * AIモーダルから送信（API呼び出し）
   */
  async submitAIGeneration() {
    console.log('🤖 AI生成処理開始（モーダルから）');
    console.log('📋 アクティブタブ:', this.activeModalTab);

    // タブに応じて処理を分岐
    if (this.activeModalTab === 'file') {
      return this.submitFileAIGeneration();
    }

    // テキスト入力タブの処理
    const title = document.querySelector('#title').value.trim();
    const draftContent = document.getElementById('modal-prompt').value.trim();
    const eventDateFrom = document.querySelector('#event-date-from').value;

    // バリデーション
    if (!title) {
      this.showAlert('タイトルを入力してください', 'error');
      return;
    }

    if (!draftContent) {
      this.showAlert('プロンプト（下書き本文）を入力してください', 'error');
      return;
    }

    if (!eventDateFrom) {
      this.showAlert('イベント開始日を入力してください', 'error');
      return;
    }

    // モーダルの送信ボタンを無効化
    const submitBtn = document.getElementById('modal-submit-btn');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '🤖 生成中...';

    // 処理中オーバーレイを表示
    this.showProcessingOverlay();

    // 30秒のタイムアウト設定
    const timeoutId = setTimeout(() => {
      console.warn('⏱️ AI生成がタイムアウトしました（30秒）');
      this.showAlert('処理がタイムアウトしました。もう一度試してください。', 'error');
      this.hideProcessingOverlay();
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }, 30000); // 30秒

    try {
      // イベント開始日時を組み立て
      const eventTimeFrom = document.querySelector('#event-time-from').value;
      const eventDateTo = document.querySelector('#event-date-to').value;
      const eventTimeTo = document.querySelector('#event-time-to').value;

      let eventDateTimeText = eventDateFrom;
      if (eventTimeFrom) {
        eventDateTimeText += ' ' + eventTimeFrom;
      }
      if (eventDateTo) {
        eventDateTimeText += ' 〜 ' + eventDateTo;
        if (eventTimeTo) {
          eventDateTimeText += ' ' + eventTimeTo;
        }
      }

      console.log('イベント日時:', eventDateTimeText);

      // Dify API呼び出し（終了日がある場合は date_to も渡す）
      const result = await this.callDifyAPI(title, draftContent, eventDateFrom, eventDateTo);

      if (result.success) {
        // 記事本文を設定
        const contentEditor = document.getElementById('content-editor');
        if (contentEditor && result.data.text350) {
          contentEditor.innerHTML = this.formatContent(result.data.text350);
        }

        // SNS用抜粋を設定
        const excerptField = document.getElementById('excerpt');
        if (excerptField && result.data.text80) {
          excerptField.value = result.data.text80;
        }

        // SEOメタタイトルを自動設定（記事タイトル + 町会名）
        const metaTitleField = document.getElementById('meta-title');
        if (metaTitleField && !metaTitleField.value.trim()) {
          const autoMetaTitle = `${title} | 旭丘一丁目町会`;
          metaTitleField.value = autoMetaTitle;
          console.log('✅ メタタイトルを自動設定しました:', autoMetaTitle);
        }

        // SEOメタディスクリプションを設定（空欄の場合のみ）
        const metaDescField = document.getElementById('meta-description');
        console.log('🔍 メタディスクリプション:', {
          field: metaDescField,
          currentValue: metaDescField ? metaDescField.value : 'フィールドが見つかりません',
          isEmpty: metaDescField ? !metaDescField.value.trim() : false,
          newValue: result.data.meta_desc
        });
        if (metaDescField && !metaDescField.value.trim() && result.data.meta_desc) {
          metaDescField.value = result.data.meta_desc;
          console.log('✅ メタディスクリプションを設定しました:', result.data.meta_desc);
        }

        // SEOメタキーワードを設定（空欄の場合のみ）
        const metaKeywordsField = document.getElementById('meta-keywords');
        console.log('🔍 メタキーワード:', {
          field: metaKeywordsField,
          currentValue: metaKeywordsField ? metaKeywordsField.value : 'フィールドが見つかりません',
          isEmpty: metaKeywordsField ? !metaKeywordsField.value.trim() : false,
          newValue: result.data.meta_kwd
        });
        if (metaKeywordsField && !metaKeywordsField.value.trim() && result.data.meta_kwd) {
          metaKeywordsField.value = result.data.meta_kwd;
          console.log('✅ メタキーワードを設定しました:', result.data.meta_kwd);
        }

        this.showAlert('AIによる記事生成が完了しました', 'success');

        // モーダルを閉じる
        this.closeAIModal();

        // プロンプトをクリア
        document.getElementById('modal-prompt').value = '';
      } else {
        this.showAlert('AI生成に失敗しました: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('AI生成エラー:', error);
      this.showAlert('AI生成処理でエラーが発生しました: ' + error.message, 'error');
    } finally {
      // タイムアウトをクリア
      clearTimeout(timeoutId);

      // 処理中オーバーレイを非表示
      this.hideProcessingOverlay();

      // ボタンを元に戻す
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  }

  /**
   * AIに記事を生成してもらう（旧メソッド：互換性のため保持）
   */
  async generateWithAI() {
    console.log('🤖 AI生成処理開始');

    const title = document.querySelector('#title').value.trim();
    const draftContent = document.querySelector('#draft-content').value.trim();
    const eventDateFrom = document.querySelector('#event-date-from').value;

    // バリデーション
    if (!title) {
      this.showAlert('タイトルを入力してください', 'error');
      return;
    }

    if (!draftContent) {
      this.showAlert('下書き本文を入力してください', 'error');
      return;
    }

    if (!eventDateFrom) {
      this.showAlert('イベント開始日を入力してください', 'error');
      return;
    }

    // ボタンを無効化
    const aiBtn = document.getElementById('ai-generate-btn');
    const originalBtnText = aiBtn.textContent;
    aiBtn.disabled = true;
    aiBtn.textContent = '🤖 生成中...';

    try {
      // イベント開始日時を組み立て
      const eventTimeFrom = document.querySelector('#event-time-from').value;
      const eventDateTo = document.querySelector('#event-date-to').value;
      const eventTimeTo = document.querySelector('#event-time-to').value;

      let eventDateTimeText = eventDateFrom;
      if (eventTimeFrom) {
        eventDateTimeText += ' ' + eventTimeFrom;
      }
      if (eventDateTo) {
        eventDateTimeText += ' 〜 ' + eventDateTo;
        if (eventTimeTo) {
          eventDateTimeText += ' ' + eventTimeTo;
        }
      }

      console.log('イベント日時:', eventDateTimeText);

      // Dify API呼び出し（終了日がある場合は date_to も渡す）
      const result = await this.callDifyAPI(title, draftContent, eventDateFrom, eventDateTo);

      if (result.success) {
        // 記事本文を設定
        const contentEditor = document.getElementById('content-editor');
        if (contentEditor && result.data.text350) {
          contentEditor.innerHTML = this.formatContent(result.data.text350);
        }

        // SNS用抜粋を設定
        const excerptField = document.getElementById('excerpt');
        if (excerptField && result.data.text80) {
          excerptField.value = result.data.text80;
        }

        // SEOメタタイトルを自動設定（記事タイトル + 町会名）
        const metaTitleField = document.getElementById('meta-title');
        if (metaTitleField && !metaTitleField.value.trim()) {
          const autoMetaTitle = `${title} | 旭丘一丁目町会`;
          metaTitleField.value = autoMetaTitle;
          console.log('✅ メタタイトルを自動設定しました:', autoMetaTitle);
        }

        // SEOメタディスクリプションを設定（空欄の場合のみ）
        const metaDescField = document.getElementById('meta-description');
        console.log('🔍 メタディスクリプション:', {
          field: metaDescField,
          currentValue: metaDescField ? metaDescField.value : 'フィールドが見つかりません',
          isEmpty: metaDescField ? !metaDescField.value.trim() : false,
          newValue: result.data.meta_desc
        });
        if (metaDescField && !metaDescField.value.trim() && result.data.meta_desc) {
          metaDescField.value = result.data.meta_desc;
          console.log('✅ メタディスクリプションを設定しました:', result.data.meta_desc);
        }

        // SEOメタキーワードを設定（空欄の場合のみ）
        const metaKeywordsField = document.getElementById('meta-keywords');
        console.log('🔍 メタキーワード:', {
          field: metaKeywordsField,
          currentValue: metaKeywordsField ? metaKeywordsField.value : 'フィールドが見つかりません',
          isEmpty: metaKeywordsField ? !metaKeywordsField.value.trim() : false,
          newValue: result.data.meta_kwd
        });
        if (metaKeywordsField && !metaKeywordsField.value.trim() && result.data.meta_kwd) {
          metaKeywordsField.value = result.data.meta_kwd;
          console.log('✅ メタキーワードを設定しました:', result.data.meta_kwd);
        }

        this.showAlert('AIによる記事生成が完了しました', 'success');
      } else {
        this.showAlert('AI生成に失敗しました: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('AI生成エラー:', error);
      this.showAlert('AI生成処理でエラーが発生しました: ' + error.message, 'error');
    } finally {
      // ボタンを元に戻す
      aiBtn.disabled = false;
      aiBtn.textContent = originalBtnText;
    }
  }

  /**
   * 本文から日付を抽出
   */
  extractDate(content) {
    // YYYY-MM-DD形式を検索
    const datePattern1 = /(\d{4})[-\/](\d{1,2})[-\/](\d{1,2})/;
    const match1 = content.match(datePattern1);
    if (match1) {
      const year = match1[1];
      const month = match1[2].padStart(2, '0');
      const day = match1[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // YYYY年MM月DD日形式を検索
    const datePattern2 = /(\d{4})年(\d{1,2})月(\d{1,2})日/;
    const match2 = content.match(datePattern2);
    if (match2) {
      const year = match2[1];
      const month = match2[2].padStart(2, '0');
      const day = match2[3].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // MM月DD日形式を検索（今年として扱う）
    const datePattern3 = /(\d{1,2})月(\d{1,2})日/;
    const match3 = content.match(datePattern3);
    if (match3) {
      const year = new Date().getFullYear();
      const month = match3[1].padStart(2, '0');
      const day = match3[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // MM/DD形式を検索（今年として扱う）
    const datePattern4 = /(\d{1,2})\/(\d{1,2})/;
    const match4 = content.match(datePattern4);
    if (match4) {
      const year = new Date().getFullYear();
      const month = match4[1].padStart(2, '0');
      const day = match4[2].padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // 見つからない場合は本日の日付
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  /**
   * Dify APIを呼び出す（Lambda経由）
   */
  async callDifyAPI(title, summary, date, dateTo = null) {
    // Lambda プロキシエンドポイント
    // TODO: Terraformデプロイ後に実際のエンドポイントURLに置き換える
    const apiEndpoint = window.DIFY_PROXY_ENDPOINT || 'https://YOUR_API_GATEWAY_ENDPOINT/prod/generate-article';

    const requestBody = {
      title: title,
      summary: summary,
      date: date,
      intro_url: 'https://asahigaoka-nerima.tokyo/town.html'
    };

    // 終了日がある場合は追加
    if (dateTo) {
      requestBody.date_to = dateTo;
    }

    console.log('Lambda Proxy APIリクエスト:', requestBody);
    console.log('API エンドポイント:', apiEndpoint);

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('レスポンス受信:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('APIエラー:', errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Lambda Proxy APIレスポンス:', data);

      // レスポンスからtext350、text80、meta_desc、meta_kwdを抽出
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
        throw new Error(data.error || 'レスポンスの形式が不正です');
      }
    } catch (error) {
      console.error('Lambda Proxy API呼び出しエラー:', error);
      console.error('エラーの詳細:', {
        name: error.name,
        message: error.message,
        stack: error.stack
      });
      return {
        success: false,
        error: `${error.name}: ${error.message}`
      };
    }
  }

  /**
   * ファイルからAI生成を実行
   */
  async submitFileAIGeneration() {
    console.log('🤖 ファイルからAI生成処理開始');

    // バリデーション
    if (!this.selectedFile) {
      this.showAlert('ファイルを選択してください', 'error');
      return;
    }

    // モーダルの送信ボタンを無効化
    const submitBtn = document.getElementById('modal-submit-btn');
    const originalBtnText = submitBtn.textContent;
    submitBtn.disabled = true;
    submitBtn.textContent = '🤖 分析中...';

    // 処理中オーバーレイを表示
    this.showProcessingOverlay();

    // 60秒のタイムアウト設定
    const timeoutId = setTimeout(() => {
      console.warn('⏱️ AI生成がタイムアウトしました（60秒）');
      this.showAlert('処理がタイムアウトしました。もう一度試してください。', 'error');
      this.hideProcessingOverlay();
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }, 60000);

    try {
      // ファイルをBase64にエンコード
      const base64Data = await this.fileToBase64(this.selectedFile);
      console.log('📄 ファイルをBase64エンコード完了');

      // 画像分析APIを呼び出し
      const result = await this.callImageAnalysisAPI(base64Data);

      if (result.success) {
        // タイトルを設定
        const titleField = document.querySelector('#title');
        if (titleField && result.data.title) {
          titleField.value = result.data.title;
          console.log('✅ タイトルを設定しました:', result.data.title);
        }

        // 記事本文を設定
        const contentEditor = document.getElementById('content-editor');
        if (contentEditor && result.data.text350) {
          contentEditor.innerHTML = this.formatContent(result.data.text350);
        }

        // SNS用抜粋を設定
        const excerptField = document.getElementById('excerpt');
        if (excerptField && result.data.text80) {
          excerptField.value = result.data.text80;
        }

        // SEOメタタイトルを自動設定（タイトル + 町会名）
        const metaTitleField = document.getElementById('meta-title');
        if (metaTitleField && result.data.title) {
          const autoMetaTitle = `${result.data.title} | 旭丘一丁目町会`;
          metaTitleField.value = autoMetaTitle;
          console.log('✅ メタタイトルを設定しました:', autoMetaTitle);
        }

        // SEOメタディスクリプションを設定（空欄の場合のみ）
        const metaDescField = document.getElementById('meta-description');
        if (metaDescField && !metaDescField.value.trim() && result.data.meta_desc) {
          metaDescField.value = result.data.meta_desc;
          console.log('✅ メタディスクリプションを設定しました:', result.data.meta_desc);
        }

        // SEOメタキーワードを設定（空欄の場合のみ）
        const metaKeywordsField = document.getElementById('meta-keywords');
        if (metaKeywordsField && !metaKeywordsField.value.trim() && result.data.meta_kwd) {
          metaKeywordsField.value = result.data.meta_kwd;
          console.log('✅ メタキーワードを設定しました:', result.data.meta_kwd);
        }

        this.showAlert('ファイルからAIによる記事生成が完了しました', 'success');

        // モーダルを閉じる
        this.closeAIModal();
      } else {
        this.showAlert('ファイルの送信に失敗しました。ほかのファイルで試すか、直接記事を書いてください。', 'error');
      }
    } catch (error) {
      console.error('ファイルAI生成エラー:', error);
      this.showAlert('ファイルの送信に失敗しました。ほかのファイルで試すか、直接記事を書いてください。', 'error');
    } finally {
      clearTimeout(timeoutId);
      this.hideProcessingOverlay();
      submitBtn.disabled = false;
      submitBtn.textContent = originalBtnText;
    }
  }

  /**
   * ファイルをBase64にエンコード
   */
  fileToBase64(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        // data:image/png;base64,XXXX の形式から base64 部分を抽出
        const base64 = reader.result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = error => reject(error);
    });
  }

  /**
   * 画像分析APIを呼び出す（Lambda経由）
   */
  async callImageAnalysisAPI(base64Data) {
    const apiEndpoint = window.DIFY_IMAGE_PROXY_ENDPOINT || 'https://YOUR_API_GATEWAY_ENDPOINT/prod/analyze-image';

    const requestBody = {
      request: base64Data
    };

    console.log('🖼️ 画像分析APIリクエスト送信');
    console.log('API エンドポイント:', apiEndpoint);

    try {
      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody)
      });

      console.log('レスポンス受信:', response.status, response.statusText);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('APIエラー:', errorData);
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      console.log('画像分析APIレスポンス:', data);

      if (data.success && data.data) {
        return {
          success: true,
          data: {
            title: data.data.title || '',
            text350: data.data.text350 || '',
            text80: data.data.text80 || '',
            meta_desc: data.data.meta_desc || '',
            meta_kwd: data.data.meta_kwd || ''
          }
        };
      } else {
        throw new Error(data.error || 'レスポンスの形式が不正です');
      }
    } catch (error) {
      console.error('画像分析API呼び出しエラー:', error);
      return {
        success: false,
        error: `${error.name}: ${error.message}`
      };
    }
  }

  /**
   * コンテンツを整形（改行を<p>タグに変換）
   */
  formatContent(content) {
    // 改行で分割
    const paragraphs = content.split('\n').filter(p => p.trim());

    // 各段落を<p>タグで囲む
    return paragraphs.map(p => `<p>${p.trim()}</p>`).join('\n');
  }

  /**
   * 記事を保存（下書き）
   */
  async saveArticle() {
    return await this.saveArticleInternal(false);
  }

  /**
   * 記事を保存（内部処理）
   * @param {boolean} isPublishMode - 公開モードかどうか（公開時は遷移しない）
   * @returns {Promise<boolean>} - 成功した場合true、失敗した場合false
   */
  async saveArticleInternal(isPublishMode = false) {
    console.log('💾 saveArticle メソッド実行');

    const title = document.querySelector('#title').value.trim();
    // content は contenteditable div なので innerHTML を使用
    const contentDiv = document.getElementById('content-editor');
    const content = contentDiv ? contentDiv.innerHTML.trim() : '';
    const excerpt = document.querySelector('#excerpt').value.trim();
    const category = document.querySelector('#category').value;

    // イベント日時を取得
    const eventDateFrom = document.querySelector('#event-date-from').value;
    const eventTimeFrom = document.querySelector('#event-time-from').value;
    const eventDateTo = document.querySelector('#event-date-to').value;
    const eventTimeTo = document.querySelector('#event-time-to').value;

    // 公開日時を取得
    const publishDate = document.querySelector('#publish-date').value;

    // SEOフィールドを取得
    const metaTitle = document.querySelector('#meta-title').value.trim();
    const metaDescription = document.querySelector('#meta-description').value.trim();
    const metaKeywords = document.querySelector('#meta-keywords').value.trim();
    let slug = document.querySelector('#slug').value.trim();

    // スラッグが空の場合は記事IDで更新
    // 新規作成時は一時的にプレースホルダーを設定し、ID生成後に更新するロジックが必要だが、
    // ここではシンプルに、既存記事の場合はIDをセットし、新規の場合は後続処理で対応する
    if (!slug && this.articleId) {
        slug = this.articleId;
        console.log('⚠️ スラッグが空のため記事IDをセット:', slug);
    }

    // TOPページ掲載設定を取得
    const isNewsFeatured = document.querySelector('#is-news-featured').checked;
    const isActivityHighlight = document.querySelector('#is-activity-highlight').checked;

    // 表示・連携設定を取得
    const generateArticlePage = document.querySelector('#generate-article-page').checked;
    const showInNewsList = document.querySelector('#show-in-news-list').checked;
    const showInCalendar = document.querySelector('#show-in-calendar').checked;
    const includeInRag = document.querySelector('#include-in-rag').checked;

    // LINE配信設定（即時配信のみ）
    const lineEnabled = document.querySelector('#line-enabled').checked;
    let lineMessage = document.querySelector('#line-message').value.trim();
    
    if (lineEnabled && !lineMessage) {
        // 空欄の場合、抜粋からハッシュタグを除いたものをセット
        // 簡易的なハッシュタグ除去（#以降の単語を削除するか、単に#記号だけ消すか。ここでは#記号を消す）
        lineMessage = excerpt.replace(/#\S+/g, '').trim();
        console.log('⚠️ LINEメッセージ自動生成:', lineMessage);
    }

    // X投稿設定（即時投稿のみ）
    const xEnabled = document.querySelector('#x-enabled').checked;
    let xMessage = document.querySelector('#x-message').value.trim();
    const xHashtags = document.querySelector('#x-hashtags').value.trim();

    if (xEnabled && !xMessage) {
        // 空欄の場合、抜粋をそのままセット
        xMessage = excerpt;
        console.log('⚠️ Xメッセージ自動生成:', xMessage);
    }

    console.log('フォーム入力値:', { title, content, excerpt, category, eventDateFrom, eventTimeFrom, eventDateTo, eventTimeTo, publishDate, metaTitle, metaDescription, metaKeywords, slug, isNewsFeatured, isActivityHighlight, showInNewsList, showInCalendar, includeInRag, lineEnabled, lineMessage, xEnabled, xMessage, xHashtags });

    // バリデーション
    if (!title) {
      alert('タイトルを入力してください');
      return;
    }

    if (!content) {
      alert('内容を入力してください');
      return;
    }

    if (!category) {
      alert('カテゴリを選択してください');
      return;
    }

    if (!eventDateFrom) {
      alert('イベント開始日を入力してください');
      return;
    }

    // 公開日時が指定されている場合、LINE/Xの配信はできない
    if (publishDate) {
      if (lineEnabled) {
        alert('公開日時を指定している場合、LINE配信はできません。公開日時を空にするか、LINE配信のチェックを外してください。');
        return;
      }
      if (xEnabled) {
        alert('公開日時を指定している場合、X投稿はできません。公開日時を空にするか、X投稿のチェックを外してください。');
        return;
      }
    }

    try {
      console.log('🔄 Supabaseに送信中...');

      // イベント日時を組み立て
      const hasStartTime = eventTimeFrom ? true : false;
      const hasEndTime = eventTimeTo ? true : false;

      let eventStartDatetime = eventDateFrom;
      if (hasStartTime) {
        eventStartDatetime += ' ' + eventTimeFrom + ':00';
      } else {
        eventStartDatetime += ' 00:00:00';
      }

      let eventEndDatetime = null;
      if (eventDateTo) {
        eventEndDatetime = eventDateTo;
        if (hasEndTime) {
          eventEndDatetime += ' ' + eventTimeTo + ':00';
        } else {
          eventEndDatetime += ' 23:59:59';
        }
      }

      // 公開日時をISO形式に変換
      let publishedAt = null;
      if (publishDate) {
        // datetime-local形式 (YYYY-MM-DDTHH:mm) をISO形式に変換
        publishedAt = new Date(publishDate).toISOString();
      }

      const articleData = {
        title,
        content,
        excerpt: excerpt || null,
        category,
        status: 'draft',
        event_start_datetime: eventStartDatetime,
        event_end_datetime: eventEndDatetime || null,
        has_start_time: hasStartTime,
        has_end_time: hasEndTime,
        meta_title: metaTitle || null,
        meta_description: metaDescription || null,
        meta_keywords: metaKeywords || null,
        slug: slug || null,
        featured_image_url: this.featuredImageUrl || null,
        is_news_featured: isNewsFeatured,
        is_activity_highlight: isActivityHighlight,
        generate_article_page: generateArticlePage,
        show_in_news_list: showInNewsList,
        show_in_calendar: showInCalendar,
        include_in_rag: includeInRag,
        published_at: publishedAt,
        line_published: lineEnabled,
        x_published: xEnabled
      };

      // LINE/X投稿判定用: 更新前の状態を保存
      const previousLinePublished = this.currentArticle?.line_published || false;
      const previousXPublished = this.currentArticle?.x_published || false;

      let result;

      if (this.articleId) {
        // 既存記事を更新
        result = await supabaseClient.updateArticle(this.articleId, articleData);

        if (result.success) {
          this.currentArticle = result.data;

          // 更新後に featured_image_url が設定されていれば、プレビューを更新
          if (result.data.featured_image_url) {
            const preview = document.getElementById('image-preview');
            if (preview) {
              preview.src = result.data.featured_image_url;
              preview.classList.add('show');
              console.log('✅ 更新後にアイキャッチ画像プレビューを更新:', result.data.featured_image_url);
            }
          }

          // LINE通知トリガー: 更新時、line_publishedがfalse→trueに変更された場合
          if (!previousLinePublished && lineEnabled) {
            console.log('📢 LINE通知トリガー: line_publishedがfalse→trueに変更');
            await this.postToLine(title, excerpt, lineMessage, result.data.slug || this.articleId);
          }

          // X投稿トリガー: 更新時、x_publishedがfalse→trueに変更された場合
          if (!previousXPublished && xEnabled) {
            console.log('📢 X投稿トリガー: x_publishedがfalse→trueに変更');
            await this.postToX(title, excerpt, xMessage, xHashtags, result.data.slug || this.articleId);
          }

          if (!isPublishMode) {
            this.showAlert('記事を保存しました', 'success');

            // 1500ms後に一覧ページに遷移
            setTimeout(() => {
              window.location.href = 'articles.html';
            }, 1500);
          }

          // 静的ページ生成トリガー（TOPページ更新）
          // 公開設定かつ、TOPページ掲載フラグがある場合のみ
          if (articleData.status === 'published' && (articleData.is_news_featured || articleData.is_activity_highlight)) {
            this.triggerStaticPageGeneration();
          }

          // 記事ページ生成・お知らせ一覧更新
          if (window.staticPageGenerator) {
            await window.staticPageGenerator.processArticleSave(result.data, {
              generateArticlePage: generateArticlePage,
              showInNewsList: showInNewsList,
              showInCalendar: showInCalendar
            });
          }

          return true;
        } else {
          const errorMsg = '保存に失敗しました: ' + result.error;
          console.error('❌', errorMsg);
          this.showAlert(errorMsg, 'error');
          return false;
        }
      } else {
        // 新規記事を作成
        result = await supabaseClient.createArticle(articleData);

        if (result.success) {
          this.articleId = result.data.id;
          this.currentArticle = result.data;

          // スラッグが空だった場合、生成されたIDで更新する
          if (!slug) {
             console.log('🔄 新規作成: スラッグが空のため記事IDで更新します:', this.articleId);
             const slugUpdateResult = await supabaseClient.updateArticle(this.articleId, { slug: this.articleId });
             if (!slugUpdateResult.success) {
               console.warn('⚠️ スラッグ更新に失敗:', slugUpdateResult.error);
             }
          }

          // アップロード済みの添付ファイルに article_id を設定
          if (this.uploadedAttachmentIds && this.uploadedAttachmentIds.length > 0) {
            // ... (中略) ...
          }

          // ローカルキャッシュをクリア
          this.uploadedAttachments = [];
          this.uploadedAttachmentIds = [];
          
          // アイキャッチ画像プレビュー更新
          if (result.data.featured_image_url) {
             // ... (中略) ...
          }

          // LINE通知トリガー: 新規作成時、line_published=trueの場合
          if (lineEnabled) {
            console.log('📢 LINE通知トリガー: 新規作成でline_published=true');
            await this.postToLine(title, excerpt, lineMessage, result.data.slug || this.articleId);
          }

          // X投稿トリガー: 新規作成時、x_published=trueの場合
          if (xEnabled) {
            console.log('📢 X投稿トリガー: 新規作成でx_published=true');
            await this.postToX(title, excerpt, xMessage, xHashtags, result.data.slug || this.articleId);
          }

          if (!isPublishMode) {
            this.showAlert('記事を作成しました', 'success');

            // URL を更新
            window.history.replaceState(
              {},
              '',
              `article-edit.html?id=${this.articleId}`
            );

            // 1500ms後に一覧ページに遷移
            setTimeout(() => {
              window.location.href = 'articles.html';
            }, 1500);
          }

          // 静的ページ生成トリガー（TOPページ更新）
          if (articleData.status === 'published' && (articleData.is_news_featured || articleData.is_activity_highlight)) {
            this.triggerStaticPageGeneration();
          }

          // 記事ページ生成・お知らせ一覧更新
          if (window.staticPageGenerator) {
            await window.staticPageGenerator.processArticleSave(result.data, {
              generateArticlePage: generateArticlePage,
              showInNewsList: showInNewsList,
              showInCalendar: showInCalendar
            });
          }

          return true;
        } else {
          const errorMsg = '作成に失敗しました: ' + result.error;
          console.error('❌', errorMsg);
          this.showAlert(errorMsg, 'error');
          return false;
        }
      }
    } catch (error) {
      console.error('保存エラー:', error.message);
      const errorMsg = '保存処理でエラーが発生しました: ' + error.message;
      this.showAlert(errorMsg, 'error');
      return false;
    }
  }

  /**
   * 静的ページ生成をトリガー
   */
  async triggerStaticPageGeneration() {
    if (window.staticPageGenerator) {
      console.log('🔄 静的ページ生成を開始します...');
      // 認証トークンが必要な場合は取得（現状の supabaseClient 実装に依存）
      // const session = supabaseClient.client.auth.session(); // Supabase Authの場合
      const token = 'dummy_token'; // カスタム認証の場合はトークン管理方法による

      const result = await window.staticPageGenerator.generateTopPage(token);
      if (result.success) {
        console.log('✅ 静的ページ生成リクエスト完了');
      } else {
        console.warn('⚠️ 静的ページ生成リクエスト失敗:', result.message);
      }
    }
  }

  /**
   * 記事を公開
   */
  async publishArticle() {
    // まず下書きを保存（エラーがあれば中断）
    try {
      // saveArticleInternalが成功/失敗を返すため、結果を確認
      const saveSuccess = await this.saveArticleInternal(true); // true = 公開モード
      
      if (!saveSuccess) {
        // saveArticleInternalがfalseを返した場合、エラーが発生している
        console.error('❌ 保存に失敗したため公開処理を中断します');
        return;
      }

      if (!this.articleId) {
        this.showAlert('記事を先に保存してください', 'warning');
        return;
      }

      const result = await supabaseClient.publishArticle(this.articleId);

      if (result.success) {
        this.currentArticle = result.data;

        // 詳細ページを生成（公開時のみ）
        if (window.staticPageGenerator) {
          console.log('📄 記事詳細ページを生成中...');
          const detailResult = await window.staticPageGenerator.generateDetailPage(this.articleId);
          if (detailResult.success) {
            console.log('✅ 記事詳細ページ生成成功:', detailResult.file_path);
          } else {
            console.warn('⚠️ 記事詳細ページ生成失敗:', detailResult.error);
            // 詳細ページ生成失敗はアラートを出すが、公開処理自体は継続
          }
        }

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
      this.showAlert('公開処理でエラーが発生しました: ' + error.message, 'error');
    }
  }

  /**
   * アイキャッチ画像をアップロード
   */
  async handleFeaturedImageUpload(event) {
    console.log('🖼️ handleFeaturedImageUpload が呼ばれました');

    const file = event.target.files[0];
    console.log('📂 ファイル:', file);

    if (!file) {
      console.warn('⚠️ ファイルが選択されていません');
      return;
    }

    // ファイル検証
    const maxSize = 5 * 1024 * 1024; // 5MB
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];

    console.log('🔍 ファイル検証:', {
      name: file.name,
      size: file.size,
      type: file.type,
      maxSize: maxSize,
      isAllowedType: allowedTypes.includes(file.type)
    });

    if (file.size > maxSize) {
      this.showAlert('ファイルサイズが大きすぎます（5MB以下）', 'error');
      return;
    }

    if (!allowedTypes.includes(file.type)) {
      this.showAlert('JPG、PNG、GIF、WebP形式のみ対応しています', 'error');
      return;
    }

    try {
      console.log('🖼️ アイキャッチ画像アップロード開始:', file.name);
      console.log('📤 supabaseClient.uploadMedia を呼び出し中...');

      const result = await supabaseClient.uploadMedia(file);

      console.log('📥 アップロード結果:', result);

      if (result.success) {
        // featured_image_url を this.featuredImageUrl に保存
        this.featuredImageUrl = result.data.file_url;
        console.log('✅ アイキャッチ画像URL保存:', this.featuredImageUrl);
        console.log('📋 this.featuredImageUrl:', this.featuredImageUrl);

        // 記事を保存している場合は、featured_image_url を即座に更新
        if (this.articleId) {
          console.log('🔄 既存記事にアイキャッチ画像を更新中... (articleId:', this.articleId, ')');
          await supabaseClient.updateArticle(this.articleId, {
            featured_image_url: result.data.file_url
          });
          console.log('✅ 既存記事のアイキャッチ画像を更新完了');
        } else {
          console.log('ℹ️ 新規記事モード（保存時に featured_image_url を含める）');
        }

        this.showAlert('アイキャッチ画像をアップロードしました', 'success');
      } else {
        console.error('❌ アップロード失敗:', result.error);
        this.showAlert('アップロードに失敗しました: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('❌ アップロードエラー:', error.message);
      console.error('エラー詳細:', error);
      this.showAlert('アップロード処理でエラーが発生しました: ' + error.message, 'error');
    }
  }

  /**
   * 添付ファイルをアップロード
   */
  async handleAttachmentsUpload(event) {
    const files = Array.from(event.target.files);
    if (files.length === 0) return;

    try {
      console.log('📎 添付ファイルアップロード開始:', files.length, '個のファイル');

      for (const file of files) {
        // ファイル検証
        const maxSize = 50 * 1024 * 1024; // 50MB
        const allowedExtensions = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'txt', 'md', 'zip', 'png', 'jpg', 'jpeg', 'gif', 'webp'];

        const fileExt = file.name.split('.').pop().toLowerCase();

        if (file.size > maxSize) {
          this.showAlert(`${file.name} のサイズが大きすぎます（50MB以下）`, 'error');
          continue;
        }

        if (!allowedExtensions.includes(fileExt)) {
          this.showAlert(`${file.name} の形式は対応していません`, 'error');
          continue;
        }

        // 添付ファイルは 'attachments' バケットにアップロード
        const result = await supabaseClient.uploadMedia(file, 'attachments');

        if (result.success) {
          console.log('✅ ファイルアップロード成功:', file.name, '(attachments バケット)');
          // アップロード済みファイル ID を記録
          this.uploadedAttachmentIds.push(result.data.id);
          console.log('📎 アップロード済みファイル ID:', result.data.id);

          // ファイル情報をローカルに保存（新規作成時のために）
          const attachmentInfo = {
            id: result.data.id,
            file_name: result.data.file_name,
            file_size: result.data.file_size,
            file_url: result.data.file_url,
            storage_path: result.data.storage_path,
            created_at: new Date().toISOString(),
            uploaded_by: { name: this.currentUser?.user_metadata?.name || 'あなた' }
          };
          this.uploadedAttachments.push(attachmentInfo);
          console.log('📦 ローカルに保存:', attachmentInfo);
        } else {
          this.showAlert(`${file.name} のアップロードに失敗しました`, 'error');
        }
      }

      this.showAlert('ファイルアップロード完了', 'success');

      // アップロード後に添付ファイル一覧を更新
      if (this.articleId) {
        // 既存記事の場合：DB から取得して表示
        const attachmentsResult = await supabaseClient.getArticleAttachments(this.articleId);
        if (attachmentsResult.success && attachmentsResult.data) {
          this.displayAttachments(attachmentsResult.data);
        }
      } else {
        // 新規記事の場合：ローカルの uploadedAttachments を表示
        console.log('📋 新規作成時：ローカルのアップロード済みファイルを表示');
        this.displayAttachments(this.uploadedAttachments);
      }
    } catch (error) {
      console.error('添付ファイルアップロードエラー:', error.message);
      this.showAlert('添付ファイルアップロード処理でエラーが発生しました', 'error');
    }
  }

  /**
   * 添付ファイル一覧を表示
   * @param {array} attachments - 添付ファイルの配列
   */
  displayAttachments(attachments) {
    const attachmentsList = document.getElementById('attachments-list');
    if (!attachmentsList) {
      console.warn('⚠️ attachments-list 要素が見つかりません');
      return;
    }

    // 既存の内容をクリア
    attachmentsList.innerHTML = '';

    // ファイルがない場合
    if (!attachments || attachments.length === 0) {
      attachmentsList.innerHTML = `
        <div style="padding: 20px; text-align: center; color: var(--text-secondary);">
          アップロードされたファイルがありません
        </div>
      `;
      console.log('📋 添付ファイルなし - プレースホルダーを表示');
      return;
    }

    // 各ファイルのアイテムを作成
    attachments.forEach((attachment) => {
      const fileIcon = this.getFileIcon(attachment.file_name);
      const fileSize = this.formatFileSize(attachment.file_size);
      const uploadedBy = attachment.uploaded_by ? attachment.uploaded_by.name : '不明';

      const itemHTML = `
        <div class="attachment-item" data-attachment-id="${attachment.id}">
          <div class="attachment-info">
            <div class="attachment-icon">${fileIcon}</div>
            <div class="attachment-details">
              <div class="attachment-name">${attachment.file_name}</div>
              <div class="attachment-meta">${fileSize} • ${uploadedBy} • ${new Date(attachment.created_at).toLocaleDateString('ja-JP')}</div>
            </div>
          </div>
          <div class="attachment-actions">
            <a href="${attachment.file_url}" target="_blank" class="btn btn-sm btn-outline" title="ダウンロード">
              📥
            </a>
            <button type="button" class="btn btn-sm btn-outline" data-delete-id="${attachment.id}" title="削除">
              🗑️
            </button>
          </div>
        </div>
      `;

      const itemDiv = document.createElement('div');
      itemDiv.innerHTML = itemHTML;
      attachmentsList.appendChild(itemDiv.firstElementChild);

      // 削除ボタンのイベントリスナーを設定
      const deleteBtn = itemDiv.querySelector('[data-delete-id]');
      if (deleteBtn) {
        deleteBtn.addEventListener('click', (e) => {
          e.preventDefault();
          this.deleteAttachment(attachment.id, attachment.storage_path);
        });
      }
    });

    console.log('✅ 添付ファイル一覧を表示しました:', attachments.length, '個');
  }

  /**
   * 添付ファイルを削除
   * @param {string} mediaId - メディアID
   * @param {string} storagePath - ストレージパス
   */
  async deleteAttachment(mediaId, storagePath) {
    if (!confirm('このファイルを削除してもよろしいですか？')) {
      return;
    }

    try {
      console.log('🗑️ 添付ファイルを削除中:', mediaId);
      const result = await supabaseClient.deleteMedia(mediaId, storagePath);

      if (result.success) {
        console.log('✅ ファイル削除成功');
        this.showAlert('ファイルを削除しました', 'success');

        // 削除後に一覧を更新
        if (this.articleId) {
          const attachmentsResult = await supabaseClient.getArticleAttachments(this.articleId);
          if (attachmentsResult.success) {
            this.displayAttachments(attachmentsResult.data);
          }
        }
      } else {
        this.showAlert('ファイル削除に失敗しました: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('❌ ファイル削除エラー:', error.message);
      this.showAlert('ファイル削除処理でエラーが発生しました', 'error');
    }
  }

  /**
   * ファイルの種類に応じてアイコンを返す
   * @param {string} fileName - ファイル名
   * @returns {string} - ファイルアイコン
   */
  getFileIcon(fileName) {
    const ext = fileName.split('.').pop().toLowerCase();
    const icons = {
      'pdf': '📄',
      'doc': '📝',
      'docx': '📝',
      'xls': '📊',
      'xlsx': '📊',
      'ppt': '🎨',
      'pptx': '🎨',
      'txt': '📄',
      'md': '📄',
      'zip': '📦',
      'png': '🖼️',
      'jpg': '🖼️',
      'jpeg': '🖼️',
      'gif': '🖼️',
      'webp': '🖼️'
    };
    return icons[ext] || '📎';
  }

  /**
   * ファイルサイズをフォーマット
   * @param {number} bytes - バイト数
   * @returns {string} - フォーマットされたサイズ
   */
  formatFileSize(bytes) {
    if (!bytes) return 'サイズ不明';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
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
   * イベント日時を表示用にフォーマット
   * カレンダー表示などで使用
   */
  formatEventDateTime(article) {
    if (!article.event_start_datetime) {
      return '';
    }

    const startDate = new Date(article.event_start_datetime);
    let result = '';

    // 開始日時
    result += startDate.getFullYear() + '年';
    result += (startDate.getMonth() + 1) + '月';
    result += startDate.getDate() + '日';

    if (article.has_start_time) {
      const hours = String(startDate.getHours()).padStart(2, '0');
      const minutes = String(startDate.getMinutes()).padStart(2, '0');
      result += ` ${hours}:${minutes}`;
    }

    // 終了日時
    if (article.event_end_datetime) {
      const endDate = new Date(article.event_end_datetime);
      result += ' 〜 ';
      result += endDate.getFullYear() + '年';
      result += (endDate.getMonth() + 1) + '月';
      result += endDate.getDate() + '日';

      if (article.has_end_time) {
        const hours = String(endDate.getHours()).padStart(2, '0');
        const minutes = String(endDate.getMinutes()).padStart(2, '0');
        result += ` ${hours}:${minutes}`;
      }
    }

    return result;
  }

  /**
   * 処理中オーバーレイを表示（マウス操作禁止）
   */
  showProcessingOverlay() {
    const overlay = document.getElementById('processing-overlay');
    if (overlay) {
      overlay.style.display = 'block';
      console.log('🔒 処理中オーバーレイを表示');
    }
  }

  /**
   * 処理中オーバーレイを非表示（マウス操作開放）
   */
  hideProcessingOverlay() {
    const overlay = document.getElementById('processing-overlay');
    if (overlay) {
      overlay.style.display = 'none';
      console.log('🔓 処理中オーバーレイを非表示');
    }
  }

  /**
   * LINEに通知（ブロードキャスト）
   * @param {string} title - 記事タイトル
   * @param {string} excerpt - 抜粋（SNS用）
   * @param {string} lineMessage - カスタムメッセージ（空の場合はexcerptを使用）
   * @param {string} slug - 記事スラッグ（URL用）
   */
  async postToLine(title, excerpt, lineMessage, slug) {
    const endpoint = window.LINE_BROADCAST_ENDPOINT;
    if (!endpoint) {
      console.error('❌ LINE通知エンドポイントが設定されていません');
      this.showAlert('LINE通知エンドポイントが設定されていません', 'error');
      return;
    }

    try {
      console.log('📢 LINE通知処理を開始...');

      // 通知メッセージを組み立て
      const articleUrl = `https://asahigaoka-nerima.tokyo/news/${slug}.html`;
      let message = lineMessage || excerpt || title;

      // タイトルとURLを追加
      message = `【新着記事】${title}\n\n${message}\n\n${articleUrl}`;

      console.log('📝 LINE通知内容:', message);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        console.log('✅ LINE通知成功:', result.line_response);
        this.showAlert('LINEへの通知が完了しました', 'success');
      } else {
        console.error('❌ LINE通知失敗:', result);
        this.showAlert(`LINE通知に失敗しました: ${result.message || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('❌ LINE通知エラー:', error);
      this.showAlert(`LINE通知処理でエラーが発生しました: ${error.message}`, 'error');
    }
  }

  /**
   * Xに投稿
   * @param {string} title - 記事タイトル
   * @param {string} excerpt - 抜粋（SNS用）
   * @param {string} xMessage - カスタムメッセージ（空の場合はexcerptを使用）
   * @param {string} xHashtags - ハッシュタグ
   * @param {string} slug - 記事スラッグ（URL用）
   */
  async postToX(title, excerpt, xMessage, xHashtags, slug) {
    const endpoint = window.X_POST_ENDPOINT;
    if (!endpoint) {
      console.error('❌ X投稿エンドポイントが設定されていません');
      this.showAlert('X投稿エンドポイントが設定されていません', 'error');
      return;
    }

    try {
      console.log('📢 X投稿処理を開始...');

      // 投稿メッセージを組み立て
      let message = xMessage || excerpt || title;

      // ハッシュタグを追加
      if (xHashtags) {
        message = `${message}\n${xHashtags}`;
      }

      // 記事URLを追加
      const articleUrl = `https://asahigaoka-nerima.tokyo/news/${slug}.html`;
      message = `${message}\n${articleUrl}`;

      // 280文字制限に収める
      if (message.length > 280) {
        // URLとハッシュタグの長さを計算
        const urlAndTags = `\n${xHashtags || ''}\n${articleUrl}`;
        const maxContentLength = 280 - urlAndTags.length;
        const truncatedContent = (xMessage || excerpt || title).substring(0, maxContentLength - 3) + '...';
        message = `${truncatedContent}${urlAndTags}`;
      }

      console.log('📝 投稿内容:', message);

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ message })
      });

      const result = await response.json();

      if (response.ok && result.status === 'success') {
        console.log('✅ X投稿成功:', result.tweet_response);
        this.showAlert('Xへの投稿が完了しました', 'success');
      } else {
        console.error('❌ X投稿失敗:', result);
        this.showAlert(`X投稿に失敗しました: ${result.message || 'Unknown error'}`, 'error');
      }
    } catch (error) {
      console.error('❌ X投稿エラー:', error);
      this.showAlert(`X投稿処理でエラーが発生しました: ${error.message}`, 'error');
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
