/**
 * API設定
 * Terraformデプロイ後に実際のエンドポイントURLを設定してください
 */

// Dify API Proxy エンドポイント（Lambda経由）
// terraform output dify_proxy_api_endpoint で取得したURLを設定
window.DIFY_PROXY_ENDPOINT = 'https://wgoz4zndo3.execute-api.ap-northeast-1.amazonaws.com/prod/generate-article';

// Dify 画像分析 API Proxy エンドポイント（Lambda経由）
// terraform output dify_proxy_image_api_endpoint で取得したURLを設定
window.DIFY_IMAGE_PROXY_ENDPOINT = 'https://wgoz4zndo3.execute-api.ap-northeast-1.amazonaws.com/prod/analyze-image';

// 静的ページ生成 API エンドポイント（Lambda経由）
// spec.md 13章に基づき設定。実際のエンドポイントは環境に合わせて変更してください
window.PAGE_GENERATOR_ENDPOINT = 'https://api.asahigaoka-nerima.tokyo/api/generate/index';
