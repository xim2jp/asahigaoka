terraform {
  required_version = ">= 1.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

# 変数定義
variable "dify_api_key" {
  description = "Dify API Key for article generation"
  type        = string
  sensitive   = true
}

variable "dify_api_endpoint" {
  description = "Dify API endpoint URL"
  type        = string
  default     = "https://top-overly-pup.ngrok-free.app/v1/workflows/run"
}

variable "dify_api_key_image_analysis" {
  description = "Dify API Key for image analysis"
  type        = string
  sensitive   = true
}

provider "aws" {
  region = "ap-northeast-1"
}

provider "aws" {
  alias  = "us_east_1"
  region = "us-east-1"
}

locals {
  domain_name = "asahigaoka-nerima.tokyo"
  bucket_name = "asahigaoka-nerima-tokyo"
}

data "aws_route53_zone" "main" {
  name = local.domain_name
}

resource "aws_s3_bucket" "website" {
  bucket = local.bucket_name
}

resource "aws_s3_bucket_public_access_block" "website" {
  bucket = aws_s3_bucket.website.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_versioning" "website" {
  bucket = aws_s3_bucket.website.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_cloudfront_origin_access_control" "website" {
  name                              = "${local.bucket_name}-oac"
  description                       = "OAC for ${local.domain_name}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_acm_certificate" "website" {
  provider          = aws.us_east_1
  domain_name       = local.domain_name
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "certificate_validation" {
  for_each = {
    for dvo in aws_acm_certificate.website.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.main.zone_id
}

resource "aws_acm_certificate_validation" "website" {
  provider                = aws.us_east_1
  certificate_arn         = aws_acm_certificate.website.arn
  validation_record_fqdns = [for record in aws_route53_record.certificate_validation : record.fqdn]
}

resource "aws_cloudfront_distribution" "website" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  aliases             = [local.domain_name]
  price_class         = "PriceClass_200"

  origin {
    domain_name              = aws_s3_bucket.website.bucket_regional_domain_name
    origin_id                = "S3-${local.bucket_name}"
    origin_access_control_id = aws_cloudfront_origin_access_control.website.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-${local.bucket_name}"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
    compress               = true

  }

  custom_error_response {
    error_code         = 404
    response_code      = 404
    response_page_path = "/404.html"
  }

  custom_error_response {
    error_code         = 403
    response_code      = 404
    response_page_path = "/404.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate_validation.website.certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }

  depends_on = [aws_acm_certificate_validation.website]
}

resource "aws_s3_bucket_policy" "website" {
  bucket = aws_s3_bucket.website.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowCloudFrontServicePrincipal"
        Effect = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.website.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.website.arn
          }
        }
      }
    ]
  })
}

resource "aws_route53_record" "website" {
  zone_id = data.aws_route53_zone.main.zone_id
  name    = local.domain_name
  type    = "A"

  alias {
    name                   = aws_cloudfront_distribution.website.domain_name
    zone_id                = aws_cloudfront_distribution.website.hosted_zone_id
    evaluate_target_health = false
  }
}

output "s3_bucket_name" {
  value = aws_s3_bucket.website.id
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.website.id
}

output "cloudfront_domain_name" {
  value = aws_cloudfront_distribution.website.domain_name
}

output "website_url" {
  value = "https://${local.domain_name}"
}

# ===================================
# Dify API Proxy Lambda Function
# ===================================

# Lambda用IAMロール
resource "aws_iam_role" "dify_proxy_lambda" {
  name = "dify-proxy-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# CloudWatch Logs用のポリシーをアタッチ
resource "aws_iam_role_policy_attachment" "dify_proxy_lambda_logs" {
  role       = aws_iam_role.dify_proxy_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# S3書き込み権限をLambdaに追加
resource "aws_iam_role_policy" "dify_proxy_lambda_s3" {
  name = "dify-proxy-lambda-s3-policy"
  role = aws_iam_role.dify_proxy_lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:PutObject"
        ]
        Resource = "${aws_s3_bucket.website.arn}/images/news_images/*"
      }
    ]
  })
}

