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

    // AIに書いてもらうボタン
    const aiGenerateBtn = document.getElementById('ai-generate-btn');
    if (aiGenerateBtn) {
      aiGenerateBtn.addEventListener('click', () => this.generateWithAI());
      console.log('✅ AI生成ボタンにリスナー設定');
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
    if (featuredImageInput) {
      featuredImageInput.addEventListener('change', (e) => this.handleFeaturedImageUpload(e));
    }

    // 添付ファイルアップロード
    const attachmentsInput = document.getElementById('attachments');
    if (attachmentsInput) {
      attachmentsInput.addEventListener('change', (e) => this.handleAttachmentsUpload(e));
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
   * AIに記事を生成してもらう
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

    // SEOフィールドを取得
    const metaTitle = document.querySelector('#meta-title').value.trim();
    const metaDescription = document.querySelector('#meta-description').value.trim();
    const metaKeywords = document.querySelector('#meta-keywords').value.trim();
    const slug = document.querySelector('#slug').value.trim();

    console.log('フォーム入力値:', { title, content, excerpt, category, eventDateFrom, eventTimeFrom, eventDateTo, eventTimeTo, metaTitle, metaDescription, metaKeywords, slug });

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

      const articleData = {
        title,
        content,
        excerpt,
        category,
        status: 'draft',
        event_start_datetime: eventStartDatetime,
        event_end_datetime: eventEndDatetime,
        has_start_time: hasStartTime,
        has_end_time: hasEndTime,
        meta_title: metaTitle || null,
        meta_description: metaDescription || null,
        meta_keywords: metaKeywords || null,
        slug: slug || null,
        featured_image_url: this.featuredImageUrl || null
      };

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

          this.showAlert('記事を保存しました', 'success');

          // 1500ms後に一覧ページに遷移
          setTimeout(() => {
            window.location.href = 'articles.html';
          }, 1500);
        } else {
          this.showAlert('保存に失敗しました: ' + result.error, 'error');
        }
      } else {
        // 新規記事を作成
        result = await supabaseClient.createArticle(articleData);

        if (result.success) {
          this.articleId = result.data.id;
          this.currentArticle = result.data;

          // 新規作成後に featured_image_url が保存されていれば、プレビューを更新
          if (result.data.featured_image_url) {
            const preview = document.getElementById('image-preview');
            if (preview) {
              preview.src = result.data.featured_image_url;
              preview.classList.add('show');
              console.log('✅ 新規作成後にアイキャッチ画像プレビューを更新:', result.data.featured_image_url);
            }
          }

          this.showAlert('記事を作成しました', 'success');

          // URL を更新（履歴に追加しない）
          window.history.replaceState(
            {},
            '',
            `article-edit.html?id=${this.articleId}`
          );

          // 1500ms後に一覧ページに遷移
          setTimeout(() => {
            window.location.href = 'articles.html';
          }, 1500);
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
   * アイキャッチ画像をアップロード
   */
  async handleFeaturedImageUpload(event) {
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
      console.log('🖼️ アイキャッチ画像アップロード開始:', file.name);

      const result = await supabaseClient.uploadMedia(file);

      if (result.success) {
        // featured_image_url を this.featuredImageUrl に保存
        this.featuredImageUrl = result.data.file_url;
        console.log('✅ アイキャッチ画像URL保存:', this.featuredImageUrl);

        // 記事を保存している場合は、featured_image_url を即座に更新
        if (this.articleId) {
          console.log('🔄 既存記事にアイキャッチ画像を更新中...');
          await supabaseClient.updateArticle(this.articleId, {
            featured_image_url: result.data.file_url
          });
          console.log('✅ 既存記事のアイキャッチ画像を更新完了');
        }

        this.showAlert('アイキャッチ画像をアップロードしました', 'success');
      } else {
        this.showAlert('アップロードに失敗しました: ' + result.error, 'error');
      }
    } catch (error) {
      console.error('アップロードエラー:', error.message);
      this.showAlert('アップロード処理でエラーが発生しました', 'error');
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

        const result = await supabaseClient.uploadMedia(file);

        if (result.success) {
          console.log('✅ ファイルアップロード成功:', file.name);
          // TODO: 添付ファイル一覧に表示する処理を実装
        } else {
          this.showAlert(`${file.name} のアップロードに失敗しました`, 'error');
        }
      }

      this.showAlert('ファイルアップロード完了', 'success');
    } catch (error) {
      console.error('添付ファイルアップロードエラー:', error.message);
      this.showAlert('添付ファイルアップロード処理でエラーが発生しました', 'error');
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
