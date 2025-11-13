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
   * 現在のユーザー情報を取得
   */
  async getCurrentUser() {
    try {
      const { data: { user }, error } = await this.client.auth.getUser();
      if (error) throw error;
      this.currentUser = user;
      return user;
    } catch (error) {
      console.error('ユーザー取得エラー:', error.message);
      return null;
    }
  }

  /**
   * メール/パスワードでログイン
   * @param {string} email - メールアドレス
   * @param {string} password - パスワード
   */
  async signIn(email, password) {
    try {
      const { data, error } = await this.client.auth.signInWithPassword({
        email,
        password
      });

      if (error) throw error;

      this.currentUser = data.user;
      console.log('✅ ログイン成功:', email);
      return { success: true, user: data.user };
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
      const { error } = await this.client.auth.signOut();
      if (error) throw error;

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
      console.error('ロール取得エラー:', error.message);
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
        .select('*,author:users(name)')
        .eq('status', status);

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error, count } = await query
        .is('deleted_at', null)
        .order(sortBy, { ascending: sortOrder === 'asc' })
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

      // ファイル名の生成（タイムスタンプ + UUID）
      const timestamp = Date.now();
      const random = Math.random().toString(36).substr(2, 9);
      const fileName = `${timestamp}-${random}-${file.name}`;

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
}

// グローバル インスタンスとして初期化
const supabaseClient = new SupabaseClient();

// 他のスクリプトからアクセス可能にする
window.supabaseClient = supabaseClient;