# Lambda関数用のZIPファイルを作成
data "archive_file" "dify_proxy_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/dify_proxy"
  output_path = "${path.module}/lambda/dify_proxy.zip"
}

# Lambda関数
resource "aws_lambda_function" "dify_proxy" {
  filename         = data.archive_file.dify_proxy_lambda.output_path
  function_name    = "dify-api-proxy"
  role             = aws_iam_role.dify_proxy_lambda.arn
  handler          = "lambda_function.lambda_handler"
  source_code_hash = data.archive_file.dify_proxy_lambda.output_base64sha256
  runtime          = "python3.11"
  timeout          = 30

  environment {
    variables = {
      DIFY_API_KEY      = var.dify_api_key
      DIFY_API_ENDPOINT = var.dify_api_endpoint
    }
  }
}

# CloudWatch Logsグループ
resource "aws_cloudwatch_log_group" "dify_proxy_lambda" {
  name              = "/aws/lambda/${aws_lambda_function.dify_proxy.function_name}"
  retention_in_days = 7
}

# API Gateway REST API
resource "aws_api_gateway_rest_api" "dify_proxy" {
  name        = "dify-proxy-api"
  description = "Dify API Proxy for article generation"
}

# API Gateway リソース（/generate-article）
resource "aws_api_gateway_resource" "generate_article" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  parent_id   = aws_api_gateway_rest_api.dify_proxy.root_resource_id
  path_part   = "generate-article"
}

# API Gateway メソッド（POST）
resource "aws_api_gateway_method" "generate_article_post" {
  rest_api_id   = aws_api_gateway_rest_api.dify_proxy.id
  resource_id   = aws_api_gateway_resource.generate_article.id
  http_method   = "POST"
  authorization = "NONE"
}

# API Gateway メソッド（OPTIONS - CORS用）
resource "aws_api_gateway_method" "generate_article_options" {
  rest_api_id   = aws_api_gateway_rest_api.dify_proxy.id
  resource_id   = aws_api_gateway_resource.generate_article.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# API Gateway 統合（POST）
resource "aws_api_gateway_integration" "generate_article_post" {
  rest_api_id             = aws_api_gateway_rest_api.dify_proxy.id
  resource_id             = aws_api_gateway_resource.generate_article.id
  http_method             = aws_api_gateway_method.generate_article_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.dify_proxy.invoke_arn
}

# API Gateway 統合（OPTIONS - CORS用）
resource "aws_api_gateway_integration" "generate_article_options" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  resource_id = aws_api_gateway_resource.generate_article.id
  http_method = aws_api_gateway_method.generate_article_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

# API Gateway メソッドレスポンス（OPTIONS）
resource "aws_api_gateway_method_response" "generate_article_options" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  resource_id = aws_api_gateway_resource.generate_article.id
  http_method = aws_api_gateway_method.generate_article_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

# API Gateway 統合レスポンス（OPTIONS）
resource "aws_api_gateway_integration_response" "generate_article_options" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  resource_id = aws_api_gateway_resource.generate_article.id
  http_method = aws_api_gateway_method.generate_article_options.http_method
  status_code = aws_api_gateway_method_response.generate_article_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.generate_article_options]
}

