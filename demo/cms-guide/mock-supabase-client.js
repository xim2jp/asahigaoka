/**
 * デモ録画用モック Supabase クライアント
 * 本番の supabase-client.js と同じインターフェースを提供し、
 * すべてメモリ内で完結する（本番DB・認証には一切アクセスしない）。
 * これにより操作案内動画を「本物のUI・偽のデータ」で安全に量産できる。
 */
(function () {
  // ---- シードデータ（きれいな状態の記事一覧） ----
  const seedArticles = [
    {
      id: 'seed-1',
      title: '防災訓練のお知らせ',
      content: '<p>9月1日に防災訓練を実施します。</p>',
      excerpt: '防災訓練を実施します',
      status: 'published',
      category: 'notice',
      event_start_datetime: '2026-09-01 00:00:00',
      created_at: '2026-06-01T09:00:00Z',
      published_at: '2026-06-01T09:00:00Z',
      author: { id: 'u1', name: '野口' }
    },
    {
      id: 'seed-2',
      title: '資源回収のご案内',
      content: '<p>毎月第2土曜日は資源回収日です。</p>',
      excerpt: '資源回収のご案内',
      status: 'published',
      category: 'notice',
      event_start_datetime: '2026-06-14 00:00:00',
      created_at: '2026-05-20T09:00:00Z',
      published_at: '2026-05-20T09:00:00Z',
      author: { id: 'u1', name: '野口' }
    },
    {
      id: 'seed-3',
      title: '町会だより5月号を発行しました',
      content: '<p>町会だより5月号を回覧します。</p>',
      excerpt: '町会だより5月号',
      status: 'draft',
      category: 'notice',
      event_start_datetime: '2026-05-10 00:00:00',
      created_at: '2026-05-10T09:00:00Z',
      published_at: null,
      author: { id: 'u1', name: '野口' }
    }
  ];

  let articles = seedArticles.map(a => ({ ...a }));
  let idCounter = 100;

  function delay(ms) {
    return new Promise(r => setTimeout(r, ms));
  }

  class MockSupabaseClient {
    constructor() {
      this.client = {};
      this.currentUser = null;
    }

    init() {}

    async getCurrentUser() {
      try {
        const userJson = localStorage.getItem('asahigaoka_user');
        if (!userJson) return null;
        const user = JSON.parse(userJson);
        this.currentUser = user;
        return user;
      } catch (e) {
        return null;
      }
    }

    async signIn(email, password) {
      // デモ：どんな入力でもログイン成功（本番認証には接続しない）
      await delay(600);
      const user = {
        id: 'u1',
        email: email || 'admin@asahigaoka.example',
        name: '町会管理者',
        role: 'admin'
      };
      this.currentUser = user;
      return { success: true, user };
    }

    async signOut() {
      localStorage.removeItem('asahigaoka_user');
      localStorage.removeItem('asahigaoka_user_role');
      this.currentUser = null;
      return { success: true };
    }

    async getArticles(options = {}) {
      await delay(300);
      const { limit = 30 } = options;
      // created_at 降順（新しい順）
      const sorted = [...articles].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
      );
      return { data: sorted.slice(0, limit), count: sorted.length, success: true };
    }

    async getArticleById(id) {
      const data = articles.find(a => a.id === id) || null;
      return { data, success: !!data };
    }

    async createArticle(articleData) {
      await delay(500);
      const id = 'new-' + idCounter++;
      const record = {
        id,
        created_at: new Date().toISOString(),
        published_at: null,
        author: { id: 'u1', name: '町会管理者' },
        ...articleData
      };
      articles.push(record);
      return { data: record, success: true };
    }

    async updateArticle(id, updates) {
      await delay(500);
      const idx = articles.findIndex(a => a.id === id);
      if (idx === -1) return { data: null, success: false, error: 'not found' };
      articles[idx] = { ...articles[idx], ...updates };
      return { data: articles[idx], success: true };
    }

    async uploadMedia(file) {
      await delay(700);
      return {
        data: {
          id: 'media-' + idCounter++,
          file_url: 'https://example.invalid/featured/' + (file && file.name || 'image.jpg')
        },
        success: true
      };
    }

    async deleteArticle() { return { success: true }; }
    async publishArticle(id) { return this.updateArticle(id, { status: 'published', published_at: new Date().toISOString() }); }
  }

  window.supabaseClient = new MockSupabaseClient();
  // 静的ページ生成クライアントもダミー化（公開時に呼ばれる）
  window.staticPageGenerator = {
    async generateDetailPage() { return { success: true, file_path: '/news/demo.html' }; }
  };
  console.log('🎬 デモ用モッククライアント有効');
})();
