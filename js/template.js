// テンプレート用共通JavaScript

document.addEventListener("DOMContentLoaded", function () {
  // モバイルメニューの制御
  const mobileMenuBtn = document.getElementById("mobile-menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");
  
  if (mobileMenuBtn && mobileMenu) {
    mobileMenuBtn.addEventListener("click", function () {
      mobileMenu.classList.toggle("hidden");
    });
  }

  // AIチャットボットの制御
  const aiChatBtn = document.getElementById("ai-chat-btn");
  const aiChatWindow = document.getElementById("ai-chat-window");
  const closeChatBtn = document.getElementById("close-chat");
  const chatInput = document.getElementById("chat-input");
  const sendMessageBtn = document.getElementById("send-message");
  const chatMessages = document.getElementById("chat-messages");

  if (aiChatBtn && aiChatWindow) {
    aiChatBtn.addEventListener("click", function () {
      aiChatWindow.classList.toggle("hidden");
    });
  }

  if (closeChatBtn && aiChatWindow) {
    closeChatBtn.addEventListener("click", function () {
      aiChatWindow.classList.add("hidden");
    });
  }

  // メッセージ送信機能
  function sendMessage() {
    if (!chatInput || !chatMessages) return;
    
    const message = chatInput.value.trim();
    if (message) {
      // ユーザーメッセージを追加
      const userMessageDiv = document.createElement("div");
      userMessageDiv.className = "flex justify-end mb-4";
      userMessageDiv.innerHTML = `
        <div class="bg-primary text-white p-3 rounded-lg max-w-xs">
          <p class="text-sm">${escapeHtml(message)}</p>
        </div>
      `;
      chatMessages.appendChild(userMessageDiv);

      // AIの返信をシミュレート
      setTimeout(() => {
        const aiResponseDiv = document.createElement("div");
        aiResponseDiv.className = "flex items-start space-x-2 mb-4";
        aiResponseDiv.innerHTML = `
          <div class="w-8 h-8 flex items-center justify-center bg-primary/10 rounded-full flex-shrink-0">
            <i class="ri-robot-line text-primary text-sm"></i>
          </div>
          <div class="bg-gray-100 p-3 rounded-lg max-w-xs">
            <p class="text-sm">ご質問ありがとうございます。町会の活動についてお答えします。詳細は担当者にお繋ぎすることも可能です。</p>
          </div>
        `;
        chatMessages.appendChild(aiResponseDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
      }, 1000);

      chatInput.value = "";
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  }

  if (sendMessageBtn) {
    sendMessageBtn.addEventListener("click", sendMessage);
  }

  if (chatInput) {
    chatInput.addEventListener("keypress", function (e) {
      if (e.key === "Enter") {
        sendMessage();
      }
    });
  }

  // HTMLエスケープ関数
  function escapeHtml(text) {
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  // スムーススクロール
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      e.preventDefault();
      const target = document.querySelector(this.getAttribute('href'));
      if (target) {
        target.scrollIntoView({
          behavior: 'smooth',
          block: 'start'
        });
      }
    });
  });

  // 現在のページをナビゲーションでハイライト
  const currentPath = window.location.pathname.split('/').pop() || 'index.html';
  document.querySelectorAll('nav a').forEach(link => {
    if (link.getAttribute('href') === currentPath) {
      link.classList.add('text-primary');
      link.classList.remove('text-gray-700');
    }
  });
});