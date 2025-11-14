/**
 * Supabase クライアント初期化
 * プロジェクト: asahigaoka (練馬区旭丘一丁目町会)
 */

// Supabase プロジェクト情報
const SUPABASE_URL = 'https://swaringqrzthsdpsyoft.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InN3YXJpbmdxcnp0aHNkcHN5b2Z0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjMwMzMxNzIsImV4cCI6MjA3ODYwOTE3Mn0.2o8jCqhmOO3Uvx0O-tzbNyjFU3XAFs843AIjq4AjHEg';

/**
 * Supabase JS SDK を CDN から読み込む
 * グローバル `supabase` オブジェクトを利用
 */

class SupabaseClient {
  constructor() {
    this.client = null;
    this.currentUser = null;
    this.init();
  }

  /**
   * Supabase クライアント初期化
   */
  init() {
    if (window.supabase && window.supabase.createClient) {
      this.client = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
      console.log('✅ Supabase クライアント初期化完了');
    } else {
      console.error('❌ Supabase SDK が読み込まれていません');
    }
  }

  /**
   * 現在のユーザー情報を取得（localStorageから）
   */
  async getCurrentUser() {
    try {
      // localStorageからユーザー情報を取得
      const userJson = localStorage.getItem('asahigaoka_user');
      if (!userJson) {
        console.log('ユーザー情報がlocalStorageに保存されていません');
        return null;
      }

      const user = JSON.parse(userJson);
      this.currentUser = user;
      return user;
    } catch (error) {
      console.error('ユーザー取得エラー:', error.message);
      return null;
    }
  }