# Lambda実行許可（API Gatewayから）
resource "aws_lambda_permission" "api_gateway" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.dify_proxy.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.dify_proxy.execution_arn}/*/*"
}

# API Gateway ステージ
resource "aws_api_gateway_stage" "prod" {
  deployment_id = aws_api_gateway_deployment.dify_proxy_v3.id
  rest_api_id   = aws_api_gateway_rest_api.dify_proxy.id
  stage_name    = "prod"
}

# 出力：API Gateway エンドポイント
output "dify_proxy_api_endpoint" {
  value       = "${aws_api_gateway_stage.prod.invoke_url}/generate-article"
  description = "Dify Proxy API endpoint URL"
}

# ===================================
# Dify API Proxy Lambda Function (Image Analysis)
# ===================================

# Lambda関数用のZIPファイルを作成（画像分析用）
data "archive_file" "dify_proxy_image_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/dify_proxy_image"
  output_path = "${path.module}/lambda/dify_proxy_image.zip"
}

# Lambda関数（画像分析用）
resource "aws_lambda_function" "dify_proxy_image" {
  filename         = data.archive_file.dify_proxy_image_lambda.output_path
  function_name    = "dify-api-proxy-image"
  role             = aws_iam_role.dify_proxy_lambda.arn
  handler          = "lambda_function.lambda_handler"
  source_code_hash = data.archive_file.dify_proxy_image_lambda.output_base64sha256
  runtime          = "python3.11"
  timeout          = 60

  environment {
    variables = {
      DIFY_API_KEY      = var.dify_api_key_image_analysis
      DIFY_API_ENDPOINT = var.dify_api_endpoint
    }
  }
}

# CloudWatch Logsグループ（画像分析用）
resource "aws_cloudwatch_log_group" "dify_proxy_image_lambda" {
  name              = "/aws/lambda/${aws_lambda_function.dify_proxy_image.function_name}"
  retention_in_days = 7
}

# API Gateway リソース（/analyze-image）
resource "aws_api_gateway_resource" "analyze_image" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  parent_id   = aws_api_gateway_rest_api.dify_proxy.root_resource_id
  path_part   = "analyze-image"
}

# API Gateway メソッド（POST）
resource "aws_api_gateway_method" "analyze_image_post" {
  rest_api_id   = aws_api_gateway_rest_api.dify_proxy.id
  resource_id   = aws_api_gateway_resource.analyze_image.id
  http_method   = "POST"
  authorization = "NONE"
}

# API Gateway メソッド（OPTIONS - CORS用）
resource "aws_api_gateway_method" "analyze_image_options" {
  rest_api_id   = aws_api_gateway_rest_api.dify_proxy.id
  resource_id   = aws_api_gateway_resource.analyze_image.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# API Gateway 統合（POST）
resource "aws_api_gateway_integration" "analyze_image_post" {
  rest_api_id             = aws_api_gateway_rest_api.dify_proxy.id
  resource_id             = aws_api_gateway_resource.analyze_image.id
  http_method             = aws_api_gateway_method.analyze_image_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.dify_proxy_image.invoke_arn
}

# API Gateway 統合（OPTIONS - CORS用）
resource "aws_api_gateway_integration" "analyze_image_options" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  resource_id = aws_api_gateway_resource.analyze_image.id
  http_method = aws_api_gateway_method.analyze_image_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

# API Gateway メソッドレスポンス（OPTIONS）
resource "aws_api_gateway_method_response" "analyze_image_options" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  resource_id = aws_api_gateway_resource.analyze_image.id
  http_method = aws_api_gateway_method.analyze_image_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

# API Gateway 統合レスポンス（OPTIONS）
resource "aws_api_gateway_integration_response" "analyze_image_options" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  resource_id = aws_api_gateway_resource.analyze_image.id
  http_method = aws_api_gateway_method.analyze_image_options.http_method
  status_code = aws_api_gateway_method_response.analyze_image_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.analyze_image_options]
}

# Lambda実行許可（API Gatewayから - 画像分析用）
resource "aws_lambda_permission" "api_gateway_image" {
  statement_id  = "AllowAPIGatewayInvokeImage"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.dify_proxy_image.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.dify_proxy.execution_arn}/*/*"
}

# 出力：画像分析 API Gateway エンドポイント
output "dify_proxy_image_api_endpoint" {
  value       = "${aws_api_gateway_stage.prod.invoke_url}/analyze-image"
  description = "Dify Proxy API endpoint URL for image analysis"
}

