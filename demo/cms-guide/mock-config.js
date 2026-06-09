/**
 * デモ録画用モック設定
 * AI生成・SNS投稿などの外部エンドポイントを「インターセプト可能なダミーURL」に向ける。
 * 実際のレスポンスは Playwright の page.route() でモックする。
 */
window.DIFY_PROXY_ENDPOINT = 'https://demo.invalid/generate-article';
window.DIFY_IMAGE_PROXY_ENDPOINT = 'https://demo.invalid/analyze-image';
window.PAGE_GENERATOR_ENDPOINT = 'https://demo.invalid/generate/index';
window.X_POST_ENDPOINT = 'https://demo.invalid/x-post';
window.LINE_BROADCAST_ENDPOINT = 'https://demo.invalid/line-broadcast';
window.DETAIL_PAGE_GENERATOR_ENDPOINT = 'https://demo.invalid/generate-detail-page';