  /**
   * メール/パスワードでログイン（独自の users テーブルから認証）
   * @param {string} email - メールアドレス
   * @param {string} password - パスワード
   */
  async signIn(email, password) {
    try {
      // users テーブルからユーザーを検索
      const { data: users, error: searchError } = await this.client
        .from('users')
        .select('*')
        .eq('email', email)
        .single();

      if (searchError || !users) {
        throw new Error('ユーザーが見つかりません');
      }

      // パスワードを検証（Base64 エンコードで比較）
      const passwordHash = btoa(password);
      if (users.password_hash !== passwordHash) {
        throw new Error('パスワードが正しくありません');
      }

      // ユーザーが有効かチェック
      if (!users.is_active) {
        throw new Error('このユーザーは無効化されています。管理者にお問い合わせください');
      }

      // ログイン成功時は last_login_at を更新
      await this.client
        .from('users')
        .update({ last_login_at: new Date().toISOString() })
        .eq('id', users.id);

      this.currentUser = {
        id: users.id,
        email: users.email,
        user_metadata: {
          name: users.name
        }
      };

      console.log('✅ ログイン成功:', email);
      return {
        success: true,
        user: {
          id: users.id,
          email: users.email,
          name: users.name,
          role: users.role
        }
      };
    } catch (error) {
      console.error('❌ ログインエラー:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * ログアウト
   */
  async signOut() {
    try {
      // localStorageからユーザー情報を削除
      localStorage.removeItem('asahigaoka_user');
      localStorage.removeItem('asahigaoka_user_role');

      this.currentUser = null;
      console.log('✅ ログアウト完了');
      return { success: true };
    } catch (error) {
      console.error('❌ ログアウトエラー:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * ユーザーロール情報を取得
   * @param {string} userId - ユーザーID
   */
  async getUserRole(userId) {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('role')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return data.role;
    } catch (error) {
      console.error('❌ ロール取得エラー:', error.message);
      return null;
    }
  }

  /**
   * 記事一覧を取得
   * @param {object} options - フィルタオプション
   */
  async getArticles(options = {}) {
    try {
      const {
        category = null,
        status = 'published',
        limit = 20,
        offset = 0,
        sortBy = 'published_at',
        sortOrder = 'desc'
      } = options;

      let query = this.client
        .from('articles')
        .select('*,author:users(id,name)');

      // status が 'all' でない場合のみフィルタリング
      if (status !== 'all') {
        query = query.eq('status', status);
      }

      if (category) {
        query = query.eq('category', category);
      }

      // deleted_at が null のレコードのみ取得
      const { data, error, count } = await query
        .is('deleted_at', null)
        .order(sortBy, { ascending: sortOrder === 'asc', nullsFirst: false })
        .range(offset, offset + limit - 1);
      if (error) throw error;
      return { data, count, success: true };
    } catch (error) {
      console.error('記事取得エラー:', error.message);
      return { data: [], count: 0, success: false, error: error.message };
    }
  }

  /**
   * 記事を IDで取得
   * @param {string} id - 記事ID
   */
  async getArticleById(id) {
    try {
      const { data, error } = await this.client
        .from('articles')
        .select('*,author:users(name)')
        .eq('id', id)
        .single();

      if (error) throw error;
      return { data, success: true };
    } catch (error) {
      console.error('記事取得エラー:', error.message);
      return { data: null, success: false, error: error.message };
    }
  }

  /**
   * 記事を作成
   * @param {object} articleData - 記事データ
   */
  async createArticle(articleData) {
    try {
      const userId = this.currentUser?.id;
      if (!userId) throw new Error('ユーザーが認証されていません');

      const { data, error } = await this.client
        .from('articles')
        .insert({
          ...articleData,
          author: userId
        })
        .select()
        .single();

      if (error) throw error;
      console.log('✅ 記事作成成功:', data.id);
      return { data, success: true };
    } catch (error) {
      console.error('❌ 記事作成エラー:', error.message);
      return { data: null, success: false, error: error.message };
    }
  }

  /**
   * 記事を更新
   * @param {string} id - 記事ID
   * @param {object} updates - 更新データ
   */
  async updateArticle(id, updates) {
    try {
      const { data, error } = await this.client
        .from('articles')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      console.log('✅ 記事更新成功:', id);
      return { data, success: true };
    } catch (error) {
      console.error('❌ 記事更新エラー:', error.message);
      return { data: null, success: false, error: error.message };
    }
  }

  /**
   * 記事を削除（論理削除）
   * @param {string} id - 記事ID
   */
  async deleteArticle(id) {
    try {
      const { data, error } = await this.client
        .from('articles')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      console.log('✅ 記事削除成功:', id);
      return { data, success: true };
    } catch (error) {
      console.error('❌ 記事削除エラー:', error.message);
      return { data: null, success: false, error: error.message };
    }
  }

  /**
   * 記事を公開状態に更新
   * @param {string} id - 記事ID
   */
  async publishArticle(id) {
    try {
      const { data, error } = await this.client
        .from('articles')
        .update({
          status: 'published',
          published_at: new Date().toISOString()
        })
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      console.log('✅ 記事公開成功:', id);
      return { data, success: true };
    } catch (error) {
      console.error('❌ 記事公開エラー:', error.message);
      return { data: null, success: false, error: error.message };
    }
  }

  /**
   * メディア（画像）をアップロード
   * @param {File} file - ファイルオブジェクト
   * @param {string} bucketName - バケット名（デフォルト: 'articles-images'）
   */
  async uploadMedia(file, bucketName = 'articles-images') {
    try {
      const userId = this.currentUser?.id;
      if (!userId) throw new Error('ユーザーが認証されていません');

      // ファイル名の生成（タイムスタンプ + ランダム + 拡張子）
      // Supabase Storage は日本語や特殊文字をサポートしないため、安全な形式に変換
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      const fileName = `${timestamp}-${random}${ext}`;

      // ファイルをストレージにアップロード
      const { data: uploadData, error: uploadError } = await this.client.storage
        .from(bucketName)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // アップロード成功後、メディア情報をDB に記録
      const fileUrl = `${SUPABASE_URL}/storage/v1/object/public/${bucketName}/${fileName}`;

      const { data: mediaData, error: dbError } = await this.client
        .from('media')
        .insert({
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          file_url: fileUrl,
          storage_path: `${bucketName}/${fileName}`,
          uploaded_by: userId,
          mime_type: file.type
        })
        .select()
        .single();

      if (dbError) throw dbError;

      console.log('✅ メディアアップロード成功:', mediaData.id);
      return { data: mediaData, success: true };
    } catch (error) {
      console.error('❌ メディアアップロードエラー:', error.message);
      return { data: null, success: false, error: error.message };
    }
  }

  /**
   * メディア一覧を取得
   */
  async getMedia(limit = 50, offset = 0) {
    try {
      const { data, error, count } = await this.client
        .from('media')
        .select('*,uploaded_by:users(name)')
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return { data, count, success: true };
    } catch (error) {
      console.error('メディア取得エラー:', error.message);
      return { data: [], count: 0, success: false, error: error.message };
    }
  }

  /**
   * メディアを削除
   * @param {string} id - メディアID
   * @param {string} storagePath - ストレージパス
   */
  async deleteMedia(id, storagePath) {
    try {
      // ストレージから削除
      const [bucketName, ...pathParts] = storagePath.split('/');
      const filePath = pathParts.join('/');

      const { error: storageError } = await this.client.storage
        .from(bucketName)
        .remove([filePath]);

      if (storageError) throw storageError;

      // DB から削除（論理削除）
      const { data, error: dbError } = await this.client
        .from('media')
        .update({ deleted_at: new Date().toISOString() })
        .eq('id', id)
        .select()
        .single();

      if (dbError) throw dbError;

      console.log('✅ メディア削除成功:', id);
      return { data, success: true };
    } catch (error) {
      console.error('❌ メディア削除エラー:', error.message);
      return { data: null, success: false, error: error.message };
    }
  }

  /**
   * 記事を検索（全文検索）
   * @param {string} keyword - 検索キーワード
   */
  async searchArticles(keyword, limit = 20) {
    try {
      const { data, error } = await this.client
        .from('articles')
        .select('*,author:users(name)')
        .or(`title.ilike.%${keyword}%,content.ilike.%${keyword}%`)
        .eq('status', 'published')
        .is('deleted_at', null)
        .limit(limit);

      if (error) throw error;
      return { data, success: true };
    } catch (error) {
      console.error('検索エラー:', error.message);
      return { data: [], success: false, error: error.message };
    }
  }

  /**
   * ユーザープロフィール情報を取得
   * @param {string} userId - ユーザーID
   */
  async getUserProfile(userId) {
    try {
      const { data, error } = await this.client
        .from('users')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) throw error;
      return { data, success: true };
    } catch (error) {
      console.error('プロフィール取得エラー:', error.message);
      return { data: null, success: false, error: error.message };
    }
  }

  /**
   * ユーザープロフィールを更新
   * @param {string} userId - ユーザーID
   * @param {object} updates - 更新データ
   */
  async updateUserProfile(userId, updates) {
    try {
      const { data, error } = await this.client
        .from('users')
        .update(updates)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;
      console.log('✅ プロフィール更新成功');
      return { data, success: true };
    } catch (error) {
      console.error('❌ プロフィール更新エラー:', error.message);
      return { data: null, success: false, error: error.message };
    }
  }

  /**
   * すべてのユーザーを取得（admin のみ）
   */
  async getAllUsers(limit = 50, offset = 0) {
    try {
      const { data, error, count } = await this.client
        .from('users')
        .select('*')
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return { data, count, success: true };
    } catch (error) {
      console.error('ユーザー取得エラー:', error.message);
      return { data: [], count: 0, success: false, error: error.message };
    }
  }

  /**
   * 新規ユーザーを作成
   * @param {object} userData - ユーザーデータ
   */
  async createUser(userData) {
    try {
      const { email, password, name, role, is_active } = userData;

      // 既存のユーザー確認
      const { data: existingUser } = await this.client
        .from('users')
        .select('id')
        .eq('email', email)
        .single();

      if (existingUser) {
        throw new Error('このメールアドレスは既に登録されています');
      }

      // 新しいユーザーIDを生成（UUID）
      const userId = crypto.randomUUID ? crypto.randomUUID() :
                    'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
                      const r = Math.random() * 16 | 0;
                      const v = c === 'x' ? r : (r & 0x3 | 0x8);
                      return v.toString(16);
                    });

      // bcryptの代わりに簡易的なハッシュ（実際の本番環境では適切なハッシュ化が必要）
      const passwordHash = btoa(password); // 簡易的な実装

      // usersテーブルにデータを追加
      const { data: newUser, error: userError } = await this.client
        .from('users')
        .insert({
          id: userId,
          email,
          name,
          role,
          is_active,
          password_hash: passwordHash,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (userError) throw userError;

      console.log('✅ ユーザー作成成功:', email);
      return { data: newUser, success: true };
    } catch (error) {
      console.error('❌ ユーザー作成エラー:', error.message);
      return { data: null, success: false, error: error.message };
    }
  }

  /**
   * ユーザー情報を更新
   * @param {string} userId - ユーザーID
   * @param {object} updates - 更新データ
   */
  async updateUser(userId, updates) {
    try {
      const { email, password, name, role, is_active } = updates;

      // 更新データを準備
      const updateData = {
        email,
        name,
        role,
        is_active,
        updated_at: new Date().toISOString()
      };

      // パスワードが指定されている場合はハッシュ化して追加
      if (password) {
        updateData.password_hash = btoa(password); // 簡易的な実装
      }

      // usersテーブルを更新
      const { data: userData, error: userError } = await this.client
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (userError) throw userError;

      console.log('✅ ユーザー更新成功:', userId);
      return { data: userData, success: true };
    } catch (error) {
      console.error('❌ ユーザー更新エラー:', error.message);
      return { data: null, success: false, error: error.message };
    }
  }

  /**
   * ユーザーを削除
   * @param {string} userId - ユーザーID
   */
  async deleteUser(userId) {
    try {
      // usersテーブルから削除（物理削除）
      const { data, error: dbError } = await this.client
        .from('users')
        .delete()
        .eq('id', userId)
        .select()
        .single();

      if (dbError) throw dbError;

      console.log('✅ ユーザー削除成功:', userId);
      return { data, success: true };
    } catch (error) {
      console.error('❌ ユーザー削除エラー:', error.message);
      return { data: null, success: false, error: error.message };
    }
  }

  /**
   * ユーザーパスワードをリセット
   * @param {string} email - メールアドレス
   */
  async resetUserPassword(email) {
    try {
      const { error } = await this.client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/admin/reset-password.html`
      });

      if (error) throw error;

      console.log('✅ パスワードリセットメール送信成功:', email);
      return { success: true };
    } catch (error) {
      console.error('❌ パスワードリセットエラー:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 添付ファイルをアップロード
   * @param {File} file - ファイルオブジェクト
   * @param {string} bucketName - バケット名（デフォルト: 'attachments'）
   */
  async uploadAttachment(file, bucketName = 'attachments') {
    try {
      const userId = this.currentUser?.id;
      if (!userId) throw new Error('ユーザーが認証されていません');

      // ファイル情報から file_type を判定
      const fileType = this.getFileType(file);

      // ファイル名の生成（タイムスタンプ + ランダム + 拡張子）
      // Supabase Storage は日本語や特殊文字をサポートしないため、安全な形式に変換
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
      const fileName = `${timestamp}-${random}${ext}`;

      // ファイルをストレージにアップロード
      const { data: uploadData, error: uploadError } = await this.client.storage
        .from(bucketName)
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      // ストレージパス
      const storagePath = `${bucketName}/${fileName}`;

      // attachments テーブルに記録
      const { data: attachmentData, error: dbError } = await this.client
        .from('attachments')
        .insert({
          file_name: file.name,
          file_type: fileType,
          mime_type: file.type,
          storage_path: storagePath,
          file_size: file.size,
          uploaded_by: userId
        })
        .select()
        .single();

      if (dbError) throw dbError;

      console.log('✅ ファイルアップロード成功:', attachmentData.id);
      return { data: attachmentData, success: true };
    } catch (error) {
      console.error('❌ ファイルアップロードエラー:', error.message);
      return { data: null, success: false, error: error.message };
    }
  }

  /**
   * ファイルタイプを判定（拡張子とMIME タイプから）
   * @param {File} file - ファイルオブジェクト
   * @returns {string} - 'image', 'document', 'text', 'archive'
   */
  getFileType(file) {
    const mimeType = file.type.toLowerCase();
    const fileName = file.name.toLowerCase();

    // MIME タイプから判定
    if (mimeType.startsWith('image/')) return 'image';
    if (mimeType === 'application/pdf') return 'document';
    if (mimeType.includes('officedocument') || mimeType.includes('msword') || mimeType.includes('spreadsheet')) {
      return 'document';
    }
    if (mimeType.startsWith('text/') || fileName.endsWith('.md')) return 'text';
    if (mimeType === 'application/zip' || fileName.endsWith('.zip')) return 'archive';

    // 拡張子から判定
    if (/\.(png|jpg|jpeg|gif|webp|svg)$/i.test(fileName)) return 'image';
    if (/\.(pdf)$/i.test(fileName)) return 'document';
    if (/\.(docx?|xlsx?|pptx?)$/i.test(fileName)) return 'document';
    if (/\.(txt|md|csv)$/i.test(fileName)) return 'text';
    if (/\.(zip|rar|7z|tar|gz)$/i.test(fileName)) return 'archive';

    // デフォルト
    return 'document';
  }

  /**
   * 記事の添付ファイル一覧を取得
   * @param {string} articleId - 記事ID
   */
  async getArticleAttachments(articleId) {
    try {
      const { data, error } = await this.client
        .from('attachments')
        .select('*,uploaded_by:users(name)')
        .eq('article_id', articleId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return { data: data || [], success: true };
    } catch (error) {
      console.error('添付ファイル取得エラー:', error.message);
      return { data: [], success: false, error: error.message };
    }
  }

  /**
   * 添付ファイル一覧を取得（ユーザーがアップロードしたもの）
   * @param {number} limit - 取得件数
   * @param {number} offset - オフセット
   */
  async getAttachments(limit = 50, offset = 0) {
    try {
      const userId = this.currentUser?.id;
      if (!userId) throw new Error('ユーザーが認証されていません');

      const { data, error, count } = await this.client
        .from('attachments')
        .select('*,uploaded_by:users(name)', { count: 'exact' })
        .eq('uploaded_by', userId)
        .order('created_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;
      return { data: data || [], count: count || 0, success: true };
    } catch (error) {
      console.error('❌ 添付ファイル一覧取得エラー:', error.message);
      return { data: [], count: 0, success: false, error: error.message };
    }
  }

  /**
   * 添付ファイルを記事に関連付け
   * @param {string} attachmentId - 添付ファイルID
   * @param {string} articleId - 記事ID
   */
  async linkAttachmentToArticle(attachmentId, articleId) {
    try {
      const { data, error } = await this.client
        .from('attachments')
        .update({ article_id: articleId })
        .eq('id', attachmentId)
        .select()
        .single();

      if (error) throw error;
      console.log('✅ ファイルを記事に関連付けました:', attachmentId);
      return { data, success: true };
    } catch (error) {
      console.error('❌ ファイル関連付けエラー:', error.message);
      return { data: null, success: false, error: error.message };
    }
  }

  /**
   * 添付ファイルを削除
   * @param {string} id - 添付ファイルID
   * @param {string} storagePath - ストレージパス
   */
  async deleteAttachment(id, storagePath) {
    try {
      // ストレージから削除
      const [bucketName, ...pathParts] = storagePath.split('/');
      const filePath = pathParts.join('/');

      const { error: storageError } = await this.client.storage
        .from(bucketName)
        .remove([filePath]);

      if (storageError) throw storageError;

      // データベースから削除
      const { error: dbError } = await this.client
        .from('attachments')
        .delete()
        .eq('id', id);

      if (dbError) throw dbError;

      console.log('✅ ファイル削除成功:', id);
      return { success: true };
    } catch (error) {
      console.error('❌ ファイル削除エラー:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * 添付ファイルのダウンロードURLを取得
   * @param {string} storagePath - ストレージパス
   * @returns {string} - ダウンロードURL
   */
  getAttachmentDownloadUrl(storagePath) {
    return `${SUPABASE_URL}/storage/v1/object/public/${storagePath}`;
  }
}

// グローバル インスタンスとして初期化
const supabaseClient = new SupabaseClient();

// 他のスクリプトからアクセス可能にする
window.supabaseClient = supabaseClient;
