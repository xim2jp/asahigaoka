/**
 * ユーザー管理機能
 * 旭丘一丁目町会 管理画面
 */

class UserManager {
  constructor() {
    this.users = [];
    this.currentPage = 1;
    this.pageSize = 10;
    this.editingUserId = null;
    this.init();
  }

  /**
   * 初期化処理
   */
  async init() {
    // 認証チェック
    await this.checkAuth();

    // イベントリスナーの設定
    this.setupEventListeners();

    // ユーザー一覧を読み込み
    await this.loadUsers();
  }

  /**
   * 認証チェック
   */
  async checkAuth() {
    const user = await supabaseClient.getCurrentUser();
    if (!user) {
      window.location.href = 'login.html';
      return;
    }

    // ユーザー情報を画面に表示
    const userProfile = await supabaseClient.getUserProfile(user.id);
    if (userProfile.success && userProfile.data) {
      const userNameElement = document.querySelector('.user-name');
      const userAvatarElement = document.querySelector('.user-avatar');

      if (userNameElement) userNameElement.textContent = userProfile.data.name || 'ユーザー';
      if (userAvatarElement) userAvatarElement.textContent = (userProfile.data.name || 'U').charAt(0);
    }
  }

  /**
   * イベントリスナーの設定
   */
  setupEventListeners() {
    // 新規ユーザー追加ボタン
    const addUserBtn = document.querySelector('[data-modal="add-user-modal"]');
    if (addUserBtn) {
      addUserBtn.addEventListener('click', () => this.openAddUserModal());
    }

    // 新規ユーザー追加フォーム
    const addUserForm = document.querySelector('#add-user-modal form');
    if (addUserForm) {
      addUserForm.addEventListener('submit', (e) => this.handleAddUser(e));
    }

    // ユーザー編集フォーム
    const editUserForm = document.querySelector('#edit-user-modal form');
    if (editUserForm) {
      editUserForm.addEventListener('submit', (e) => this.handleEditUser(e));
    }

    // モーダルの閉じるボタン
    document.querySelectorAll('.modal-close').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const modal = e.target.closest('.modal');
        if (modal) modal.classList.remove('show');
      });
    });

    // モーダル外側クリックで閉じる
    document.querySelectorAll('.modal').forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.classList.remove('show');
        }
      });
    });

    // ログアウトボタン
    const logoutBtn = document.querySelector('a[href="login.html"]');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        await supabaseClient.signOut();
        window.location.href = 'login.html';
      });
    }
  }

  /**
   * ユーザー一覧を読み込み
   */
  async loadUsers() {
    try {
      // ローディング表示
      this.showLoading();

      const result = await supabaseClient.getAllUsers(100, 0);

      if (result.success) {
        this.users = result.data;
        this.renderUserTable();
        this.updateStats();
      } else {
        this.showError('ユーザー一覧の取得に失敗しました');
      }
    } catch (error) {
      console.error('ユーザー読み込みエラー:', error);
      this.showError('ユーザー一覧の取得に失敗しました');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * ユーザーテーブルをレンダリング
   */
  renderUserTable() {
    const tbody = document.querySelector('.table tbody');
    if (!tbody) return;

    if (this.users.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; padding: 40px;">
            ユーザーが登録されていません
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.users.map((user, index) => {
      const initial = (user.name || user.email || 'U').charAt(0).toUpperCase();
      const avatarColors = [
        'var(--primary-color)',
        'var(--info-color)',
        'var(--warning-color)',
        'var(--secondary-color)',
        'var(--accent-color)'
      ];
      const avatarColor = avatarColors[index % avatarColors.length];

      // 最終ログイン日時のフォーマット
      const lastLoginAt = user.last_login_at ?
        new Date(user.last_login_at).toLocaleString('ja-JP') :
        '未ログイン';

      // 作成日時のフォーマット
      const createdAt = new Date(user.created_at).toLocaleDateString('ja-JP');

      // ステータスの判定（アクティブかどうか）
      const isActive = user.is_active !== false;
      const statusBadge = isActive ?
        '<span class="badge badge-success">有効</span>' :
        '<span class="badge badge-warning">無効</span>';

      // 権限バッジ
      const roleBadge = user.role === 'admin' ?
        '<span class="badge badge-danger">管理者</span>' :
        '<span class="badge badge-info">編集者</span>';

      return `
        <tr data-user-id="${user.id}">
          <td data-label="No">${(index + 1).toString().padStart(3, '0')}</td>
          <td data-label="名前">
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="user-avatar" style="background-color: ${avatarColor};">${initial}</div>
              ${user.name || 'ユーザー名未設定'}
            </div>
          </td>
          <td data-label="メール">${user.email}</td>
          <td data-label="権限">${roleBadge}</td>
          <td data-label="最終ログイン">${lastLoginAt}</td>
          <td data-label="登録日">${createdAt}</td>
          <td data-label="ステータス">${statusBadge}</td>
          <td data-label="操作">
            <div class="table-actions">
              <button class="btn btn-sm btn-outline" onclick="userManager.openEditUserModal('${user.id}')">編集</button>
              <button class="btn btn-sm btn-danger" onclick="userManager.confirmDeleteUser('${user.id}')">削除</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  /**
   * 統計情報を更新
   */
  updateStats() {
    const totalUsers = this.users.length;
    const adminCount = this.users.filter(u => u.role === 'admin').length;
    const editorCount = this.users.filter(u => u.role === 'editor').length;
    const activeCount = this.users.filter(u => u.is_active !== false).length;

    // 総ユーザー数
    const totalCard = document.querySelector('.stat-cards .stat-card:nth-child(1)');
    if (totalCard) {
      totalCard.querySelector('.stat-card-value').textContent = totalUsers;
      totalCard.querySelector('.stat-card-change').textContent =
        `管理者: ${adminCount}名 / 編集者: ${editorCount}名`;
    }

    // 有効ユーザー数
    const activeCard = document.querySelector('.stat-cards .stat-card:nth-child(2)');
    if (activeCard) {
      activeCard.querySelector('.stat-card-value').textContent = activeCount;
      const percentage = totalUsers > 0 ? Math.round((activeCount / totalUsers) * 100) : 0;
      activeCard.querySelector('.stat-card-change').textContent = `${percentage}% アクティブ`;
    }

    // 今日のログイン（仮データ）
    const todayCard = document.querySelector('.stat-cards .stat-card:nth-child(3)');
    if (todayCard) {
      const today = new Date().toDateString();
      const todayLogins = this.users.filter(u => {
        return u.last_login_at && new Date(u.last_login_at).toDateString() === today;
      });
      todayCard.querySelector('.stat-card-value').textContent = todayLogins.length;
      const names = todayLogins.map(u => u.name || u.email.split('@')[0]).slice(0, 3).join('、');
      todayCard.querySelector('.stat-card-change').textContent = names || 'なし';
    }
  }

  /**
   * 新規ユーザー追加モーダルを開く
   */
  openAddUserModal() {
    const modal = document.getElementById('add-user-modal');
    if (modal) {
      // フォームをリセット
      const form = modal.querySelector('form');
      if (form) form.reset();

      modal.classList.add('show');
    }
  }

  /**
   * ユーザー編集モーダルを開く
   */
  async openEditUserModal(userId) {
    const modal = document.getElementById('edit-user-modal');
    if (!modal) return;

    const user = this.users.find(u => u.id === userId);
    if (!user) return;

    this.editingUserId = userId;

    // フォームに値を設定
    const nameInput = modal.querySelector('#edit-name');
    const emailInput = modal.querySelector('#edit-email');
    const roleSelect = modal.querySelector('#edit-role');
    const activeCheckbox = modal.querySelector('input[type="checkbox"]');

    if (nameInput) nameInput.value = user.name || '';
    if (emailInput) emailInput.value = user.email;
    if (roleSelect) roleSelect.value = user.role;
    if (activeCheckbox) activeCheckbox.checked = user.is_active !== false;

    // 情報を表示
    const infoDiv = modal.querySelector('.alert-info');
    if (infoDiv) {
      const lastLogin = user.last_login_at ?
        new Date(user.last_login_at).toLocaleString('ja-JP') :
        '未ログイン';
      const createdAt = new Date(user.created_at).toLocaleString('ja-JP');

      infoDiv.innerHTML = `
        <strong>最終ログイン:</strong> ${lastLogin}<br>
        <strong>登録日:</strong> ${createdAt}
      `;
    }

    modal.classList.add('show');
  }

  /**
   * 新規ユーザー追加処理
   */
  async handleAddUser(event) {
    event.preventDefault();

    const form = event.target;
    const name = form.querySelector('#new-name').value.trim();
    const email = form.querySelector('#new-email').value.trim();
    const password = form.querySelector('#new-password').value;
    const role = form.querySelector('#new-role').value;
    const isActive = form.querySelector('input[type="checkbox"]').checked;

    if (!name || !email || !password || !role) {
      this.showError('必須項目を入力してください');
      return;
    }

    if (password.length < 8) {
      this.showError('パスワードは8文字以上で設定してください');
      return;
    }

    try {
      this.showLoading();

      // ユーザーを作成
      const result = await supabaseClient.createUser({
        email,
        password,
        name,
        role,
        is_active: isActive
      });

      if (result.success) {
        this.showSuccess('ユーザーを追加しました');
        document.getElementById('add-user-modal').classList.remove('show');
        await this.loadUsers();
      } else {
        this.showError(result.error || 'ユーザーの追加に失敗しました');
      }
    } catch (error) {
      console.error('ユーザー追加エラー:', error);
      this.showError('ユーザーの追加に失敗しました');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * ユーザー編集処理
   */
  async handleEditUser(event) {
    event.preventDefault();

    if (!this.editingUserId) return;

    const form = event.target;
    const name = form.querySelector('#edit-name').value.trim();
    const email = form.querySelector('#edit-email').value.trim();
    const password = form.querySelector('#edit-password').value;
    const role = form.querySelector('#edit-role').value;
    const isActive = form.querySelector('input[type="checkbox"]').checked;

    if (!name || !email || !role) {
      this.showError('必須項目を入力してください');
      return;
    }

    try {
      this.showLoading();

      const updates = {
        name,
        email,
        role,
        is_active: isActive
      };

      // パスワードが入力されていれば更新対象に含める
      if (password) {
        if (password.length < 8) {
          this.showError('パスワードは8文字以上で設定してください');
          return;
        }
        updates.password = password;
      }

      // ユーザー情報を更新
      const result = await supabaseClient.updateUser(this.editingUserId, updates);

      if (result.success) {
        this.showSuccess('ユーザー情報を更新しました');
        document.getElementById('edit-user-modal').classList.remove('show');
        this.editingUserId = null;
        await this.loadUsers();
      } else {
        this.showError(result.error || 'ユーザー情報の更新に失敗しました');
      }
    } catch (error) {
      console.error('ユーザー更新エラー:', error);
      this.showError('ユーザー情報の更新に失敗しました');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * ユーザー削除確認
   */
  async confirmDeleteUser(userId) {
    const user = this.users.find(u => u.id === userId);
    if (!user) return;

    const confirmed = confirm(`ユーザー「${user.name || user.email}」を削除してよろしいですか？\nこの操作は取り消せません。`);

    if (confirmed) {
      await this.deleteUser(userId);
    }
  }

  /**
   * ユーザー削除処理
   */
  async deleteUser(userId) {
    try {
      this.showLoading();

      const result = await supabaseClient.deleteUser(userId);

      if (result.success) {
        this.showSuccess('ユーザーを削除しました');
        await this.loadUsers();
      } else {
        this.showError(result.error || 'ユーザーの削除に失敗しました');
      }
    } catch (error) {
      console.error('ユーザー削除エラー:', error);
      this.showError('ユーザーの削除に失敗しました');
    } finally {
      this.hideLoading();
    }
  }

  /**
   * ローディング表示
   */
  showLoading() {
    // ローディングオーバーレイを表示
    let overlay = document.querySelector('.loading-overlay');
    if (!overlay) {
      overlay = document.createElement('div');
      overlay.className = 'loading-overlay';
      overlay.innerHTML = '<div class="spinner"></div>';
      document.body.appendChild(overlay);
    }
    overlay.style.display = 'flex';
  }

  /**
   * ローディング非表示
   */
  hideLoading() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
      overlay.style.display = 'none';
    }
  }

  /**
   * 成功メッセージ表示
   */
  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  /**
   * エラーメッセージ表示
   */
  showError(message) {
    this.showNotification(message, 'error');
  }

  /**
   * 通知メッセージ表示
   */
  showNotification(message, type = 'info') {
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.textContent = message;

    document.body.appendChild(notification);

    // アニメーション表示
    setTimeout(() => notification.classList.add('show'), 10);

    // 3秒後に自動削除
    setTimeout(() => {
      notification.classList.remove('show');
      setTimeout(() => notification.remove(), 300);
    }, 3000);
  }
}

// ページ読み込み時に初期化
let userManager;

document.addEventListener('DOMContentLoaded', () => {
  // Supabase SDK が読み込まれるまで待機
  const checkSupabase = setInterval(() => {
    if (window.supabase && window.supabaseClient) {
      clearInterval(checkSupabase);
      userManager = new UserManager();
    }
  }, 100);

  // 10秒でタイムアウト
  setTimeout(() => {
    clearInterval(checkSupabase);
    if (!userManager) {
      console.error('Supabase SDK の読み込みに失敗しました');
      alert('システムの初期化に失敗しました。ページを再読み込みしてください。');
    }
  }, 10000);
});