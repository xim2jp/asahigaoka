/**
 * API設定
 * Terraformデプロイ後に実際のエンドポイントURLを設定してください
 */

// Dify API Proxy エンドポイント（Lambda経由）
// terraform output dify_proxy_api_endpoint で取得したURLを設定
window.DIFY_PROXY_ENDPOINT = 'https://wgoz4zndo3.execute-api.ap-northeast-1.amazonaws.com/prod/generate-article';