# ===================================
# News Page Generator Lambda Function
# news.htmlを毎日更新してGitHubにプッシュ
# ===================================

variable "supabase_url" {
  description = "Supabase Project URL"
  type        = string
}

variable "supabase_anon_key" {
  description = "Supabase Anonymous Key"
  type        = string
  sensitive   = true
}

variable "github_token" {
  description = "GitHub Personal Access Token for pushing news.html"
  type        = string
  sensitive   = true
}

variable "github_repo" {
  description = "GitHub repository (owner/repo)"
  type        = string
  default     = "asahigaoka/asahigaoka"
}

variable "github_branch" {
  description = "GitHub branch to push to"
  type        = string
  default     = "main"
}

# Lambda用IAMロール（news page generator用）
resource "aws_iam_role" "news_page_generator_lambda" {
  name = "news-page-generator-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# CloudWatch Logs用のポリシーをアタッチ
resource "aws_iam_role_policy_attachment" "news_page_generator_lambda_logs" {
  role       = aws_iam_role.news_page_generator_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda関数用のZIPファイルを作成
data "archive_file" "news_page_generator_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/news_page_generator"
  output_path = "${path.module}/lambda/news_page_generator.zip"
}

# Lambda関数
resource "aws_lambda_function" "news_page_generator" {
  filename         = data.archive_file.news_page_generator_lambda.output_path
  function_name    = "news-page-generator"
  role             = aws_iam_role.news_page_generator_lambda.arn
  handler          = "lambda_function.lambda_handler"
  source_code_hash = data.archive_file.news_page_generator_lambda.output_base64sha256
  runtime          = "python3.11"
  timeout          = 60
  memory_size      = 256

  environment {
    variables = {
      SUPABASE_URL      = var.supabase_url
      SUPABASE_ANON_KEY = var.supabase_anon_key
      GITHUB_TOKEN      = var.github_token
      GITHUB_REPO       = var.github_repo
      GITHUB_BRANCH     = var.github_branch
    }
  }
}

# CloudWatch Logsグループ
resource "aws_cloudwatch_log_group" "news_page_generator_lambda" {
  name              = "/aws/lambda/${aws_lambda_function.news_page_generator.function_name}"
  retention_in_days = 14
}

# EventBridge スケジュールルール（日本時間 0:05 = UTC 15:05）
resource "aws_cloudwatch_event_rule" "news_page_generator_schedule" {
  name                = "news-page-generator-daily-schedule"
  description         = "Trigger news page generator Lambda daily at JST 00:05"
  schedule_expression = "cron(5 15 * * ? *)" # UTC 15:05 = JST 00:05
}

# EventBridge ターゲット
resource "aws_cloudwatch_event_target" "news_page_generator_target" {
  rule      = aws_cloudwatch_event_rule.news_page_generator_schedule.name
  target_id = "news-page-generator-lambda"
  arn       = aws_lambda_function.news_page_generator.arn
}

# Lambda実行許可（EventBridgeから）
resource "aws_lambda_permission" "news_page_generator_eventbridge" {
  statement_id  = "AllowExecutionFromEventBridge"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.news_page_generator.function_name
  principal     = "events.amazonaws.com"
  source_arn    = aws_cloudwatch_event_rule.news_page_generator_schedule.arn
}

# 出力：Lambda関数ARN
output "news_page_generator_lambda_arn" {
  value       = aws_lambda_function.news_page_generator.arn
  description = "News Page Generator Lambda function ARN"
}

# 出力：EventBridgeルール名
output "news_page_generator_schedule_rule" {
  value       = aws_cloudwatch_event_rule.news_page_generator_schedule.name
  description = "EventBridge schedule rule name"
}

# ===================================
# News Detail Page Generator Lambda Function
# 記事詳細ページを生成してGitHubにプッシュ
# ===================================

# Lambda関数用のZIPファイルを作成
data "archive_file" "news_detail_page_generator_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/news_detail_page_generator"
  output_path = "${path.module}/lambda/news_detail_page_generator.zip"
}

