// お問い合わせページ専用JavaScript

document.addEventListener("DOMContentLoaded", function() {
  // メールリンクのクリックトラッキング（分析用）
  const emailLinks = document.querySelectorAll('a[href^="mailto:"]');
  emailLinks.forEach(link => {
    link.addEventListener('click', function() {
      console.log('Email contact initiated');
    });
  });

  // LINE友だち追加ボタンのトラッキング
  const lineButton = document.querySelector('a[href*="line.me"]');
  if (lineButton) {
    lineButton.addEventListener('click', function() {
      console.log('LINE contact initiated');
    });
  }

  // X（Twitter）フォローボタンのトラッキング
  const xButton = document.querySelector('a[href*="x.com"]');
  if (xButton) {
    xButton.addEventListener('click', function() {
      console.log('X (Twitter) contact initiated');
    });
  }

  // 地図プレースホルダーのクリックイベント（将来的にGoogle Maps等を実装）
  const mapPlaceholder = document.querySelector('.bg-gray-200');
  if (mapPlaceholder && mapPlaceholder.querySelector('.ri-map-2-line')) {
    mapPlaceholder.style.cursor = 'pointer';
    mapPlaceholder.addEventListener('click', function() {
      // 将来的にはGoogle Maps APIを使用して実際の地図を表示
      alert('地図機能は準備中です。\n住所: 東京都練馬区旭丘1-XX-XX');
    });
  }
});