# Lambda関数
resource "aws_lambda_function" "news_detail_page_generator" {
  filename         = data.archive_file.news_detail_page_generator_lambda.output_path
  function_name    = "news-detail-page-generator"
  role             = aws_iam_role.news_page_generator_lambda.arn # 既存のロールを再利用
  handler          = "lambda_function.lambda_handler"
  source_code_hash = data.archive_file.news_detail_page_generator_lambda.output_base64sha256
  runtime          = "python3.11"
  timeout          = 60
  memory_size      = 256

  environment {
    variables = {
      SUPABASE_URL      = var.supabase_url
      SUPABASE_ANON_KEY = var.supabase_anon_key
      GITHUB_TOKEN      = var.github_token
      GITHUB_REPO       = var.github_repo
      GITHUB_BRANCH     = var.github_branch
    }
  }
}

# CloudWatch Logsグループ
resource "aws_cloudwatch_log_group" "news_detail_page_generator_lambda" {
  name              = "/aws/lambda/${aws_lambda_function.news_detail_page_generator.function_name}"
  retention_in_days = 14
}

# API Gateway リソース（/generate-detail-page）
resource "aws_api_gateway_resource" "generate_detail_page" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  parent_id   = aws_api_gateway_rest_api.dify_proxy.root_resource_id
  path_part   = "generate-detail-page"
}

# API Gateway メソッド（POST）
resource "aws_api_gateway_method" "generate_detail_page_post" {
  rest_api_id   = aws_api_gateway_rest_api.dify_proxy.id
  resource_id   = aws_api_gateway_resource.generate_detail_page.id
  http_method   = "POST"
  authorization = "NONE"
}

# API Gateway メソッド（OPTIONS - CORS用）
resource "aws_api_gateway_method" "generate_detail_page_options" {
  rest_api_id   = aws_api_gateway_rest_api.dify_proxy.id
  resource_id   = aws_api_gateway_resource.generate_detail_page.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# API Gateway 統合（POST）
resource "aws_api_gateway_integration" "generate_detail_page_post" {
  rest_api_id             = aws_api_gateway_rest_api.dify_proxy.id
  resource_id             = aws_api_gateway_resource.generate_detail_page.id
  http_method             = aws_api_gateway_method.generate_detail_page_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.news_detail_page_generator.invoke_arn
}

# API Gateway 統合（OPTIONS - CORS用）
resource "aws_api_gateway_integration" "generate_detail_page_options" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  resource_id = aws_api_gateway_resource.generate_detail_page.id
  http_method = aws_api_gateway_method.generate_detail_page_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

# API Gateway メソッドレスポンス（OPTIONS）
resource "aws_api_gateway_method_response" "generate_detail_page_options" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  resource_id = aws_api_gateway_resource.generate_detail_page.id
  http_method = aws_api_gateway_method.generate_detail_page_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

# API Gateway 統合レスポンス（OPTIONS）
resource "aws_api_gateway_integration_response" "generate_detail_page_options" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  resource_id = aws_api_gateway_resource.generate_detail_page.id
  http_method = aws_api_gateway_method.generate_detail_page_options.http_method
  status_code = aws_api_gateway_method_response.generate_detail_page_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.generate_detail_page_options]
}

# Lambda実行許可（API Gatewayから）
resource "aws_lambda_permission" "api_gateway_detail_page" {
  statement_id  = "AllowAPIGatewayInvokeDetailPage"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.news_detail_page_generator.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.dify_proxy.execution_arn}/*/*"
}

# デプロイメントトリガーを更新（LINE Webhookエンドポイント追加）
resource "aws_api_gateway_deployment" "dify_proxy_v3" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id

  triggers = {
    redeployment = sha1(jsonencode([
      aws_api_gateway_resource.generate_article.id,
      aws_api_gateway_method.generate_article_post.id,
      aws_api_gateway_integration.generate_article_post.id,
      aws_api_gateway_resource.analyze_image.id,
      aws_api_gateway_method.analyze_image_post.id,
      aws_api_gateway_integration.analyze_image_post.id,
      aws_api_gateway_resource.generate_detail_page.id,
      aws_api_gateway_method.generate_detail_page_post.id,
      aws_api_gateway_integration.generate_detail_page_post.id,
      aws_api_gateway_resource.line_webhook.id,
      aws_api_gateway_method.line_webhook_post.id,
      aws_api_gateway_integration.line_webhook_post.id,
      timestamp()
    ]))
  }

  lifecycle {
    create_before_destroy = true
  }

  depends_on = [
    aws_api_gateway_integration.generate_article_post,
    aws_api_gateway_integration.generate_article_options,
    aws_api_gateway_integration.analyze_image_post,
    aws_api_gateway_integration.analyze_image_options,
    aws_api_gateway_integration.generate_detail_page_post,
    aws_api_gateway_integration.generate_detail_page_options,
    aws_api_gateway_integration.line_webhook_post,
    aws_api_gateway_integration.line_webhook_options
  ]
}

# 出力：詳細ページ生成 API Gateway エンドポイント
output "news_detail_page_generator_api_endpoint" {
  value       = "${aws_api_gateway_stage.prod.invoke_url}/generate-detail-page"
  description = "News Detail Page Generator API endpoint URL"
}

# 出力：Lambda関数ARN
output "news_detail_page_generator_lambda_arn" {
  value       = aws_lambda_function.news_detail_page_generator.arn
  description = "News Detail Page Generator Lambda function ARN"
}

# ===================================
# LINE Webhook Lambda Function
# LINE AIチャット（Dify連携）
# 環境変数はAWSコンソールで手動設定
# ===================================

# Lambda用IAMロール（LINE Webhook用）
resource "aws_iam_role" "line_webhook_lambda" {
  name = "line-webhook-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# CloudWatch Logs用のポリシーをアタッチ
resource "aws_iam_role_policy_attachment" "line_webhook_lambda_logs" {
  role       = aws_iam_role.line_webhook_lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda関数用のZIPファイルを作成
data "archive_file" "line_webhook_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/line_webhook"
  output_path = "${path.module}/lambda/line_webhook.zip"
}

# Lambda関数
resource "aws_lambda_function" "line_webhook" {
  filename         = data.archive_file.line_webhook_lambda.output_path
  function_name    = "asahigaoka-line-webhook"
  role             = aws_iam_role.line_webhook_lambda.arn
  handler          = "lambda_function.lambda_handler"
  source_code_hash = data.archive_file.line_webhook_lambda.output_base64sha256
  runtime          = "python3.11"
  timeout          = 30
  memory_size      = 256

  environment {
    variables = {
      # 初回デプロイ用のプレースホルダー
      # 実際の値はAWSコンソールで設定
      LINE_CHANNEL_SECRET       = "SET_IN_AWS_CONSOLE"
      LINE_CHANNEL_ACCESS_TOKEN = "SET_IN_AWS_CONSOLE"
      DIFY_API_KEY              = "SET_IN_AWS_CONSOLE"
      DIFY_API_ENDPOINT         = "http://top-overly-pup.ngrok-free.app/v1/chat-messages"
      SUPABASE_URL              = var.supabase_url
      SUPABASE_KEY              = var.supabase_anon_key
    }
  }

  # AWSコンソールで設定した環境変数をTerraformで上書きしない
  lifecycle {
    ignore_changes = [environment]
  }
}

# CloudWatch Logsグループ
resource "aws_cloudwatch_log_group" "line_webhook_lambda" {
  name              = "/aws/lambda/${aws_lambda_function.line_webhook.function_name}"
  retention_in_days = 14
}

# API Gateway リソース（/line-webhook）
resource "aws_api_gateway_resource" "line_webhook" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  parent_id   = aws_api_gateway_rest_api.dify_proxy.root_resource_id
  path_part   = "line-webhook"
}

# API Gateway メソッド（POST）
resource "aws_api_gateway_method" "line_webhook_post" {
  rest_api_id   = aws_api_gateway_rest_api.dify_proxy.id
  resource_id   = aws_api_gateway_resource.line_webhook.id
  http_method   = "POST"
  authorization = "NONE"
}

# API Gateway メソッド（OPTIONS - CORS用）
resource "aws_api_gateway_method" "line_webhook_options" {
  rest_api_id   = aws_api_gateway_rest_api.dify_proxy.id
  resource_id   = aws_api_gateway_resource.line_webhook.id
  http_method   = "OPTIONS"
  authorization = "NONE"
}

# API Gateway 統合（POST）
resource "aws_api_gateway_integration" "line_webhook_post" {
  rest_api_id             = aws_api_gateway_rest_api.dify_proxy.id
  resource_id             = aws_api_gateway_resource.line_webhook.id
  http_method             = aws_api_gateway_method.line_webhook_post.http_method
  integration_http_method = "POST"
  type                    = "AWS_PROXY"
  uri                     = aws_lambda_function.line_webhook.invoke_arn
}

# API Gateway 統合（OPTIONS - CORS用）
resource "aws_api_gateway_integration" "line_webhook_options" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  resource_id = aws_api_gateway_resource.line_webhook.id
  http_method = aws_api_gateway_method.line_webhook_options.http_method
  type        = "MOCK"

  request_templates = {
    "application/json" = "{\"statusCode\": 200}"
  }
}

# API Gateway メソッドレスポンス（OPTIONS）
resource "aws_api_gateway_method_response" "line_webhook_options" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  resource_id = aws_api_gateway_resource.line_webhook.id
  http_method = aws_api_gateway_method.line_webhook_options.http_method
  status_code = "200"

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = true
    "method.response.header.Access-Control-Allow-Methods" = true
    "method.response.header.Access-Control-Allow-Origin"  = true
  }
}

# API Gateway 統合レスポンス（OPTIONS）
resource "aws_api_gateway_integration_response" "line_webhook_options" {
  rest_api_id = aws_api_gateway_rest_api.dify_proxy.id
  resource_id = aws_api_gateway_resource.line_webhook.id
  http_method = aws_api_gateway_method.line_webhook_options.http_method
  status_code = aws_api_gateway_method_response.line_webhook_options.status_code

  response_parameters = {
    "method.response.header.Access-Control-Allow-Headers" = "'Content-Type,X-Line-Signature'"
    "method.response.header.Access-Control-Allow-Methods" = "'POST,OPTIONS'"
    "method.response.header.Access-Control-Allow-Origin"  = "'*'"
  }

  depends_on = [aws_api_gateway_integration.line_webhook_options]
}

# Lambda実行許可（API Gatewayから）
resource "aws_lambda_permission" "api_gateway_line_webhook" {
  statement_id  = "AllowAPIGatewayInvokeLineWebhook"
  action        = "lambda:InvokeFunction"
  function_name = aws_lambda_function.line_webhook.function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_api_gateway_rest_api.dify_proxy.execution_arn}/*/*"
}

# 出力：LINE Webhook API Gateway エンドポイント
output "line_webhook_api_endpoint" {
  value       = "${aws_api_gateway_stage.prod.invoke_url}/line-webhook"
  description = "LINE Webhook API endpoint URL"
}

# 出力：Lambda関数ARN
output "line_webhook_lambda_arn" {
  value       = aws_lambda_function.line_webhook.arn
  description = "LINE Webhook Lambda function ARN"
}
